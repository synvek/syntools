import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NodeSelection } from '@tiptap/pm/state';
import { DOMParser as PMDOMParser, type Mark, type Node as PMNode } from '@tiptap/pm/model';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { PresentOverlay } from '@/core/components/PresentOverlay';
import { Icon } from '@/core/components/Icon';
import { EditorStatusBar } from '@/core/components/EditorStatusBar';
import {
  EDITOR_STRIP_TITLE_INPUT_CLASS,
  STRIP_ICON_BUTTON_CLASS,
  editorMenuItem,
  modifierShortcut,
  estimateJsonBytes,
  formatBytes,
  type EditorMenu,
} from '@/core/components/editorChrome';
import { ProgressBar } from '@/core/components/ProgressBar';
import { useViewportFill } from '@/core/hooks/useViewportFill';
import { hasOverlay } from '@/core/hooks/useOverlayStack';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import { downloadBytes } from '@/core/pdf/download';
import type { ToolResult } from '@/core/types';
import { PrintLayer } from './A4Page';
import { PrintPreviewDialog } from './PrintPreviewDialog';
import { ShortcutHelpDialog } from './ShortcutHelpDialog';
import { EditorContextMenu, type EditorContextTarget } from './EditorContextMenu';
import { EditorToolbar } from './EditorToolbar';
import { RulerBar } from './RulerBar';
import { FindReplacePanel } from './FindReplacePanel';
import {
  createFidelityReport,
  isFidelityMuted,
  muteFidelity,
  type FidelityReport,
} from '@/core/fidelity';
import { FidelityDialog } from '@/core/components/FidelityDialog';
import { docxLossIssues, markdownLossIssues } from './fidelity';
import { OutlinePanel } from './OutlinePanel';
import {
  buildExportFilename,
  checkImportFile,
  countDocStats,
  createEmptyDocHtml,
  htmlToPlain,
  sanitizeDocHtml,
  scanDocxExportLosses,
  scanMarkdownExportLosses,
  textToDocHtml,
  type DocxExportLosses,
  type MarkdownExportLosses,
} from './core';
import {
  clearDraft,
  draftWarningLevel,
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
  subscribeDocEvents,
  type DocMeta,
  type DocStoreEvent,
  type StoredVersion,
} from './docStore';
import { DocLibraryPanel, VersionHistoryPanel } from './DocLibraryPanel';
import { VersionDiffPanel } from './VersionDiffPanel';
import { ImageResizeOverlay } from './ImageResizeOverlay';
import { ShapeOverlay } from './ShapeOverlay';
import { ShapePanel } from './ShapePanel';
import { ShapeDrawLayer } from './ShapeDrawLayer';
import { useSelectedShape } from './useSelectedShape';
import { handleFloatingImagePointerDown } from './imageLayer';
import { exportDocxBlob, importDocx } from './docx';
import { printSupported, snapshotToPdf, printToPdf } from './pdf';
import { createExtensions } from './extensions';
import { PageSetupPanel } from './PageSetupPanel';
import { planComparison } from './revisions';
import { ReviewPanel } from './ReviewPanel';
import { applyFormat, captureFormat } from './formatPainter';
import {
  addCommentReply,
  anchoredCommentIds,
  htmlToMarkdown,
  syncCommentAnchors,
  type DocComment,
  type TrackedChange,
} from './docs';
import { findChangeRange } from './marks';
import type { TrackingEntry } from './tracking';
import { createCommentId } from '../../core/comments/model';
import { pageIndexOfPosition } from './core';
import { BookmarkDialog } from './BookmarkDialog';
import { FootnoteDialog } from './FootnoteDialog';
import { XrefDialog } from './XrefDialog';
import { injectXrefHtml, resolveAllXrefs, type XrefLabels } from './xrefs';
import {
  FOOTNOTE_EDIT_EVENT,
  findSelectedFootnote,
  injectFootnotes,
  type FootnoteEditDetail,
  type FootnoteLabels,
} from './footnotes';
import {
  ENDNOTE_EDIT_EVENT,
  findSelectedEndnote,
  injectEndnotes,
  type EndnoteEditDetail,
  type EndnoteLabels,
} from './endnotes';
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
import {
  buildStyleCss,
  inlineNamedStyles,
  mergeStyles,
  styleHeadingLevel,
  sanitizeStyles,
  type NamedStyle,
} from './namedStyles';
import { forcePageRelayout, type PageLayoutSnapshot } from './PageView';
import { buildTemplateApplication, type DocumentTemplate } from './templates';
import { TemplatePanel } from './TemplatePanel';
import { buildTocEntries, injectTocHtml, renderTocHtml, type TocLabels } from './toc';
import {
  DEFAULT_PAGE_SETUP,
  bandFieldFor,
  buildPrintPageCss,
  footerForPage,
  headerForPage,
  mergePageSetup,
  normalizePageSetup,
  pageMetricsToPx,
  watermarkCssVars,
  resolvePageMetrics,
  type PageSetupConfig,
  type PageSetupPatch,
} from './pageSetup';
import { registerRichTextStrings } from './strings';
import './editor.css';

// Tool strings are registered lazily with this chunk so they stay out of the first-screen bundle
registerRichTextStrings(i18n);

type Failure = Extract<ToolResult<unknown>, { ok: false }>;
import { PdfModeDialog, type PdfMode } from './PdfModeDialog';
type BusyKind = 'import' | 'docx' | 'pdf' | null;

/** 两种说明共用一套对话框与面板，但落到 Word 里是两个独立部件 */
type NoteKindName = 'footnote' | 'endnote';

const SAVE_DEBOUNCE_MS = 600;
/** Minimum usable editor height: on short windows let the page scroll rather than squash the editor */
const MIN_VIEWPORT_PX = 320;

/** Maximum issues shown in the spellcheck panel: skip the rest so long documents don't render hundreds */
const SPELL_ISSUE_LIMIT = 100;

/**
 * Image styles for single-file HTML export: the exported file carries no editor stylesheet,
 * so these must be inlined — otherwise wrap-left / wrap-right / top-bottom floats and inline
 * image alignment all break in the exported file.
 */
const IMAGE_EXPORT_CSS =
  'img{max-width:100%;height:auto;vertical-align:baseline}' +
  "img[data-layer='wrap-left']{float:left;margin:4px 12px 8px 0}" +
  "img[data-layer='wrap-right']{float:right;margin:4px 0 8px 12px}" +
  "img[data-layer='top-bottom']{display:block;margin:8px auto}";

/** Table cell vertical alignment for single-file HTML export (kept in sync with editor.css) */
const TABLE_EXPORT_CSS =
  "td[data-valign='middle'],th[data-valign='middle']{vertical-align:middle}" +
  "td[data-valign='bottom'],th[data-valign='bottom']{vertical-align:bottom}";

/** Single-file HTML export carries no editor stylesheet, so TOC styles are inlined (kept in sync with editor.css) */
const TOC_EXPORT_CSS =
  '.rte-toc{margin:.75em 0 1.25em}.rte-toc-title{margin:0 0 .5em;font-weight:600}' +
  '.rte-toc-list{list-style:none;margin:0;padding:0}' +
  '.rte-toc-item{display:flex;align-items:baseline;gap:.5em;border-bottom:1px dotted #e5e7eb;padding:.15em 0}' +
  '.rte-toc-text{flex:1;min-width:0;overflow-wrap:anywhere}' +
  '.rte-toc-page{flex-shrink:0;color:#6b7280}';

/**
 * Tab stops (P1-4) for single-file HTML export: the file carries no editor stylesheet, and a bare
 * `<span data-rte-tab>` would collapse to nothing (words run together). Inlining the default grid
 * keeps the export readable; custom stops print on the same 0.5in grid, as registered in the plan.
 */
const TAB_EXPORT_CSS =
  '[data-rte-tab]{white-space:pre;tab-size:48px;-moz-tab-size:48px}' +
  '[data-rte-tab]::before{content:"\\9"}';

/** Wait for the next frame to finish rendering (layout must settle before printing/screenshotting) */
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

/** Positions of the section-break nodes, in document order */
function sectionBreakPositions(editor: Editor): number[] {
  const positions: number[] = [];
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name === 'sectionBreak') positions.push(offset);
  });
  return positions;
}

/** 0-based index of the section that contains the caret (0 = the document-level setup) */
function sectionIndexAtCaret(editor: Editor): number {
  const { from } = editor.state.selection;
  return sectionBreakPositions(editor).filter((pos) => pos < from).length;
}

/**
 * Rich text editor tool: local editing + Word (.docx) import/export + dual-mode PDF export.
 * All content processing happens in the browser; nothing is ever sent out.
 */
export default function RichTextEditorTool() {
  const { t } = useTranslation();
  const initial = useMemo(() => readDraft(), []);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [snapshotHtml, setSnapshotHtml] = useState(initial?.html ?? createEmptyDocHtml());
  const [failure, setFailure] = useState<Failure | null>(null);
  const [losses, setLosses] = useState<DocxExportLosses | null>(null);
  // Sections merged on import (>1 only): mammoth drops w:sectPr, so multi-section documents collapse
  const [importSections, setImportSections] = useState(0);
  // Revisions present but not mappable onto mammoth's HTML: imported as plain text, reported (never guessed)
  const [importRevisionsLost, setImportRevisionsLost] = useState(false);
  /** Shapes dropped on import because their position could not be matched to the text */
  const [importShapesLost, setImportShapesLost] = useState(0);
  // Comments whose range crossed paragraphs: the editor cannot anchor those, so they are reported
  const [importCommentsLost, setImportCommentsLost] = useState(0);
  const [markdownLosses, setMarkdownLosses] = useState<MarkdownExportLosses | null>(null);
  /** Unified cross-product fidelity report (shown once per export) */
  const [fidelity, setFidelity] = useState<FidelityReport | null>(null);
  // Pagination snapshot: sheet positions + doc position of each page start (the TOC derives real page numbers from the latter)
  const [layout, setLayout] = useState<PageLayoutSnapshot>({ sheetTops: [], pageStarts: [] });
  const [printNotice, setPrintNotice] = useState(false);
  const [pageSetup, setPageSetup] = useState<PageSetupConfig>(() =>
    normalizePageSetup(initial?.pageSetup ?? DEFAULT_PAGE_SETUP),
  );
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [zoom, setZoom] = useState(initial?.zoom ?? 1);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [shapesOpen, setShapesOpen] = useState(false);
  /** 形状库下拉（挑预设 → 进入画布绘制） */
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  /** 正在拖拽绘制的预设：null = 不在绘制模式 */
  const [drawPrst, setDrawPrst] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [spellcheckOpen, setSpellcheckOpen] = useState(false);
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(false);
  /** English word list (loaded on demand from static assets; until loaded only the custom dictionary is used) */
  const [dictionary, setDictionary] = useState<ReadonlySet<string>>(() => new Set());
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const [dictionaryFailed, setDictionaryFailed] = useState(false);
  const [userWords, setUserWords] = useState<string[]>(() => initial?.userWords ?? []);
  /** Words ignored for this session only (not persisted: treated as a temporary decision) */
  const [ignoredWords, setIgnoredWords] = useState<string[]>([]);
  /** Id of the last applied template (persisted with the draft; the panel marks the current template from it) */
  const [templateId, setTemplateId] = useState(initial?.templateId ?? '');
  /** Named style set (draft v3): blocks only carry `data-rte-style`, the look lives here (P1-1) */
  const [namedStyles, setNamedStyles] = useState<NamedStyle[]>(() =>
    sanitizeStyles(initial?.styles),
  );
  /** Same set for callbacks that must not be rebuilt on every style edit (autosave, TOC level lookup) */
  const namedStylesRef = useRef<NamedStyle[]>(namedStyles);
  namedStylesRef.current = namedStyles;
  const [reviewOpen, setReviewOpen] = useState(false);
  /** 修订模式（P1-2）：开启后输入 / 删除自动变成可逐条接受-拒绝的修订；关闭时行为与旧版一致 */
  const [trackingMode, setTrackingMode] = useState(false);
  // Comment / tracked-change metadata is persisted with the draft: restore the previous session on init
  const [comments, setComments] = useState<DocComment[]>(() => initial?.comments ?? []);
  const [changes, setChanges] = useState<TrackedChange[]>(() => initial?.changes ?? []);
  /** Quote of the comment being composed (null = not composing) */
  const [pendingQuote, setPendingQuote] = useState<string | null>(null);
  const [author, setAuthor] = useState(() => readReviewerName());
  const [diffVersion, setDiffVersion] = useState<StoredVersion | null>(null);
  /** Outcome of the last "compare with file" run (shown inline; null = nothing to report) */
  const [compareNote, setCompareNote] = useState<string | null>(null);
  // The pagination plugin starts calling back while the editor is created (during render), so wait until mounted before setState
  const mountedRef = useRef(false);
  const pendingLayoutRef = useRef<PageLayoutSnapshot | null>(null);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [progress, setProgress] = useState(0);
  const [pdfMode, setPdfMode] = useState<PdfMode>(
    initial?.pdfMode === 'snapshot' ? 'snapshot' : 'text',
  );
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  /** 脚注 / 尾注共用一个对话框：kind 决定文案与落到哪个部件，pos null = 新建 */
  const [noteDialog, setNoteDialog] = useState<{
    kind: NoteKindName;
    mode: 'insert' | 'edit';
    pos: number | null;
    note: string;
  } | null>(null);
  /** Math dialog: null = closed; pos null = create new */
  const [mathDialog, setMathDialog] = useState<{
    mode: 'insert' | 'edit';
    pos: number | null;
    latex: string;
    display: boolean;
  } | null>(null);
  /** Bookmark dialog (RTE-03): insert / rename / delete / jump, all in one panel */
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  /** 交叉引用对话框：选书签 + 选模式，插入一条活引用 */
  const [xrefsOpen, setXrefsOpen] = useState(false);
  const [printReady, setPrintReady] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  /** Keyboard shortcut help, opened from the ⋯ menu and closed through the shared overlay stack */
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  /** Short-lived "saved" confirmation for Ctrl/⌘+S (the status bar dot is the passive indicator) */
  const [saveFlash, setSaveFlash] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(initial?.view ?? 'flow');
  /**
   * Inline header / footer editing (page view). `page` is 1-based, because the field to write depends
   * on the page's parity when 奇偶页不同 is on.
   */
  const [bandEdit, setBandEdit] = useState<{ part: 'header' | 'footer'; page: number } | null>(
    null,
  );
  /** Escape must not be followed by the blur-commit that React fires while unmounting the input */
  const bandCancelledRef = useRef(false);
  const [bandDraft, setBandDraft] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [versions, setVersions] = useState<StoredVersion[]>([]);
  const [docId, setDocId] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<'degraded' | 'nearLimit' | 'failed' | null>(null);
  /** 另一个标签页保存/删除了当前文档：提示用户，避免两边静默互相覆盖 */
  const [remoteChange, setRemoteChange] = useState<DocStoreEvent | null>(null);
  /** 乐观锁拒绝了本次保存（本地内容仍留在草稿里，等用户决定是否载入对方版本） */
  const [saveConflict, setSaveConflict] = useState(false);
  /**
   * 另一个标签页持有更新版本时，本标签页不再写文档（草稿照常写）：既避免连续的无谓冲突，
   * 也避免用户还没看到提示就被覆盖。
   */
  const remoteBlocksSaveRef = useRef(false);
  remoteBlocksSaveRef.current = Boolean(remoteChange) || saveConflict;
  const [saved, setSaved] = useState(Boolean(initial));
  const flowRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  /** Editor height = remaining first-screen space (status bar stays in view, "related tools" is pushed below the fold) */
  const viewportMax = useViewportFill(viewportRef, { min: MIN_VIEWPORT_PX });
  const importInputRef = useRef<HTMLInputElement | null>(null);
  /** Separate picker for local text formats (.txt / .md / .html), handled by the same import function */
  const textImportRef = useRef<HTMLInputElement | null>(null);
  /** "Compare with file" picker (same .docx path as import, but the result becomes revisions) */
  const compareInputRef = useRef<HTMLInputElement | null>(null);
  /** Image picker for the Insert menu (the toolbar owns its own hidden input) */
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const titleRef = useRef(title);
  titleRef.current = title;
  const viewRef = useRef(viewMode);
  viewRef.current = viewMode;
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  /** Editor context menu: hit target and position (viewport coordinates) */
  const [contextMenu, setContextMenu] = useState<EditorContextTarget | null>(null);
  /** Horizontal ruler toggle (like Word's ruler, shown by default) */
  const [rulerOpen, setRulerOpen] = useState(true);
  // Page geometry (mm) -> pixels: follows page setup changes; plugins read the latest values via getters
  const metrics = useMemo(() => resolvePageMetrics(pageSetup), [pageSetup]);
  /**
   * P1-5: intrinsic height for `content-visibility: auto` on the page sheets.
   * Off-screen sheets then skip layout and paint entirely — without it a 200-page document lays out
   * 300+ absolutely-positioned sheets on every keystroke.
   */
  const sheetHeightPx = useMemo(() => Math.round(pageMetricsToPx(metrics).heightPx), [metrics]);
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;
  const getMetrics = useCallback(() => metricsRef.current, []);
  // Sheets are absolutely positioned and don't contribute to parent height: when content is shorter
  // than a full page, the gray workbench would end early. Give the content area a minimum height
  // based on the last sheet's bottom edge so the gray background fills through the last page.
  const sheetBottomPx = useMemo(() => {
    const tops = layout.sheetTops;
    if (tops.length === 0) return 0;
    return Math.round(tops[tops.length - 1] + pageMetricsToPx(metrics).heightPx + 12);
  }, [layout, metrics]);

  const placeholder = useMemo(() => t('tools.richText.placeholder'), [t]);
  /** Pagination snapshot callback: update only when sheet positions or page breaks change, avoiding pointless re-renders */
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
  const endnoteLabels = useMemo<EndnoteLabels>(
    () => ({ name: t('tools.richText.endnote'), empty: t('tools.richText.endnoteEmpty') }),
    [t],
  );
  /** 交叉引用的"目标书签已删除"占位文字（NodeView 与导出注入共用一份） */
  const xrefLabels = useMemo<XrefLabels>(() => ({ missing: t('tools.richText.xrefMissing') }), [t]);
  /** Click a formula in the body (NodeView callback) -> open the edit dialog */
  const handleMathSelect = useCallback((pos: number, latex: string, display: boolean) => {
    setMathDialog({ mode: 'edit', pos, latex, display });
  }, []);
  // The spellcheck dictionary and toggle are exposed to the PM plugin via refs + getters (no editor rebuild after the word list loads).
  // This must be declared before useEditor: the editor is constructed synchronously during render and plugin state.init calls these getters immediately.
  const userWordsRef = useRef<string[]>(initial?.userWords ?? []);
  const dictionaryRef = useRef<ReadonlySet<string>>(dictionary);
  const spellcheckEnabledRef = useRef(false);
  /** Spellcheck reads the live dictionary and toggle (stable getter identity, so the plugin never needs rebuilding) */
  const getSpellDictionary = useCallback(
    () => ({ words: dictionaryRef.current, userWords: userWordsRef.current }),
    [],
  );
  const isSpellcheckEnabled = useCallback(() => spellcheckEnabledRef.current, []);
  /** Revision mode reads the toggle through a ref as well: flipping it must not rebuild the editor */
  const trackingModeRef = useRef(false);
  const isTrackingEnabled = useCallback(() => trackingModeRef.current, []);
  /**
   * Sink for the revisions one dispatch produced. The callbacks live in a ref because the author
   * (`resolveAuthor`) is defined further down and depends on the current language / reviewer name;
   * `createExtensions` only needs a stable trampoline.
   */
  const trackedChangeSink = useRef<(entries: TrackingEntry[]) => void>(() => {});
  /**
   * TOC levels from named styles (P1-1): a block styled 标题 2 belongs in the outline even when it is a
   * paragraph node. Reads the ref, so a style edit re-levels the TOC without rebuilding the extensions.
   */
  const tocStyleLevel = useCallback(
    (node: PMNode) => styleHeadingLevel(namedStylesRef.current, node),
    [],
  );
  const extensions = useMemo(
    () =>
      createExtensions({
        placeholder,
        onLayout: handleLayout,
        getPageMetrics: getMetrics,
        tocLabels,
        tocStyleLevel,
        xrefLabels,
        footnoteLabels,
        endnoteLabels,
        onMathSelect: handleMathSelect,
        spellcheck: { getDictionary: getSpellDictionary, isEnabled: isSpellcheckEnabled },
        tracking: {
          isEnabled: isTrackingEnabled,
          onChange: (entries) => trackedChangeSink.current(entries),
        },
      }),
    [
      placeholder,
      handleLayout,
      getMetrics,
      tocLabels,
      tocStyleLevel,
      xrefLabels,
      footnoteLabels,
      endnoteLabels,
      handleMathSelect,
      getSpellDictionary,
      isSpellcheckEnabled,
      isTrackingEnabled,
    ],
  );

  const editor = useEditor({ extensions, content: snapshotHtml });

  /** 选中形状（工具栏上下文格式栏与形状库高亮都要用） */
  const selectedShape = useSelectedShape(editor);

  // Force a relayout after page setup / zoom changes: page height and content width changes move the
  // page breaks, and neither lives in the document, so the plugin needs an explicit signal
  useEffect(() => {
    if (!editor || viewMode !== 'paged') return;
    const id = window.setTimeout(() => forcePageRelayout(editor.view), 0);
    return () => clearTimeout(id);
  }, [editor, viewMode, metrics, zoom]);

  // Apply the pagination snapshot the plugin cached during render, now that we're mounted
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

  const docIdRef = useRef<string | null>(null);
  docIdRef.current = docId;
  /** 当前文档已载入的修订号：保存时作为乐观锁基准，另一个标签页写过就会被拒绝 */
  const docRevRef = useRef(0);
  // Read review metadata through refs so persistNow keeps a stable identity;
  // otherwise every comment change would re-register the editor update listener
  const commentsRef = useRef<DocComment[]>(comments);
  const changesRef = useRef<TrackedChange[]>(changes);
  const templateIdRef = useRef<string>(initial?.templateId ?? '');

  /**
   * Named styles are applied through one stylesheet, so editing a style repaints every block that
   * points at it without rewriting the document (P1-1 acceptance).
   */
  const styleSheetRef = useRef<HTMLStyleElement | null>(null);
  useEffect(() => {
    if (!styleSheetRef.current) {
      const sheet = document.createElement('style');
      sheet.id = 'rte-named-styles';
      document.head.appendChild(sheet);
      styleSheetRef.current = sheet;
    }
    styleSheetRef.current.textContent = buildStyleCss(namedStyles);
  }, [namedStyles]);
  useEffect(
    () => () => {
      styleSheetRef.current?.remove();
      styleSheetRef.current = null;
    },
    [],
  );

  /** Lazily allocate a document id: only persisted on first save */
  const ensureDocId = (): string => {
    if (!docIdRef.current) {
      const id = createDocId();
      docIdRef.current = id;
      setDocId(id);
      setCurrentDocId(id);
    }
    return docIdRef.current;
  };

  /** Unified persistence: localStorage draft (synchronous fallback + degraded mode) + IndexedDB document library (multi-doc / version history) */
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
        styles: namedStylesRef.current,
      };
      const result = writeDraftSafe(withPrefs);
      const level = draftWarningLevel(result);
      setSaved(result.ok);
      setDraftNotice(
        level === 'failed'
          ? 'failed'
          : level === 'nearLimit'
            ? 'nearLimit'
            : result.degraded
              ? 'degraded'
              : null,
      );
      const id = ensureDocId();
      // The other tab already owns a newer revision: keep the draft (written above) but leave the
      // document untouched until the user picks "reload" in the notice
      if (remoteBlocksSaveRef.current) return;
      // Optimistic lock: the revision this tab started from must still be current, otherwise the write
      // is refused and the notice below asks the user to load the newer version
      void saveDocument(id, withPrefs, { baseRev: docRevRef.current }).then((saved) => {
        if (saved.conflict) {
          setSaveConflict(true);
          // Keep the stale revision on purpose: further autosaves must not overwrite the other tab either
          return;
        }
        if (saved.ok) {
          docRevRef.current = saved.rev;
          setSaveConflict(false);
        }
        void listDocuments().then(setDocs);
      });
      // ensureDocId/setSaved/setDraftNotice have stable identities, no need to list them as deps
    },
    [pageSetup, zoom, pdfMode],
  );

  /** Sync review metadata (write both state and ref, since persistence reads the ref) */
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

  // Startup: restore the pointed-to document, or migrate the v1 draft into the document library
  useEffect(() => {
    void initDocStore().then((init) => {
      void listDocuments().then(setDocs);
      if (!init) return;
      docIdRef.current = init.docId;
      setDocId(init.docId);
      if (init.doc && editor && !editor.isDestroyed) {
        docRevRef.current = init.doc.rev ?? 0;
        setTitle(init.doc.title);
        editor.commands.setContent(init.doc.html);
        setSnapshotHtml(init.doc.html);
        setViewMode(init.doc.view ?? 'flow');
        setPageSetup(normalizePageSetup(init.doc.pageSetup ?? null));
        setZoom(init.doc.zoom ?? 1);
        setPdfMode(init.doc.pdfMode === 'snapshot' ? 'snapshot' : 'text');
        applyReview(init.doc);
        setSaved(true);
      }
    });
    // Run only once, after the editor is ready
  }, [editor, applyReview]);

  // Another tab saved / deleted the document currently open here: flag it instead of silently diverging
  useEffect(
    () =>
      subscribeDocEvents((event) => {
        if (event.id !== docIdRef.current) return;
        setRemoteChange(event);
      }),
    [],
  );

  // Deferred/async callbacks may land on an already destroyed editor (React StrictMode double mount), so check first
  const readHtml = useCallback((): string | null => {
    if (!editor || editor.isDestroyed) return null;
    try {
      return editor.getHTML();
    } catch {
      return null;
    }
  }, [editor]);

  // Persist after comment / tracked-change updates (previously they only lived in component state and were lost on refresh)
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

  // Latest callbacks for the update debounce. They change on almost every render, so keeping them in
  // refs lets the effect subscribe once — otherwise every re-render clears the pending timer and the
  // snapshot never updates (which silently disables the export menu entries).
  const persistRef = useRef(persistNow);
  persistRef.current = persistNow;
  const readHtmlRef = useRef(readHtml);
  readHtmlRef.current = readHtml;

  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handleUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const html = readHtmlRef.current();
        if (html === null) return;
        setSnapshotHtml(html);
        persistRef.current({ title: titleRef.current, html, view: viewRef.current });
      }, SAVE_DEBOUNCE_MS);
    };
    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
      if (timer) clearTimeout(timer);
    };
  }, [editor]);

  // Persist title changes too
  useEffect(() => {
    if (!editor) return;
    const timer = setTimeout(() => {
      const html = readHtml();
      if (html === null) return;
      persistNow({ title, html, view: viewRef.current });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [title, editor, persistNow, readHtml]);

  // Persist view switches immediately so the user's preference survives a refresh
  useEffect(() => {
    if (!editor) return;
    const html = readHtml();
    if (html === null) return;
    persistNow({ title: titleRef.current, html, view: viewMode });
  }, [viewMode, editor, persistNow, readHtml]);

  /**
   * TOC export content: the TOC node is an atom, so `getHTML()` only outputs an empty shell.
   * Render a directly distributable TOC HTML from "current document + current pagination";
   * sheetTops is a dependency so page numbers are recomputed once pagination settles.
   */
  const tocHtml = useMemo(() => {
    // snapshotHtml is the signal that body content changed; an empty document needs no TOC
    if (!editor || editor.isDestroyed || !snapshotHtml) return '';
    const { entries, headings } = buildTocEntries(
      editor.state.doc,
      (pos) => pageIndexOfPosition(layout.pageStarts, pos),
      // Reads the state (not the ref) so editing a style's level re-derives the exported TOC
      (node) => styleHeadingLevel(namedStyles, node),
    );
    return renderTocHtml(entries, headings, tocLabels);
  }, [editor, snapshotHtml, layout, tocLabels, namedStyles]);

  /**
   * 交叉引用解析值：atom 节点在 `getHTML()` 里只是空壳，导出前必须按"当前文档 + 当前分页"填一次。
   * 与 TOC 一样依赖 layout：分页稳定后页码才会正确。
   */
  const xrefValues = useMemo(() => {
    if (!editor || editor.isDestroyed || !snapshotHtml) return new Map<string, string>();
    return resolveAllXrefs(editor.state.doc, (pos) => pageIndexOfPosition(layout.pageStarts, pos));
  }, [editor, snapshotHtml, layout]);

  /**
   * Unified preparation before export: fill in TOC content + footnote numbering and the end-of-document summary.
   * Both TOC and footnotes are "render-time derived" content (atom nodes serialize to an empty shell,
   * the footnote summary is a widget); without this step print / PDF / Word / Markdown lose content.
   */
  const prepareExportHtml = useCallback(
    (html: string): string =>
      injectXrefHtml(
        injectEndnotes(
          injectFootnotes(injectTocHtml(html, tocHtml), footnoteLabels),
          endnoteLabels,
        ),
        xrefValues,
        xrefLabels,
      ),
    [tocHtml, footnoteLabels, endnoteLabels, xrefValues, xrefLabels],
  );

  /** Shared by print / snapshot PDF / present / single-file HTML: the prepared HTML */
  const printHtml = useMemo(
    // Exports leave without our stylesheet, so the named styles are expanded to inline CSS (P1-1)
    () => injectMath(inlineNamedStyles(prepareExportHtml(snapshotHtml), namedStyles)),
    [prepareExportHtml, snapshotHtml, namedStyles],
  );

  // Read-only HTML for presentation: reuse the same sanitizing path as PDF export to avoid injection risk
  const presentHtml = useMemo(() => {
    const result = sanitizeDocHtml(printHtml);
    return result.ok ? result.value : '';
  }, [printHtml]);

  /**
   * File-command handlers live in a ref so the keydown listener can be registered once: an
   * empty-dependency effect would otherwise capture handlers from the first render. (P0-3.2)
   */
  const fileActionsRef = useRef({
    print: () => {},
    save: () => {},
    create: () => {},
  });

  // ⌘/Ctrl+F find, +P print, +S save locally, +N new document; Esc closes find
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        const key = event.key.toLowerCase();
        if (key === 'f') {
          event.preventDefault();
          setFindOpen(true);
          return;
        }
        if (!event.altKey && key === 'p') {
          event.preventDefault();
          fileActionsRef.current.print();
          return;
        }
        if (!event.altKey && key === 's') {
          event.preventDefault();
          fileActionsRef.current.save();
          return;
        }
        if (!event.altKey && key === 'n') {
          event.preventDefault();
          fileActionsRef.current.create();
        }
      }
      // P0-4: an open dialog / menu owns Escape; find must not be cleared underneath it
      if (event.key === 'Escape' && !hasOverlay()) setFindOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!saveFlash) return;
    const timer = window.setTimeout(() => setSaveFlash(false), 2000);
    return () => window.clearTimeout(timer);
  }, [saveFlash]);

  const stats = useMemo(() => countDocStats(htmlToPlain(snapshotHtml)), [snapshotHtml]);
  const isEmpty = stats.chars === 0;

  const handleImport = async (file: File) => {
    setBusy('import');
    setFailure(null);
    setImportRevisionsLost(false);
    setImportCommentsLost(0);
    setImportShapesLost(0);
    const check = checkImportFile(file);
    if (!check.ok) {
      setBusy(null);
      setFailure(check);
      return;
    }
    if (check.value !== 'docx') {
      // Local text formats: convert on the client, then commit through the same editor/persistence path
      try {
        const text = await file.text();
        const converted = textToDocHtml(text, check.value);
        setBusy(null);
        if (!converted.ok) {
          setFailure(converted);
          return;
        }
        editor?.commands.setContent(converted.value);
        setSnapshotHtml(converted.value);
        applyReview({
          comments: [],
          changes: [],
          userWords: userWordsRef.current,
          templateId: templateIdRef.current,
        });
        persistNow({ title: titleRef.current, html: converted.value, view: viewRef.current });
        if (!titleRef.current.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
      } catch {
        setBusy(null);
        setFailure({ ok: false, error: 'IMPORT_FAILED' });
      }
      return;
    }
    let importedChanges: TrackedChange[] = [];
    let importedComments: DocComment[] = [];
    const result = await importDocx(file, {
      onLayout: ({ pageSetup: importedSetup, sectionCount }) => {
        // First section owns the document-level layout; partial data is merged over the current setup
        setPageSetup((prev) => normalizePageSetup({ ...prev, ...importedSetup }));
        setImportSections(sectionCount > 1 ? sectionCount : 0);
      },
      onReview: ({ changes: readChanges, comments: readComments, degraded, skippedComments }) => {
        importedChanges = readChanges;
        importedComments = readComments;
        setImportRevisionsLost(degraded);
        setImportCommentsLost(skippedComments);
      },
      // Shapes are only restored when their block position provably matches the imported text
      onShapes: ({ skipped }) => setImportShapesLost(skipped),
      // Structured-import side channel (P0-2.6): only fires with USE_OOXML_IR on, and never changes
      // the imported HTML — it just explains the three grouped losses in the shared fidelity dialog
      onIr: ({ issues }) => {
        if (issues.length === 0) return;
        setFidelity(isFidelityMuted() ? null : createFidelityReport('rte', 'import', issues));
      },
      // Named styles the body actually uses (P1-1): adopting them is what makes the round trip keep
      // the look — the imported definitions win for the ids they define, the rest stays untouched
      onStyles: (imported) => {
        const next = mergeStyles(namedStylesRef.current, imported);
        namedStylesRef.current = next;
        setNamedStyles(next);
      },
    });
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    editor?.commands.setContent(result.value);
    setSnapshotHtml(result.value);
    // Imported revisions replace the current review list: they describe *this* document, and keeping the
    // previous entries would leave ids that no longer exist in the new content
    applyReview({
      comments: importedComments,
      changes: importedChanges,
      userWords: userWordsRef.current,
      templateId: templateIdRef.current,
    });
    if (importedChanges.length > 0) setReviewOpen(true);
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
    // TOC field cache entries come from the rendered TOC, so fill it in before exporting
    const html = prepareExportHtml(editor.getHTML());
    // Include comment and tracked-change metadata so Word can review them natively
    const result = await exportDocxBlob(
      html,
      title,
      pageSetup,
      {
        comments: commentsRef.current,
        changes: changesRef.current,
        author: resolveAuthor(),
      },
      // Named styles travel with the file: `w:styles` + `w:pStyle` keep the names for a round trip
      namedStylesRef.current,
    );
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    downloadBlob(result.value, buildExportFilename(title || 'document', 'docx'));
    // Report known losses after export instead of dropping them silently
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
      setFidelity(
        isFidelityMuted()
          ? null
          : createFidelityReport('rte', 'export', docxLossIssues(scanned.value)),
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
        // Text in the print view is selectable and searchable, and Chinese needs no embedded font.
        // Wait for fonts, then sync the page view's block pagination to the print flow for WYSIWYG output.
        try {
          await document.fonts.ready;
        } catch {
          // Ignore when the Font API is unavailable
        }
        // Wait until the print layer is actually mounted (up to ~20 frames) to avoid getting null
        for (let i = 0; i < 20 && !flowRef.current; i += 1) {
          await nextFrame();
        }
        if (!printSupported()) {
          // Environments like desktop WebViews have no print dialog: fall back to snapshot mode silently
          setPrintNotice(true);
        } else {
          try {
            // The flow view must also paginate on block boundaries: otherwise the print preview
            // reflows freely in the browser, splitting paragraphs mid-way and mismatching the page view
            printToPdf(flowRef.current, pageSetup);
            return;
          } catch {
            // Print dialog failed to open: fall back to snapshot mode
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
      // Any export exception gets visible feedback instead of "nothing happened"
      console.error('[richText] export pdf failed:', error);
      setFailure({ ok: false, error: 'RENDER_FAILED' });
    } finally {
      setBusy(null);
      setPrintReady(false);
    }
  };

  /** Insert a dynamic TOC: page numbers and entries are derived live from the pagination at render time */
  const handleInsertToc = () => {
    if (!editor) return;
    editor.chain().focus().insertTableOfContents().run();
  };

  /** Refresh TOC: trigger a pagination recompute so entries and page numbers follow (needed after async font/image loads) */
  const handleRefreshToc = () => {
    if (!editor) return;
    editor.chain().focus().refreshTableOfContents().run();
  };

  // Click a footnote / endnote reference in the body (NodeView dispatches a bubbling event) -> open the edit dialog
  useEffect(() => {
    const onEditFootnote = (event: Event) => {
      const detail = (event as CustomEvent<FootnoteEditDetail>).detail;
      if (!detail) return;
      setNoteDialog({ kind: 'footnote', mode: 'edit', pos: detail.pos, note: detail.note });
    };
    const onEditEndnote = (event: Event) => {
      const detail = (event as CustomEvent<EndnoteEditDetail>).detail;
      if (!detail) return;
      setNoteDialog({ kind: 'endnote', mode: 'edit', pos: detail.pos, note: detail.note });
    };
    document.addEventListener(FOOTNOTE_EDIT_EVENT, onEditFootnote);
    document.addEventListener(ENDNOTE_EDIT_EVENT, onEditEndnote);
    return () => {
      document.removeEventListener(FOOTNOTE_EDIT_EVENT, onEditFootnote);
      document.removeEventListener(ENDNOTE_EDIT_EVENT, onEditEndnote);
    };
  }, []);

  /** Toolbar entry: edit the selected note of that kind if any, otherwise create a new one */
  const handleNoteAction = (kind: NoteKindName) => {
    if (!editor) return;
    const selected =
      kind === 'footnote' ? findSelectedFootnote(editor.state) : findSelectedEndnote(editor.state);
    if (selected) setNoteDialog({ kind, mode: 'edit', pos: selected.pos, note: selected.note });
    else setNoteDialog({ kind, mode: 'insert', pos: null, note: '' });
  };

  const handleNoteSubmit = (note: string) => {
    if (!editor || !noteDialog) return;
    const chain = editor.chain().focus();
    if (noteDialog.kind === 'footnote') {
      if (noteDialog.mode === 'insert') chain.insertFootnote(note).run();
      else if (noteDialog.pos !== null) chain.updateFootnote(noteDialog.pos, note).run();
    } else if (noteDialog.mode === 'insert') {
      chain.insertEndnote(note).run();
    } else if (noteDialog.pos !== null) {
      chain.updateEndnote(noteDialog.pos, note).run();
    }
    setNoteDialog(null);
  };

  const handleNoteRemove = () => {
    if (!editor || !noteDialog || noteDialog.pos === null) return;
    const chain = editor.chain().focus();
    if (noteDialog.kind === 'footnote') chain.removeFootnote(noteDialog.pos).run();
    else chain.removeEndnote(noteDialog.pos).run();
    setNoteDialog(null);
  };

  const handleNoteCancel = () => setNoteDialog(null);

  /** Toolbar entry: edit the selected formula if any, otherwise create a new one */
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
   * Submit formula: on insert, use the dialog's inline/block choice;
   * on edit, keep the existing inline/block form (switching display mode changes the node type and invites surprises).
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

  // Mirror the dictionary and toggle into refs for the PM plugin's getters
  dictionaryRef.current = dictionary;
  spellcheckEnabledRef.current = spellcheckEnabled;
  trackingModeRef.current = trackingMode;

  const refreshSpellcheck = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.refreshSpellcheck();
  }, [editor]);

  /** Load the English word list (downloaded on demand, never bundled; failure only limits coverage) */
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
    // Recompute decorations once the word list is ready (the ref already points at the new list)
    if (editor && !editor.isDestroyed) editor.commands.refreshSpellcheck();
  }, [dictionaryLoading, editor]);

  const handleToggleSpellcheck = () => {
    const next = !spellcheckEnabled;
    setSpellcheckEnabled(next);
    spellcheckEnabledRef.current = next;
    if (next) void handleLoadDictionary();
    refreshSpellcheck();
  };

  /**
   * Revision mode: the toggle writes no mark itself, it only changes how the *next* edit gets recorded.
   * Turning it off leaves existing revisions in place — they stay accept/reject-able (Word behaves the
   * same way), which is also the rollback point: no flag, no interception.
   */
  const handleToggleTracking = () => {
    const next = !trackingMode;
    setTrackingMode(next);
    trackingModeRef.current = next;
  };

  const handleReplaceIssue = (issue: DocSpellIssue, replacement: string) => {
    if (!editor) return;
    editor.chain().focus().insertContentAt({ from: issue.from, to: issue.to }, replacement).run();
  };

  /**
   * A style edit is document state even though it does not touch a node: persist right away, otherwise
   * autosave (which only runs on body changes) would drop it on refresh.
   */
  const handleNamedStylesChange = (next: NamedStyle[]) => {
    namedStylesRef.current = next;
    setNamedStyles(next);
    persistNow({
      title: titleRef.current,
      html: readHtml() ?? snapshotHtml,
      view: viewRef.current,
    });
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

  /** The suggestion index is built on demand and cached: the bucketed index over 200k+ words is built only once */
  const wordIndexRef = useRef<WordIndex | null>(null);
  const suggestionsFor = useCallback(
    (word: string): string[] => {
      if (dictionary.size === 0) return [];
      if (!wordIndexRef.current) wordIndexRef.current = createWordIndex(dictionary);
      return suggest(word, wordIndexRef.current, 5, userWordsRef.current);
    },
    [dictionary],
  );

  /**
   * Issues in the current document (excluding words ignored this session, capped to protect rendering).
   * `capped` / `truncated` are reported to the panel: a cap must never look like "that is all there is".
   */
  const spellReport = useMemo(() => {
    // snapshotHtml signals both "document has content" and "body changed"
    if (!editor || editor.isDestroyed || !spellcheckEnabled || !snapshotHtml) {
      return { issues: [], capped: false, truncated: false };
    }
    const report = collectDocIssues(
      editor.state.doc,
      { words: dictionary, userWords },
      SPELL_ISSUE_LIMIT,
    );
    return {
      issues: report.issues.filter((issue) => !ignoredWords.includes(issue.word)),
      capped: report.capped,
      truncated: report.truncated,
    };
    // snapshotHtml is the body-change signal; dictionary / userWords / ignoredWords feed the check directly
  }, [editor, snapshotHtml, spellcheckEnabled, dictionary, userWords, ignoredWords]);

  /** New comment author: falls back to the default label when empty */
  const resolveAuthor = () => author.trim() || t('tools.richText.commentAuthor');

  /**
   * Revision mode keeps the same record shape as the manual marks (id / kind / text / author / time),
   * so the review panel, per-author filter and draft persistence need no special case for it.
   */
  trackedChangeSink.current = (entries: TrackingEntry[]) => {
    const createdAt = Date.now();
    const by = resolveAuthor();
    setChanges((prev) => [
      ...prev,
      ...entries.map((entry) => ({ ...entry, author: by, createdAt })),
    ]);
  };

  /**
   * New comment: record the selection quote, then edit inline in the panel (no native browser prompt any more).
   * An empty selection allows a "document-level" comment that writes no mark into the body.
   */
  const handleAddComment = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    setPendingQuote(editor.state.doc.textBetween(from, to, ' ').trim());
  };

  /** Submit comment: write the mark + persist metadata */
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

  /** Delete a comment: also remove the body mark so no orphan highlight is left behind */
  const handleRemoveComment = (id: string) => {
    editor?.chain().focus().removeCommentMark(id).run();
    setComments((prev) => prev.filter((comment) => comment.id !== id));
  };

  /**
   * Mark resolved / reopen.
   * Resolving removes the body mark (entry and quote are kept) so the anchor stops disturbing reading;
   * reopening only flips the state — the original selection can't be reproduced, so the mark isn't rebuilt.
   */
  const handleToggleResolved = (id: string, resolved: boolean) => {
    if (resolved) editor?.chain().focus().removeCommentMark(id).run();
    setComments((prev) =>
      prev.map((comment) => (comment.id === id ? { ...comment, resolved } : comment)),
    );
  };

  /** Reply to a comment: metadata only, the anchor mark is untouched */
  const handleReplyComment = (id: string, text: string) => {
    setComments((prev) =>
      addCommentReply(prev, id, {
        id: createCommentId('r'),
        author: resolveAuthor(),
        createdAt: Date.now(),
        body: text,
      }),
    );
  };

  /**
   * 格式刷: copy the run formatting of the current selection and paint it onto the next non-empty
   * selection (`formatPainter.ts` owns the mark whitelist). `painterSticky` mirrors Word's
   * double-click: the painter stays armed so several selections can be painted in a row.
   */
  const [painterActive, setPainterActive] = useState(false);
  const [painterSticky, setPainterSticky] = useState(false);
  const painterMarks = useRef<Mark[] | null>(null);
  /** Guards the dispatch inside `applyFormat` from re-entering through `selectionUpdate` */
  const painting = useRef(false);

  const armPainter = () => {
    if (!editor) return false;
    const marks = captureFormat(editor);
    // A plain paragraph has nothing to copy: arming an empty painter would look broken
    if (!marks.length) return false;
    painterMarks.current = marks;
    setPainterActive(true);
    return true;
  };

  const stopPainter = () => {
    painterMarks.current = null;
    setPainterActive(false);
    setPainterSticky(false);
  };

  const handleTogglePainter = () => {
    if (painterActive) {
      stopPainter();
      return;
    }
    armPainter();
  };

  /** Word's locked painter: arm once, then paint selection after selection until switched off */
  const handleLockPainter = () => {
    if (painterActive && painterSticky) {
      stopPainter();
      return;
    }
    if (armPainter()) setPainterSticky(true);
  };

  useEffect(() => {
    if (!editor || !painterActive) return;
    const handleSelectionUpdate = () => {
      const marks = painterMarks.current;
      if (!marks || painting.current) return;
      if (editor.state.selection.empty) return;
      painting.current = true;
      const painted = applyFormat(editor, marks);
      painting.current = false;
      if (!painted) return;
      // The one-shot painter drops its snapshot; the locked one keeps painting
      if (!painterSticky) {
        painterMarks.current = null;
        setPainterActive(false);
      }
    };
    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, painterActive, painterSticky]);

  /** Tracked changes: mark the selection as insert/delete (local record + Mark) */

  const handleTrackChange = (kind: 'insert' | 'delete') => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');
    if (!text.trim()) return;
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // The id has to live in the mark too: the mark is what per-change accept/reject looks up,
    // the list entry alone would leave the command with nothing to find.
    if (kind === 'insert') editor.chain().focus().markTrackedInsert(id).run();
    else editor.chain().focus().markTrackedDelete(id).run();
    setChanges((prev) => [
      ...prev,
      { id, kind, text, author: resolveAuthor(), createdAt: Date.now() },
    ]);
  };

  /**
   * A revision action can delete text that carried a comment mark. The comment record survives and is
   * flagged `orphaned` instead of being dropped: a reviewer losing a comment silently is worse than
   * seeing "anchor lost" next to it (the policy `core/comments/model.ts` already uses for threads).
   */
  const refreshCommentAnchors = () => {
    if (!editor) return;
    const alive = anchoredCommentIds(editor.state.doc);
    setComments((prev) => {
      const result = syncCommentAnchors(prev, alive);
      return result.changed ? result.comments : prev;
    });
  };

  /** Accept one change: the mark carries the id, so only that range is touched */
  const handleAcceptChange = (id: string) => {
    if (!editor) return;
    // The command fails when no mark carries this id any more — the edit was undone (revision mode
    // keeps undo as a plain undo) or already resolved elsewhere. Dropping the stale entry is the only
    // honest outcome; keeping it would leave a button that can never work.
    if (editor.chain().focus().acceptTrackedChange(id).run()) refreshCommentAnchors();
    setChanges((prev) => prev.filter((change) => change.id !== id));
  };

  /** Reject one change (insertions disappear, deletions come back, format revisions revert the block kind) */
  const handleRejectChange = (id: string) => {
    if (!editor) return;
    if (editor.chain().focus().rejectTrackedChange(id).run()) refreshCommentAnchors();
    setChanges((prev) => prev.filter((change) => change.id !== id));
  };

  const handleAcceptAll = () => {
    if (!editor) return;
    editor.chain().focus().acceptAllTracked().run();
    setChanges([]);
    refreshCommentAnchors();
  };

  const handleRejectAll = () => {
    if (!editor) return;
    editor.chain().focus().rejectAllTracked().run();
    setChanges([]);
    refreshCommentAnchors();
  };

  /** Panel navigation: select the revision range so the editor scrolls it into view */
  const handleFocusChange = (id: string) => {
    if (!editor) return;
    const range = findChangeRange(editor.state.doc, id);
    if (!range) return;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: range.from, to: range.to })
      .scrollIntoView()
      .run();
  };

  /**
   * Compare with a .docx file: the import is parsed into a ProseMirror doc and handed to
   * `planComparison`, which returns a single transaction — one comparison = one undo step.
   * The result is *revisions in this document*, not a separate view, so the same review panel and the
   * same accept/reject commands apply afterwards.
   */
  const handleCompareFile = async (file: File) => {
    if (!editor) return;
    setBusy('import');
    setFailure(null);
    setCompareNote(null);
    const result = await importDocx(file);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    const dom = new DOMParser().parseFromString(result.value, 'text/html');
    const target = PMDOMParser.fromSchema(editor.schema).parse(dom.body);
    const plan = planComparison(editor.state, target);
    if (!plan) {
      setCompareNote(t('tools.richText.compareIdentical'));
      return;
    }
    editor.view.dispatch(plan.tr);
    const createdAt = Date.now();
    const author = resolveAuthor();
    // Comparison ids repeat across runs (`cmp-1`, `cmp-2`, …), so previously accepted entries are dropped
    const fresh = new Set(plan.entries.map((entry) => entry.id));
    setChanges((prev) => [
      ...prev.filter((change) => !fresh.has(change.id)),
      ...plan.entries.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        text: entry.text,
        author,
        createdAt,
      })),
    ]);
    setReviewOpen(true);
  };

  /** Manual snapshot: flush current content first, then archive it, optionally with a note */
  const handleManualSnapshot = (note: string) => {
    const id = docIdRef.current;
    if (!id) return;
    const html = readHtml() ?? snapshotHtml;
    void saveDocument(
      id,
      {
        title: titleRef.current,
        html,
        view: viewRef.current,
        pageSetup,
        zoom,
        pdfMode,
        comments: commentsRef.current,
        changes: changesRef.current,
        userWords: userWordsRef.current,
        // Must be passed explicitly: omitting it would blank the stored template on this path
        templateId: templateIdRef.current || undefined,
      },
      { baseRev: docRevRef.current },
    )
      .then((saved) => {
        if (saved.conflict) {
          setSaveConflict(true);
          return null;
        }
        if (saved.ok) {
          docRevRef.current = saved.rev;
          setSaveConflict(false);
        }
        return saveManualVersion(id, note || undefined);
      })
      .then((version) => (version === null ? null : listVersions(id)))
      .then((list) => {
        if (!list) return;
        setVersions(list);
        setSaved(true);
      });
  };

  /** Open the version diff view (mutually exclusive with the history panel so the editor isn't squeezed twice) */
  const handleCompareVersion = (version: StoredVersion) => {
    setDiffVersion(version);
    setVersionsOpen(false);
    setLibraryOpen(false);
  };

  const handleAuthorChange = (next: string) => {
    setAuthor(next);
    writeReviewerName(next);
  };

  /** Export Markdown (pure function htmlToMarkdown: underline / highlight / inline styles are kept as GFM inline HTML) */
  const handleExportMarkdown = () => {
    if (!editor) return;
    // Fill in TOC and footnotes first, otherwise atom-node / widget-derived content vanishes from Markdown
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
      setFidelity(
        isFidelityMuted()
          ? null
          : createFidelityReport('rte', 'export', markdownLossIssues(scanned.value)),
      );
    }
  };

  /** Export single-file HTML (inline styles, opens/shares directly) */
  const handleExportHtml = () => {
    if (!editor) return;
    // Single-file HTML uses KaTeX MathML so formulas render correctly without shipping the stylesheet
    const body = injectMath(prepareExportHtml(editor.getHTML()));
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title || 'document'}</title><style>body{font-family:'PingFang SC','Microsoft YaHei',Arial,sans-serif;max-width:170mm;margin:20mm auto;line-height:1.8;font-size:15px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:.4rem .6rem;vertical-align:top}pre{background:#f3f4f6;padding:.75rem .9rem;border-radius:.5rem}${TABLE_EXPORT_CSS}${IMAGE_EXPORT_CSS}${TOC_EXPORT_CSS}${TAB_EXPORT_CSS}</style></head><body>${body}</body></html>`;
    const bytes = new TextEncoder().encode(html);
    downloadBytes(bytes, buildExportFilename(title || 'document', 'html'), 'text/html');
  };

  /** Export plain text (P0-3.3): prepared HTML → plain text, so TOC / notes are included too */
  const handleExportTxt = () => {
    if (!editor) return;
    const plain = htmlToPlain(prepareExportHtml(editor.getHTML()));
    downloadBytes(
      new TextEncoder().encode(plain),
      buildExportFilename(title || 'document', 'txt'),
      'text/plain;charset=utf-8',
    );
  };

  const resetEditorContent = (doc: {
    title: string;
    html: string;
    view?: ViewMode;
    pageSetup?: Partial<PageSetupConfig>;
    zoom?: number;
    pdfMode?: PdfMode;
    comments?: DocComment[];
    changes?: TrackedChange[];
    userWords?: string[];
    templateId?: string;
  }) => {
    setTitle(doc.title);
    editor?.commands.setContent(doc.html);
    setSnapshotHtml(doc.html);
    // View mode / page setup / zoom / pdf mode and the template id belong to the document: switching
    // document or restoring a version must carry them over, otherwise the previous layout leaks in
    if (doc.view) setViewMode(doc.view);
    if (doc.pageSetup) setPageSetup(normalizePageSetup(doc.pageSetup));
    if (typeof doc.zoom === 'number') setZoom(doc.zoom);
    if (doc.pdfMode) setPdfMode(doc.pdfMode);
    applyReview({
      comments: doc.comments ?? [],
      changes: doc.changes ?? [],
      userWords: doc.userWords,
      templateId: doc.templateId,
    });
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

  /** Image insert shared by the toolbar picker and the paste / drop path (data URL, then setImage) */
  const handleMenuImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        editor?.chain().focus().setImage({ src: reader.result }).run();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleNew = () => {
    const hasContent = stats.chars > 0 || title.trim().length > 0;
    if (hasContent && !window.confirm(t('common.discardConfirm'))) return;
    // Creating a document assigns a new id; the old document stays in the library
    const id = createDocId();
    docIdRef.current = id;
    // A brand-new document has no stored revision yet: save it unconditionally the first time
    docRevRef.current = 0;
    setDocId(id);
    setCurrentDocId(id);
    setRemoteChange(null);
    setSaveConflict(false);
    handleClear();
    void listDocuments().then(setDocs);
  };

  /** Point the single keydown listener at the latest handlers (see the ref declaration above). */
  fileActionsRef.current = {
    print: () => {
      setPrintPreviewOpen(false);
      void handleExportPdf('text');
    },
    save: () => {
      persistNow({
        title: titleRef.current,
        html: readHtml() ?? snapshotHtml,
        view: viewRef.current,
      });
      setSaveFlash(true);
    },
    create: handleNew,
  };

  /**
   * Apply template: page setup is merged with the template declaration (undeclared fields keep the current choice),
   * and the body is replaced with the template skeleton; confirm first if content exists to avoid overwriting.
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

  type ToolPanel = 'pageSetup' | 'styles' | 'shapes' | 'review' | 'templates' | 'spellcheck';

  /** Mutually exclusive toolbar panels: only one open at a time so the workspace isn't squeezed */
  const togglePanel = (panel: ToolPanel) => {
    setLibraryOpen(false);
    setVersionsOpen(false);
    setDiffVersion(null);
    setPageSetupOpen(panel === 'pageSetup' ? !pageSetupOpen : false);
    setStylesOpen(panel === 'styles' ? !stylesOpen : false);
    setShapesOpen(panel === 'shapes' ? !shapesOpen : false);
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
      docRevRef.current = doc.rev;
      setDocId(id);
      setCurrentDocId(id);
      setRemoteChange(null);
      setSaveConflict(false);
      // StoredDocument is already normalized to v2, so comments and tracked-change metadata come along directly
      resetEditorContent(doc);
      setLibraryOpen(false);
      setDiffVersion(null);
    });
  };

  /** 载入另一个标签页刚保存的版本（本地未保存的改动会被覆盖，所以只在用户点按钮时执行） */
  const handleReloadRemote = () => {
    const id = docIdRef.current;
    setRemoteChange(null);
    setSaveConflict(false);
    if (!id) return;
    void loadDocument(id).then((doc) => {
      if (!doc) return;
      // Adopt the freshest revision, otherwise the next save would be refused as a conflict too
      docRevRef.current = doc.rev;
      resetEditorContent(doc);
      setSaved(true);
    });
  };

  const handleDuplicateDoc = (id: string) => {
    void duplicateDocument(id, {
      untitled: t('tools.richText.untitledDoc'),
      suffix: t('tools.richText.copySuffix'),
    }).then(() => {
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
    // resetEditorContent also syncs the review refs (comments/changes/userWords/templateId),
    // so the following persist writes the snapshot's metadata instead of stale values
    resetEditorContent(version);
    // Keep the snapshot's own view mode: state is set inside resetEditorContent, so the ref is still stale here
    persistNow({ title: version.title, html: version.html, view: version.view ?? viewRef.current });
    setVersionsOpen(false);
    setDiffVersion(null);
  };

  /**
   * Editor context menu: take over the native menu (desktop has none anyway) and pick entries by hit target.
   * Links and images use DOM hits (matching marks / nodes); everything else depends on whether there is a selection.
   */
  const openContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!editor) return;
    event.preventDefault();
    const element = event.target as HTMLElement;
    const anchor = element.closest('a[href]');
    if (anchor && editor.view.dom.contains(anchor)) {
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        kind: 'link',
        href: anchor.getAttribute('href') ?? '',
      });
      return;
    }
    const image = element.closest('img');
    if (image && editor.view.dom.contains(image)) {
      let imagePos: number | undefined;
      try {
        imagePos = editor.view.posAtDOM(image, 0);
      } catch {
        imagePos = undefined;
      }
      setContextMenu({ x: event.clientX, y: event.clientY, kind: 'image', imagePos });
      return;
    }
    const { from, to } = editor.state.selection;
    setContextMenu({ x: event.clientX, y: event.clientY, kind: from !== to ? 'text' : 'empty' });
  };

  /** P0-4.4: Shift+F10 / the ContextMenu key is the keyboard equivalent of right-click */
  const openContextMenuFromKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!editor) return;
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    event.preventDefault();
    const { from, to } = editor.state.selection;
    let x: number;
    let y: number;
    try {
      const coords = editor.view.coordsAtPos(from);
      x = coords.left;
      y = coords.bottom;
    } catch {
      const rect = editor.view.dom.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + 24;
    }
    setContextMenu({ x, y, kind: from !== to ? 'text' : 'empty' });
  };

  // Multi-section (P2-2): the page setup panel edits the section under the cursor. Section 0 is the
  // document-level setup; later sections carry their own snapshot on the section-break node.
  const sectionState = (() => {
    if (!editor) return { index: 0, setup: pageSetup, headerLinked: false, footerLinked: false };
    const positions = sectionBreakPositions(editor);
    const index = sectionIndexAtCaret(editor);
    const pos = index > 0 ? positions[index - 1] : undefined;
    const node = pos === undefined ? null : editor.state.doc.nodeAt(pos);
    const raw = node?.attrs.pageSetup as Partial<PageSetupConfig> | null | undefined;
    return {
      index,
      setup: raw ? normalizePageSetup(raw) : pageSetup,
      headerLinked: node?.attrs.headerLinked === true,
      footerLinked: node?.attrs.footerLinked === true,
    };
  })();

  /** Toggle "link to previous" for the section under the cursor (mirrors what the docx writer emits) */
  const applySectionLink = (part: 'header' | 'footer', linked: boolean) => {
    if (!editor) return;
    // Resolve the section at apply time: the render-time snapshot can predate the last caret move, and
    // then the toggle (or the paper below) would silently land on the previous section
    const pos = sectionBreakPositions(editor)[sectionIndexAtCaret(editor) - 1];
    const node = pos === undefined ? null : editor.state.doc.nodeAt(pos);
    if (pos === undefined || !node) return;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        [part === 'header' ? 'headerLinked' : 'footerLinked']: linked,
      }),
    );
  };

  const applySectionPageSetup = (patch: PageSetupPatch) => {
    if (!editor) {
      setPageSetup((current) => mergePageSetup(current, patch));
      return;
    }
    const pos = sectionBreakPositions(editor)[sectionIndexAtCaret(editor) - 1];
    const node = pos === undefined ? null : editor.state.doc.nodeAt(pos);
    if (pos === undefined || !node) {
      setPageSetup((current) => mergePageSetup(current, patch));
      return;
    }
    // Merge onto the section's own snapshot, not onto the rendered one: consecutive edits must compose
    const base = node.attrs.pageSetup
      ? normalizePageSetup(node.attrs.pageSetup as Partial<PageSetupConfig>)
      : pageSetup;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        pageSetup: mergePageSetup(base, patch),
      }),
    );
  };

  /**
   * 页眉 / 页脚就地编辑（P1-4）：页面视图里双击页边空白带，改当前页实际显示的那一份文本。
   * 关闭态的 sheet 是 `pointer-events: none` 的装饰层，所以可点的命中区是一层独立的透明 button。
   */
  const openBandEdit = (part: 'header' | 'footer', page: number) => {
    setBandDraft(
      part === 'header' ? headerForPage(pageSetup, page) : footerForPage(pageSetup, page),
    );
    bandCancelledRef.current = false;
    setBandEdit({ part, page });
  };

  /** Escape: close without writing (the following blur must not commit) */
  const closeBandEdit = () => {
    bandCancelledRef.current = true;
    setBandEdit(null);
  };

  /** Enter / blur commits; the field is chosen by the page, so 奇偶页不同 edits the part that page shows */
  const commitBandEdit = () => {
    if (bandCancelledRef.current) {
      bandCancelledRef.current = false;
      return;
    }
    const target = bandEdit;
    if (!target) return;
    setBandEdit(null);
    const field = bandFieldFor(pageSetup, target.part, target.page);
    if (pageSetup[field] === bandDraft) return;
    if (field === 'header') applySectionPageSetup({ header: bandDraft });
    else if (field === 'evenHeader') applySectionPageSetup({ evenHeader: bandDraft });
    else if (field === 'footer') applySectionPageSetup({ footer: bandDraft });
    else applySectionPageSetup({ evenFooter: bandDraft });
  };

  /**
   * 只放"工具库里没有"的命令：新建 / 导入 / 导出 / 文档库 / 清空，外加 ribbon 没有入口的三项
   * （插入分节符、全选）。格式、插入、页面布局、引用、审阅、视图都在六个标签页上，撤销重做在快速访问栏，
   * 菜单里再列一遍只会出现两条路径、两处要同步。
   */
  const menu: EditorMenu = {
    id: 'more',
    label: t('common.more'),
    entries: [
      editorMenuItem('file-import', t('tools.richText.importDocx'), () =>
        importInputRef.current?.click(),
      ),
      editorMenuItem('file-import-text', t('tools.richText.importText'), () =>
        textImportRef.current?.click(),
      ),
      { type: 'separator' },
      editorMenuItem('file-print', t('tools.richText.print'), () => void handleExportPdf('text'), {
        disabled: isEmpty,
      }),
      editorMenuItem('file-print-preview', t('tools.richText.printPreview'), () =>
        setPrintPreviewOpen(true),
      ),
      { type: 'separator' },
      editorMenuItem(
        'file-export-docx',
        t('tools.richText.exportDocx'),
        () => void handleExportDocx(),
        { disabled: isEmpty },
      ),
      editorMenuItem(
        'file-export-pdf',
        t('tools.richText.exportPdf'),
        () => setPdfDialogOpen(true),
        { disabled: isEmpty },
      ),
      editorMenuItem(
        'file-export-markdown',
        t('tools.richText.exportMarkdown'),
        () => void handleExportMarkdown(),
        { disabled: isEmpty },
      ),
      editorMenuItem(
        'file-export-html',
        t('tools.richText.exportHtml'),
        () => void handleExportHtml(),
        { disabled: isEmpty },
      ),
      editorMenuItem('file-export-txt', t('tools.richText.exportTxt'), handleExportTxt, {
        disabled: isEmpty,
      }),
      { type: 'separator' },
      editorMenuItem('file-library', t('tools.richText.library'), openLibrary),
      { type: 'separator' },
      editorMenuItem('insert-section-break', t('tools.richText.sectionBreak'), () =>
        editor?.chain().focus().setSectionBreak({ startType: 'nextPage', pageSetup }).run(),
      ),
      editorMenuItem(
        'edit-select-all',
        t('tools.richText.selectAll'),
        () => editor?.chain().focus().selectAll().run(),
        { shortcut: modifierShortcut('A'), disabled: !editor },
      ),
      editorMenuItem('help-shortcuts', t('tools.richText.shortcutHelp'), () =>
        setShortcutHelpOpen(true),
      ),
      { type: 'separator' },
      editorMenuItem('file-clear', t('common.clear'), handleClear, {
        danger: true,
        disabled: isEmpty && !title,
      }),
    ],
  };

  const statusText = saved ? t('tools.richText.saved') : t('tools.richText.saving');
  const memory = useMemo(() => formatBytes(estimateJsonBytes(snapshotHtml)), [snapshotHtml]);

  return (
    <div className="flex flex-col gap-4" data-tool-root>
      <EditorToolbar
        editor={editor}
        menu={menu}
        headerRight={
          <>
            {saveFlash ? (
              <span
                data-testid="rich-text-save-notice"
                className="mr-1 shrink-0 text-[11px] text-green-600 dark:text-green-400"
              >
                {t('tools.richText.savedNotice')}
              </span>
            ) : null}
            <span
              role="status"
              title={statusText}
              aria-label={statusText}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${
                saved ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <Icon name={saved ? 'check' : 'clock'} className="h-3.5 w-3.5" />
            </span>
            <button
              type="button"
              onClick={handleClear}
              disabled={isEmpty && !title}
              aria-label={t('common.clear')}
              title={t('common.clear')}
              className={`${STRIP_ICON_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
            <input
              type="text"
              value={title}
              aria-label={t('tools.richText.docTitle')}
              placeholder={t('tools.richText.titlePlaceholder')}
              onChange={(event) => setTitle(event.target.value)}
              className={EDITOR_STRIP_TITLE_INPUT_CLASS}
            />
            <button
              type="button"
              onClick={handleNew}
              aria-label={t('common.newDoc')}
              title={t('common.newDoc')}
              className={STRIP_ICON_BUTTON_CLASS}
            >
              <Icon name="newDoc" className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              data-testid="rich-text-present"
              onClick={() => setPresenting(true)}
              disabled={isEmpty}
              aria-label={t('tools.richText.present')}
              title={t('tools.richText.present')}
              className={`${STRIP_ICON_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Icon name="present" className="h-3.5 w-3.5" />
            </button>
          </>
        }
        findOpen={findOpen}
        onToggleFind={() => setFindOpen((open) => !open)}
        outlineOpen={outlineOpen}
        onToggleOutline={() => setOutlineOpen((open) => !open)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        pageSetupOpen={pageSetupOpen}
        onTogglePageSetup={() => togglePanel('pageSetup')}
        rulerOpen={rulerOpen}
        onToggleRuler={() => setRulerOpen((open) => !open)}
        onInsertToc={handleInsertToc}
        onRefreshToc={handleRefreshToc}
        tocDisabled={isEmpty}
        onFootnote={() => handleNoteAction('footnote')}
        onEndnote={() => handleNoteAction('endnote')}
        onOpenBookmarks={() => setBookmarksOpen(true)}
        bookmarksOpen={bookmarksOpen}
        onOpenXrefs={() => setXrefsOpen(true)}
        xrefsOpen={xrefsOpen}
        onMath={handleMathAction}
        stylesOpen={stylesOpen}
        onToggleStyles={() => togglePanel('styles')}
        namedStyles={namedStyles}
        onNamedStylesChange={handleNamedStylesChange}
        shapesOpen={shapesOpen}
        shapeMenuOpen={shapeMenuOpen}
        onToggleShapeMenu={() => setShapeMenuOpen((open) => !open)}
        onPickShape={(prst) => {
          // Word / Excel 的顺序：先选形状，再在画布上画；面板留给长尾属性
          setShapeMenuOpen(false);
          setDrawPrst(prst);
        }}
        onOpenShapePanel={() => {
          setShapeMenuOpen(false);
          setShapesOpen(true);
        }}
        activeShapePrst={selectedShape?.attrs.prst ?? null}
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
        trackingMode={trackingMode}
        onToggleTracking={handleToggleTracking}
        onMarkInsert={() => handleTrackChange('insert')}
        onMarkDelete={() => handleTrackChange('delete')}
        onAcceptAll={handleAcceptAll}
        onRejectAll={handleRejectAll}
        hasTrackedChanges={changes.length > 0}
        onCompareFile={() => compareInputRef.current?.click()}
        onInsertSectionBreak={(type) =>
          editor?.chain().focus().setSectionBreak({ startType: type, pageSetup }).run()
        }
        painterActive={painterActive}
        painterSticky={painterSticky}
        onTogglePainter={handleTogglePainter}
        onLockPainter={handleLockPainter}
      />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        {/* Left column: outline (left of the document; falls back above it on narrow screens) */}
        {outlineOpen && editor ? (
          <aside className="w-full shrink-0 xl:sticky xl:top-4 xl:w-64 xl:self-start">
            <OutlinePanel editor={editor} />
          </aside>
        ) : null}

        {/* Middle column: the editor owns the flow; find floats above it so the page never jumps
            and the panel cannot slide under the sticky ribbon (z-30) while scrolling */}
        <div className="relative flex min-w-0 flex-1 flex-col gap-4">
          {findOpen && editor ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-end px-2 pt-2">
              <div className="pointer-events-auto max-w-full">
                <FindReplacePanel editor={editor} onClose={() => setFindOpen(false)} />
              </div>
            </div>
          ) : null}

          {/* Print paper size/margins: @page doesn't support CSS variables, so inject per current setup */}
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

          {/* Styles live in the ribbon gallery now (Word's model): no panel under the page */}
          {shapesOpen ? <ShapePanel editor={editor} onClose={() => setShapesOpen(false)} /> : null}
          {spellcheckOpen ? (
            <SpellcheckPanel
              enabled={spellcheckEnabled}
              onToggle={handleToggleSpellcheck}
              dictionaryLoaded={dictionary.size > 0}
              loading={dictionaryLoading}
              loadFailed={dictionaryFailed}
              onLoadDictionary={() => void handleLoadDictionary()}
              issues={spellReport.issues}
              capped={spellReport.capped}
              truncated={spellReport.truncated}
              issueLimit={SPELL_ISSUE_LIMIT}
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
              <button
                type="button"
                onClick={() => compareInputRef.current?.click()}
                className="h-7 rounded-md border border-gray-300 px-2 text-xs transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                {t('tools.richText.compareWithFile')}
              </button>
              {compareNote ? (
                <span className="text-xs text-amber-600 dark:text-amber-400">{compareNote}</span>
              ) : null}
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
              onReplyComment={handleReplyComment}
              onAcceptAll={handleAcceptAll}
              onRejectAll={handleRejectAll}
              onAcceptChange={handleAcceptChange}
              onRejectChange={handleRejectChange}
              onFocusChange={handleFocusChange}
              onClose={() => setReviewOpen(false)}
            />
          ) : null}

          {/* Shape formatting lives on the ribbon's contextual 形状格式 tab now */}
          {/* Editing workspace: fixed to the remaining first-screen height and scrolls internally (long documents don't stretch the page).
              The page view's gray workbench hangs off this container so it fills the whole scrollable area. */}
          <div
            className={`rte-editor-viewport${viewMode === 'paged' ? ' rte-viewport-paged' : ''}${
              rulerOpen ? ' rte-viewport-ruler' : ''
            }`}
            ref={viewportRef}
            style={viewportMax ? { height: `${viewportMax}px` } : undefined}
            onMouseDown={(event) => {
              if (!editor) return;
              // Clicks inside the editor are handled by ProseMirror plugins;
              // this catches floating images drawn outside the content box (workbench area) for select & drag
              if (editor.view.dom.contains(event.target as Node)) return;
              handleFloatingImagePointerDown(editor.view, event.nativeEvent);
            }}
          >
            {/* Horizontal ruler: millimeter ticks and margins pinned to the top (sticky, stays visible while scrolling) */}
            {rulerOpen ? (
              <RulerBar
                editor={editor}
                viewportRef={viewportRef}
                viewMode={viewMode}
                zoom={zoom}
                metrics={metrics}
                margin={pageSetup.margin}
              />
            ) : null}
            {/* Image resize handles: overlay layer (content coordinate space, follows scrolling) */}
            <ImageResizeOverlay editor={editor} viewportRef={viewportRef} />
            {/* Shape handles: resize / rotate / preset adjustment dots for the selected shape */}
            <ShapeOverlay editor={editor} viewportRef={viewportRef} />
            {/* Drag-to-draw: picked a preset in the gallery, now pull a rectangle on the page */}
            <ShapeDrawLayer
              editor={editor}
              prst={drawPrst}
              hint={t('tools.richText.shapeDrawHint')}
              onDone={() => setDrawPrst(null)}
            />
            {/* Zoom layer: CSS zoom participates in layout (scroll height stays correct); data-rte-zoom lets pagination undo it */}
            <div data-rte-zoom={zoom} style={{ zoom, ...(metrics.cssVars as React.CSSProperties) }}>
              <div
                className={`mx-auto w-full max-w-[860px] ${
                  viewMode === 'paged' ? 'rte-page-area' : ''
                }`}
              >
                <div
                  ref={surfaceRef}
                  onContextMenu={openContextMenu}
                  onKeyDown={openContextMenuFromKeyboard}
                  className={`rte-surface relative rounded-lg border border-gray-200 shadow-sm dark:border-gray-700 ${
                    viewMode === 'paged' ? 'rte-paged' : 'px-8 py-8'
                  } ${viewMode === 'flow' && metrics.columns > 1 ? 'rte-columns' : ''}`}
                  style={{
                    // Page background: honors the user's explicit choice even in dark theme (print/export use it too)
                    background: pageSetup.background ?? undefined,
                    ...(viewMode === 'paged' && sheetBottomPx > 0
                      ? { minHeight: `${sheetBottomPx}px` }
                      : {}),
                  }}
                >
                  {/* Flow view watermark: covers the whole editor (page view renders one per page) */}
                  {viewMode === 'flow' && pageSetup.watermark?.text.trim() ? (
                    <div
                      className="rte-watermark"
                      style={watermarkCssVars(pageSetup.watermark) as React.CSSProperties}
                    >
                      <span>{pageSetup.watermark.text}</span>
                    </div>
                  ) : null}
                  {/* Page view: one real sheet per page, content flows continuously */}
                  {viewMode === 'paged' &&
                    layout.sheetTops.map((top, index) => (
                      <div
                        key={index}
                        className="rte-page-sheet"
                        style={{
                          top: `${top}px`,
                          // P1-5 page virtualisation: the browser skips layout/paint for sheets
                          // outside the viewport and reserves the intrinsic size instead
                          contentVisibility: 'auto',
                          containIntrinsicSize: `auto ${sheetHeightPx}px`,
                          ...(pageSetup.background ? { background: pageSetup.background } : {}),
                        }}
                        aria-hidden="true"
                      >
                        {/* Render the watermark once per sheet (matching repeated per-page printing) */}
                        {pageSetup.watermark?.text.trim() ? (
                          <span
                            className="rte-watermark"
                            style={watermarkCssVars(pageSetup.watermark) as React.CSSProperties}
                          >
                            <span>{pageSetup.watermark.text}</span>
                          </span>
                        ) : null}
                        {/* Header / footer / page number: 首页不同 and 奇偶页不同 decide the text per page */}
                        {headerForPage(pageSetup, index + 1).trim() ? (
                          <span className="rte-page-header">
                            {headerForPage(pageSetup, index + 1)}
                          </span>
                        ) : null}
                        {footerForPage(pageSetup, index + 1).trim() || pageSetup.showPageNumber ? (
                          <span className="rte-page-footer">
                            {footerForPage(pageSetup, index + 1)}
                            {pageSetup.showPageNumber ? (
                              <span className="rte-page-footer-number">
                                {t('tools.richText.pageBadge', { page: index + 1 })}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        {/* Page badge appears only when the footer shows no page number, to avoid duplication */}
                        {!pageSetup.showPageNumber &&
                        !footerForPage(pageSetup, index + 1).trim() ? (
                          <span className="rte-page-badge">
                            {t('tools.richText.pageBadge', { page: index + 1 })}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  <EditorContent editor={editor} />
                  {/*
                    Header / footer bands (P1-4): the sheet below is a `pointer-events: none` decoration,
                    so Word's "double-click the header" gesture needs real hit areas. They live in the page
                    margins only — never over text — and are hidden in print.
                  */}
                  {viewMode === 'paged' &&
                    layout.sheetTops.map((top, index) => {
                      const page = index + 1;
                      // 首页不同 has no first-page text in the model (the blank first page *is* the feature)
                      if (pageSetup.differentFirstPage && page === 1) return null;
                      return (
                        <div
                          key={`band-${index}`}
                          className="rte-page-band-layer"
                          style={{ top: `${top}px`, height: `${sheetHeightPx}px` }}
                        >
                          {(['header', 'footer'] as const).map((part) => {
                            const label = t(
                              part === 'header'
                                ? 'tools.richText.editHeader'
                                : 'tools.richText.editFooter',
                            );
                            const active = bandEdit?.part === part && bandEdit.page === page;
                            return active ? (
                              <input
                                key={part}
                                autoFocus
                                className={`rte-page-band rte-page-band-${part} rte-page-band-input`}
                                aria-label={label}
                                value={bandDraft}
                                onChange={(event) => setBandDraft(event.target.value)}
                                onBlur={commitBandEdit}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    commitBandEdit();
                                  } else if (event.key === 'Escape') {
                                    event.preventDefault();
                                    closeBandEdit();
                                  }
                                }}
                              />
                            ) : (
                              <button
                                key={part}
                                type="button"
                                className={`rte-page-band rte-page-band-${part}`}
                                aria-label={label}
                                title={label}
                                onDoubleClick={() => openBandEdit(part, page)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    openBandEdit(part, page);
                                  }
                                }}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>

          {busy === 'pdf' && <ProgressBar value={progress} label={t('tools.richText.exporting')} />}
        </div>

        {/* Right column: page setup + document library / version history (right of the document; falls back below on narrow screens) */}
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
                setup={sectionState.setup}
                scopeLabel={t('tools.richText.pageSetupScope', { n: sectionState.index + 1 })}
                linkState={
                  sectionState.index > 0
                    ? {
                        header: sectionState.headerLinked,
                        footer: sectionState.footerLinked,
                        onToggle: applySectionLink,
                      }
                    : undefined
                }
                onChange={applySectionPageSetup}
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

      <EditorStatusBar
        left={
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
        right={<span>{t('common.memoryUsage', { size: memory })}</span>}
      />

      {presenting ? (
        <PresentOverlay
          title={title.trim() || t('tools.richText.titlePlaceholder')}
          onClose={() => setPresenting(false)}
          exitLabel={t('tools.richText.exitPresent')}
          failedLabel={t('tools.richText.presentFailed')}
          failed={!presentHtml}
          align="top"
        >
          {/* Read-only page: reuses the print layout (170mm white sheet + document font) without touching the editor itself */}
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
        data-testid="rich-text-import-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleImport(file);
        }}
      />

      {/* Local text formats share `handleImport`; conversion and DOMPurify sanitizing happen in core.ts */}
      <input
        ref={textImportRef}
        type="file"
        accept=".txt,.md,.markdown,.html,.htm,text/plain,text/markdown,text/html"
        className="hidden"
        data-testid="rich-text-text-import-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleImport(file);
        }}
      />

      {/* Same picker shape as import, but the file becomes revisions instead of replacing the document */}
      <input
        ref={compareInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        data-testid="rich-text-compare-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleCompareFile(file);
        }}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) handleMenuImage(file);
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
            : draftNotice === 'nearLimit'
              ? t('tools.richText.draftNearLimit')
              : t('tools.richText.draftSaveFailed')}
        </p>
      )}

      {(remoteChange || saveConflict) && !failure && (
        <div
          role="status"
          data-testid="rich-text-remote-change"
          className="flex flex-wrap items-center gap-2 text-sm text-amber-600 dark:text-amber-400"
        >
          <span>
            {saveConflict
              ? t('tools.richText.saveConflict')
              : remoteChange?.type === 'deleted'
                ? t('tools.richText.remoteDeleted')
                : t('tools.richText.remoteSaved')}
          </span>
          {(saveConflict || remoteChange?.type === 'saved') && (
            <button
              type="button"
              onClick={handleReloadRemote}
              className="rounded-md border border-amber-400 px-2 py-0.5 text-xs transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              {t('tools.richText.remoteReload')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setRemoteChange(null);
              setSaveConflict(false);
            }}
            className="rounded-md px-2 py-0.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {t('tools.richText.remoteDismiss')}
          </button>
        </div>
      )}

      {importRevisionsLost && !failure && (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {t('tools.richText.importRevisionsLost')}
        </p>
      )}

      {importShapesLost > 0 && !failure && (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {t('tools.richText.importShapesLost', { count: importShapesLost })}
        </p>
      )}

      {importCommentsLost > 0 && !failure && (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {t('tools.richText.importCommentsLost', { count: importCommentsLost })}
        </p>
      )}

      {importSections > 1 && !failure && (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {t('tools.richText.lossSections', { count: importSections })}
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
        kind={noteDialog?.kind ?? 'footnote'}
        mode={noteDialog?.mode ?? null}
        initialNote={noteDialog?.note ?? ''}
        onCancel={handleNoteCancel}
        onConfirm={handleNoteSubmit}
        onRemove={handleNoteRemove}
      />

      <BookmarkDialog
        editor={editor}
        open={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
      />

      <XrefDialog editor={editor} open={xrefsOpen} onClose={() => setXrefsOpen(false)} />

      <MathDialog
        mode={mathDialog?.mode ?? null}
        initialLatex={mathDialog?.latex ?? ''}
        initialDisplay={mathDialog?.display ?? false}
        onCancel={handleMathCancel}
        onConfirm={handleMathSubmit}
        onRemove={handleMathRemove}
      />

      <FidelityDialog
        report={fidelity}
        muted={isFidelityMuted()}
        onClose={() => setFidelity(null)}
        onMute={muteFidelity}
      />

      {contextMenu && editor ? (
        <EditorContextMenu
          editor={editor}
          target={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      ) : null}

      {printReady && (
        <PrintLayer
          html={printHtml}
          flowRef={flowRef}
          watermark={pageSetup.watermark}
          cssVars={metrics.cssVars}
        />
      )}

      <PrintPreviewDialog
        open={printPreviewOpen}
        html={presentHtml}
        cssVars={metrics.cssVars}
        onClose={() => setPrintPreviewOpen(false)}
        onPrint={() => {
          setPrintPreviewOpen(false);
          void handleExportPdf('text');
        }}
      />

      <ShortcutHelpDialog open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />
    </div>
  );
}
