import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NodeSelection } from '@tiptap/pm/state';
import { DOMParser as PMDOMParser } from '@tiptap/pm/model';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { PresentOverlay } from '@/core/components/PresentOverlay';
import { Icon } from '@/core/components/Icon';
import { EditorMenuBar } from '@/core/components/EditorMenuBar';
import { EditorStatusBar } from '@/core/components/EditorStatusBar';
import {
  EDITOR_ICON_BUTTON_CLASS,
  EDITOR_TITLE_INPUT_CLASS,
  editorMenuItem,
  estimateJsonBytes,
  formatBytes,
  type EditorMenu,
} from '@/core/components/editorChrome';
import { ProgressBar } from '@/core/components/ProgressBar';
import { useViewportFill } from '@/core/hooks/useViewportFill';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import { downloadBytes } from '@/core/pdf/download';
import type { ToolResult } from '@/core/types';
import { PrintLayer } from './A4Page';
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
import { planComparison } from './revisions';
import { ReviewPanel } from './ReviewPanel';
import { StylePanel } from './StylePanel';
import {
  addCommentReply,
  anchoredCommentIds,
  htmlToMarkdown,
  syncCommentAnchors,
  type DocComment,
  type TrackedChange,
} from './docs';
import { findChangeRange } from './marks';
import { createCommentId } from '../../core/comments/model';
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

/** Single-file HTML export carries no editor stylesheet, so TOC styles are inlined (kept in sync with editor.css) */
const TOC_EXPORT_CSS =
  '.rte-toc{margin:.75em 0 1.25em}.rte-toc-title{margin:0 0 .5em;font-weight:600}' +
  '.rte-toc-list{list-style:none;margin:0;padding:0}' +
  '.rte-toc-item{display:flex;align-items:baseline;gap:.5em;border-bottom:1px dotted #e5e7eb;padding:.15em 0}' +
  '.rte-toc-text{flex:1;min-width:0;overflow-wrap:anywhere}' +
  '.rte-toc-page{flex-shrink:0;color:#6b7280}';

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
  const [reviewOpen, setReviewOpen] = useState(false);
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
  /** Footnote dialog: null = closed; pos null = create new */
  const [footnoteDialog, setFootnoteDialog] = useState<{
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
  /** Editor height = remaining first-screen space (status bar stays in view, "related tools" is pushed below the fold) */
  const viewportMax = useViewportFill(viewportRef, { min: MIN_VIEWPORT_PX });
  const importInputRef = useRef<HTMLInputElement | null>(null);
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

  // Force a relayout after page setup / zoom changes: page height and content width changes move the page breaks
  useEffect(() => {
    if (!editor || viewMode !== 'paged') return;
    const id = window.setTimeout(() => {
      // An empty transaction triggers the plugin's update -> re-measure and re-plan
      editor.view.dispatch(editor.state.tr);
    }, 0);
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
  // Read review metadata through refs so persistNow keeps a stable identity;
  // otherwise every comment change would re-register the editor update listener
  const commentsRef = useRef<DocComment[]>(comments);
  const changesRef = useRef<TrackedChange[]>(changes);
  const templateIdRef = useRef<string>(initial?.templateId ?? '');

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
      };
      const result = writeDraftSafe(withPrefs);
      setSaved(result.ok);
      setDraftNotice(result.ok ? (result.degraded ? 'degraded' : null) : 'failed');
      const id = ensureDocId();
      void saveDocument(id, withPrefs).then(() => {
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
        setTitle(init.doc.title);
        editor.commands.setContent(init.doc.html);
        setSnapshotHtml(init.doc.html);
        applyReview(init.doc);
        setSaved(true);
      }
    });
    // Run only once, after the editor is ready
  }, [editor, applyReview]);

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
    const { entries, headings } = buildTocEntries(editor.state.doc, (pos) =>
      pageIndexOfPosition(layout.pageStarts, pos),
    );
    return renderTocHtml(entries, headings, tocLabels);
  }, [editor, snapshotHtml, layout, tocLabels]);

  /**
   * Unified preparation before export: fill in TOC content + footnote numbering and the end-of-document summary.
   * Both TOC and footnotes are "render-time derived" content (atom nodes serialize to an empty shell,
   * the footnote summary is a widget); without this step print / PDF / Word / Markdown lose content.
   */
  const prepareExportHtml = useCallback(
    (html: string): string => injectFootnotes(injectTocHtml(html, tocHtml), footnoteLabels),
    [tocHtml, footnoteLabels],
  );

  /** Shared by print / snapshot PDF / present / single-file HTML: the prepared HTML */
  const printHtml = useMemo(
    () => injectMath(prepareExportHtml(snapshotHtml)),
    [prepareExportHtml, snapshotHtml],
  );

  // Read-only HTML for presentation: reuse the same sanitizing path as PDF export to avoid injection risk
  const presentHtml = useMemo(() => {
    const result = sanitizeDocHtml(printHtml);
    return result.ok ? result.value : '';
  }, [printHtml]);

  // ⌘/Ctrl+F opens find & replace, Esc closes it (works while the editor is focused too)
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
    setImportRevisionsLost(false);
    setImportCommentsLost(0);
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

  // Click a footnote reference in the body (NodeView dispatches a bubbling event) -> open the edit dialog
  useEffect(() => {
    const onEditFootnote = (event: Event) => {
      const detail = (event as CustomEvent<FootnoteEditDetail>).detail;
      if (!detail) return;
      setFootnoteDialog({ mode: 'edit', pos: detail.pos, note: detail.note });
    };
    document.addEventListener(FOOTNOTE_EDIT_EVENT, onEditFootnote);
    return () => document.removeEventListener(FOOTNOTE_EDIT_EVENT, onEditFootnote);
  }, []);

  /** Toolbar entry: edit the selected footnote if any, otherwise create a new one */
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

  /** Spelling issues in the current document (excluding words ignored this session, capped to protect rendering) */
  const spellIssues = useMemo(() => {
    // snapshotHtml signals both "document has content" and "body changed"
    if (!editor || editor.isDestroyed || !spellcheckEnabled || !snapshotHtml) return [];
    const issues = collectDocIssues(
      editor.state.doc,
      { words: dictionary, userWords },
      SPELL_ISSUE_LIMIT,
    );
    return issues.filter((issue) => !ignoredWords.includes(issue.word));
    // snapshotHtml is the body-change signal; dictionary / userWords / ignoredWords feed the check directly
  }, [editor, snapshotHtml, spellcheckEnabled, dictionary, userWords, ignoredWords]);

  /** New comment author: falls back to the default label when empty */
  const resolveAuthor = () => author.trim() || t('tools.richText.commentAuthor');

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
    if (!editor.chain().focus().acceptTrackedChange(id).run()) return;
    setChanges((prev) => prev.filter((change) => change.id !== id));
    refreshCommentAnchors();
  };

  /** Reject one change (insertions disappear, deletions come back, format revisions revert the block kind) */
  const handleRejectChange = (id: string) => {
    if (!editor) return;
    if (!editor.chain().focus().rejectTrackedChange(id).run()) return;
    setChanges((prev) => prev.filter((change) => change.id !== id));
    refreshCommentAnchors();
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
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title || 'document'}</title><style>body{font-family:'PingFang SC','Microsoft YaHei',Arial,sans-serif;max-width:170mm;margin:20mm auto;line-height:1.8;font-size:15px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:.4rem .6rem}pre{background:#f3f4f6;padding:.75rem .9rem;border-radius:.5rem}${IMAGE_EXPORT_CSS}${TOC_EXPORT_CSS}</style></head><body>${body}</body></html>`;
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

  /** Menu image insert: same behaviour as the toolbar picker (read as data URL, then setImage) */
  const handleMenuImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        editor?.chain().focus().setImage({ src: reader.result }).run();
      }
    };
    reader.readAsDataURL(file);
  };

  /** Menu link insert: prompt for the URL; an empty value removes the link (same rule as the toolbar) */
  const handleMenuLink = () => {
    if (!editor) return;
    const href = window.prompt(t('tools.richText.linkPrompt'), 'https://');
    if (href === null) return;
    const chain = editor.chain().focus().extendMarkRange('link');
    if (href.trim()) chain.setLink({ href: href.trim() }).run();
    else chain.unsetLink().run();
  };

  const handleNew = () => {
    const hasContent = stats.chars > 0 || title.trim().length > 0;
    if (hasContent && !window.confirm(t('common.discardConfirm'))) return;
    // Creating a document assigns a new id; the old document stays in the library
    const id = createDocId();
    docIdRef.current = id;
    setDocId(id);
    setCurrentDocId(id);
    handleClear();
    void listDocuments().then(setDocs);
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

  type ToolPanel = 'pageSetup' | 'styles' | 'review' | 'templates' | 'spellcheck';

  /** Mutually exclusive toolbar panels: only one open at a time so the workspace isn't squeezed */
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
      // StoredDocument is already normalized to v2, so comments and tracked-change metadata come along directly
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
    // Sync review metadata before persisting, so restore doesn't overwrite snapshot comments with stale refs
    commentsRef.current = version.comments;
    changesRef.current = version.changes;
    userWordsRef.current = version.userWords ?? [];
    templateIdRef.current = version.templateId ?? '';
    persistNow({ title: version.title, html: version.html, view: viewRef.current });
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

  const menus: EditorMenu[] = [
    {
      id: 'file',
      label: t('common.menuFile'),
      entries: [
        editorMenuItem('file-new', t('common.newDoc'), handleNew, { shortcut: '⌘N' }),
        editorMenuItem('file-import', t('tools.richText.importDocx'), () =>
          importInputRef.current?.click(),
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
        { type: 'separator' },
        editorMenuItem('file-library', t('tools.richText.library'), openLibrary),
        { type: 'separator' },
        editorMenuItem('file-clear', t('common.clear'), handleClear, {
          danger: true,
          disabled: isEmpty && !title,
        }),
      ],
    },
    {
      id: 'edit',
      label: t('common.menuEdit'),
      entries: [
        editorMenuItem(
          'edit-undo',
          t('tools.richText.undo'),
          () => editor?.chain().focus().undo().run(),
          { shortcut: '⌘Z', disabled: !editor?.can().undo() },
        ),
        editorMenuItem(
          'edit-redo',
          t('tools.richText.redo'),
          () => editor?.chain().focus().redo().run(),
          { shortcut: '⇧⌘Z', disabled: !editor?.can().redo() },
        ),
        { type: 'separator' },
        editorMenuItem(
          'edit-select-all',
          t('tools.richText.selectAll'),
          () => editor?.chain().focus().selectAll().run(),
          { shortcut: '⌘A', disabled: !editor },
        ),
        editorMenuItem('edit-find', t('tools.richText.findReplace'), () => setFindOpen(true), {
          shortcut: '⌘F',
        }),
      ],
    },
    {
      id: 'insert',
      label: t('common.menuInsert'),
      entries: [
        editorMenuItem('insert-image', t('tools.richText.image'), () =>
          imageInputRef.current?.click(),
        ),
        editorMenuItem('insert-table', t('tools.richText.table'), () =>
          editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        ),
        editorMenuItem('insert-link', t('tools.richText.link'), handleMenuLink, {
          disabled: !editor,
        }),
        editorMenuItem('insert-divider', t('tools.richText.divider'), () =>
          editor?.chain().focus().setHorizontalRule().run(),
        ),
        editorMenuItem('insert-page-break', t('tools.richText.pageBreak'), () =>
          editor?.chain().focus().setPageBreak().run(),
        ),
        editorMenuItem('insert-section-break', t('tools.richText.sectionBreak'), () =>
          editor?.chain().focus().setSectionBreak({ startType: 'nextPage', pageSetup }).run(),
        ),
        { type: 'separator' },
        editorMenuItem('insert-toc', t('tools.richText.insertToc'), handleInsertToc, {
          disabled: isEmpty,
        }),
        editorMenuItem(
          'insert-footnote',
          t('tools.richText.footnoteInsert'),
          handleFootnoteAction,
          {
            disabled: !editor,
          },
        ),
        editorMenuItem('insert-math', t('tools.richText.mathInsert'), handleMathAction, {
          disabled: !editor,
        }),
      ],
    },
    {
      id: 'format',
      label: t('tools.richText.format'),
      entries: [
        editorMenuItem(
          'format-bold',
          `${t('tools.richText.bold')}${editor?.isActive('bold') ? ' ✓' : ''}`,
          () => editor?.chain().focus().toggleBold().run(),
          { shortcut: '⌘B', disabled: !editor },
        ),
        editorMenuItem(
          'format-italic',
          `${t('tools.richText.italic')}${editor?.isActive('italic') ? ' ✓' : ''}`,
          () => editor?.chain().focus().toggleItalic().run(),
          { shortcut: '⌘I', disabled: !editor },
        ),
        editorMenuItem(
          'format-underline',
          `${t('tools.richText.underline')}${editor?.isActive('underline') ? ' ✓' : ''}`,
          () => editor?.chain().focus().toggleUnderline().run(),
          { shortcut: '⌘U', disabled: !editor },
        ),
        editorMenuItem(
          'format-strike',
          `${t('tools.richText.strike')}${editor?.isActive('strike') ? ' ✓' : ''}`,
          () => editor?.chain().focus().toggleStrike().run(),
          { disabled: !editor },
        ),
        { type: 'separator' },
        editorMenuItem(
          'format-paragraph',
          `${t('tools.richText.paragraph')}${editor?.isActive('paragraph') ? ' ✓' : ''}`,
          () => editor?.chain().focus().setParagraph().run(),
          { disabled: !editor },
        ),
        editorMenuItem(
          'format-h1',
          `${t('tools.richText.h1')}${editor?.isActive('heading', { level: 1 }) ? ' ✓' : ''}`,
          () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
          { disabled: !editor },
        ),
        editorMenuItem(
          'format-h2',
          `${t('tools.richText.h2')}${editor?.isActive('heading', { level: 2 }) ? ' ✓' : ''}`,
          () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
          { disabled: !editor },
        ),
        editorMenuItem(
          'format-h3',
          `${t('tools.richText.h3')}${editor?.isActive('heading', { level: 3 }) ? ' ✓' : ''}`,
          () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
          { disabled: !editor },
        ),
        { type: 'separator' },
        editorMenuItem(
          'format-bullet-list',
          `${t('tools.richText.bulletList')}${editor?.isActive('bulletList') ? ' ✓' : ''}`,
          () => editor?.chain().focus().toggleBulletList().run(),
          { disabled: !editor },
        ),
        editorMenuItem(
          'format-ordered-list',
          `${t('tools.richText.orderedList')}${editor?.isActive('orderedList') ? ' ✓' : ''}`,
          () => editor?.chain().focus().toggleOrderedList().run(),
          { disabled: !editor },
        ),
        editorMenuItem(
          'format-quote',
          `${t('tools.richText.quote')}${editor?.isActive('blockquote') ? ' ✓' : ''}`,
          () => editor?.chain().focus().toggleBlockquote().run(),
          { disabled: !editor },
        ),
        editorMenuItem(
          'format-code-block',
          `${t('tools.richText.codeBlock')}${editor?.isActive('codeBlock') ? ' ✓' : ''}`,
          () => editor?.chain().focus().toggleCodeBlock().run(),
          { disabled: !editor },
        ),
        { type: 'separator' },
        editorMenuItem(
          'format-align-left',
          `${t('tools.richText.alignLeft')}${editor?.isActive({ textAlign: 'left' }) ? ' ✓' : ''}`,
          () => editor?.chain().focus().setTextAlign('left').run(),
          { disabled: !editor },
        ),
        editorMenuItem(
          'format-align-center',
          `${t('tools.richText.alignCenter')}${editor?.isActive({ textAlign: 'center' }) ? ' ✓' : ''}`,
          () => editor?.chain().focus().setTextAlign('center').run(),
          { disabled: !editor },
        ),
        editorMenuItem(
          'format-align-right',
          `${t('tools.richText.alignRight')}${editor?.isActive({ textAlign: 'right' }) ? ' ✓' : ''}`,
          () => editor?.chain().focus().setTextAlign('right').run(),
          { disabled: !editor },
        ),
        editorMenuItem(
          'format-align-justify',
          `${t('tools.richText.alignJustify')}${editor?.isActive({ textAlign: 'justify' }) ? ' ✓' : ''}`,
          () => editor?.chain().focus().setTextAlign('justify').run(),
          { disabled: !editor },
        ),
        { type: 'separator' },
        editorMenuItem(
          'format-clear',
          t('tools.richText.clearFormat'),
          () => editor?.chain().focus().unsetAllMarks().clearNodes().run(),
          { disabled: !editor },
        ),
      ],
    },
    {
      id: 'view',
      label: t('common.menuView'),
      entries: [
        editorMenuItem(
          'view-outline',
          `${t('tools.richText.outline')}${outlineOpen ? ' ✓' : ''}`,
          () => setOutlineOpen((open) => !open),
        ),
        editorMenuItem(
          'view-styles',
          `${t('tools.richText.styles')}${stylesOpen ? ' ✓' : ''}`,
          () => togglePanel('styles'),
        ),
        editorMenuItem(
          'view-templates',
          `${t('tools.richText.templates')}${templatesOpen ? ' ✓' : ''}`,
          () => togglePanel('templates'),
        ),
        editorMenuItem(
          'view-review',
          `${t('tools.richText.review')}${reviewOpen ? ' ✓' : ''}`,
          () => togglePanel('review'),
        ),
        editorMenuItem(
          'view-spellcheck',
          `${t('tools.richText.spellcheck')}${spellcheckOpen ? ' ✓' : ''}`,
          () => togglePanel('spellcheck'),
        ),
        { type: 'separator' },
        editorMenuItem(
          'view-page-setup',
          `${t('tools.richText.pageSetup')}${pageSetupOpen ? ' ✓' : ''}`,
          () => togglePanel('pageSetup'),
        ),
        editorMenuItem('view-ruler', `${t('tools.richText.ruler')}${rulerOpen ? ' ✓' : ''}`, () =>
          setRulerOpen((open) => !open),
        ),
        { type: 'separator' },
        editorMenuItem(
          'view-flow',
          `${t('tools.richText.viewFlow')}${viewMode === 'flow' ? ' ✓' : ''}`,
          () => setViewMode('flow'),
        ),
        editorMenuItem(
          'view-paged',
          `${t('tools.richText.viewPaged')}${viewMode === 'paged' ? ' ✓' : ''}`,
          () => setViewMode('paged'),
        ),
        { type: 'separator' },
        editorMenuItem('view-present', t('tools.richText.present'), () => setPresenting(true), {
          disabled: isEmpty,
        }),
        { type: 'separator' },
        ...[0.5, 0.75, 1, 1.25, 1.5, 2].map((level) =>
          editorMenuItem(
            `view-zoom-${Math.round(level * 100)}`,
            `${t('tools.richText.zoom')} ${Math.round(level * 100)}%${zoom === level ? ' ✓' : ''}`,
            () => setZoom(level),
          ),
        ),
      ],
    },
  ];

  const statusText = saved ? t('tools.richText.saved') : t('tools.richText.saving');
  const memory = useMemo(() => formatBytes(estimateJsonBytes(snapshotHtml)), [snapshotHtml]);

  return (
    <div className="flex flex-col gap-4" data-tool-root>
      <EditorMenuBar
        menus={menus}
        ariaLabel={t('common.menuBar')}
        actions={
          <>
            <span
              role="status"
              title={statusText}
              aria-label={statusText}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${
                saved ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <Icon name={saved ? 'check' : 'clock'} className="h-4 w-4" />
            </span>
            <button
              type="button"
              onClick={handleClear}
              disabled={isEmpty && !title}
              aria-label={t('common.clear')}
              title={t('common.clear')}
              className={`${EDITOR_ICON_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Icon name="trash" className="h-4 w-4" />
            </button>
          </>
        }
        center={
          <input
            type="text"
            value={title}
            aria-label={t('tools.richText.docTitle')}
            placeholder={t('tools.richText.titlePlaceholder')}
            onChange={(event) => setTitle(event.target.value)}
            className={EDITOR_TITLE_INPUT_CLASS}
          />
        }
        right={
          <>
            <button
              type="button"
              onClick={handleNew}
              aria-label={t('common.newDoc')}
              title={t('common.newDoc')}
              className={EDITOR_ICON_BUTTON_CLASS}
            >
              <Icon name="newDoc" className="h-4 w-4" />
            </button>
            <button
              type="button"
              data-testid="rich-text-present"
              onClick={() => setPresenting(true)}
              disabled={isEmpty}
              aria-label={t('tools.richText.present')}
              title={t('tools.richText.present')}
              className={`${EDITOR_ICON_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Icon name="present" className="h-4 w-4" />
            </button>
          </>
        }
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
        rulerOpen={rulerOpen}
        onToggleRuler={() => setRulerOpen((open) => !open)}
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
        {/* Left column: outline (left of the document; falls back above it on narrow screens) */}
        {outlineOpen && editor ? (
          <aside className="w-full shrink-0 xl:sticky xl:top-4 xl:w-64 xl:self-start">
            <OutlinePanel editor={editor} />
          </aside>
        ) : null}

        {/* Middle column: editor + editing panels still on top (find / styles / review) */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {findOpen && editor ? (
            <FindReplacePanel editor={editor} onClose={() => setFindOpen(false)} />
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
                        {/* Header / footer / page number: shared with Word export and snapshot PDF */}
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
                        {/* Page badge appears only when the footer shows no page number, to avoid duplication */}
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
            : t('tools.richText.draftSaveFailed')}
        </p>
      )}

      {importRevisionsLost && !failure && (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {t('tools.richText.importRevisionsLost')}
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
    </div>
  );
}
