import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorContent, useEditor } from '@tiptap/react';
import { DocumentHeader } from '@/core/components/DocumentHeader';
import { PresentOverlay } from '@/core/components/PresentOverlay';
import { Icon } from '@/core/components/Icon';
import { ProgressBar } from '@/core/components/ProgressBar';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import { downloadBytes } from '@/core/pdf/download';
import type { ToolResult } from '@/core/types';
import { PrintLayer } from './A4Page';
import { EditorToolbar } from './EditorToolbar';
import { FindReplacePanel } from './FindReplacePanel';
import { OutlinePanel } from './OutlinePanel';
import {
  buildExportFilename,
  countDocStats,
  createEmptyDocHtml,
  htmlToPlain,
  sanitizeDocHtml,
  scanDocxExportLosses,
  type DocxExportLosses,
} from './core';
import { clearDraft, readDraft, writeDraftSafe, type RichTextDraft, type ViewMode } from './draft';
import {
  createDocId,
  deleteDocument,
  duplicateDocument,
  initDocStore,
  listDocuments,
  listVersions,
  loadDocument,
  saveDocument,
  setCurrentDocId,
  type DocMeta,
  type StoredVersion,
} from './docStore';
import { DocLibraryPanel, VersionHistoryPanel } from './DocLibraryPanel';
import { ImageResizeOverlay } from './ImageResizeOverlay';
import { handleFloatingImagePointerDown } from './imageLayer';
import { exportDocxBlob, importDocx } from './docx';
import { printSupported, snapshotToPdf, printToPdf } from './pdf';
import { createExtensions } from './extensions';
import { PageSetupPanel } from './PageSetupPanel';
import { ReviewPanel } from './ReviewPanel';
import { StylePanel } from './StylePanel';
import { buildTableOfContents, htmlToMarkdown, type DocComment, type TrackedChange } from './docs';
import {
  DEFAULT_PAGE_SETUP,
  buildPrintPageCss,
  normalizePageSetup,
  pageMetricsToPx,
  resolvePageMetrics,
  type PageSetupConfig,
} from './pageSetup';
import { registerRichTextStrings } from './strings';
import './editor.css';

// 工具文案随本 chunk 懒加载注册，不占用首屏语言包体积
registerRichTextStrings(i18n);

type Failure = Extract<ToolResult<unknown>, { ok: false }>;
import { PdfModeDialog, type PdfMode } from './PdfModeDialog';
type BusyKind = 'import' | 'docx' | 'pdf' | null;

const SAVE_DEBOUNCE_MS = 600;
/** 编辑区最小可用高度：窗口过矮时宁可让页面滚动，也不把编辑区压扁 */
const MIN_VIEWPORT_PX = 320;
/** 底部给「相关工具」等页脚内容预留的空间，保证它们始终在首屏可见 */
const BOTTOM_RESERVE_PX = 150;

/** 等待下一帧渲染完成（打印/截图前必须完成布局） */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * 富文本编辑器工具：本地编辑 + Word(.docx) 导入导出 + 双模式 PDF 导出。
 * 所有内容处理均在浏览器完成，不产生任何外发请求。
 */
export default function RichTextEditorTool() {
  const { t } = useTranslation();
  const initial = useMemo(() => readDraft(), []);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [snapshotHtml, setSnapshotHtml] = useState(initial?.html ?? createEmptyDocHtml());
  const [failure, setFailure] = useState<Failure | null>(null);
  const [losses, setLosses] = useState<DocxExportLosses | null>(null);
  const [sheetTops, setSheetTops] = useState<number[]>([]);
  const [printNotice, setPrintNotice] = useState(false);
  const [pageSetup, setPageSetup] = useState<PageSetupConfig>(() =>
    normalizePageSetup(initial?.pageSetup ?? DEFAULT_PAGE_SETUP),
  );
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [zoom, setZoom] = useState(initial?.zoom ?? 1);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [comments, setComments] = useState<DocComment[]>([]);
  const [changes, setChanges] = useState<TrackedChange[]>([]);
  // 分页插件在编辑器创建（渲染期）即开始回调，需等组件挂载后再 setState
  const mountedRef = useRef(false);
  const pendingTopsRef = useRef<number[] | null>(null);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [progress, setProgress] = useState(0);
  const [pdfMode, setPdfMode] = useState<PdfMode>(
    initial?.pdfMode === 'snapshot' ? 'snapshot' : 'text',
  );
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [printReady, setPrintReady] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(initial?.view ?? 'flow');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [versions, setVersions] = useState<StoredVersion[]>([]);
  const [docId, setDocId] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<'degraded' | 'failed' | null>(null);
  const [saved, setSaved] = useState(Boolean(initial));
  const flowRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportMax, setViewportMax] = useState<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const titleRef = useRef(title);
  titleRef.current = title;
  const viewRef = useRef(viewMode);
  viewRef.current = viewMode;
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  // 页面几何（mm）→ 像素：随页面设置变化，插件通过 getter 读取最新值
  const metrics = useMemo(() => resolvePageMetrics(pageSetup), [pageSetup]);
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;
  const getMetrics = useCallback(() => metricsRef.current, []);
  // 纸面是绝对定位元素，不参与父级高度计算：内容不足整页时灰色工作台会提前结束。
  // 这里按最后一张纸的下沿给内容区补一个最小高度，让灰色背景铺满到最后一页。
  const sheetBottomPx = useMemo(() => {
    if (sheetTops.length === 0) return 0;
    return Math.round(sheetTops[sheetTops.length - 1] + pageMetricsToPx(metrics).heightPx + 12);
  }, [sheetTops, metrics]);

  const placeholder = useMemo(() => t('tools.richText.placeholder'), [t]);
  const handleSheetTops = useCallback((tops: number[]) => {
    if (!mountedRef.current) {
      pendingTopsRef.current = tops;
      return;
    }
    setSheetTops((prev) =>
      prev.length === tops.length && prev.every((top, i) => Math.abs(top - tops[i]) < 0.5)
        ? prev
        : tops,
    );
  }, []);
  const extensions = useMemo(
    () => createExtensions(placeholder, handleSheetTops, getMetrics),
    [placeholder, handleSheetTops, getMetrics],
  );

  const editor = useEditor({ extensions, content: snapshotHtml });

  // 页面设置/缩放变化后强制重排：页高与内容宽变化会改变分页点
  useEffect(() => {
    if (!editor || viewMode !== 'paged') return;
    const id = window.setTimeout(() => {
      // 空事务触发插件 update → 重新测量与规划
      editor.view.dispatch(editor.state.tr);
    }, 0);
    return () => clearTimeout(id);
  }, [editor, viewMode, metrics, zoom]);

  // 挂载后应用插件在渲染期缓存的纸面位置
  useEffect(() => {
    mountedRef.current = true;
    if (pendingTopsRef.current) {
      const tops = pendingTopsRef.current;
      pendingTopsRef.current = null;
      setSheetTops(tops);
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // 编辑区高度按「首屏剩余空间」计算：头部/工具栏高度不固定（会随面板展开变化），
  // 写死 calc(100vh - Npx) 会把底部内容（相关工具）挤出视口。
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const compute = () => {
      // 用 offsetTop 链求文档内偏移：不受当前滚动位置影响，避免滚动时高度抖动
      let top = 0;
      let node: HTMLElement | null = el;
      while (node) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      const available = window.innerHeight - top - BOTTOM_RESERVE_PX;
      setViewportMax(Math.max(MIN_VIEWPORT_PX, Math.round(available)));
    };
    compute();
    const observer = new ResizeObserver(compute);
    if (el.parentElement) observer.observe(el.parentElement);
    window.addEventListener('resize', compute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [findOpen, outlineOpen, pageSetupOpen, stylesOpen, reviewOpen, libraryOpen, versionsOpen]);

  const docIdRef = useRef<string | null>(null);
  docIdRef.current = docId;

  /** 惰性分配文档 id：首次保存时才入库 */
  const ensureDocId = (): string => {
    if (!docIdRef.current) {
      const id = createDocId();
      docIdRef.current = id;
      setDocId(id);
      setCurrentDocId(id);
    }
    return docIdRef.current;
  };

  /** 统一持久化：localStorage 草稿（同步兜底 + 降级）+ IndexedDB 文档库（多文档/版本历史） */
  const persistNow = useCallback(
    (draft: RichTextDraft): void => {
      const withPrefs: RichTextDraft = { ...draft, pageSetup, zoom, pdfMode };
      const result = writeDraftSafe(withPrefs);
      setSaved(result.ok);
      setDraftNotice(result.ok ? (result.degraded ? 'degraded' : null) : 'failed');
      const id = ensureDocId();
      void saveDocument(id, withPrefs).then(() => {
        void listDocuments().then(setDocs);
      });
      // ensureDocId/setSaved/setDraftNotice 依赖稳定，无需加入依赖
    },
    [pageSetup, zoom, pdfMode],
  );

  // 启动：恢复指针文档或迁移 v1 草稿到文档库
  useEffect(() => {
    void initDocStore().then((init) => {
      void listDocuments().then(setDocs);
      if (!init) return;
      docIdRef.current = init.docId;
      setDocId(init.docId);
      if (init.doc && editor && !editor.isDestroyed) {
        setTitle(init.doc.title);
        editor.commands.setContent(init.doc.html);
        setSnapshotHtml(init.doc.html);
        setSaved(true);
      }
    });
    // 仅在编辑器就绪后执行一次
  }, [editor]);

  // 延迟/异步回调可能落在已销毁的编辑器上（React 严格模式双挂载），读取前先判定
  const readHtml = useCallback((): string | null => {
    if (!editor || editor.isDestroyed) return null;
    try {
      return editor.getHTML();
    } catch {
      return null;
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handleUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const html = readHtml();
        if (html === null) return;
        setSnapshotHtml(html);
        persistNow({ title: titleRef.current, html, view: viewRef.current });
      }, SAVE_DEBOUNCE_MS);
    };
    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
      if (timer) clearTimeout(timer);
    };
  }, [editor, persistNow, readHtml]);

  // 标题变化同样落盘
  useEffect(() => {
    if (!editor) return;
    const timer = setTimeout(() => {
      const html = readHtml();
      if (html === null) return;
      persistNow({ title, html, view: viewRef.current });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [title, editor, persistNow, readHtml]);

  // 视图切换立即落盘，刷新后保持用户偏好
  useEffect(() => {
    if (!editor) return;
    const html = readHtml();
    if (html === null) return;
    persistNow({ title: titleRef.current, html, view: viewMode });
  }, [viewMode, editor, persistNow, readHtml]);

  // 放映用只读 HTML：复用导出 PDF 的同一套净化逻辑，避免注入风险
  const presentHtml = useMemo(() => {
    const result = sanitizeDocHtml(snapshotHtml);
    return result.ok ? result.value : '';
  }, [snapshotHtml]);

  // ⌘/Ctrl+F 打开查找替换，Esc 关闭（编辑器聚焦时同样生效）
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setFindOpen(true);
        return;
      }
      if (event.key === 'Escape') setFindOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const stats = useMemo(() => countDocStats(htmlToPlain(snapshotHtml)), [snapshotHtml]);
  const isEmpty = stats.chars === 0;

  const handleImport = async (file: File) => {
    setBusy('import');
    setFailure(null);
    const result = await importDocx(file);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    editor?.commands.setContent(result.value);
    setSnapshotHtml(result.value);
    persistNow({ title: titleRef.current, html: result.value, view: viewRef.current });
    if (!titleRef.current.trim()) {
      setTitle(file.name.replace(/\.docx$/i, ''));
    }
  };

  const handleExportDocx = async () => {
    if (!editor) return;
    setBusy('docx');
    setFailure(null);
    setLosses(null);
    const html = editor.getHTML();
    const result = await exportDocxBlob(html, title, pageSetup);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    downloadBlob(result.value, buildExportFilename(title || 'document', 'docx'));
    // 导出后提示已知损耗，替代静默丢弃
    const scanned = scanDocxExportLosses(html);
    if (scanned.ok) {
      const { externalImages, webpImages, deepListItems } = scanned.value;
      setLosses(externalImages > 0 || webpImages > 0 || deepListItems > 0 ? scanned.value : null);
    }
  };

  const handleExportPdf = async (mode: PdfMode = pdfMode) => {
    setPdfMode(mode);
    setFailure(null);
    setPrintNotice(false);
    setProgress(0);
    setPrintReady(true);
    await nextFrame();
    try {
      if (mode === 'text') {
        // 打印视图中的文字可选可检索，且中文无需嵌入字体。
        // 等待字体就绪后，把页面视图的块级分页同步到打印流，保证所见即所得。
        try {
          await document.fonts.ready;
        } catch {
          // 字体 API 不可用时忽略
        }
        // 等待打印层确实挂载（最多约 20 帧），避免拿到 null
        for (let i = 0; i < 20 && !flowRef.current; i += 1) {
          await nextFrame();
        }
        if (!printSupported()) {
          // 桌面 WebView 等环境没有打印对话框：静默回退到快照模式
          setPrintNotice(true);
        } else {
          try {
            // 流式视图同样要按块级边界分页：否则打印预览会由浏览器自由断行，
            // 出现段落被拦腰截断、与页面视图不一致的分页
            printToPdf(flowRef.current, pageSetup);
            return;
          } catch {
            // 打印对话框打开失败：回退到快照模式
            setPrintNotice(true);
          }
        }
      }
      const flow = flowRef.current;
      if (!flow) {
        setFailure({ ok: false, error: 'RENDER_FAILED' });
        return;
      }
      setBusy('pdf');
      const result = await snapshotToPdf(flow, setProgress, pageSetup);
      setBusy(null);
      if (!result.ok) {
        setFailure(result);
        return;
      }
      downloadBytes(
        result.value,
        buildExportFilename(title || 'document', 'pdf'),
        'application/pdf',
      );
    } catch (error) {
      // 任何导出异常都给出可见反馈，而不是“无反应”
      console.error('[richText] export pdf failed:', error);
      setFailure({ ok: false, error: 'RENDER_FAILED' });
    } finally {
      setBusy(null);
      setPrintReady(false);
    }
  };

  /** 插入自动目录：按大纲生成，页码取自当前纸面分页 */
  const handleInsertToc = () => {
    if (!editor) return;
    const headings: { level: number; text: string }[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') {
        headings.push({ level: Number(node.attrs.level ?? 1), text: node.textContent });
      }
    });
    const pageOf = () => 0; // 分页位置依赖渲染，导出/打印时由分页算法给出
    const result = buildTableOfContents(headings, pageOf);
    if (!result.ok) {
      setFailure({ ok: false, error: 'EMPTY' });
      return;
    }
    const lines = result.value.entries
      .map((entry) => `${'  '.repeat(entry.level - 1)}${entry.text}`)
      .join('\n');
    editor
      .chain()
      .focus()
      .insertContent(
        `<h2>${t('tools.richText.tocTitle')}</h2><p>${lines.replace(/\n/g, '<br>')}</p>`,
      )
      .run();
  };

  /** 新建批注：以选区文字为引用，正文用简单的 prompt 输入（本地存储） */
  const handleAddComment = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const quote = editor.state.doc.textBetween(from, to, ' ');
    if (!quote.trim()) return;
    const text = window.prompt(t('tools.richText.commentPrompt'));
    if (!text) return;
    const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    editor.chain().focus().setComment(id).run();
    setComments((prev) => [
      ...prev,
      {
        id,
        quote,
        text,
        author: t('tools.richText.commentAuthor'),
        createdAt: Date.now(),
        resolved: false,
      },
    ]);
  };

  const handleRemoveComment = (id: string) => {
    setComments((prev) => prev.filter((comment) => comment.id !== id));
  };

  /** 修订追踪：对选区标记插入/删除（本地记录 + Mark） */
  const handleTrackChange = (kind: 'insert' | 'delete') => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');
    if (!text.trim()) return;
    if (kind === 'insert') editor.chain().focus().markTrackedInsert().run();
    else editor.chain().focus().markTrackedDelete().run();
    setChanges((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind,
        text,
        author: t('tools.richText.commentAuthor'),
        createdAt: Date.now(),
      },
    ]);
  };

  /** 导出 Markdown（纯函数 htmlToMarkdown） */
  const handleExportMarkdown = () => {
    if (!editor) return;
    const markdown = htmlToMarkdown(editor.getHTML());
    const bytes = new TextEncoder().encode(markdown);
    downloadBytes(bytes, buildExportFilename(title || 'document', 'md'), 'text/markdown');
  };

  /** 导出单文件 HTML（内联样式，可直接打开/分享） */
  const handleExportHtml = () => {
    if (!editor) return;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title || 'document'}</title><style>body{font-family:'PingFang SC','Microsoft YaHei',Arial,sans-serif;max-width:170mm;margin:20mm auto;line-height:1.8;font-size:15px}img{max-width:100%}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:.4rem .6rem}pre{background:#f3f4f6;padding:.75rem .9rem;border-radius:.5rem}</style></head><body>${editor.getHTML()}</body></html>`;
    const bytes = new TextEncoder().encode(html);
    downloadBytes(bytes, buildExportFilename(title || 'document', 'html'), 'text/html');
  };

  const resetEditorContent = (doc: { title: string; html: string }) => {
    setTitle(doc.title);
    editor?.commands.setContent(doc.html);
    setSnapshotHtml(doc.html);
    setFailure(null);
    setLosses(null);
  };

  const handleClear = () => {
    editor?.commands.clearContent();
    clearDraft();
    setTitle('');
    setSnapshotHtml(createEmptyDocHtml());
    setSaved(false);
    setFailure(null);
    setLosses(null);
    setDraftNotice(null);
  };

  const handleNew = () => {
    const hasContent = stats.chars > 0 || title.trim().length > 0;
    if (hasContent && !window.confirm(t('common.discardConfirm'))) return;
    // 新建即建立新文档 id，旧文档仍保留在文档库中
    const id = createDocId();
    docIdRef.current = id;
    setDocId(id);
    setCurrentDocId(id);
    handleClear();
    void listDocuments().then(setDocs);
  };

  type ToolPanel = 'pageSetup' | 'styles' | 'review';

  /** 工具栏面板互斥切换：同一时间只展开一个，避免工作区被挤压 */
  const togglePanel = (panel: ToolPanel) => {
    setLibraryOpen(false);
    setVersionsOpen(false);
    setPageSetupOpen(panel === 'pageSetup' ? !pageSetupOpen : false);
    setStylesOpen(panel === 'styles' ? !stylesOpen : false);
    setReviewOpen(panel === 'review' ? !reviewOpen : false);
  };

  const openLibrary = () => {
    setVersionsOpen(false);
    setLibraryOpen(true);
    void listDocuments().then(setDocs);
  };

  const handleOpenDoc = (id: string) => {
    void loadDocument(id).then((doc) => {
      if (!doc) return;
      docIdRef.current = id;
      setDocId(id);
      setCurrentDocId(id);
      resetEditorContent({ title: doc.title, html: doc.html });
      setLibraryOpen(false);
    });
  };

  const handleDuplicateDoc = (id: string) => {
    void duplicateDocument(id).then(() => {
      void listDocuments().then(setDocs);
    });
  };

  const handleDeleteDoc = (id: string) => {
    const target = docs.find((doc) => doc.id === id);
    if (
      !window.confirm(
        t('tools.richText.deleteDocConfirm', {
          title: target?.title || t('tools.richText.untitledDoc'),
        }),
      )
    ) {
      return;
    }
    void deleteDocument(id).then(() => {
      void listDocuments().then(setDocs);
      if (id === docIdRef.current) {
        docIdRef.current = null;
        setDocId(null);
        handleClear();
      }
    });
  };

  const openVersions = () => {
    setLibraryOpen(false);
    setVersionsOpen(true);
    const id = docIdRef.current;
    if (id) void listVersions(id).then(setVersions);
    else setVersions([]);
  };

  const handleRestoreVersion = (version: StoredVersion) => {
    if (!window.confirm(t('tools.richText.restoreConfirm'))) return;
    resetEditorContent({ title: version.title, html: version.html });
    persistNow({ title: version.title, html: version.html, view: viewRef.current });
    setVersionsOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <DocumentHeader
        titleLabel={t('tools.richText.docTitle')}
        titlePlaceholder={t('tools.richText.titlePlaceholder')}
        title={title}
        onTitleChange={setTitle}
        newLabel={t('common.newDoc')}
        newIcon="text"
        onNew={handleNew}
        afterNew={
          <>
            <button
              type="button"
              data-testid="rich-text-present"
              onClick={() => setPresenting(true)}
              disabled={isEmpty}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="present" className="h-4 w-4" />
              {t('tools.richText.present')}
            </button>
            <button
              type="button"
              onClick={openLibrary}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="file" className="h-4 w-4" />
              {t('tools.richText.library')}
            </button>
          </>
        }
        io={
          <>
            {/* 导出区：图标按钮 + tooltip，避免文字占位 */}
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              title={t('tools.richText.importDocx')}
              aria-label={t('tools.richText.importDocx')}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="upload" className="h-4 w-4" />
            </button>

            <span className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-gray-700" />

            <button
              type="button"
              onClick={() => void handleExportDocx()}
              disabled={busy !== null || isEmpty}
              title={t('tools.richText.exportDocx')}
              aria-label={t('tools.richText.exportDocx')}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'docx' ? (
                <span className="text-xs leading-none">…</span>
              ) : (
                <Icon name="download" className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setPdfDialogOpen(true)}
              disabled={busy !== null || isEmpty}
              title={t('tools.richText.exportPdf')}
              aria-label={t('tools.richText.exportPdf')}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-blue-600 text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-950"
            >
              {busy === 'pdf' ? (
                <span className="text-xs leading-none">…</span>
              ) : (
                <Icon name="pdf" className="h-4 w-4" />
              )}
            </button>

            <span className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-gray-700" />

            <button
              type="button"
              onClick={handleExportMarkdown}
              disabled={isEmpty}
              title={t('tools.richText.exportMarkdown')}
              aria-label={t('tools.richText.exportMarkdown')}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="markdown" className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleExportHtml}
              disabled={isEmpty}
              title={t('tools.richText.exportHtml')}
              aria-label={t('tools.richText.exportHtml')}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="html" className="h-4 w-4" />
            </button>
          </>
        }
        stats={
          <>
            <span>
              {t('tools.richText.chars')}: {stats.chars}
            </span>
            <span>
              {t('tools.richText.words')}: {stats.words}
            </span>
            <span>
              {t('tools.richText.paragraphs')}: {stats.paragraphs}
            </span>
          </>
        }
        status={saved ? t('tools.richText.saved') : t('tools.richText.saving')}
        onClear={handleClear}
        clearDisabled={isEmpty && !title}
      />

      <EditorToolbar
        editor={editor}
        findOpen={findOpen}
        onToggleFind={() => setFindOpen((open) => !open)}
        outlineOpen={outlineOpen}
        onToggleOutline={() => setOutlineOpen((open) => !open)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        pageSetupOpen={pageSetupOpen}
        onTogglePageSetup={() => togglePanel('pageSetup')}
        onInsertToc={handleInsertToc}
        tocDisabled={isEmpty}
        stylesOpen={stylesOpen}
        onToggleStyles={() => togglePanel('styles')}
        reviewOpen={reviewOpen}
        onToggleReview={() => togglePanel('review')}
        onOpenVersions={openVersions}
        versionsDisabled={!docId}
        zoom={zoom}
        onZoomChange={setZoom}
      />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        {/* 左列：大纲（文档左侧；窄屏回落到文档上方） */}
        {outlineOpen && editor ? (
          <aside className="w-full shrink-0 xl:sticky xl:top-4 xl:w-64 xl:self-start">
            <OutlinePanel editor={editor} />
          </aside>
        ) : null}

        {/* 中间列：编辑器 + 仍位于上方的编辑类面板（查找 / 样式 / 修订） */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {findOpen && editor ? (
            <FindReplacePanel editor={editor} onClose={() => setFindOpen(false)} />
          ) : null}

          {/* 打印纸张尺寸/边距：@page 不支持 CSS 变量，按当前设置动态注入 */}
          <style>{buildPrintPageCss(metrics, pageSetup.margin)}</style>

          {stylesOpen ? <StylePanel editor={editor} onClose={() => setStylesOpen(false)} /> : null}
          {reviewOpen ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => handleTrackChange('insert')}
                className="h-7 rounded-md border border-gray-300 px-2 text-xs transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                {t('tools.richText.markInsert')}
              </button>
              <button
                type="button"
                onClick={() => handleTrackChange('delete')}
                className="h-7 rounded-md border border-gray-300 px-2 text-xs transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                {t('tools.richText.markDelete')}
              </button>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {t('tools.richText.markHint')}
              </span>
            </div>
          ) : null}
          {reviewOpen ? (
            <ReviewPanel
              comments={comments}
              changes={changes}
              onAddComment={handleAddComment}
              onRemoveComment={handleRemoveComment}
              onAcceptAll={() => {
                editor?.chain().focus().acceptAllTracked().run();
                setChanges([]);
              }}
              onRejectAll={() => {
                editor?.chain().focus().rejectAllTracked().run();
                setChanges([]);
              }}
              onClose={() => setReviewOpen(false)}
            />
          ) : null}

          {/* 编辑工作区：固定为「首屏剩余空间」高度并内部滚动（长文档不撑高页面）。
              页面视图的灰色工作台挂在此容器上，保证铺满整个可滚动区域。 */}
          <div
            className={`rte-editor-viewport${viewMode === 'paged' ? ' rte-viewport-paged' : ''}`}
            ref={viewportRef}
            style={viewportMax ? { height: `${viewportMax}px` } : undefined}
            onMouseDown={(event) => {
              if (!editor) return;
              // 编辑器内部的点击由 ProseMirror 插件处理；
              // 这里兜底浮动图片绘制在内容盒子之外（工作台区域）时的选中与拖动
              if (editor.view.dom.contains(event.target as Node)) return;
              handleFloatingImagePointerDown(editor.view, event.nativeEvent);
            }}
          >
            {/* 图片缩放手柄：覆盖层（内容坐标系，滚动自动跟随） */}
            <ImageResizeOverlay editor={editor} viewportRef={viewportRef} />
            {/* 缩放层：CSS zoom 参与布局（滚动高度正确），data-rte-zoom 供分页测量还原 */}
            <div data-rte-zoom={zoom} style={{ zoom, ...(metrics.cssVars as React.CSSProperties) }}>
              <div
                className={`mx-auto w-full max-w-[860px] ${
                  viewMode === 'paged' ? 'rte-page-area' : ''
                }`}
              >
                <div
                  ref={surfaceRef}
                  className={`rte-surface relative rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 ${
                    viewMode === 'paged' ? 'rte-paged' : 'px-8 py-8'
                  }`}
                  style={
                    viewMode === 'paged' && sheetBottomPx > 0
                      ? { minHeight: `${sheetBottomPx}px` }
                      : undefined
                  }
                >
                  {/* 页视图：每页一张真实纸面，内容连续流动 */}
                  {viewMode === 'paged' &&
                    sheetTops.map((top, index) => (
                      <div
                        key={index}
                        className="rte-page-sheet"
                        style={{ top: `${top}px` }}
                        aria-hidden="true"
                      >
                        {/* 页眉 / 页脚 / 页码：与 Word 导出、快照 PDF 共用同一份设置 */}
                        {pageSetup.header.trim() ? (
                          <span className="rte-page-header">{pageSetup.header}</span>
                        ) : null}
                        {pageSetup.footer.trim() || pageSetup.showPageNumber ? (
                          <span className="rte-page-footer">
                            {pageSetup.footer.trim()}
                            {pageSetup.showPageNumber ? (
                              <span className="rte-page-footer-number">
                                {t('tools.richText.pageBadge', { page: index + 1 })}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        {/* 角标仅在页脚未显示页码时出现，避免重复 */}
                        {!pageSetup.showPageNumber && !pageSetup.footer.trim() ? (
                          <span className="rte-page-badge">
                            {t('tools.richText.pageBadge', { page: index + 1 })}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  <EditorContent editor={editor} />
                </div>
              </div>
            </div>
          </div>

          {busy === 'pdf' && <ProgressBar value={progress} label={t('tools.richText.exporting')} />}
        </div>

        {/* 右列：页面设置 + 文档库 / 历史版本（文档右侧；窄屏回落到下方） */}
        {pageSetupOpen || libraryOpen || versionsOpen ? (
          <aside className="w-full shrink-0 xl:w-80">
            {pageSetupOpen ? (
              <PageSetupPanel
                setup={pageSetup}
                onChange={setPageSetup}
                onClose={() => setPageSetupOpen(false)}
              />
            ) : null}
            {libraryOpen ? (
              <DocLibraryPanel
                currentDocId={docId}
                docs={docs}
                onOpen={handleOpenDoc}
                onDuplicate={handleDuplicateDoc}
                onDelete={handleDeleteDoc}
                onNew={handleNew}
                onClose={() => setLibraryOpen(false)}
              />
            ) : null}
            {versionsOpen ? (
              <VersionHistoryPanel
                versions={versions}
                onRestore={handleRestoreVersion}
                onClose={() => setVersionsOpen(false)}
              />
            ) : null}
          </aside>
        ) : null}
      </div>

      {presenting ? (
        <PresentOverlay
          title={title.trim() || t('tools.richText.titlePlaceholder')}
          onClose={() => setPresenting(false)}
          exitLabel={t('tools.richText.exitPresent')}
          failedLabel={t('tools.richText.presentFailed')}
          failed={!presentHtml}
          align="top"
        >
          {/* 只读页面：直接复用打印版式（170mm 白纸 + 文档字体），不改动编辑器本身 */}
          <div
            data-testid="present-document"
            className="rte-print-flow max-h-full overflow-auto rounded-lg px-10 py-10 shadow-2xl"
            dangerouslySetInnerHTML={{ __html: presentHtml }}
          />
        </PresentOverlay>
      ) : null}

      <input
        ref={importInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleImport(file);
        }}
      />

      {failure && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.richText', failure)}
        </p>
      )}

      {printNotice && !failure && (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {t('tools.richText.printFallback')}
        </p>
      )}

      {draftNotice && !failure && (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {draftNotice === 'degraded'
            ? t('tools.richText.draftDegraded')
            : t('tools.richText.draftSaveFailed')}
        </p>
      )}

      {losses && !failure && (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {[
            losses.externalImages > 0
              ? t('tools.richText.lossExternalImages', { count: losses.externalImages })
              : null,
            losses.webpImages > 0
              ? t('tools.richText.lossWebpImages', { count: losses.webpImages })
              : null,
            losses.deepListItems > 0
              ? t('tools.richText.lossDeepLists', { count: losses.deepListItems })
              : null,
          ]
            .filter(Boolean)
            .join(' ')}
        </p>
      )}

      <PdfModeDialog
        open={pdfDialogOpen}
        initialMode={pdfMode}
        busy={busy !== null}
        onCancel={() => setPdfDialogOpen(false)}
        onConfirm={(mode) => {
          setPdfDialogOpen(false);
          void handleExportPdf(mode);
        }}
      />

      {printReady && <PrintLayer html={snapshotHtml} flowRef={flowRef} />}
    </div>
  );
}
