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
import { PresentSheet } from './ui/PresentSheet';
import { ChartOverlay } from './ui/ChartOverlay';
import { readWorkbookExtras, withWorkbookExtras, type WorkbookExtras } from './xlsx-extras';
import type { RawChartParts } from './rawChartParts';
import { SheetTabs } from './SheetTabs';
import './sheet.css';

// Tool copy is registered lazily with this chunk so it does not weigh down the initial bundle
registerSpreadsheetStrings(i18n);
registerChartStrings(i18n);
registerStoreStrings(i18n);

type Failure = Extract<ToolResult<unknown>, { ok: false }>;
type BusyKind = 'import' | 'export' | null;

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
    return withWorkbookExtras(next, extrasRef.current);
  }, []);

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
      }
      handleRef.current = handle;
      // Dirty tracking: only modifications that reach the snapshot trigger debounced persistence
      unsubscribeRef.current = handle.onMutation(scheduleSave);
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

  const handleExport = async () => {
    const handle = handleRef.current;
    if (!handle) return;
    setBusy('export');
    setFailure(null);
    const result = await exportSnapshotToBytes(withDocOwnedContent(handle.getSnapshot()));
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    downloadBytes(result.value, buildExportFilename(title || 'workbook', 'xlsx'), XLSX_MIME);
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
        left={stats.map((item) => (
          <span key={item.label}>
            {item.label}: {item.value}
          </span>
        ))}
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
