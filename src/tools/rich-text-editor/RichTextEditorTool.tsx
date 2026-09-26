import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorContent, useEditor } from '@tiptap/react';
import { DocumentHeader, HintTip } from '@/core/components/DocumentHeader';
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
import { exportDocxBlob, importDocx } from './docx';
import { PAGE_HEIGHT_PX } from './PageView';
import { printSupported, snapshotToPdf, printToPdf } from './pdf';
import { createExtensions } from './extensions';
import { registerRichTextStrings } from './strings';
import './editor.css';

// 工具文案随本 chunk 懒加载注册，不占用首屏语言包体积
registerRichTextStrings(i18n);

type Failure = Extract<ToolResult<unknown>, { ok: false }>;
type PdfMode = 'text' | 'snapshot';
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
  // 分页插件在编辑器创建（渲染期）即开始回调，需等组件挂载后再 setState
  const mountedRef = useRef(false);
  const pendingTopsRef = useRef<number[] | null>(null);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [progress, setProgress] = useState(0);
  const [pdfMode, setPdfMode] = useState<PdfMode>('text');
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
  // 纸面是绝对定位元素，不参与父级高度计算：内容不足整页时灰色工作台会提前结束。
  // 这里按最后一张纸的下沿给内容区补一个最小高度，让灰色背景铺满到最后一页。
  const sheetBottomPx = useMemo(() => {
    if (sheetTops.length === 0) return 0;
    return Math.round(sheetTops[sheetTops.length - 1] + PAGE_HEIGHT_PX + 12);
  }, [sheetTops]);

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
    () => createExtensions(placeholder, handleSheetTops),
    [placeholder, handleSheetTops],
  );

  const editor = useEditor({ extensions, content: snapshotHtml });

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
  }, [findOpen, outlineOpen, libraryOpen, versionsOpen]);

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
  const persistNow = useCallback((draft: RichTextDraft): void => {
    const result = writeDraftSafe(draft);
    setSaved(result.ok);
    setDraftNotice(result.ok ? (result.degraded ? 'degraded' : null) : 'failed');
    const id = ensureDocId();
    void saveDocument(id, draft).then(() => {
      void listDocuments().then(setDocs);
    });
    // ensureDocId/setSaved/setDraftNotice 依赖稳定，无需加入依赖
  }, []);

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
    const result = await exportDocxBlob(html, title);
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

  const handleExportPdf = async () => {
    setFailure(null);
    setPrintNotice(false);
    setProgress(0);
    setPrintReady(true);
    await nextFrame();
    try {
      if (pdfMode === 'text') {
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
            printToPdf(flowRef.current);
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
      const result = await snapshotToPdf(flow, setProgress);
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
            <button
              type="button"
              onClick={openVersions}
              disabled={!docId}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="clock" className="h-4 w-4" />
              {t('tools.richText.versionHistory')}
            </button>
          </>
        }
        io={
          <>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              title={t('tools.richText.importHint')}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="upload" className="h-4 w-4" />
              {t('tools.richText.importDocx')}
            </button>

            <button
              type="button"
              onClick={() => void handleExportDocx()}
              disabled={busy !== null || isEmpty}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              {busy === 'docx' ? t('tools.richText.exporting') : t('tools.richText.exportDocx')}
            </button>

            <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
              {t('tools.richText.pdfMode')}
              <select
                value={pdfMode}
                onChange={(e) => setPdfMode(e.target.value as PdfMode)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="text">{t('tools.richText.modeText')}</option>
                <option value="snapshot">{t('tools.richText.modeSnapshot')}</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => void handleExportPdf()}
              disabled={busy !== null || isEmpty}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-950"
            >
              <Icon name="pdf" className="h-4 w-4" />
              {busy === 'pdf' ? t('tools.richText.exporting') : t('tools.richText.exportPdf')}
            </button>

            {/* 导出模式说明改为 tooltip，避免占用行内空间 */}
            <HintTip
              label={t('tools.richText.pdfMode')}
              text={
                pdfMode === 'text'
                  ? t('tools.richText.modeTextHint')
                  : t('tools.richText.modeSnapshotHint')
              }
            />
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
      />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        {/* 左列：编辑器 + 导出状态 */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {findOpen && editor ? (
            <FindReplacePanel editor={editor} onClose={() => setFindOpen(false)} />
          ) : null}
          {outlineOpen && editor ? <OutlinePanel editor={editor} /> : null}

          {/* 编辑工作区：按首屏剩余空间定高、内部滚动，长文档不再把页面撑高 */}
          <div
            className="rte-editor-viewport"
            ref={viewportRef}
            style={viewportMax ? { maxHeight: `${viewportMax}px` } : undefined}
          >
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
                {/* 页视图：每页一张真实 A4 纸面，内容连续流动 */}
                {viewMode === 'paged' &&
                  sheetTops.map((top, index) => (
                    <div
                      key={index}
                      className="rte-page-sheet"
                      style={{ top: `${top}px` }}
                      aria-hidden="true"
                    >
                      <span className="rte-page-badge">
                        {t('tools.richText.pageBadge', { page: index + 1 })}
                      </span>
                    </div>
                  ))}
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>

          {busy === 'pdf' && <ProgressBar value={progress} label={t('tools.richText.exporting')} />}
        </div>

        {/* 右侧栏：文档库 / 历史版本（工具栏之下、编辑器右侧；窄屏回落到编辑器上方） */}
        {libraryOpen || versionsOpen ? (
          <aside className="w-full shrink-0 xl:w-80">
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

      {printReady && <PrintLayer html={snapshotHtml} flowRef={flowRef} />}
    </div>
  );
}
