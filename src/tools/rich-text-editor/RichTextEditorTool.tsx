import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NodeSelection } from '@tiptap/pm/state';
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
  scanMarkdownExportLosses,
  type DocxExportLosses,
  type MarkdownExportLosses,
} from './core';
import {
  clearDraft,
  readDraft,
  readReviewerName,
  writeDraftSafe,
  writeReviewerName,
  type RichTextDraft,
  type ViewMode,
} from './draft';
import {
  createDocId,
  deleteDocument,
  duplicateDocument,
  initDocStore,
  listDocuments,
  listVersions,
  loadDocument,
  saveDocument,
  saveManualVersion,
  setCurrentDocId,
  type DocMeta,
  type StoredVersion,
} from './docStore';
import { DocLibraryPanel, VersionHistoryPanel } from './DocLibraryPanel';
import { VersionDiffPanel } from './VersionDiffPanel';
import { ImageResizeOverlay } from './ImageResizeOverlay';
import { handleFloatingImagePointerDown } from './imageLayer';
import { exportDocxBlob, importDocx } from './docx';
import { printSupported, snapshotToPdf, printToPdf } from './pdf';
import { createExtensions } from './extensions';
import { PageSetupPanel } from './PageSetupPanel';
import { ReviewPanel } from './ReviewPanel';
import { StylePanel } from './StylePanel';
import { htmlToMarkdown, type DocComment, type TrackedChange } from './docs';
import { pageIndexOfPosition } from './core';
import { FootnoteDialog } from './FootnoteDialog';
import {
  FOOTNOTE_EDIT_EVENT,
  findSelectedFootnote,
  injectFootnotes,
  type FootnoteEditDetail,
  type FootnoteLabels,
} from './footnotes';
import { injectMath } from './math';
import { MathDialog } from './MathDialog';
import {
  addUserWord,
  collectDocIssues,
  createWordIndex,
  loadDictionary,
  removeUserWord,
  suggest,
  type DocSpellIssue,
  type WordIndex,
} from './spellcheck';
import { SpellcheckPanel } from './SpellcheckPanel';
import type { PageLayoutSnapshot } from './PageView';
import { buildTemplateApplication, type DocumentTemplate } from './templates';
import { TemplatePanel } from './TemplatePanel';
import { buildTocEntries, injectTocHtml, renderTocHtml, type TocLabels } from './toc';
import {
  DEFAULT_PAGE_SETUP,
  buildPrintPageCss,
  normalizePageSetup,
  pageMetricsToPx,
  watermarkCssVars,
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

/** 拼写面板最多展示的问题数：超出部分不渲染，避免长文档铺开上百条 */
const SPELL_ISSUE_LIMIT = 100;

/** 单文件 HTML 导出不携带编辑器样式表，目录样式需内联补齐（与 editor.css 保持一致） */
const TOC_EXPORT_CSS =
  '.rte-toc{margin:.75em 0 1.25em}.rte-toc-title{margin:0 0 .5em;font-weight:600}' +
  '.rte-toc-list{list-style:none;margin:0;padding:0}' +
  '.rte-toc-item{display:flex;align-items:baseline;gap:.5em;border-bottom:1px dotted #e5e7eb;padding:.15em 0}' +
  '.rte-toc-text{flex:1;min-width:0;overflow-wrap:anywhere}' +
  '.rte-toc-page{flex-shrink:0;color:#6b7280}';

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
  const [markdownLosses, setMarkdownLosses] = useState<MarkdownExportLosses | null>(null);
  // 分页快照：纸面位置 + 每页起始块的文档位置（目录据后者算真实页码）
  const [layout, setLayout] = useState<PageLayoutSnapshot>({ sheetTops: [], pageStarts: [] });
  const [printNotice, setPrintNotice] = useState(false);
  const [pageSetup, setPageSetup] = useState<PageSetupConfig>(() =>
    normalizePageSetup(initial?.pageSetup ?? DEFAULT_PAGE_SETUP),
  );
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [zoom, setZoom] = useState(initial?.zoom ?? 1);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [spellcheckOpen, setSpellcheckOpen] = useState(false);
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(false);
  /** 英文词表（按需从静态资源加载，未加载时只依据自定义词典判断） */
  const [dictionary, setDictionary] = useState<ReadonlySet<string>>(() => new Set());
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const [dictionaryFailed, setDictionaryFailed] = useState(false);
  const [userWords, setUserWords] = useState<string[]>(() => initial?.userWords ?? []);
  /** 本次会话内忽略的单词（不落盘：属于临时判断） */
  const [ignoredWords, setIgnoredWords] = useState<string[]>([]);
  /** 最近套用的模板 id（随草稿落盘，面板据此标记当前模板） */
  const [templateId, setTemplateId] = useState(initial?.templateId ?? '');
  const [reviewOpen, setReviewOpen] = useState(false);
  // 批注 / 修订元数据随草稿落盘：初始化时直接取回上次会话的内容
  const [comments, setComments] = useState<DocComment[]>(() => initial?.comments ?? []);
  const [changes, setChanges] = useState<TrackedChange[]>(() => initial?.changes ?? []);
  /** 正在撰写的新批注引文（null 表示未在撰写） */
  const [pendingQuote, setPendingQuote] = useState<string | null>(null);
  const [author, setAuthor] = useState(() => readReviewerName());
  const [diffVersion, setDiffVersion] = useState<StoredVersion | null>(null);
  // 分页插件在编辑器创建（渲染期）即开始回调，需等组件挂载后再 setState
  const mountedRef = useRef(false);
  const pendingLayoutRef = useRef<PageLayoutSnapshot | null>(null);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [progress, setProgress] = useState(0);
  const [pdfMode, setPdfMode] = useState<PdfMode>(
    initial?.pdfMode === 'snapshot' ? 'snapshot' : 'text',
  );
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  /** 脚注弹窗：null 关闭；pos 为 null 表示新建 */
  const [footnoteDialog, setFootnoteDialog] = useState<{
    mode: 'insert' | 'edit';
    pos: number | null;
    note: string;
  } | null>(null);
  /** 公式弹窗：null 关闭；pos 为 null 表示新建 */
  const [mathDialog, setMathDialog] = useState<{
    mode: 'insert' | 'edit';
    pos: number | null;
    latex: string;
    display: boolean;
  } | null>(null);
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
    const tops = layout.sheetTops;
    if (tops.length === 0) return 0;
    return Math.round(tops[tops.length - 1] + pageMetricsToPx(metrics).heightPx + 12);
  }, [layout, metrics]);

  const placeholder = useMemo(() => t('tools.richText.placeholder'), [t]);
  /** 分页快照回调：纸面位置或分页点变化才更新，避免无意义的重渲染 */
  const handleLayout = useCallback((next: PageLayoutSnapshot) => {
    if (!mountedRef.current) {
      pendingLayoutRef.current = next;
      return;
    }
    setLayout((prev) =>
      prev.sheetTops.length === next.sheetTops.length &&
      prev.sheetTops.every((top, index) => Math.abs(top - next.sheetTops[index]) < 0.5) &&
      prev.pageStarts.length === next.pageStarts.length &&
      prev.pageStarts.every((pos, index) => pos === next.pageStarts[index])
        ? prev
        : next,
    );
  }, []);
  const tocLabels = useMemo<TocLabels>(
    () => ({ title: t('tools.richText.tocTitle'), empty: t('tools.richText.tocEmpty') }),
    [t],
  );
  const footnoteLabels = useMemo<FootnoteLabels>(
    () => ({ name: t('tools.richText.footnote'), empty: t('tools.richText.footnoteEmpty') }),
    [t],
  );
  /** 点击正文中的公式（NodeView 回调）→ 打开编辑弹窗 */
  const handleMathSelect = useCallback((pos: number, latex: string, display: boolean) => {
    setMathDialog({ mode: 'edit', pos, latex, display });
  }, []);
  // 拼写检查的词典与开关经 ref + getter 暴露给 PM 插件（词表加载后无需重建编辑器）。
  // 必须声明在 useEditor 之前：编辑器在渲染期同步构造，插件 state.init 会立即调用 getter 读取这两个 ref。
  const userWordsRef = useRef<string[]>(initial?.userWords ?? []);
  const dictionaryRef = useRef<ReadonlySet<string>>(dictionary);
  const spellcheckEnabledRef = useRef(false);
  /** 拼写检查读取实时词典与开关（getter 身份稳定，插件不需要重建） */
  const getSpellDictionary = useCallback(
    () => ({ words: dictionaryRef.current, userWords: userWordsRef.current }),
    [],
  );
  const isSpellcheckEnabled = useCallback(() => spellcheckEnabledRef.current, []);
  const extensions = useMemo(
    () =>
      createExtensions({
        placeholder,
        onLayout: handleLayout,
        getPageMetrics: getMetrics,
        tocLabels,
        footnoteLabels,
        onMathSelect: handleMathSelect,
        spellcheck: { getDictionary: getSpellDictionary, isEnabled: isSpellcheckEnabled },
      }),
    [
      placeholder,
      handleLayout,
      getMetrics,
      tocLabels,
      footnoteLabels,
      handleMathSelect,
      getSpellDictionary,
      isSpellcheckEnabled,
    ],
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

  // 挂载后应用插件在渲染期缓存的分页快照
  useEffect(() => {
    mountedRef.current = true;
    if (pendingLayoutRef.current) {
      const pending = pendingLayoutRef.current;
      pendingLayoutRef.current = null;
      setLayout(pending);
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
  }, [
    findOpen,
    outlineOpen,
    pageSetupOpen,
    stylesOpen,
    reviewOpen,
    libraryOpen,
    versionsOpen,
    diffVersion,
  ]);

  const docIdRef = useRef<string | null>(null);
  docIdRef.current = docId;
  // 审阅元数据经 ref 读取：persistNow 依赖保持稳定，
  // 否则每次批注变化都会让编辑器 update 监听重新注册
  const commentsRef = useRef<DocComment[]>(comments);
  const changesRef = useRef<TrackedChange[]>(changes);
  const templateIdRef = useRef<string>(initial?.templateId ?? '');

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
      const withPrefs: RichTextDraft = {
        ...draft,
        pageSetup,
        zoom,
        pdfMode,
        comments: commentsRef.current,
        changes: changesRef.current,
        userWords: userWordsRef.current,
        templateId: templateIdRef.current || undefined,
      };
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

  /** 同步审阅元数据（状态 + ref 双写，供持久化读 ref） */
  const applyReview = useCallback(
    (source: {
      comments: DocComment[];
      changes: TrackedChange[];
      userWords?: string[];
      templateId?: string;
    }) => {
      commentsRef.current = source.comments;
      changesRef.current = source.changes;
      userWordsRef.current = source.userWords ?? [];
      templateIdRef.current = source.templateId ?? '';
      setComments(source.comments);
      setChanges(source.changes);
      setUserWords(source.userWords ?? []);
      setTemplateId(source.templateId ?? '');
    },
    [],
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
        applyReview(init.doc);
        setSaved(true);
      }
    });
    // 仅在编辑器就绪后执行一次
  }, [editor, applyReview]);

  // 延迟/异步回调可能落在已销毁的编辑器上（React 严格模式双挂载），读取前先判定
  const readHtml = useCallback((): string | null => {
    if (!editor || editor.isDestroyed) return null;
    try {
      return editor.getHTML();
    } catch {
      return null;
    }
  }, [editor]);

  // 批注 / 修订变化后落盘（此前它们只存在于组件态，刷新即丢失）
  const reviewMountedRef = useRef(false);
  useEffect(() => {
    commentsRef.current = comments;
    changesRef.current = changes;
    if (!reviewMountedRef.current) {
      reviewMountedRef.current = true;
      return;
    }
    const html = readHtml();
    if (html === null) return;
    const timer = setTimeout(() => {
      persistNow({ title: titleRef.current, html, view: viewRef.current });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [comments, changes, persistNow, readHtml]);

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

  /**
   * 目录导出内容：目录节点是 atom，`getHTML()` 只输出空外壳。
   * 这里按「当前文档 + 当前分页结果」渲染出可直接分发的目录 HTML；
   * sheetTops 参与依赖，分页收敛后页码变化会触发重算。
   */
  const tocHtml = useMemo(() => {
    // snapshotHtml 是正文变化的信号；空文档无需渲染目录
    if (!editor || editor.isDestroyed || !snapshotHtml) return '';
    const { entries, headings } = buildTocEntries(editor.state.doc, (pos) =>
      pageIndexOfPosition(layout.pageStarts, pos),
    );
    return renderTocHtml(entries, headings, tocLabels);
  }, [editor, snapshotHtml, layout, tocLabels]);

  /**
   * 导出前的统一整理：补齐目录内容 + 脚注编号与文末汇总区。
   * 目录与脚注都是「渲染期派生」的内容（atom 节点序列化为空外壳、脚注汇总区是 widget），
   * 不在导出前补齐，打印 / PDF / Word / Markdown 里就会缺内容。
   */
  const prepareExportHtml = useCallback(
    (html: string): string => injectFootnotes(injectTocHtml(html, tocHtml), footnoteLabels),
    [tocHtml, footnoteLabels],
  );

  /** 打印 / 快照 PDF / 放映 / 单文件 HTML 共用：整理后的 HTML */
  const printHtml = useMemo(
    () => injectMath(prepareExportHtml(snapshotHtml)),
    [prepareExportHtml, snapshotHtml],
  );

  // 放映用只读 HTML：复用导出 PDF 的同一套净化逻辑，避免注入风险
  const presentHtml = useMemo(() => {
    const result = sanitizeDocHtml(printHtml);
    return result.ok ? result.value : '';
  }, [printHtml]);

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
    // 目录字段的缓存条目取自已渲染的目录内容，因此先补齐再导出
    const html = prepareExportHtml(editor.getHTML());
    // 批注与修订元数据一并写入，Word 侧可原生审阅
    const result = await exportDocxBlob(html, title, pageSetup, {
      comments: commentsRef.current,
      changes: changesRef.current,
      author: resolveAuthor(),
    });
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    downloadBlob(result.value, buildExportFilename(title || 'document', 'docx'));
    // 导出后提示已知损耗，替代静默丢弃
    const scanned = scanDocxExportLosses(html, commentsRef.current);
    if (scanned.ok) {
      const { externalImages, webpImages, deepListItems, unlinkedComments, mathAsImages } =
        scanned.value;
      setLosses(
        externalImages > 0 ||
          webpImages > 0 ||
          deepListItems > 0 ||
          unlinkedComments > 0 ||
          mathAsImages > 0
          ? scanned.value
          : null,
      );
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

  /** 插入动态目录：页码与条目由渲染时的分页结果实时派生 */
  const handleInsertToc = () => {
    if (!editor) return;
    editor.chain().focus().insertTableOfContents().run();
  };

  /** 刷新目录：触发分页重算，条目与页码随之更新（字体/图片异步加载后尤其需要） */
  const handleRefreshToc = () => {
    if (!editor) return;
    editor.chain().focus().refreshTableOfContents().run();
  };

  // 点击正文中的脚注引用（NodeView 冒泡派发）→ 打开编辑弹窗
  useEffect(() => {
    const onEditFootnote = (event: Event) => {
      const detail = (event as CustomEvent<FootnoteEditDetail>).detail;
      if (!detail) return;
      setFootnoteDialog({ mode: 'edit', pos: detail.pos, note: detail.note });
    };
    document.addEventListener(FOOTNOTE_EDIT_EVENT, onEditFootnote);
    return () => document.removeEventListener(FOOTNOTE_EDIT_EVENT, onEditFootnote);
  }, []);

  /** 工具栏入口：选中已有脚注则编辑，否则新建 */
  const handleFootnoteAction = () => {
    if (!editor) return;
    const selected = findSelectedFootnote(editor.state);
    if (selected) setFootnoteDialog({ mode: 'edit', pos: selected.pos, note: selected.note });
    else setFootnoteDialog({ mode: 'insert', pos: null, note: '' });
  };

  const handleFootnoteSubmit = (note: string) => {
    if (!editor || !footnoteDialog) return;
    if (footnoteDialog.mode === 'insert') {
      editor.chain().focus().insertFootnote(note).run();
    } else if (footnoteDialog.pos !== null) {
      editor.chain().focus().updateFootnote(footnoteDialog.pos, note).run();
    }
    setFootnoteDialog(null);
  };

  const handleFootnoteRemove = () => {
    if (!editor || !footnoteDialog || footnoteDialog.pos === null) return;
    editor.chain().focus().removeFootnote(footnoteDialog.pos).run();
    setFootnoteDialog(null);
  };

  const handleFootnoteCancel = () => setFootnoteDialog(null);

  /** 工具栏入口：选中已有公式则编辑，否则新建 */
  const handleMathAction = () => {
    if (!editor) return;
    const { selection } = editor.state;
    const node =
      selection instanceof NodeSelection &&
      (selection.node.type.name === 'mathInline' || selection.node.type.name === 'mathBlock')
        ? selection.node
        : null;
    if (node) {
      setMathDialog({
        mode: 'edit',
        pos: selection.from,
        latex: String(node.attrs.latex ?? ''),
        display: node.attrs.display === true,
      });
      return;
    }
    setMathDialog({ mode: 'insert', pos: null, latex: '', display: false });
  };

  /**
   * 提交公式：新建时按弹窗选择插入行内或块级；
   * 编辑时保持原有行内/块级形态（切换展示模式会让节点类型变化，容易产生意外）。
   */
  const handleMathSubmit = (latex: string, display: boolean) => {
    if (!editor || !mathDialog) return;
    if (mathDialog.mode === 'insert') {
      if (display) editor.chain().focus().insertBlockMath(latex).run();
      else editor.chain().focus().insertInlineMath(latex).run();
    } else if (mathDialog.pos !== null) {
      editor.chain().focus().updateMath(mathDialog.pos, latex).run();
    }
    setMathDialog(null);
  };

  const handleMathRemove = () => {
    if (!editor || !mathDialog || mathDialog.pos === null) return;
    editor.chain().focus().removeMath(mathDialog.pos).run();
    setMathDialog(null);
  };

  const handleMathCancel = () => setMathDialog(null);

  // 词典与开关同步到 ref，供 PM 插件的 getter 读取
  dictionaryRef.current = dictionary;
  spellcheckEnabledRef.current = spellcheckEnabled;

  const refreshSpellcheck = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.refreshSpellcheck();
  }, [editor]);

  /** 加载英文词表（按需下载，不进打包产物；失败时只影响判定覆盖面） */
  const handleLoadDictionary = useCallback(async () => {
    if (dictionaryRef.current.size > 0 || dictionaryLoading) return;
    setDictionaryLoading(true);
    setDictionaryFailed(false);
    const result = await loadDictionary();
    setDictionaryLoading(false);
    if (!result.ok) {
      setDictionaryFailed(true);
      return;
    }
    setDictionary(result.value);
    // 词表就绪后重算装饰（ref 已指向新词表）
    if (editor && !editor.isDestroyed) editor.commands.refreshSpellcheck();
  }, [dictionaryLoading, editor]);

  const handleToggleSpellcheck = () => {
    const next = !spellcheckEnabled;
    setSpellcheckEnabled(next);
    spellcheckEnabledRef.current = next;
    if (next) void handleLoadDictionary();
    refreshSpellcheck();
  };

  const handleReplaceIssue = (issue: DocSpellIssue, replacement: string) => {
    if (!editor) return;
    editor.chain().focus().insertContentAt({ from: issue.from, to: issue.to }, replacement).run();
  };

  const handleAddToDictionary = (word: string) => {
    const next = addUserWord(userWordsRef.current, word);
    userWordsRef.current = next;
    setUserWords(next);
    persistNow({
      title: titleRef.current,
      html: readHtml() ?? snapshotHtml,
      view: viewRef.current,
    });
    refreshSpellcheck();
  };

  const handleRemoveUserWord = (word: string) => {
    const next = removeUserWord(userWordsRef.current, word);
    userWordsRef.current = next;
    setUserWords(next);
    persistNow({
      title: titleRef.current,
      html: readHtml() ?? snapshotHtml,
      view: viewRef.current,
    });
    refreshSpellcheck();
  };

  const handleIgnoreWord = (word: string) => {
    setIgnoredWords((prev) => (prev.includes(word) ? prev : [...prev, word]));
  };

  /** 建议索引按需构建并缓存：二十多万词的分桶索引只建一次 */
  const wordIndexRef = useRef<WordIndex | null>(null);
  const suggestionsFor = useCallback(
    (word: string): string[] => {
      if (dictionary.size === 0) return [];
      if (!wordIndexRef.current) wordIndexRef.current = createWordIndex(dictionary);
      return suggest(word, wordIndexRef.current, 5, userWordsRef.current);
    },
    [dictionary],
  );

  /** 当前文档的拼写问题（排除本轮忽略的词，数量上限保护渲染） */
  const spellIssues = useMemo(() => {
    // snapshotHtml 既是「文档有内容」的判断，也是正文变化的信号
    if (!editor || editor.isDestroyed || !spellcheckEnabled || !snapshotHtml) return [];
    const issues = collectDocIssues(
      editor.state.doc,
      { words: dictionary, userWords },
      SPELL_ISSUE_LIMIT,
    );
    return issues.filter((issue) => !ignoredWords.includes(issue.word));
    // snapshotHtml 是正文变化信号；dictionary / userWords / ignoredWords 直接参与判定
  }, [editor, snapshotHtml, spellcheckEnabled, dictionary, userWords, ignoredWords]);

  /** 新批注署名：未填写时回退到默认文案 */
  const resolveAuthor = () => author.trim() || t('tools.richText.commentAuthor');

  /**
   * 新建批注：记录选区引文后展开面板内联编辑（不再使用浏览器原生弹窗）。
   * 选区为空时允许创建「文档级」批注，不写入正文标记。
   */
  const handleAddComment = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    setPendingQuote(editor.state.doc.textBetween(from, to, ' ').trim());
  };

  /** 提交批注：写入标记 + 落盘元数据 */
  const handleSubmitComment = (text: string) => {
    if (!editor) return;
    const quote = pendingQuote ?? '';
    const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (quote) editor.chain().focus().setComment(id).run();
    setComments((prev) => [
      ...prev,
      {
        id,
        quote,
        text,
        author: resolveAuthor(),
        createdAt: Date.now(),
        resolved: false,
      },
    ]);
    setPendingQuote(null);
  };

  const handleCancelComment = () => setPendingQuote(null);

  /** 删除批注：同时移除正文标记，避免留下孤立高亮 */
  const handleRemoveComment = (id: string) => {
    editor?.chain().focus().removeCommentMark(id).run();
    setComments((prev) => prev.filter((comment) => comment.id !== id));
  };

  /**
   * 标记已解决 / 重新打开。
   * 解决时移除正文标记（条目与引文保留），附件不再干扰阅读；
   * 重新打开只翻状态——正文选区已不可复现，不重建标记。
   */
  const handleToggleResolved = (id: string, resolved: boolean) => {
    if (resolved) editor?.chain().focus().removeCommentMark(id).run();
    setComments((prev) =>
      prev.map((comment) => (comment.id === id ? { ...comment, resolved } : comment)),
    );
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
        author: resolveAuthor(),
        createdAt: Date.now(),
      },
    ]);
  };

  /** 手动打快照：先冲刷当前内容再留档，可附备注 */
  const handleManualSnapshot = (note: string) => {
    const id = docIdRef.current;
    if (!id) return;
    const html = readHtml() ?? snapshotHtml;
    void saveDocument(id, {
      title: titleRef.current,
      html,
      view: viewRef.current,
      pageSetup,
      zoom,
      pdfMode,
      comments: commentsRef.current,
      changes: changesRef.current,
      userWords: userWordsRef.current,
    })
      .then(() => saveManualVersion(id, note || undefined))
      .then(() => listVersions(id))
      .then((list) => {
        setVersions(list);
        setSaved(true);
      });
  };

  /** 打开版本差异视图（与历史版本面板互斥，避免同时挤压编辑区） */
  const handleCompareVersion = (version: StoredVersion) => {
    setDiffVersion(version);
    setVersionsOpen(false);
    setLibraryOpen(false);
  };

  const handleAuthorChange = (next: string) => {
    setAuthor(next);
    writeReviewerName(next);
  };

  /** 导出 Markdown（纯函数 htmlToMarkdown：下划线/高亮/行内样式以 GFM 内联 HTML 保留） */
  const handleExportMarkdown = () => {
    if (!editor) return;
    // 先补齐目录与脚注，否则 atom 节点 / widget 派生内容在 Markdown 里会消失
    const html = prepareExportHtml(editor.getHTML());
    const markdown = htmlToMarkdown(html);
    const bytes = new TextEncoder().encode(markdown);
    downloadBytes(bytes, buildExportFilename(title || 'document', 'md'), 'text/markdown');
    const scanned = scanMarkdownExportLosses(html, pageSetup);
    if (scanned.ok) {
      const { comments, trackedChanges, paragraphSpacing, floatingImages, pageSetupFields } =
        scanned.value;
      const total = comments + trackedChanges + paragraphSpacing + floatingImages + pageSetupFields;
      setMarkdownLosses(total > 0 ? scanned.value : null);
    }
  };

  /** 导出单文件 HTML（内联样式，可直接打开/分享） */
  const handleExportHtml = () => {
    if (!editor) return;
    // 单文件 HTML 用 KaTeX MathML：无需携带样式表即可正确显示公式
    const body = injectMath(prepareExportHtml(editor.getHTML()));
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title || 'document'}</title><style>body{font-family:'PingFang SC','Microsoft YaHei',Arial,sans-serif;max-width:170mm;margin:20mm auto;line-height:1.8;font-size:15px}img{max-width:100%}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:.4rem .6rem}pre{background:#f3f4f6;padding:.75rem .9rem;border-radius:.5rem}${TOC_EXPORT_CSS}</style></head><body>${body}</body></html>`;
    const bytes = new TextEncoder().encode(html);
    downloadBytes(bytes, buildExportFilename(title || 'document', 'html'), 'text/html');
  };

  const resetEditorContent = (doc: {
    title: string;
    html: string;
    comments?: DocComment[];
    changes?: TrackedChange[];
  }) => {
    setTitle(doc.title);
    editor?.commands.setContent(doc.html);
    setSnapshotHtml(doc.html);
    applyReview({ comments: doc.comments ?? [], changes: doc.changes ?? [] });
    setPendingQuote(null);
    setFailure(null);
    setLosses(null);
    setMarkdownLosses(null);
  };

  const handleClear = () => {
    editor?.commands.clearContent();
    clearDraft();
    setTitle('');
    setSnapshotHtml(createEmptyDocHtml());
    applyReview({ comments: [], changes: [] });
    setPendingQuote(null);
    setSaved(false);
    setFailure(null);
    setLosses(null);
    setMarkdownLosses(null);
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

  /**
   * 套用模板：页面设置与模板声明合并（未声明的字段沿用当前选择），
   * 正文被替换为模板骨架；已有内容时先确认，避免误覆盖。
   */
  const handleApplyTemplate = (template: DocumentTemplate) => {
    if (!editor) return;
    const hasContent = stats.chars > 0;
    if (hasContent && !window.confirm(t('tools.richText.templateOverwriteConfirm'))) return;
    const application = buildTemplateApplication(template, { title, pageSetup }, (key) =>
      String(t(`tools.richText.${key}`)),
    );
    setPageSetup(normalizePageSetup(application.pageSetup));
    editor.commands.setContent(application.html);
    setSnapshotHtml(application.html);
    templateIdRef.current = application.templateId;
    setTemplateId(application.templateId);
    persistNow({ title: titleRef.current, html: application.html, view: viewRef.current });
    setTemplatesOpen(false);
  };

  type ToolPanel = 'pageSetup' | 'styles' | 'review' | 'templates' | 'spellcheck';

  /** 工具栏面板互斥切换：同一时间只展开一个，避免工作区被挤压 */
  const togglePanel = (panel: ToolPanel) => {
    setLibraryOpen(false);
    setVersionsOpen(false);
    setDiffVersion(null);
    setPageSetupOpen(panel === 'pageSetup' ? !pageSetupOpen : false);
    setStylesOpen(panel === 'styles' ? !stylesOpen : false);
    setReviewOpen(panel === 'review' ? !reviewOpen : false);
    setTemplatesOpen(panel === 'templates' ? !templatesOpen : false);
    setSpellcheckOpen(panel === 'spellcheck' ? !spellcheckOpen : false);
  };

  const openLibrary = () => {
    setVersionsOpen(false);
    setDiffVersion(null);
    setLibraryOpen(true);
    void listDocuments().then(setDocs);
  };

  const handleOpenDoc = (id: string) => {
    void loadDocument(id).then((doc) => {
      if (!doc) return;
      docIdRef.current = id;
      setDocId(id);
      setCurrentDocId(id);
      // StoredDocument 已归一化为 v2，直接带出批注与修订元数据
      resetEditorContent(doc);
      setLibraryOpen(false);
      setDiffVersion(null);
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
    setDiffVersion(null);
    setVersionsOpen(true);
    const id = docIdRef.current;
    if (id) void listVersions(id).then(setVersions);
    else setVersions([]);
  };

  const handleRestoreVersion = (version: StoredVersion) => {
    if (!window.confirm(t('tools.richText.restoreConfirm'))) return;
    resetEditorContent(version);
    // 先同步审阅元数据再落盘，避免 restore 用旧的 ref 覆盖快照里的批注
    commentsRef.current = version.comments;
    changesRef.current = version.changes;
    userWordsRef.current = version.userWords ?? [];
    templateIdRef.current = version.templateId ?? '';
    persistNow({ title: version.title, html: version.html, view: viewRef.current });
    setVersionsOpen(false);
    setDiffVersion(null);
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
        onRefreshToc={handleRefreshToc}
        tocDisabled={isEmpty}
        onFootnote={handleFootnoteAction}
        onMath={handleMathAction}
        stylesOpen={stylesOpen}
        onToggleStyles={() => togglePanel('styles')}
        templatesOpen={templatesOpen}
        onToggleTemplates={() => togglePanel('templates')}
        spellcheckOpen={spellcheckOpen}
        onToggleSpellcheck={() => togglePanel('spellcheck')}
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

          {diffVersion ? (
            <VersionDiffPanel
              key={diffVersion.id}
              versions={versions}
              initialVersionId={diffVersion.id}
              currentHtml={snapshotHtml}
              currentTitle={title}
              onRestore={handleRestoreVersion}
              onClose={() => setDiffVersion(null)}
            />
          ) : null}

          {stylesOpen ? <StylePanel editor={editor} onClose={() => setStylesOpen(false)} /> : null}
          {spellcheckOpen ? (
            <SpellcheckPanel
              enabled={spellcheckEnabled}
              onToggle={handleToggleSpellcheck}
              dictionaryLoaded={dictionary.size > 0}
              loading={dictionaryLoading}
              loadFailed={dictionaryFailed}
              onLoadDictionary={() => void handleLoadDictionary()}
              issues={spellIssues}
              suggestionsFor={suggestionsFor}
              onReplace={handleReplaceIssue}
              onAddToDictionary={handleAddToDictionary}
              onIgnore={handleIgnoreWord}
              userWords={userWords}
              onRemoveUserWord={handleRemoveUserWord}
              onClose={() => setSpellcheckOpen(false)}
            />
          ) : null}
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
              pendingQuote={pendingQuote}
              author={author}
              onAuthorChange={handleAuthorChange}
              onSubmitComment={handleSubmitComment}
              onCancelComment={handleCancelComment}
              onAddComment={handleAddComment}
              onRemoveComment={handleRemoveComment}
              onToggleResolved={handleToggleResolved}
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
                  className={`rte-surface relative rounded-lg border border-gray-200 shadow-sm dark:border-gray-700 ${
                    viewMode === 'paged' ? 'rte-paged' : 'px-8 py-8'
                  } ${viewMode === 'flow' && metrics.columns > 1 ? 'rte-columns' : ''}`}
                  style={{
                    // 页面背景色：深色主题下也以用户显式选择为准（打印/导出以它为准）
                    background: pageSetup.background ?? undefined,
                    ...(viewMode === 'paged' && sheetBottomPx > 0
                      ? { minHeight: `${sheetBottomPx}px` }
                      : {}),
                  }}
                >
                  {/* 流式视图的水印：覆盖整个编辑区（页面视图下逐页渲染） */}
                  {viewMode === 'flow' && pageSetup.watermark?.text.trim() ? (
                    <div
                      className="rte-watermark"
                      style={watermarkCssVars(pageSetup.watermark) as React.CSSProperties}
                    >
                      <span>{pageSetup.watermark.text}</span>
                    </div>
                  ) : null}
                  {/* 页视图：每页一张真实纸面，内容连续流动 */}
                  {viewMode === 'paged' &&
                    layout.sheetTops.map((top, index) => (
                      <div
                        key={index}
                        className="rte-page-sheet"
                        style={{
                          top: `${top}px`,
                          ...(pageSetup.background ? { background: pageSetup.background } : {}),
                        }}
                        aria-hidden="true"
                      >
                        {/* 每张纸面各渲染一次水印（与打印逐页重复一致） */}
                        {pageSetup.watermark?.text.trim() ? (
                          <span
                            className="rte-watermark"
                            style={watermarkCssVars(pageSetup.watermark) as React.CSSProperties}
                          >
                            <span>{pageSetup.watermark.text}</span>
                          </span>
                        ) : null}
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
        {pageSetupOpen || libraryOpen || versionsOpen || templatesOpen ? (
          <aside className="w-full shrink-0 xl:w-80">
            {templatesOpen ? (
              <TemplatePanel
                activeId={templateId || undefined}
                onApply={handleApplyTemplate}
                onClose={() => setTemplatesOpen(false)}
              />
            ) : null}
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
                canSnapshot={Boolean(docId)}
                onRestore={handleRestoreVersion}
                onCompare={handleCompareVersion}
                onManualSnapshot={handleManualSnapshot}
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
            losses.unlinkedComments > 0
              ? t('tools.richText.lossUnlinkedComments', { count: losses.unlinkedComments })
              : null,
            losses.mathAsImages > 0
              ? t('tools.richText.lossMathAsImages', { count: losses.mathAsImages })
              : null,
          ]
            .filter(Boolean)
            .join(' ')}
        </p>
      )}

      {markdownLosses && !failure && (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {[
            markdownLosses.comments > 0
              ? t('tools.richText.lossMdComments', { count: markdownLosses.comments })
              : null,
            markdownLosses.trackedChanges > 0
              ? t('tools.richText.lossMdTracked', { count: markdownLosses.trackedChanges })
              : null,
            markdownLosses.paragraphSpacing > 0
              ? t('tools.richText.lossMdSpacing', { count: markdownLosses.paragraphSpacing })
              : null,
            markdownLosses.floatingImages > 0
              ? t('tools.richText.lossMdFloating', { count: markdownLosses.floatingImages })
              : null,
            markdownLosses.pageSetupFields > 0
              ? t('tools.richText.lossMdPageSetup', { count: markdownLosses.pageSetupFields })
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

      <FootnoteDialog
        mode={footnoteDialog?.mode ?? null}
        initialNote={footnoteDialog?.note ?? ''}
        onCancel={handleFootnoteCancel}
        onConfirm={handleFootnoteSubmit}
        onRemove={handleFootnoteRemove}
      />

      <MathDialog
        mode={mathDialog?.mode ?? null}
        initialLatex={mathDialog?.latex ?? ''}
        initialDisplay={mathDialog?.display ?? false}
        onCancel={handleMathCancel}
        onConfirm={handleMathSubmit}
        onRemove={handleMathRemove}
      />

      {printReady && (
        <PrintLayer html={printHtml} flowRef={flowRef} watermark={pageSetup.watermark} />
      )}
    </div>
  );
}
