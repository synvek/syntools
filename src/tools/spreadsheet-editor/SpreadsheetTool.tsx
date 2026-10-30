import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HintTip } from '@/core/components/DocumentHeader';
import { clearDraft, readDraft, writeDraftSafe } from './draft';
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
import { PresentOverlay } from '@/core/components/PresentOverlay';
import { ProgressBar } from '@/core/components/ProgressBar';
import { useViewportFill } from '@/core/hooks/useViewportFill';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import { downloadBytes } from '@/core/pdf/download';
import { useSettingsStore } from '@/stores/settings';
import type { ToolResult } from '@/core/types';
import {
  CSV_BOM,
  buildExportFilename,
  buildPresentGrid,
  checkImportFile,
  sanitizeFilename,
  summarizeWorkbook,
  type PresentGrid,
  type WorkbookSnapshotLite,
  type WorkbookSummary,
} from './core';
import { csvToSnapshot, snapshotToCsv } from './csv';
import { buildChartData, type ChartConfig, type ChartData } from './charts';
import { registerChartStrings } from './chartStrings';
import { registerStoreStrings } from './storeStrings';
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
import { registerSpreadsheetStrings } from './strings';
import {
  createEmptySnapshot,
  exportSnapshotToBytes,
  importXlsxToSnapshot,
  type WorkbookSnapshot,
} from './xlsx-io';
import { createUniverInstance, type SheetInfo, type UniverHandle } from './univer';
import {
  collectFieldKeys,
  computePivot,
  pivotToMatrix,
  readPivotSource,
  type PivotConfig,
} from './pivot';
import { registerPivotStrings } from './pivotStrings';
import { appendPivotSheets, buildPivotSheet, uniqueSheetName } from './pivotSheet';
import { PivotPanel } from './ui/PivotPanel';
import { PresentSheet } from './ui/PresentSheet';
import { ChartOverlay } from './ui/ChartOverlay';
import { PrintDialog } from './ui/PrintDialog';
import { CommentDialog } from './ui/CommentDialog';
import {
  countSheetComments,
  readSheetComments,
  setSheetThreads,
  threadsForSheet,
  withSheetComments,
  type SheetCommentMap,
} from './comments';
import {
  addReply,
  createThread,
  setThreadResolved,
  type CommentThread,
} from '../../core/comments/model';
import { exportSheetPdf, type CellRange } from './print';
import {
  createFidelityReport,
  isFidelityMuted,
  muteFidelity,
  type FidelityReport,
} from '@/core/fidelity';
import { FidelityDialog } from '@/core/components/FidelityDialog';
import { collectExportIssues } from './fidelity';
import { readWorkbookExtras, withWorkbookExtras, type WorkbookExtras } from './xlsx-extras';
import {
  DEFAULT_SHEET_PRINT_OPTIONS,
  printSheet,
  resolveUsedRange,
  type SheetPrintOptions,
} from './print';
import type { RawChartParts } from './rawChartParts';
import { SheetTabs } from './SheetTabs';
import './sheet.css';

// Tool copy is registered lazily with this chunk so it does not weigh down the initial bundle
registerSpreadsheetStrings(i18n);
registerChartStrings(i18n);
registerStoreStrings(i18n);
registerPivotStrings(i18n);

type Failure = Extract<ToolResult<unknown>, { ok: false }>;
/** 首版一个工作簿只保留一个透视表：多表会让"导出到哪张工作表"的语义含混 */
const PIVOT_ID = 'pivot-1';
/** 打印用的合成快照里只有一个工作表，id 固定即可 */
const PIVOT_SHEET_ID = 'pivot-print';
type BusyKind = 'import' | 'export' | null;

/**
 * 一张表已经被写入的范围（行数/列数），用于「更新透视表」前清掉旧值：
 * 换布局后行列可能变少，不清就会留下上一版的尾巴。
 */
function usedBlock(
  sheet: WorkbookSnapshot['sheets'][string] | undefined,
): { rows: number; columns: number } | undefined {
  if (!sheet) return undefined;
  let rows = 0;
  let columns = 0;
  for (const [row, cells] of Object.entries(sheet.cellData ?? {})) {
    for (const column of Object.keys(cells ?? {})) {
      rows = Math.max(rows, Number(row) + 1);
      columns = Math.max(columns, Number(column) + 1);
    }
  }
  return rows > 0 && columns > 0 ? { rows, columns } : undefined;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** Debounce after edits: avoids a full save() on every keystroke */
const SAVE_DEBOUNCE_MS = 600;

/**
 * Spreadsheet editor: Univer provides the editing surface; import and export happen entirely in the
 * browser. Every Univer side effect (CSS, instantiation) stays inside this lazy-loaded module so the
 * SSR pass in scripts/prerender.ts cannot trigger it.
 */
export default function SpreadsheetTool() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  /** Sheet height = whatever remains in the first viewport (sheet tabs / status bar stay visible, "related tools" is pushed below the fold) */
  const sheetHeight = useViewportFill(containerRef, { min: 460 });
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const handleRef = useRef<UniverHandle | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  /** Carries the current data across instance rebuilds (theme / locale switch) */
  const pendingRef = useRef<WorkbookSnapshot | null>(null);
  const [title, setTitle] = useState('');
  const [presenting, setPresenting] = useState(false);
  const [printTarget, setPrintTarget] = useState<{
    snapshot: WorkbookSnapshot;
    sheetId: string | null;
    selection: CellRange | null;
  } | null>(null);
  const [fidelity, setFidelity] = useState<FidelityReport | null>(null);
  const [presentGrid, setPresentGrid] = useState<PresentGrid | null>(null);
  const [presentFailed, setPresentFailed] = useState(false);
  /** Floating charts on the sheet: configs (persisted with the snapshot) + derived data + a selection hint */
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const chartsRef = useRef<ChartConfig[]>([]);
  chartsRef.current = charts;
  const [chartDataMap, setChartDataMap] = useState<Record<string, ChartData | null>>({});
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [chartNotice, setChartNotice] = useState(false);
  /** Sheet area size: the bounds for dragging / resizing charts */
  const [chartBounds, setChartBounds] = useState({ width: 0, height: 0 });
  const chartSeqRef = useRef(0);
  /** Pivot table (P2-4): analysis view over a source range, persisted in its own snapshot field */
  const [pivotConfigs, setPivotConfigs] = useState<PivotConfig[]>([]);
  const pivotConfigsRef = useRef<PivotConfig[]>([]);
  pivotConfigsRef.current = pivotConfigs;
  const [pivotOpen, setPivotOpen] = useState(false);
  const pivotOpenRef = useRef(false);
  pivotOpenRef.current = pivotOpen;
  const [pivotConfig, setPivotConfig] = useState<PivotConfig | null>(null);
  /** Snapshot the panel aggregates from: refreshed on every mutation so edits recompute immediately */
  const [pivotSnapshot, setPivotSnapshot] = useState<WorkbookSnapshot | null>(null);
  /** Cell comment threads (P1-2): keyed by sheet id, carried by the snapshot like syntoolsCharts */
  const [sheetComments, setSheetComments] = useState<SheetCommentMap>({});
  const commentsRef = useRef<SheetCommentMap>({});
  commentsRef.current = sheetComments;
  /** Only adopt comments from the first restored snapshot; later rebuilds carry a raw Univer snapshot */
  const commentsLoadedRef = useRef(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCell, setCommentCell] = useState<{ row: number; col: number } | null>(null);
  const [commentAuthor, setCommentAuthor] = useState('');
  /**
   * Persistence trigger: adding / moving / resizing / deleting a chart is not a Univer MUTATION, so
   * dirty tracking never sees it — persistence has to be requested explicitly. (Assigned once
   * scheduleSave exists.)
   */
  const scheduleSaveRef = useRef<() => void>(() => {});
  /** Content such as conditional formatting / data validation that survives the snapshot round-trip without semantic mapping */
  const extrasRef = useRef<WorkbookExtras | null>(null);
  /** Excel native chart parts that came with the imported file (written back verbatim, never parsed) */
  const rawPartsRef = useRef<RawChartParts | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  /**
   * Present: read the current workbook snapshot → turn it into a read-only grid.
   * It renders without the Univer instance, so the workbook being edited is left untouched.
   */
  const openPresent = () => {
    setPresentGrid(null);
    setPresentFailed(false);
    setPresenting(true);
    try {
      const handle = handleRef.current;
      const snapshot = handle?.getSnapshot();
      const grid = snapshot
        ? buildPresentGrid(snapshot, handleRef.current?.getActiveSheetId() ?? null)
        : null;
      if (grid) setPresentGrid(grid);
      else setPresentFailed(true);
    } catch {
      setPresentFailed(true);
    }
  };

  const setChartList = useCallback((next: ChartConfig[]) => {
    chartsRef.current = next;
    setCharts(next);
  }, []);

  /** Recompute the derived data of every chart from the current workbook (called after cell edits) */
  const applyChartData = useCallback((snapshot: WorkbookSnapshotLite, sheetId: string | null) => {
    const configs = chartsRef.current;
    if (configs.length === 0) {
      setChartDataMap({});
      return;
    }
    const next: Record<string, ChartData | null> = {};
    for (const config of configs) {
      const result = buildChartData(snapshot, config.sheetId ?? sheetId, config.range);
      next[config.id] = result.ok ? result.value : null;
    }
    setChartDataMap(next);
  }, []);

  /** Insert a floating chart into the sheet area: data comes from the current selection, position/size get defaults */
  const openChart = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const range = handle.getActiveRange();
    if (!range) {
      setChartNotice(true);
      return;
    }
    const sheetId = handle.getActiveSheetId();
    const result = buildChartData(handle.getSnapshot(), sheetId, range);
    if (!result.ok) {
      setChartNotice(true);
      return;
    }
    setChartNotice(false);
    chartSeqRef.current += 1;
    const offset = (chartsRef.current.length % 5) * 24;
    const config: ChartConfig = {
      id: `chart-${Date.now().toString(36)}-${chartSeqRef.current}`,
      type: 'bar',
      range,
      sheetId: sheetId ?? undefined,
      x: 24 + offset,
      y: 24 + offset,
      width: Math.max(260, Math.min(420, (chartBounds.width || 460) - 48)),
      height: Math.max(200, Math.min(280, (chartBounds.height || 320) - 48)),
    };
    setChartList([...chartsRef.current, config]);
    setSelectedChartId(config.id);
    setChartDataMap((prev) => ({ ...prev, [config.id]: result.value }));
    scheduleSaveRef.current();
  }, [chartBounds.height, chartBounds.width, setChartList]);

  /** Update a chart config; recompute its data immediately when the data range changes */
  const updateChart = useCallback(
    (id: string, patch: Partial<ChartConfig>) => {
      setChartList(
        chartsRef.current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
      if (patch.range) {
        const handle = handleRef.current;
        if (handle) applyChartData(handle.getSnapshot(), handle.getActiveSheetId());
      }
      scheduleSaveRef.current();
    },
    [applyChartData, setChartList],
  );

  const removeChart = useCallback(
    (id: string) => {
      setChartList(chartsRef.current.filter((item) => item.id !== id));
      setSelectedChartId((prev) => (prev === id ? null : prev));
      setChartDataMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      scheduleSaveRef.current();
    },
    [setChartList],
  );

  /** Point a chart at the current sheet selection */
  const pickRangeForChart = useCallback(
    (id: string) => {
      const handle = handleRef.current;
      if (!handle) return;
      const range = handle.getActiveRange();
      if (!range) {
        setChartNotice(true);
        return;
      }
      setChartNotice(false);
      updateChart(id, { range, sheetId: handle.getActiveSheetId() ?? undefined });
    },
    [updateChart],
  );

  const [summary, setSummary] = useState<WorkbookSummary>({
    sheets: 0,
    rows: 0,
    columns: 0,
    cells: 0,
    formulas: 0,
  });
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [runtimeError, setRuntimeError] = useState(false);
  // Local document library (IndexedDB): multiple workbooks + version history; degrades silently when unavailable
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [versions, setVersions] = useState<StoredVersion[]>([]);
  const [docId, setDocId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  /** Persistence failure notice: over the size cap (failed) / local storage unavailable (degraded) */
  const [draftNotice, setDraftNotice] = useState<'degraded' | 'failed' | null>(null);
  const docIdRef = useRef<string | null>(null);
  docIdRef.current = docId;
  const titleRef = useRef(title);
  titleRef.current = title;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Merge content this tool owns but Univer knows nothing about into the snapshot: conditional
   * formatting / data validation (round-trip preserved) plus the in-sheet chart configs.
   */
  const withDocOwnedContent = useCallback((base: WorkbookSnapshot): WorkbookSnapshot => {
    let next: WorkbookSnapshot = base;
    if (chartsRef.current.length) next = { ...next, syntoolsCharts: chartsRef.current };
    if (rawPartsRef.current) next = { ...next, syntoolsRawParts: rawPartsRef.current };
    if (pivotConfigsRef.current.length) next = { ...next, syntoolsPivots: pivotConfigsRef.current };
    // Comment threads ride along in their own field (xlsx has no counterpart yet)
    next = withSheetComments(next, commentsRef.current);
    return withWorkbookExtras(next, extrasRef.current);
  }, []);

  /** Comments are app-side data: write through the ref and request a save explicitly (like charts) */
  const setCommentMap = useCallback((next: SheetCommentMap) => {
    commentsRef.current = next;
    setSheetComments(next);
    scheduleSaveRef.current();
  }, []);

  const commentAnchor = (): { row: number; col: number } | null => {
    const range = handleRef.current?.getActiveRange();
    return range ? { row: range.startRow, col: range.startColumn } : null;
  };

  const openComments = () => {
    setCommentCell(commentAnchor());
    setCommentsOpen(true);
  };

  const resolveCommentAuthor = () => commentAuthor.trim() || t('tools.sheet.commentAnonymous');

  const activeCommentSheetId = () => handleRef.current?.getActiveSheetId() ?? activeSheetId;

  const updateCommentThread = (
    threadId: string,
    updater: (thread: CommentThread) => CommentThread,
  ) => {
    const sheetId = activeCommentSheetId();
    if (!sheetId) return;
    const threads = threadsForSheet(commentsRef.current, sheetId);
    let changed = false;
    const next = threads.map((thread) => {
      if (thread.id !== threadId) return thread;
      const updated = updater(thread);
      if (updated !== thread) changed = true;
      return updated;
    });
    if (changed) setCommentMap(setSheetThreads(commentsRef.current, sheetId, next));
  };

  const addSheetComment = (body: string) => {
    const sheetId = activeCommentSheetId();
    if (!sheetId || !commentCell) return;
    const thread = createThread(
      { kind: 'cell', sheetId, row: commentCell.row, col: commentCell.col },
      { author: resolveCommentAuthor(), body },
    );
    const threads = [...threadsForSheet(commentsRef.current, sheetId), thread];
    setCommentMap(setSheetThreads(commentsRef.current, sheetId, threads));
  };

  const replySheetComment = (threadId: string, body: string) =>
    updateCommentThread(threadId, (thread) =>
      addReply(thread, { author: resolveCommentAuthor(), body }),
    );

  const resolveSheetComment = (threadId: string, resolved: boolean) =>
    updateCommentThread(threadId, (thread) => setThreadResolved(thread, resolved));

  const deleteSheetComment = (threadId: string) => {
    const sheetId = activeCommentSheetId();
    if (!sheetId) return;
    const threads = threadsForSheet(commentsRef.current, sheetId);
    const next = threads.filter((thread) => thread.id !== threadId);
    if (next.length === threads.length) return;
    setCommentMap(setSheetThreads(commentsRef.current, sheetId, next));
  };

  /**
   * Unified persistence: localStorage draft (a synchronous safety net) plus the IndexedDB document
   * library (multiple documents / version history). Called only after real edits or explicit
   * actions, replacing the old "full save() + stringify every 2 seconds" poll.
   */
  const persistNow = useCallback(
    (nextTitle?: string): void => {
      const handle = handleRef.current;
      if (!handle) return;
      const base = handle.getSnapshot();
      // Chart data follows the cell contents
      applyChartData(base, handle.getActiveSheetId());
      const snapshot = withDocOwnedContent(base);
      const result = writeDraftSafe(snapshot);
      setDraftSaved(result.ok);
      setDraftNotice(result.ok ? null : result.degraded ? 'degraded' : 'failed');
      setSummary(summarizeWorkbook(base));
      // Allocate the document id lazily: it only enters the library on the first save
      let id = docIdRef.current;
      if (!id) {
        id = createDocId();
        docIdRef.current = id;
        setDocId(id);
        setCurrentDocId(id);
      }
      void saveDocument(id, nextTitle ?? titleRef.current, snapshot).then(() => {
        void listDocuments().then(setDocs);
      });
    },
    [applyChartData, withDocOwnedContent],
  );

  /** Edit events → debounced persistence */
  const scheduleSave = useCallback((): void => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      persistNow();
    }, SAVE_DEBOUNCE_MS);
  }, [persistNow]);
  // Chart edits (non-Univer changes) trigger persistence through this ref, so callbacks need not be declared in order
  useEffect(() => {
    scheduleSaveRef.current = scheduleSave;
  }, [scheduleSave]);

  const lang = useSettingsStore((s) => s.lang);
  const theme = useSettingsStore((s) => s.theme);
  const dark =
    theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'));
  const univerLocale: 'zhCN' | 'enUS' = lang === 'zh' || lang === 'zh-TW' ? 'zhCN' : 'enUS';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    // Create one tick later: under StrictMode the effect mounts → unmounts → mounts synchronously,
    // and instantiating inside the effect would unmount Univer's React root during React's own
    // render, leaving the second instance blank (an empty sheet in development).
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      let handle: UniverHandle;
      try {
        handle = createUniverInstance(container, { locale: univerLocale, dark });
      } catch {
        setRuntimeError(true);
        return;
      }
      const pending = pendingRef.current ?? readDraft();
      if (pending) {
        handle.loadSnapshot(pending);
        // Tool-owned content (conditional formatting / data validation + charts): read only on the
        // first restore from the draft. On an instance rebuild (StrictMode's second mount, theme /
        // locale switch) `pending` is a raw Univer snapshot without these fields, so overwriting
        // would simply drop them.
        if (!extrasRef.current) extrasRef.current = readWorkbookExtras(pending);
        if (!rawPartsRef.current) rawPartsRef.current = pending.syntoolsRawParts ?? null;
        if (chartsRef.current.length === 0) {
          const configs = pending.syntoolsCharts ?? [];
          if (configs.length > 0) {
            chartsRef.current = configs;
            setCharts(configs);
            setSelectedChartId(configs[0]?.id ?? null);
          }
        }
        if (!commentsLoadedRef.current) {
          const map = readSheetComments(pending);
          commentsLoadedRef.current = true;
          commentsRef.current = map;
          setSheetComments(map);
        }
        if (pivotConfigsRef.current.length === 0) {
          const pivots = pending.syntoolsPivots ?? [];
          if (pivots.length > 0) {
            pivotConfigsRef.current = pivots;
            setPivotConfigs(pivots);
          }
        }
      }
      handleRef.current = handle;
      // Dirty tracking: only modifications that reach the snapshot trigger debounced persistence
      unsubscribeRef.current = handle.onMutation(() => {
        scheduleSave();
        // 透视表是"源数据的视图"：源表一改就重算，而不是等用户手动刷新
        if (pivotOpenRef.current) setPivotSnapshot(handle.getSnapshot());
      });
      setSheets(handle.getSheets());
      setActiveSheetId(handle.getActiveSheetId());
      const initial = handle.getSnapshot();
      setSummary(summarizeWorkbook(initial));
      applyChartData(initial, handle.getActiveSheetId());
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      const current = handleRef.current;
      if (current) {
        pendingRef.current = current.getSnapshot();
        current.dispose();
        handleRef.current = null;
      }
    };
  }, [univerLocale, dark, scheduleSave, applyChartData]);

  // Sheet area size: chart dragging / resizing needs bounds
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const update = () => setChartBounds({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const refreshSummary = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    setSummary(summarizeWorkbook(handle.getSnapshot()));
  }, []);

  const refreshSheets = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    setSheets(handle.getSheets());
    setActiveSheetId(handle.getActiveSheetId());
  }, []);

  /** Charts visible on the active sheet (each chart is bound to one sheet) */
  const visibleCharts = useMemo(
    () => charts.filter((item) => !item.sheetId || item.sheetId === activeSheetId),
    [charts, activeSheetId],
  );

  /** 面板看到的一切都由这里算出来：源快照变了（编辑 / 刷新 / 换区域）就整体重算 */
  const pivotView = useMemo(() => {
    if (!pivotConfig || !pivotSnapshot) return null;
    const source = readPivotSource(pivotSnapshot, pivotConfig);
    return { source, result: computePivot(pivotConfig, source) };
  }, [pivotConfig, pivotSnapshot]);

  const pivotFieldKeys = useMemo(() => {
    if (!pivotView) return {};
    return Object.fromEntries(
      pivotView.source.fields.map((field) => [
        field.column,
        collectFieldKeys(pivotView.source, field.column).map((key) => ({
          key: key.key,
          label: key.label,
        })),
      ]),
    );
  }, [pivotView]);

  /** Load a snapshot and refresh derived state (shared by the document library / version history / import) */
  const applySnapshot = useCallback(
    (snapshot: WorkbookSnapshot, nextTitle: string) => {
      const handle = handleRef.current;
      if (!handle) return;
      handle.loadSnapshot(snapshot);
      setTitle(nextTitle);
      setFailure(null);
      setChartNotice(false);
      // Tool-owned content carried by the snapshot: conditional formatting / data validation + charts + native chart parts
      extrasRef.current = readWorkbookExtras(snapshot);
      rawPartsRef.current = snapshot.syntoolsRawParts ?? null;
      const configs = snapshot.syntoolsCharts ?? [];
      chartsRef.current = configs;
      setCharts(configs);
      setSelectedChartId(configs[0]?.id ?? null);
      const commentMap = readSheetComments(snapshot);
      commentsLoadedRef.current = true;
      commentsRef.current = commentMap;
      setSheetComments(commentMap);
      const pivots = snapshot.syntoolsPivots ?? [];
      pivotConfigsRef.current = pivots;
      setPivotConfigs(pivots);
      applyChartData(handle.getSnapshot(), handle.getActiveSheetId());
      refreshSummary();
      refreshSheets();
    },
    [applyChartData, refreshSummary, refreshSheets],
  );

  // Startup: adopt the document-library pointer (content already came from the localStorage draft, avoiding a race with instance creation)
  useEffect(() => {
    void initDocStore().then((init) => {
      void listDocuments().then(setDocs);
      if (!init) return;
      docIdRef.current = init.docId;
      setDocId(init.docId);
    });
  }, []);

  // Title changes are persisted too (skipped on first render so merely opening the page does not create an empty document)
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const timer = setTimeout(() => persistNow(), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [title, persistNow]);

  /** Limit the file dialog's default filter to the format picked in the dropdown (users can still switch to "all files"; the type check lives in handleImport) */
  const openImport = (accept: string) => {
    const input = importInputRef.current;
    if (!input) return;
    input.accept = accept;
    input.click();
  };

  const handleImport = async (file: File) => {
    setBusy('import');
    setFailure(null);
    // Route by extension first: .csv goes through the pure-logic parser, .xlsx/.xlsm to exceljs
    const check = checkImportFile(file);
    if (!check.ok) {
      setBusy(null);
      setFailure(check);
      return;
    }
    const result =
      check.value === 'csv'
        ? csvToSnapshot(await file.text(), file.name.replace(/\.csv$/i, ''), univerLocale)
        : await importXlsxToSnapshot(file);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    const nextTitle = title.trim() ? title : result.value.name;
    applySnapshot(result.value, nextTitle);
    persistNow(nextTitle);
  };

  const handleAddSheet = () => {
    handleRef.current?.addSheet();
    refreshSheets();
    setFailure(null);
  };

  const handleSelectSheet = (id: string) => {
    handleRef.current?.setActiveSheet(id);
    refreshSheets();
  };

  const handleRenameSheet = (id: string, name: string) => {
    handleRef.current?.renameSheet(id, name);
    refreshSheets();
  };

  const handleDeleteSheet = (id: string) => {
    handleRef.current?.deleteSheet(id);
    refreshSheets();
  };

  const handleDuplicateSheet = (id: string) => {
    handleRef.current?.duplicateSheet(id);
    refreshSheets();
  };

  /**
   * 从当前选区（单格时退回已用区域）生成初始配置。
   * 布局给一个能立刻看到结果的最小默认：第一个字段做行、最后一个字段做值。
   */
  const buildPivotConfig = (snapshot: WorkbookSnapshot, sheetId: string): PivotConfig => {
    const active = handleRef.current?.getActiveRange() ?? null;
    const sheet = snapshot.sheets[sheetId];
    const used = sheet ? resolveUsedRange(sheet) : null;
    const single =
      !!active && active.startRow === active.endRow && active.startColumn === active.endColumn;
    const range =
      active && !single
        ? active
        : (used ?? active ?? { startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 });
    const width = range.endColumn - range.startColumn + 1;
    return {
      id: PIVOT_ID,
      name: t('tools.sheet.pivotTitle'),
      sheetId,
      range: { ...range },
      // 默认给一个立刻能看懂的交叉表：第一列做行、第二列做列（够宽时）、最后一列求和
      rows: width > 1 ? [0] : [],
      cols: width > 2 ? [1] : [],
      values: width > 1 ? [{ column: width - 1, aggregation: 'sum' }] : [],
      filters: {},
      hasHeader: true,
    };
  };

  const openPivot = () => {
    const handle = handleRef.current;
    if (!handle) return;
    const snapshot = handle.getSnapshot();
    // 没有活动工作表就没有源数据：与图表一致，直接不进面板
    const sheetId = handle.getActiveSheetId() ?? snapshot.sheetOrder[0];
    if (!sheetId) return;
    // 已有配置就沿用（用户上次摆好的行列不因为重开面板丢失）
    const saved = pivotConfigsRef.current.find((item) => item.sheetId === sheetId);
    const config = saved ?? buildPivotConfig(snapshot, sheetId);
    setPivotConfig(config);
    // 第一次打开就把配置写进文档：否则"打开面板直接导出"会因为 ref 里没有配置而漏掉透视表工作表
    pivotConfigsRef.current = [config];
    setPivotConfigs([config]);
    scheduleSaveRef.current();
    setPivotSnapshot(snapshot);
    setPivotOpen(true);
  };

  /** 配置是工具自有内容：写进 ref + 状态，并显式请求保存（与图表同一范式） */
  const applyPivotConfig = (next: PivotConfig) => {
    setPivotConfig(next);
    const list = [next];
    pivotConfigsRef.current = list;
    setPivotConfigs(list);
    scheduleSaveRef.current();
  };

  const handlePivotUseSelection = () => {
    const handle = handleRef.current;
    if (!handle) return;
    const snapshot = handle.getSnapshot();
    const sheetId = handle.getActiveSheetId() ?? snapshot.sheetOrder[0];
    if (!sheetId) return;
    // 换源区域后旧的字段偏移不再有效：布局复位，避免把"第 3 列"当成"第 1 列"继续算
    applyPivotConfig({
      ...buildPivotConfig(snapshot, sheetId),
      id: pivotConfig?.id ?? PIVOT_ID,
    });
    setPivotSnapshot(snapshot);
  };

  /**
   * 「插入到文档」：把透视结果落成一张真实工作表。
   *
   * 第一次插在末尾并记下 `outputSheetId`；之后再点就是**更新**同一张表
   * （先按旧范围清空再写）。导出会复用这张表，不再追加副本——
   * 否则用户点了插入再导出，文档里会出现两张透视表。
   */
  const handlePivotInsert = () => {
    const handle = handleRef.current;
    if (!handle || !pivotConfig) return;
    // 从**当前**文档重算：面板可能停在旧快照上（源数据改过但没点刷新），
    // 插进去的数字必须是用户此刻看到的这份数据。
    const snapshot = handle.getSnapshot();
    const source = readPivotSource(snapshot, pivotConfig);
    if (source.records.length === 0 || source.fields.length === 0) return;
    const result = computePivot(pivotConfig, source);
    const matrix = pivotToMatrix(result, pivotConfig, t('tools.sheet.pivotBlank'));
    if (matrix.length === 0 || result.rowKeys.length === 0) return;

    const sheets = handle.getSheets();
    const target = pivotConfig.outputSheetId
      ? sheets.find((sheet) => sheet.id === pivotConfig.outputSheetId)
      : undefined;

    if (target) {
      const used = usedBlock(snapshot.sheets[target.id]);
      handle.writeSheetValues(target.id, matrix, used);
      handle.setActiveSheet(target.id);
      setPivotSnapshot(handle.getSnapshot());
    } else {
      const name = uniqueSheetName(
        sheets.map((sheet) => sheet.name),
        pivotConfig.name,
        t('tools.sheet.pivotTitle'),
      );
      const id = handle.insertSheetWithValues(name, matrix);
      if (!id) return;
      // 记住这张表：下次点按钮是更新而不是再插一张
      applyPivotConfig({ ...pivotConfig, outputSheetId: id });
      handle.setActiveSheet(id);
      setPivotSnapshot(handle.getSnapshot());
    }
    refreshSheets();
    scheduleSaveRef.current();
  };

  const handlePivotRemove = () => {
    pivotConfigsRef.current = [];
    setPivotConfigs([]);
    setPivotConfig(null);
    setPivotOpen(false);
    scheduleSaveRef.current();
  };

  /**
   * 打印/PDF：透视表不是 Univer 的工作表，直接 `window.print()` 打印不到它。
   * 做法是把矩阵合成一个**独立的只读快照**再交给 `print.ts` —— 分页、宽表横向切分、
   * 打印样式全部复用既有管线，不需要为透视表再写一套。
   */
  const handlePivotPrint = () => {
    if (!pivotConfig || !pivotView) return;
    const sheet = buildPivotSheet(
      PIVOT_SHEET_ID,
      pivotConfig,
      pivotView.result,
      t('tools.sheet.pivotBlank'),
    );
    if (!sheet) return;
    const base = createEmptySnapshot(t('tools.sheet.pivotTitle'), univerLocale);
    const snapshot: WorkbookSnapshot = {
      ...base,
      sheets: { [sheet.id]: sheet },
      sheetOrder: [sheet.id],
    };
    void printSheet(snapshot, sheet.id, DEFAULT_SHEET_PRINT_OPTIONS as SheetPrintOptions, null);
  };

  const handleExport = async () => {
    const handle = handleRef.current;
    if (!handle) return;
    setBusy('export');
    setFailure(null);
    const base = withDocOwnedContent(handle.getSnapshot());
    // 透视表写进额外工作表：导出层会再注入原生 pivotTable part，
    // 支持不了的形态（多级列头/筛选/截断）保留静态值并由保真报告告警
    const snapshot = appendPivotSheets(base, pivotConfigsRef.current, t('tools.sheet.pivotBlank'));
    const result = await exportSnapshotToBytes(snapshot);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    downloadBytes(result.value, buildExportFilename(title || 'workbook', 'xlsx'), XLSX_MIME);
    setFidelity(
      isFidelityMuted()
        ? null
        : createFidelityReport('sheet', 'export', collectExportIssues(snapshot)),
    );
  };

  /** Export CSV from the active sheet; a leading BOM lets Excel handle Chinese text correctly */
  const handleExportCsv = () => {
    const handle = handleRef.current;
    if (!handle) return;
    setFailure(null);
    const result = snapshotToCsv(handle.getSnapshot(), handle.getActiveSheetId());
    if (!result.ok) {
      setFailure(result);
      return;
    }
    const bytes = new TextEncoder().encode(CSV_BOM + result.value);
    downloadBytes(bytes, buildExportFilename(title || 'workbook', 'csv'), 'text/csv;charset=utf-8');
  };

  /** Open the print dialog with a fresh snapshot + selection (printing never mutates the doc) */
  const openPrint = () => {
    const handle = handleRef.current;
    if (!handle) return;
    const range = handle.getActiveRange();
    const sheetId = handle.getActiveSheetId();
    setPrintTarget({
      snapshot: handle.getSnapshot(),
      sheetId,
      selection: range
        ? {
            startRow: range.startRow,
            startColumn: range.startColumn,
            endRow: range.endRow,
            endColumn: range.endColumn,
          }
        : null,
    });
  };

  /** Print; browsers that block the popup fall back to PDF export */
  const handlePrint = async (options: SheetPrintOptions, range: CellRange | null) => {
    if (!printTarget) return;
    setFailure(null);
    setBusy('export');
    const result = await printSheet(printTarget.snapshot, printTarget.sheetId, options, range);
    if (result.ok) {
      setBusy(null);
      setPrintTarget(null);
      return;
    }
    if (result.error === 'PRINT_BLOCKED' || result.error === 'PRINT_UNSUPPORTED') {
      const pdf = await exportSheetPdf(printTarget.snapshot, printTarget.sheetId, options, range);
      setBusy(null);
      if (!pdf.ok) {
        setFailure(pdf);
        return;
      }
      downloadBytes(pdf.value, `${sanitizeFilename(title || 'workbook')}.pdf`, 'application/pdf');
      setPrintTarget(null);
      return;
    }
    setBusy(null);
    setFailure(result);
  };

  /** Export the print layout as PDF (paper / orientation / area) */
  const handlePrintPdf = async (options: SheetPrintOptions, range: CellRange | null) => {
    if (!printTarget) return;
    setFailure(null);
    setBusy('export');
    const result = await exportSheetPdf(printTarget.snapshot, printTarget.sheetId, options, range);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    downloadBytes(result.value, `${sanitizeFilename(title || 'workbook')}.pdf`, 'application/pdf');
    setPrintTarget(null);
  };

  const loadEmptyWorkbook = () => {
    applySnapshot(createEmptySnapshot('', univerLocale), '');
    clearDraft();
    setDraftSaved(false);
    setDraftNotice(null);
  };

  const handleClear = () => {
    loadEmptyWorkbook();
  };

  const handleNew = () => {
    const hasContent = summary.cells > 0 || title.trim().length > 0;
    if (hasContent && !window.confirm(t('common.discardConfirm'))) return;
    // A new document gets a fresh id; the previous workbook stays in the library
    const id = createDocId();
    docIdRef.current = id;
    setDocId(id);
    setCurrentDocId(id);
    loadEmptyWorkbook();
    void listDocuments().then(setDocs);
  };

  const openLibrary = () => {
    setVersionsOpen(false);
    setLibraryOpen(true);
    void listDocuments().then(setDocs);
  };

  const openVersions = () => {
    setLibraryOpen(false);
    setVersionsOpen(true);
    const id = docIdRef.current;
    if (id) void listVersions(id).then(setVersions);
    else setVersions([]);
  };

  const handleOpenDoc = (id: string) => {
    void loadDocument(id).then((doc) => {
      if (!doc) return;
      docIdRef.current = id;
      setDocId(id);
      setCurrentDocId(id);
      applySnapshot(doc.snapshot, doc.title);
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
    const label = target?.title || t('tools.sheet.untitledDoc');
    if (!window.confirm(t('tools.sheet.deleteDocConfirm', { title: label }))) return;
    void deleteDocument(id).then(() => {
      void listDocuments().then(setDocs);
      if (id === docIdRef.current) {
        docIdRef.current = null;
        setDocId(null);
        loadEmptyWorkbook();
      }
    });
  };

  const handleRestoreVersion = (version: StoredVersion) => {
    if (!window.confirm(t('tools.sheet.restoreConfirm'))) return;
    applySnapshot(version.snapshot, version.title);
    setVersionsOpen(false);
    persistNow(version.title);
  };

  const stats = useMemo(
    () => [
      { label: t('tools.sheet.sheets'), value: summary.sheets },
      { label: t('tools.sheet.rows'), value: summary.rows },
      { label: t('tools.sheet.columns'), value: summary.columns },
      { label: t('tools.sheet.cells'), value: summary.cells },
      { label: t('tools.sheet.formulas'), value: summary.formulas },
    ],
    [summary, t],
  );

  const activeSheet = sheets.find((sheet) => sheet.id === activeSheetId) ?? null;

  const menus: EditorMenu[] = [
    {
      id: 'file',
      label: t('common.menuFile'),
      entries: [
        editorMenuItem('file-new', t('common.newDoc'), handleNew, { shortcut: '⌘N' }),
        editorMenuItem(
          'file-import-xlsx',
          t('tools.sheet.importXlsx'),
          () => openImport('.xlsx,.xlsm'),
          { disabled: busy !== null },
        ),
        editorMenuItem('file-import-csv', t('tools.sheet.importCsv'), () => openImport('.csv'), {
          disabled: busy !== null,
        }),
        { type: 'separator' },
        editorMenuItem('file-export-xlsx', t('tools.sheet.exportXlsx'), () => void handleExport(), {
          disabled: summary.cells === 0,
        }),
        editorMenuItem('file-export-csv', t('tools.sheet.exportCsv'), handleExportCsv, {
          disabled: summary.cells === 0,
        }),
        editorMenuItem('file-print', t('tools.sheet.print'), openPrint, {
          disabled: summary.cells === 0,
        }),
        { type: 'separator' },
        editorMenuItem('file-library', t('tools.sheet.library'), openLibrary),
        editorMenuItem('file-versions', t('tools.sheet.versions'), openVersions, {
          disabled: !docId,
        }),
        { type: 'separator' },
        editorMenuItem('file-clear', t('common.clear'), handleClear, {
          danger: true,
          disabled: summary.cells === 0 && !title.trim(),
        }),
      ],
    },
    {
      id: 'edit',
      label: t('common.menuEdit'),
      entries: [
        editorMenuItem('edit-undo', t('tools.sheet.undo'), () => handleRef.current?.undo(), {
          shortcut: '⌘Z',
        }),
        editorMenuItem('edit-redo', t('tools.sheet.redo'), () => handleRef.current?.redo(), {
          shortcut: '⇧⌘Z',
        }),
      ],
    },
    {
      id: 'insert',
      label: t('common.menuInsert'),
      entries: [
        editorMenuItem('insert-chart', t('tools.sheet.insertChart'), openChart, {
          disabled: busy !== null,
        }),
        editorMenuItem('insert-pivot', t('tools.sheet.insertPivot'), openPivot, {
          disabled: busy !== null,
        }),
        { type: 'separator' },
        editorMenuItem('insert-sheet', t('tools.sheet.addSheet'), handleAddSheet, {
          disabled: busy !== null,
        }),
        editorMenuItem(
          'insert-sheet-duplicate',
          t('tools.sheet.duplicate'),
          () => activeSheetId && handleDuplicateSheet(activeSheetId),
          { disabled: !activeSheetId || busy !== null },
        ),
        editorMenuItem(
          'insert-sheet-rename',
          t('tools.sheet.rename'),
          () => {
            if (!activeSheet) return;
            const name = window.prompt(t('tools.sheet.rename'), activeSheet.name);
            if (name === null) return;
            const next = name.trim();
            if (!next || next === activeSheet.name) return;
            handleRenameSheet(activeSheet.id, next);
          },
          { disabled: !activeSheet || busy !== null },
        ),
        editorMenuItem(
          'insert-sheet-delete',
          t('tools.sheet.delete'),
          () => activeSheetId && handleDeleteSheet(activeSheetId),
          { danger: true, disabled: !activeSheetId || sheets.length <= 1 || busy !== null },
        ),
      ],
    },
    {
      id: 'view',
      label: t('common.menuView'),
      entries: [
        editorMenuItem('view-comments', t('tools.sheet.comments'), openComments),
        { type: 'separator' },
        editorMenuItem('view-present', t('tools.sheet.present'), () => setPresenting(true), {
          disabled: summary.cells === 0,
        }),
      ],
    },
  ];

  const statusText = draftSaved ? t('common.saved') : t('common.saving');
  const memory = useMemo(() => {
    let snapshot: unknown = null;
    try {
      snapshot = handleRef.current?.getSnapshot() ?? null;
    } catch {
      snapshot = null;
    }
    return formatBytes(estimateJsonBytes({ summary, snapshot }));
  }, [summary]);

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
                draftSaved
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <Icon name={draftSaved ? 'check' : 'clock'} className="h-4 w-4" />
            </span>
            <button
              type="button"
              onClick={handleClear}
              disabled={summary.cells === 0 && !title.trim()}
              aria-label={t('common.clear')}
              title={t('common.clear')}
              className={`${EDITOR_ICON_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Icon name="trash" className="h-4 w-4" />
            </button>
            <HintTip text={t('tools.sheet.unsupportedTip')} />
          </>
        }
        center={
          <input
            type="text"
            value={title}
            aria-label={t('tools.sheet.docTitle')}
            placeholder={t('tools.sheet.titlePlaceholder')}
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
              <Icon name="sheet" className="h-4 w-4" />
            </button>
            <button
              type="button"
              data-testid="sheet-present"
              onClick={openPresent}
              aria-label={t('tools.sheet.present')}
              title={t('tools.sheet.present')}
              className={EDITOR_ICON_BUTTON_CLASS}
            >
              <Icon name="present" className="h-4 w-4" />
            </button>
          </>
        }
      />

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

      {chartNotice ? (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {t('tools.sheet.chartEmpty')}
        </p>
      ) : null}

      {/* 工作表区域：图表以浮层形式贴在同一区域内，可拖动 / 缩放 / 改数据 */}
      <div
        ref={surfaceRef}
        className="relative overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      >
        <div
          ref={containerRef}
          className="sheet-canvas"
          style={sheetHeight ? { height: `${sheetHeight}px` } : undefined}
        />
        {visibleCharts.map((config) => (
          <ChartOverlay
            key={config.id}
            config={config}
            data={chartDataMap[config.id] ?? null}
            selected={config.id === selectedChartId}
            bounds={chartBounds}
            onSelect={() => setSelectedChartId(config.id)}
            onChange={(patch) => updateChart(config.id, patch)}
            onPickRange={() => pickRangeForChart(config.id)}
            onClose={() => removeChart(config.id)}
          />
        ))}
      </div>

      <SheetTabs
        sheets={sheets}
        activeId={activeSheetId}
        onSelect={handleSelectSheet}
        onAdd={handleAddSheet}
        onRename={handleRenameSheet}
        onDelete={handleDeleteSheet}
        onDuplicate={handleDuplicateSheet}
      />

      <EditorStatusBar
        left={
          <>
            {stats.map((item) => (
              <span key={item.label}>
                {item.label}: {item.value}
              </span>
            ))}
            {countSheetComments(sheetComments) > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">
                {t('tools.sheet.commentCount', { count: countSheetComments(sheetComments) })}
              </span>
            ) : null}
          </>
        }
        right={<span>{t('common.memoryUsage', { size: memory })}</span>}
      />

      {busy !== null && <ProgressBar indeterminate label={t('tools.sheet.exporting')} />}

      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xlsm,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleImport(file);
        }}
      />

      {runtimeError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.sheet', { ok: false, error: 'RUNTIME_FAILED' })}
        </p>
      )}

      {draftNotice && (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {draftNotice === 'degraded'
            ? t('tools.sheet.draftDegraded')
            : t('tools.sheet.draftSaveFailed')}
        </p>
      )}

      {failure && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.sheet', failure)}
        </p>
      )}

      <FidelityDialog
        report={fidelity}
        muted={isFidelityMuted()}
        onClose={() => setFidelity(null)}
        onMute={muteFidelity}
      />

      {pivotOpen && pivotConfig && pivotView ? (
        <PivotPanel
          config={pivotConfig}
          fields={pivotView.source.fields}
          result={pivotView.result}
          empty={pivotView.source.records.length === 0}
          recordCount={pivotView.source.records.length}
          keysByColumn={pivotFieldKeys}
          onConfigChange={applyPivotConfig}
          onUseSelection={handlePivotUseSelection}
          onRefresh={() => setPivotSnapshot(handleRef.current?.getSnapshot() ?? null)}
          onRemove={handlePivotRemove}
          onClose={() => setPivotOpen(false)}
          onInsert={handlePivotInsert}
          inserted={
            Boolean(pivotConfig.outputSheetId) &&
            sheets.some((sheet) => sheet.id === pivotConfig.outputSheetId)
          }
          onExport={() => void handleExport()}
          onPrint={handlePivotPrint}
        />
      ) : null}

      {printTarget ? (
        <PrintDialog
          snapshot={printTarget.snapshot}
          sheetId={printTarget.sheetId}
          selection={printTarget.selection}
          busy={busy !== null}
          onCancel={() => setPrintTarget(null)}
          onPrint={(options, range) => void handlePrint(options, range)}
          onExportPdf={(options, range) => void handlePrintPdf(options, range)}
        />
      ) : null}

      {commentsOpen ? (
        <CommentDialog
          cell={commentCell}
          threads={threadsForSheet(sheetComments, activeSheetId)}
          author={commentAuthor}
          onAuthorChange={setCommentAuthor}
          onAdd={addSheetComment}
          onReply={replySheetComment}
          onToggleResolved={resolveSheetComment}
          onDeleteThread={deleteSheetComment}
          onUseCurrentCell={() => setCommentCell(commentAnchor())}
          onClose={() => setCommentsOpen(false)}
        />
      ) : null}

      {presenting ? (
        <PresentOverlay
          title={title.trim() || t('tools.sheet.titlePlaceholder')}
          onClose={() => setPresenting(false)}
          exitLabel={t('tools.sheet.exitPresent')}
          failedLabel={t('tools.sheet.presentFailed')}
          failed={presentFailed}
        >
          {presentGrid ? <PresentSheet grid={presentGrid} /> : null}
        </PresentOverlay>
      ) : null}
    </div>
  );
}
