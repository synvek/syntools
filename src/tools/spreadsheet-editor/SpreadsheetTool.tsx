import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HintTip } from '@/core/components/DocumentHeader';
import { clearDraft, readDraft, writeDraftSafe } from './draft';
import { Icon } from '@/core/components/Icon';
import { EditorStatusBar } from '@/core/components/EditorStatusBar';
import {
  EDITOR_STRIP_TITLE_INPUT_CLASS,
  STRIP_ICON_BUTTON_CLASS,
  estimateJsonBytes,
  formatBytes,
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
  columnIndexToName,
  sanitizeFilename,
  summarizeWorkbook,
  type PresentGrid,
  type WorkbookSnapshotLite,
  type WorkbookSummary,
} from './core';
import { csvToSnapshot, snapshotToCsv } from './csv';
import { CHART_TYPE_LABEL_KEY, buildChartData, type ChartConfig, type ChartData } from './charts';
import { registerChartStrings } from './chartStrings';
import { chartTypeBreakdown, summarizeImport, type ChartImportReport } from './chartImport';
import { registerShapeStrings } from './shapeStrings';
import { registerImageStrings } from './imageStrings';
import {
  buildSheetLayout,
  createSheetShape,
  pxToAnchor,
  DEFAULT_SHEET_VIEWPORT,
  type SheetLayout,
  type SheetShapeConfig,
  type SheetViewport,
} from './shapes';
import {
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  createSheetImage,
  fitImageSize,
  parseImageDataUrl,
  type SheetImageConfig,
} from './sheetImages';
import { ShapeLayer, ShapePalette } from './ui/ShapeOverlay';
import { ShapeDrawLayer } from './ui/ShapeDrawLayer';
import { ShapeFormatBar } from './ui/ShapeFormatBar';
import { ImageLayer } from './ui/ImageLayer';
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
import { registerRibbonStrings } from './ribbonStrings';
import { SpreadsheetRibbon, type RibbonBaseContext } from './SpreadsheetRibbon';
import { buildSheetMenu, type SheetActions } from './commands';
import { parseClipboardMatrix } from './sheetFormat';
import { NumberFormatDialog } from './ui/NumberFormatDialog';
import {
  createEmptySnapshot,
  exportSnapshotToBytes,
  importXlsxToSnapshot,
  type ImportOutcome,
  type WorkbookSnapshot,
} from './xlsx-io';
import { reportSheetIssue, subscribeSheetIssues, type SheetIssue } from './issues';
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
import { NameManagerPanel } from './ui/NameManagerPanel';
import { ProtectDialog } from './ui/ProtectDialog';
import { registerMetaStrings } from './metaStrings';
import { sanitizeNamedRanges, type NamedRange } from './namedRanges';
import {
  createTableFromSelection,
  sanitizeTables,
  takenNames,
  tablesInRange,
  type SheetTable,
} from './sheetTables';
import {
  createPasswordHash,
  protectionFor,
  setProtection,
  type SheetProtectionFlags,
  type SheetProtectionState,
} from './sheetProtection';
import './sheet.css';

// Tool copy is registered lazily with this chunk so it does not weigh down the initial bundle
registerSpreadsheetStrings(i18n);
registerChartStrings(i18n);
registerStoreStrings(i18n);
registerPivotStrings(i18n);
registerShapeStrings(i18n);
registerImageStrings(i18n);
registerMetaStrings(i18n);
registerRibbonStrings(i18n);

type Failure = Extract<ToolResult<unknown>, { ok: false }>;
/** 首版一个工作簿只保留一个透视表：多表会让"导出到哪张工作表"的语义含混 */
const PIVOT_ID = 'pivot-1';
/** File → dataURL：图片要存进快照，必须自包含（不能引用原文件路径） */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/** dataURL → 原始像素尺寸；量不出来（损坏 / 环境不支持）时返回 0，交给 fitImageSize 兜底 */
function measureImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve({ width: 0, height: 0 });
      return;
    }
    const probe = new Image();
    probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.onerror = () => resolve({ width: 0, height: 0 });
    probe.src = src;
  });
}

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
 * Document-library writes are a second, much slower tier than the draft (P0-5): a full snapshot is
 * structured-cloned into IndexedDB, which is the expensive half of persistence. 10 s keeps the
 * library close enough to the draft while taking that cost off the typing path.
 */
const DOC_SAVE_DEBOUNCE_MS = 10_000;
/** How long an inline failure notice stays on screen before it goes away by itself */
const ISSUE_NOTICE_MS = 6_000;

/**
 * Run a heavy-but-deferrable task (full `getSnapshot()` + `JSON.stringify`) when the browser is
 * idle, with a hard deadline so a permanently busy page still saves.
 */
function runWhenIdle(task: () => void): void {
  const idle = (
    window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof idle === 'function') {
    idle(task, { timeout: 1500 });
    return;
  }
  window.setTimeout(task, 0);
}

/**
 * Spreadsheet editor: Univer provides the editing surface; import and export happen entirely in the
 * browser. Every Univer side effect (CSS, instantiation) stays inside this lazy-loaded module so the
 * SSR pass in scripts/prerender.ts cannot trigger it.
 */
export default function SpreadsheetTool() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  /** Collapsing the ribbon changes the chrome height above the canvas; the fill hook must re-measure */
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
  /** Set once the Univer instance is live — the ribbon needs it reactively, `handleRef` is not enough */
  const [ribbonHost, setRibbonHost] = useState<UniverHandle | null>(null);
  const [numberFormatOpen, setNumberFormatOpen] = useState(false);
  /** Pattern the custom-format dialog starts from (read when it opens, so it reflects the selection) */
  const [numberFormatInitial, setNumberFormatInitial] = useState('');
  /** Sheet height = whatever remains in the first viewport (sheet tabs / status bar stay visible, "related tools" is pushed below the fold) */
  const sheetHeight = useViewportFill(containerRef, {
    min: 460,
    signature: ribbonCollapsed ? 'ribbon-collapsed' : 'ribbon-expanded',
  });
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
  /** 导入文件里保留下来的原生图表统计（P2-S8 回读：只报数量与类型，不做语义重建） */
  const [chartImport, setChartImport] = useState<ChartImportReport | null>(null);
  /** Sheet area size: the bounds for dragging / resizing charts */
  const [chartBounds, setChartBounds] = useState({ width: 0, height: 0 });
  const chartSeqRef = useRef(0);
  /** Floating shapes (SHEET-02): cell-anchored configs, persisted in their own snapshot field */
  const [shapes, setShapes] = useState<SheetShapeConfig[]>([]);
  const shapesRef = useRef<SheetShapeConfig[]>([]);
  shapesRef.current = shapes;
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [shapePaletteOpen, setShapePaletteOpen] = useState(false);
  /** 形状库选中后进入的绘制模式：在表格上拖拽即按该尺寸建形状 */
  const [shapeDrawPrst, setShapeDrawPrst] = useState<string | null>(null);
  const [images, setImages] = useState<SheetImageConfig[]>([]);
  const imagesRef = useRef<SheetImageConfig[]>([]);
  imagesRef.current = images;
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  /** 插入图片时的提示（超限 / 读取失败），贴在工具栏下方，不打断操作 */
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  /** Bumped on every mutation so the row/column layout is re-measured after a resize */
  const [shapeLayoutVersion, setShapeLayoutVersion] = useState(0);
  const shapeLayoutRef = useRef<SheetLayout>(buildSheetLayout(undefined));
  /** Grid → container projection for the shape layer: scrolls / zooms with the sheet (P4-SH6) */
  const [shapeViewport, setShapeViewport] = useState<SheetViewport>(DEFAULT_SHEET_VIEWPORT);
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
  /** Named ranges (P2-S7.1): workbook/sheet metadata that neither Univer nor its formula engine knows */
  const [namedRanges, setNamedRanges] = useState<NamedRange[]>([]);
  const namedRangesRef = useRef<NamedRange[]>([]);
  namedRangesRef.current = namedRanges;
  const [namesOpen, setNamesOpen] = useState(false);
  /** 打开名称面板时的选区（`A1:B2`），供"用选区填入"使用 */
  const [selectionLabel, setSelectionLabel] = useState<string | null>(null);
  /** Table objects (P2-S7.3): native `xl/tables` parts, kept outside Univer */
  const [tables, setTables] = useState<SheetTable[]>([]);
  const tablesRef = useRef<SheetTable[]>([]);
  tablesRef.current = tables;
  const [tableNotice, setTableNotice] = useState<string | null>(null);
  /** Sheet protection (P2-S7.2): carried by the snapshot, enforced by switching Univer to read-only */
  const [protection, setProtectionList] = useState<SheetProtectionState[]>([]);
  const protectionRef = useRef<SheetProtectionState[]>([]);
  protectionRef.current = protection;
  const [protectOpen, setProtectOpen] = useState(false);
  const [protectBusy, setProtectBusy] = useState(false);
  /** Only adopt names/protection from the first restored snapshot (same rule as comments) */
  const metaLoadedRef = useRef(false);
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
      const result = buildChartData(snapshot, config.sheetId ?? sheetId, config.range, config.type);
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
    const result = buildChartData(handle.getSnapshot(), sheetId, range, 'bar');
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
  const docSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Latest snapshot waiting for the slow IndexedDB tier (P0-5) */
  const pendingDocRef = useRef<{
    id: string;
    title: string;
    snapshot: WorkbookSnapshot;
  } | null>(null);
  /** Assigned once `flushDocSave` exists; the debounce timer and unmount cleanup go through it */
  const flushDocSaveRef = useRef<() => void>(() => {});
  /**
   * Snapshot size shown in the status bar. Measured once per save instead of on every render: the
   * old `useMemo` called `getSnapshot()` during render, so typing billed the whole workbook twice.
   */
  const [memoryBytes, setMemoryBytes] = useState(0);
  /** Inline failure notice (P0-3); replaces the silent `catch {}` this module used to have */
  const [issueNotice, setIssueNotice] = useState<SheetIssue | null>(null);
  /** Screen-reader announcement of the current selection (P0-6) */
  const [a11yStatus, setA11yStatus] = useState('');

  /**
   * Merge content this tool owns but Univer knows nothing about into the snapshot: conditional
   * formatting / data validation (round-trip preserved) plus the in-sheet chart configs.
   */
  const withDocOwnedContent = useCallback((base: WorkbookSnapshot): WorkbookSnapshot => {
    let next: WorkbookSnapshot = base;
    if (chartsRef.current.length) next = { ...next, syntoolsCharts: chartsRef.current };
    if (rawPartsRef.current) next = { ...next, syntoolsRawParts: rawPartsRef.current };
    if (pivotConfigsRef.current.length) next = { ...next, syntoolsPivots: pivotConfigsRef.current };
    if (shapesRef.current.length) next = { ...next, syntoolsShapes: shapesRef.current };
    if (imagesRef.current.length) next = { ...next, syntoolsImages: imagesRef.current };
    // Names and protection are workbook/sheet metadata written into workbook.xml and sheetProtection
    const names = sanitizeNamedRanges(namedRangesRef.current);
    if (names.length) next = { ...next, namedRanges: names };
    if (protectionRef.current.length) next = { ...next, syntoolsProtection: protectionRef.current };
    const tables = sanitizeTables(tablesRef.current);
    if (tables.length) next = { ...next, syntoolsTables: tables };
    // Comment threads ride along in their own field (xlsx has no counterpart yet)
    next = withSheetComments(next, commentsRef.current);
    return withWorkbookExtras(next, extrasRef.current);
  }, []);

  /**
   * Shapes (SHEET-02) are app-side content exactly like charts: they are not Univer mutations, so
   * every edit writes through the ref and asks for a save explicitly.
   */
  const setShapeList = useCallback((next: SheetShapeConfig[]) => {
    shapesRef.current = next;
    setShapes(next);
  }, []);

  /**
   * 在指定锚点/尺寸处建形状（拖拽绘制与"插入到选区"共用一条路径）。
   * 锚点由调用方给出：绘制时是鼠标落点，菜单插入时是当前选区左上角。
   */
  const insertShapeAt = useCallback(
    (prst: string, from: SheetShapeConfig['from'], width?: number, height?: number) => {
      const handle = handleRef.current;
      if (!handle) return;
      const sheetId = handle.getActiveSheetId();
      const shape = createSheetShape({
        prst,
        from,
        sheetId: sheetId ?? undefined,
        width,
        height,
        z: shapesRef.current.reduce((max, item) => Math.max(max, item.z), 0) + 1,
      });
      setShapeList([...shapesRef.current, shape]);
      setSelectedShapeId(shape.id);
      setShapePaletteOpen(false);
      setShapeDrawPrst(null);
      scheduleSaveRef.current();
    },
    [setShapeList],
  );

  const updateShape = useCallback(
    (id: string, patch: Partial<SheetShapeConfig>) => {
      setShapeList(
        shapesRef.current.map((shape) => (shape.id === id ? { ...shape, ...patch } : shape)),
      );
      scheduleSaveRef.current();
    },
    [setShapeList],
  );

  const removeShape = useCallback(
    (id: string) => {
      setShapeList(shapesRef.current.filter((shape) => shape.id !== id));
      setSelectedShapeId((current) => (current === id ? null : current));
      scheduleSaveRef.current();
    },
    [setShapeList],
  );

  /** z-order: one step above everything / below everything */
  const reorderShape = useCallback(
    (id: string, direction: 'front' | 'back') => {
      const zs = shapesRef.current.map((shape) => shape.z);
      const next = direction === 'front' ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1;
      setShapeList(
        shapesRef.current.map((shape) => (shape.id === id ? { ...shape, z: next } : shape)),
      );
      scheduleSaveRef.current();
    },
    [setShapeList],
  );

  /* ---------------------------- Pictures (SHEET-02 剩余) ---------------------------- */

  const setImageList = useCallback((next: SheetImageConfig[]) => {
    imagesRef.current = next;
    setImages(next);
  }, []);

  /**
   * 插入一张图。图片以 dataURL 存进快照 —— 快照必须自包含（草稿/历史版本/导出都不能依赖原文件路径），
   * 导出时再拆回 `xl/media/imageN.<ext>`。超过上限直接拒绝，免得把 localStorage 撑爆。
   */
  const insertImageFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_IMAGE_BYTES) {
        setImageNotice(t('tools.sheet.imageTooLarge'));
        return;
      }
      let src = '';
      try {
        src = await readFileAsDataUrl(file);
      } catch {
        setImageNotice(t('tools.sheet.imageReadFailed'));
        return;
      }
      if (!parseImageDataUrl(src)) {
        setImageNotice(t('tools.sheet.imageReadFailed'));
        return;
      }
      const natural = await measureImage(src);
      const handle = handleRef.current;
      const layout = shapeLayoutRef.current;
      const range = handle?.getActiveRange();
      const from = range
        ? { col: range.startColumn, row: range.startRow, colOff: 8, rowOff: 8 }
        : pxToAnchor(24, 24, layout);
      const fit = fitImageSize(natural.width, natural.height);
      const image = createSheetImage({
        src,
        name: file.name,
        from,
        sheetId: handle?.getActiveSheetId() ?? undefined,
        width: fit.width,
        height: fit.height,
        z: imagesRef.current.reduce((max, item) => Math.max(max, item.z), 0) + 1,
      });
      setImageNotice(null);
      setImageList([...imagesRef.current, image]);
      setSelectedImageId(image.id);
      scheduleSaveRef.current();
    },
    [setImageList, t],
  );

  const updateImage = useCallback(
    (id: string, patch: Partial<SheetImageConfig>) => {
      setImageList(
        imagesRef.current.map((image) => (image.id === id ? { ...image, ...patch } : image)),
      );
      scheduleSaveRef.current();
    },
    [setImageList],
  );

  const removeImage = useCallback(
    (id: string) => {
      setImageList(imagesRef.current.filter((image) => image.id !== id));
      setSelectedImageId((current) => (current === id ? null : current));
      scheduleSaveRef.current();
    },
    [setImageList],
  );

  const reorderImage = useCallback(
    (id: string, direction: 'front' | 'back') => {
      const zs = imagesRef.current.map((image) => image.z);
      const next = direction === 'front' ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1;
      setImageList(
        imagesRef.current.map((image) => (image.id === id ? { ...image, z: next } : image)),
      );
      scheduleSaveRef.current();
    },
    [setImageList],
  );

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
   * IndexedDB tier (P0-5): keep only the newest snapshot and write it on a slow debounce. The draft
   * (localStorage) is the fast path; this is the durable one, so it must never queue up N writes for
   * N keystrokes — the last one wins.
   */
  const queueDocSave = useCallback(
    (id: string, title: string, snapshot: WorkbookSnapshot): void => {
      pendingDocRef.current = { id, title, snapshot };
      if (docSaveTimerRef.current) clearTimeout(docSaveTimerRef.current);
      docSaveTimerRef.current = setTimeout(() => {
        docSaveTimerRef.current = null;
        flushDocSaveRef.current();
      }, DOC_SAVE_DEBOUNCE_MS);
    },
    [],
  );

  const flushDocSave = useCallback((): void => {
    if (docSaveTimerRef.current) {
      clearTimeout(docSaveTimerRef.current);
      docSaveTimerRef.current = null;
    }
    const pending = pendingDocRef.current;
    pendingDocRef.current = null;
    if (!pending) return;
    void saveDocument(pending.id, pending.title, pending.snapshot).then(() => {
      void listDocuments().then(setDocs);
    });
  }, []);
  // The debounce timer and the unmount cleanup call through the ref, so they always see this closure
  flushDocSaveRef.current = flushDocSave;

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
      const nextSummary = summarizeWorkbook(base);
      setSummary(nextSummary);
      setMemoryBytes(estimateJsonBytes({ summary: nextSummary, snapshot }));
      // Allocate the document id lazily: it only enters the library on the first save
      let id = docIdRef.current;
      if (!id) {
        id = createDocId();
        docIdRef.current = id;
        setDocId(id);
        setCurrentDocId(id);
      }
      queueDocSave(id, nextTitle ?? titleRef.current, snapshot);
    },
    [applyChartData, queueDocSave, withDocOwnedContent],
  );

  /**
   * Edit events → debounced persistence. The snapshot + stringify work happens in an idle callback:
   * doing it inside the timer made every pause in typing a main-thread stall on large sheets.
   */
  const scheduleSave = useCallback((): void => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      runWhenIdle(persistNow);
    }, SAVE_DEBOUNCE_MS);
  }, [persistNow]);
  // Chart edits (non-Univer changes) trigger persistence through this ref, so callbacks need not be declared in order
  useEffect(() => {
    scheduleSaveRef.current = scheduleSave;
  }, [scheduleSave]);

  /** Inline failure notices (P0-3): one at a time, auto-dismissed, never blocking */
  useEffect(() => subscribeSheetIssues((issue) => setIssueNotice(issue)), []);

  useEffect(() => {
    if (!issueNotice) return;
    const timer = window.setTimeout(() => setIssueNotice(null), ISSUE_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [issueNotice]);

  /**
   * Close-the-tab safety net (P0-5): the draft is written on a debounce and the library on a slow
   * one, so the last edits must be flushed when the page goes away.
   */
  useEffect(() => {
    const flush = () => flushDocSaveRef.current();
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return;
      persistNow();
      flushDocSaveRef.current();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [persistNow]);

  /** A queued library write must not be stranded when the tool unmounts (route change) */
  useEffect(() => () => flushDocSaveRef.current(), []);

  /**
   * Screen-reader announcement of the selection (P0-6). The grid is a canvas, so a live region is
   * the only thing assistive tech can follow; it settles for 300 ms so dragging a selection
   * announces the result instead of every intermediate cell.
   */
  useEffect(() => {
    const host = ribbonHost;
    if (!host) return;
    let timer: number | null = null;
    let last = '';
    const announce = () => {
      timer = null;
      const range = host.getActiveRange();
      if (!range) return;
      const cell = `${columnIndexToName(range.startColumn)}${range.startRow + 1}`;
      const rows = range.endRow - range.startRow + 1;
      const columns = range.endColumn - range.startColumn + 1;
      const next =
        rows === 1 && columns === 1
          ? t('tools.sheet.a11yCell', { cell })
          : t('tools.sheet.a11yRange', { cell, rows, columns });
      if (next === last) return;
      last = next;
      setA11yStatus(next);
    };
    const unsubscribe = host.onSelectionChange(() => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(announce, 300);
    });
    return () => {
      unsubscribe();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [ribbonHost, t]);

  const lang = useSettingsStore((s) => s.lang);
  const theme = useSettingsStore((s) => s.theme);
  const dark =
    theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'));
  const univerLocale: 'zhCN' | 'enUS' = lang === 'zh' || lang === 'zh-TW' ? 'zhCN' : 'enUS';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let stopViewport: (() => void) | null = null;
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
        if (!rawPartsRef.current) {
          rawPartsRef.current = pending.syntoolsRawParts ?? null;
        }
        if (chartsRef.current.length === 0) {
          const configs = pending.syntoolsCharts ?? [];
          if (configs.length > 0) {
            chartsRef.current = configs;
            setCharts(configs);
            setSelectedChartId(configs[0]?.id ?? null);
          }
        }
        // 图表导入提示：已转换成可编辑配置的 + 只能原样保留的（两者都为 0 时为 null，不显示）
        setChartImport(summarizeImport(chartsRef.current, rawPartsRef.current?.parts));
        if (imagesRef.current.length === 0) {
          const imageConfigs = pending.syntoolsImages ?? [];
          if (imageConfigs.length > 0) {
            imagesRef.current = imageConfigs;
            setImages(imageConfigs);
          }
        }
        if (shapesRef.current.length === 0) {
          const shapeConfigs = pending.syntoolsShapes ?? [];
          if (shapeConfigs.length > 0) {
            shapesRef.current = shapeConfigs;
            setShapes(shapeConfigs);
          }
        }
        if (!commentsLoadedRef.current) {
          const map = readSheetComments(pending);
          commentsLoadedRef.current = true;
          commentsRef.current = map;
          setSheetComments(map);
        }
        if (!metaLoadedRef.current) {
          metaLoadedRef.current = true;
          const names = pending.namedRanges ?? [];
          namedRangesRef.current = names;
          setNamedRanges(names);
          const protections = pending.syntoolsProtection ?? [];
          protectionRef.current = protections;
          setProtectionList(protections);
          const pendingTables = pending.syntoolsTables ?? [];
          tablesRef.current = pendingTables;
          setTables(pendingTables);
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
      setRibbonHost(handle);
      // Dirty tracking: only modifications that reach the snapshot trigger debounced persistence
      unsubscribeRef.current = handle.onMutation(() => {
        scheduleSave();
        // 透视表是"源数据的视图"：源表一改就重算，而不是等用户手动刷新
        if (pivotOpenRef.current) setPivotSnapshot(handle.getSnapshot());
        // Column widths / row heights may have changed: shapes are anchored through them
        setShapeLayoutVersion((version) => version + 1);
      });
      setSheets(handle.getSheets());
      setActiveSheetId(handle.getActiveSheetId());
      // Re-apply the read-only switch after every rebuild (locale / theme rebuilds the instance)
      handle.setEditable(protectionFor(protectionRef.current, handle.getActiveSheetId()) === null);
      const initial = handle.getSnapshot();
      setSummary(summarizeWorkbook(initial));
      applyChartData(initial, handle.getActiveSheetId());
      // Shapes are projected through the grid's origin / scroll / zoom; the render unit is only
      // measured once Univer has painted, hence the extra frame before the first read.
      const syncViewport = (): void => {
        if (cancelled) return;
        setShapeViewport(handle.getViewport() ?? DEFAULT_SHEET_VIEWPORT);
      };
      stopViewport = handle.onViewportChange(syncViewport);
      syncViewport();
      window.requestAnimationFrame(syncViewport);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopViewport?.();
      stopViewport = null;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      const current = handleRef.current;
      if (current) {
        pendingRef.current = current.getSnapshot();
        current.dispose();
        handleRef.current = null;
        setRibbonHost(null);
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

  // Every sheet keeps its own scroll position: re-read the projection on a sheet switch
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    setShapeViewport(handle.getViewport() ?? DEFAULT_SHEET_VIEWPORT);
  }, [activeSheetId]);

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

  /**
   * 名称改动立刻进快照：名称不是 Univer 的 mutation，脏标记看不到它，
   * 所以必须显式请求持久化（与图表/形状同一条路径）。
   */
  const updateNames = useCallback((next: NamedRange[]) => {
    namedRangesRef.current = next;
    setNamedRanges(next);
    scheduleSaveRef.current();
  }, []);

  /** 关面板时把"半成品"名称清掉：空名或引用识别不了的行导出后就是坏文件 */
  const closeNames = useCallback(() => {
    const cleaned = sanitizeNamedRanges(namedRangesRef.current);
    if (cleaned.length !== namedRangesRef.current.length) updateNames(cleaned);
    setNamesOpen(false);
  }, [updateNames]);

  /**
   * 打开名称管理器：顺手把当前选区记成 `A1:B2`，供"用选区填入"按钮使用。
   * 只在打开那一刻取一次 —— 面板是模态的，背后的选区不会变。
   */
  const openNames = useCallback(() => {
    const range = handleRef.current?.getActiveRange();
    if (!range) {
      setSelectionLabel(null);
    } else {
      const from = `${columnIndexToName(range.startColumn)}${range.startRow + 1}`;
      const to = `${columnIndexToName(range.endColumn)}${range.endRow + 1}`;
      setSelectionLabel(from === to ? from : `${from}:${to}`);
    }
    setNamesOpen(true);
  }, []);

  /**
   * 保护开关：开启时把该表切为只读（Univer 的 editable 权限），关闭时恢复。
   * 密码只在开启那一刻算一次哈希，之后从快照原样导出（导出结果才是可复现的）。
   */
  const applyProtection = useCallback(
    async (input: { enabled: boolean; flags: SheetProtectionFlags; password: string }) => {
      const handle = handleRef.current;
      const sheetId = handle?.getActiveSheetId();
      if (!sheetId) return;
      setProtectBusy(true);
      try {
        if (!input.enabled) {
          const next = setProtection(protectionRef.current, sheetId, null);
          protectionRef.current = next;
          setProtectionList(next);
          scheduleSaveRef.current();
          setProtectOpen(false);
          return;
        }
        const hash = await createPasswordHash(input.password);
        const previous = protectionFor(protectionRef.current, sheetId);
        const next = setProtection(protectionRef.current, sheetId, {
          sheetId,
          enabled: true,
          flags: input.flags,
          // 保留已有密码：只是改"允许的操作"时不该把密码丢掉
          ...(hash ?? (previous?.password ? { password: previous.password } : {})),
        });
        protectionRef.current = next;
        setProtectionList(next);
        scheduleSaveRef.current();
        setProtectOpen(false);
      } finally {
        setProtectBusy(false);
      }
    },
    [],
  );

  /** 活动表受保护 → 整个工作簿切只读（Univer 只有工作簿级 editable 权限） */
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.setEditable(protectionFor(protection, activeSheetId) === null);
  }, [protection, activeSheetId]);

  /**
   * 插入表格（P2-S7.3）：把当前选区（太窄时退回已用区域）变成一张原生表格。
   * 表头取区域首行的文字，列名重复/为空自动兜底；表名与名称管理器共享命名空间。
   */
  const handleInsertTable = useCallback(() => {
    const handle = handleRef.current;
    const sheetId = handle?.getActiveSheetId();
    if (!handle || !sheetId) return;
    if (protectionFor(protectionRef.current, sheetId)) return;
    const snapshot = handle.getSnapshot();
    const active = handle.getActiveRange();
    const sheetSnapshot = snapshot.sheets[sheetId];
    const used = sheetSnapshot ? resolveUsedRange(sheetSnapshot) : null;
    const range = active && active.endRow > active.startRow ? active : used;
    if (!range) return;
    const table = createTableFromSelection(
      snapshot,
      sheetId,
      range,
      takenNames({
        ...snapshot,
        syntoolsTables: tablesRef.current,
        namedRanges: namedRangesRef.current,
      }),
    );
    if (!table) {
      setTableNotice(t('tools.sheet.tableInsertNeedsRows'));
      return;
    }
    setTableNotice(null);
    const next = [...tablesRef.current, table];
    tablesRef.current = next;
    setTables(next);
    scheduleSaveRef.current();
  }, [t]);

  /** 删除与当前选区相交的表格（整块删除，不做"缩表"） */
  const handleDeleteTable = useCallback(() => {
    const handle = handleRef.current;
    const sheetId = handle?.getActiveSheetId();
    const range = handle?.getActiveRange();
    if (!handle || !sheetId || !range) return;
    if (protectionFor(protectionRef.current, sheetId)) return;
    const hits = tablesInRange(tablesRef.current, sheetId, range);
    if (hits.length === 0) {
      setTableNotice(t('tools.sheet.tableDeleteNotFound'));
      return;
    }
    setTableNotice(null);
    const ids = new Set(hits.map((table) => table.id));
    const next = tablesRef.current.filter((table) => !ids.has(table.id));
    tablesRef.current = next;
    setTables(next);
    scheduleSaveRef.current();
  }, [t]);

  /** Charts visible on the active sheet (each chart is bound to one sheet) */
  const visibleCharts = useMemo(
    () => charts.filter((item) => !item.sheetId || item.sheetId === activeSheetId),
    [charts, activeSheetId],
  );

  /** Shapes visible on the active sheet, painted in z order */
  const visibleShapes = useMemo(
    () =>
      shapes
        .filter((shape) => !shape.sheetId || shape.sheetId === activeSheetId)
        .sort((a, b) => a.z - b.z),
    [shapes, activeSheetId],
  );

  /** Pictures visible on the active sheet, painted in z order (below the shapes) */
  const visibleImages = useMemo(
    () =>
      images
        .filter((image) => !image.sheetId || image.sheetId === activeSheetId)
        .sort((a, b) => a.z - b.z),
    [images, activeSheetId],
  );

  /**
   * Row/column layout of the active sheet. Shapes are stored as cell anchors; both the overlay and
   * the export go through this one conversion table so they cannot drift apart.
   */
  const shapeLayout = useMemo<SheetLayout>(() => {
    // The snapshot is read through a ref, so the memo cannot depend on it: `shapeLayoutVersion` is
    // the explicit invalidation token, bumped by the mutation subscription (column resize etc.)
    void shapeLayoutVersion;
    const snapshot = handleRef.current?.getSnapshot();
    const sheet = activeSheetId ? snapshot?.sheets?.[activeSheetId] : undefined;
    return buildSheetLayout(sheet);
  }, [activeSheetId, shapeLayoutVersion]);
  shapeLayoutRef.current = shapeLayout;

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
      setChartImport(summarizeImport(configs, rawPartsRef.current?.parts));
      const commentMap = readSheetComments(snapshot);
      commentsLoadedRef.current = true;
      commentsRef.current = commentMap;
      setSheetComments(commentMap);
      const pivots = snapshot.syntoolsPivots ?? [];
      pivotConfigsRef.current = pivots;
      setPivotConfigs(pivots);
      // Names / protection travel in the same snapshot; adopting them here keeps "打开文件" honest
      const names = snapshot.namedRanges ?? [];
      namedRangesRef.current = names;
      setNamedRanges(names);
      const protections = snapshot.syntoolsProtection ?? [];
      protectionRef.current = protections;
      setProtectionList(protections);
      const nextTables = snapshot.syntoolsTables ?? [];
      tablesRef.current = nextTables;
      setTables(nextTables);
      metaLoadedRef.current = true;
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
    // Import-side fidelity (P0-4): the sink is filled by the xlsx path; CSV has nothing to report
    const outcome: ImportOutcome = { issues: [] };
    const result =
      check.value === 'csv'
        ? csvToSnapshot(await file.text(), file.name.replace(/\.csv$/i, ''), univerLocale)
        : await importXlsxToSnapshot(file, outcome);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    const nextTitle = title.trim() ? title : result.value.name;
    applySnapshot(result.value, nextTitle);
    persistNow(nextTitle);
    // An import is an explicit action: the library entry must exist now, not after the debounce
    flushDocSaveRef.current();
    // Same dialog as the export side, opposite direction: tell the user what the file had that this
    // editor could not keep, instead of letting them find out after re-exporting.
    if (outcome.issues.length > 0 && !isFidelityMuted()) {
      setFidelity(createFidelityReport('sheet', 'import', outcome.issues));
    }
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
    // 该表的保护与局部名称随表一起消失：留着会让导出的 localSheetId 指向不存在的表
    if (protectionRef.current.some((item) => item.sheetId === id)) {
      const nextProtection = protectionRef.current.filter((item) => item.sheetId !== id);
      protectionRef.current = nextProtection;
      setProtectionList(nextProtection);
    }
    if (namedRangesRef.current.some((item) => item.sheetId === id)) {
      const nextNames = namedRangesRef.current.filter((item) => item.sheetId !== id);
      namedRangesRef.current = nextNames;
      setNamedRanges(nextNames);
    }
    if (tablesRef.current.some((item) => item.sheetId === id)) {
      const nextTables = tablesRef.current.filter((item) => item.sheetId !== id);
      tablesRef.current = nextTables;
      setTables(nextTables);
    }
    scheduleSaveRef.current();
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
      // 保护的意义就是拦住写入：目标表受保护时不要悄悄覆盖它
      if (protectionFor(protectionRef.current, target.id)) return;
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
    void duplicateDocument(id, {
      untitled: t('tools.sheet.untitledDoc'),
      suffix: t('tools.sheet.copySuffix'),
    }).then(() => {
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
    // Explicit actions bypass the 10 s library debounce: the document list must match what the user
    // just asked for, not what it will look like in ten seconds (P0-5)
    flushDocSaveRef.current();
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
  /** Protection of the active sheet drives both the menu copy and the read-only switch */
  const activeProtection = protectionFor(protection, activeSheetId);
  /** Tables living on the active sheet (badge + delete target) */
  const activeTables = useMemo(
    () => tables.filter((table) => table.sheetId === activeSheetId),
    [tables, activeSheetId],
  );
  /**
   * A sheet holding only floating objects is still exportable: shapes and charts are written as
   * native `xdr:*` parts. Gating on cell count alone made such a workbook impossible to save.
   */
  const canExportXlsx = summary.cells > 0 || shapes.length > 0 || charts.length > 0;

  /**
   * One command registry feeds both surfaces: `commands.ts` is projected onto the ribbon **and** onto the
   * ⋯ menu (which only carries the commands the ribbon has no button for), so the two cannot disagree.
   */
  const sheetActions: SheetActions = {
    newDoc: handleNew,
    importXlsx: () => openImport('.xlsx,.xlsm'),
    importCsv: () => openImport('.csv'),
    exportXlsx: () => void handleExport(),
    exportCsv: handleExportCsv,
    print: openPrint,
    library: openLibrary,
    versions: openVersions,
    clear: handleClear,
    undo: () => handleRef.current?.undo(),
    redo: () => handleRef.current?.redo(),
    insertChart: openChart,
    insertShape: () => setShapePaletteOpen(true),
    insertImage: () => imageInputRef.current?.click(),
    insertPivot: openPivot,
    openNames,
    insertTable: handleInsertTable,
    deleteTable: handleDeleteTable,
    addSheet: handleAddSheet,
    duplicateSheet: () => {
      if (activeSheetId) handleDuplicateSheet(activeSheetId);
    },
    renameSheet: () => {
      if (!activeSheet) return;
      const name = window.prompt(t('tools.sheet.rename'), activeSheet.name);
      if (name === null) return;
      const next = name.trim();
      if (!next || next === activeSheet.name) return;
      handleRenameSheet(activeSheet.id, next);
    },
    deleteSheet: () => {
      if (activeSheetId) handleDeleteSheet(activeSheetId);
    },
    openComments,
    openProtect: () => setProtectOpen(true),
    present: () => setPresenting(true),
    promptHyperlink: () => {
      const url = window.prompt(t('tools.sheet.r.hyperlinkPrompt'), 'https://');
      if (url === null) return;
      handleRef.current?.setHyperlink(url.trim());
    },
    openNumberFormat: () => {
      setNumberFormatInitial(handleRef.current?.getFormatState()?.numberFormat ?? '');
      setNumberFormatOpen(true);
    },
    copyToClipboard: (text) => {
      const clipboard = navigator.clipboard;
      if (!clipboard) {
        reportSheetIssue({ code: 'clipboardWrite', level: 'notice' });
        return;
      }
      // A rejected clipboard write used to be indistinguishable from a successful one (P0-3)
      void clipboard.writeText(text).catch((error: unknown) => {
        reportSheetIssue({ code: 'clipboardWrite', level: 'notice', detail: String(error) });
      });
    },
    pasteFromClipboard: () => {
      const clipboard = navigator.clipboard;
      if (!clipboard) {
        reportSheetIssue({ code: 'clipboardRead', level: 'notice' });
        return;
      }
      void clipboard
        .readText()
        .then((text) => {
          if (!text.trim()) return;
          handleRef.current?.writeMatrix(parseClipboardMatrix(text));
        })
        .catch((error: unknown) => {
          reportSheetIssue({ code: 'clipboardRead', level: 'notice', detail: String(error) });
        });
    },
  };

  const ribbonBase: RibbonBaseContext = {
    t,
    actions: sheetActions,
    busy: busy !== null,
    cellCount: summary.cells,
    canExportXlsx,
    sheetCount: sheets.length,
    hasActiveSheet: Boolean(activeSheetId),
    activeSheetName: activeSheet?.name ?? null,
    protectedSheet: activeProtection !== null,
    hasTable: activeTables.length > 0,
    hasDocId: Boolean(docId),
    hasTitle: Boolean(title.trim()),
  };
  const menu = buildSheetMenu({ ...ribbonBase, host: ribbonHost, format: null });

  const statusText = draftSaved ? t('common.saved') : t('common.saving');
  /**
   * Snapshot size comes from the last save, not from a render-time `getSnapshot()` (P0-5). Before
   * this, every keystroke that changed the summary serialised the whole workbook just to print a
   * number in the status bar.
   */
  const memory = formatBytes(memoryBytes);

  return (
    <div className="flex flex-col gap-4" data-tool-root>
      <SpreadsheetRibbon
        ctx={ribbonBase}
        host={ribbonHost}
        menu={menu}
        onCollapsedChange={setRibbonCollapsed}
        headerRight={
          <>
            {activeProtection ? (
              <span
                role="status"
                data-testid="sheet-protected-badge"
                title={t('tools.sheet.protectLockedNotice')}
                aria-label={t('tools.sheet.protectLockedNotice')}
                className="inline-flex h-6 items-center justify-center rounded bg-amber-50 px-1.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              >
                <Icon name="lock" className="h-3.5 w-3.5" />
              </span>
            ) : null}
            {activeTables.length > 0 ? (
              <span
                role="status"
                data-testid="sheet-table-badge"
                title={t('tools.sheet.tableBadge', { count: activeTables.length })}
                aria-label={t('tools.sheet.tableBadge', { count: activeTables.length })}
                className="inline-flex h-6 items-center rounded bg-sky-50 px-1.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300"
              >
                {activeTables.length}
              </span>
            ) : null}
            <span
              role="status"
              title={statusText}
              aria-label={statusText}
              className={`inline-flex h-6 w-6 items-center justify-center rounded ${
                draftSaved
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <Icon name={draftSaved ? 'check' : 'clock'} className="h-3.5 w-3.5" />
            </span>
            <button
              type="button"
              onClick={handleClear}
              disabled={summary.cells === 0 && !title.trim()}
              aria-label={t('common.clear')}
              title={t('common.clear')}
              className={`${STRIP_ICON_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
            <HintTip text={t('tools.sheet.unsupportedTip')} />
            <input
              type="text"
              value={title}
              aria-label={t('tools.sheet.docTitle')}
              placeholder={t('tools.sheet.titlePlaceholder')}
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
              <Icon name="sheet" className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              data-testid="sheet-present"
              onClick={openPresent}
              aria-label={t('tools.sheet.present')}
              title={t('tools.sheet.present')}
              className={STRIP_ICON_BUTTON_CLASS}
            >
              <Icon name="present" className="h-3.5 w-3.5" />
            </button>
          </>
        }
      />
      <NumberFormatDialog
        open={numberFormatOpen}
        initial={numberFormatInitial}
        onClose={() => setNumberFormatOpen(false)}
        onApply={(pattern) => {
          handleRef.current?.applyNumberFormat(pattern);
          setNumberFormatOpen(false);
        }}
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

      {tableNotice ? (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {tableNotice}
        </p>
      ) : null}

      {imageNotice ? (
        <p role="status" className="px-4 pb-1 text-[12px] text-amber-600 dark:text-amber-400">
          {imageNotice}
        </p>
      ) : null}
      {chartImport ? (
        <p role="status" className="text-[11px] text-gray-500 dark:text-gray-400">
          {chartImport.editable.total > 0
            ? `${t('tools.sheet.chartImported', { count: chartImport.editable.total })}${
                chartTypeBreakdown(chartImport.editable).length > 0
                  ? ` · ${chartTypeBreakdown(chartImport.editable)
                      .map(
                        (item) =>
                          `${t(`tools.sheet.${CHART_TYPE_LABEL_KEY[item.type]}`)} ${item.count}`,
                      )
                      .join(' / ')}`
                  : ''
              }`
            : ''}
          {chartImport.editable.total > 0 && chartImport.kept.total > 0 ? ' · ' : ''}
          {chartImport.kept.total > 0
            ? t('tools.sheet.chartKept', { count: chartImport.kept.total })
            : ''}
        </p>
      ) : null}

      {/* 选中形状时的上下文格式栏（对应 Excel 的「形状格式」选项卡） */}
      <ShapeFormatBar
        shape={visibleShapes.find((item) => item.id === selectedShapeId) ?? null}
        onChange={(patch) => {
          if (selectedShapeId) updateShape(selectedShapeId, patch);
        }}
        onRemove={() => {
          if (selectedShapeId) removeShape(selectedShapeId);
        }}
        onBringFront={() => {
          if (selectedShapeId) reorderShape(selectedShapeId, 'front');
        }}
        onSendBack={() => {
          if (selectedShapeId) reorderShape(selectedShapeId, 'back');
        }}
      />

      {/* 工作表区域：图表以浮层形式贴在同一区域内，可拖动 / 缩放 / 改数据 */}
      <div
        ref={surfaceRef}
        className="relative overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      >
        <div
          ref={containerRef}
          className="sheet-canvas"
          // The grid itself is a canvas: this label at least tells assistive tech what the region is,
          // while the live region below carries the cell coordinates (P0-6)
          role="application"
          aria-label={t('tools.sheet.a11yGridLabel')}
          style={sheetHeight ? { height: `${sheetHeight}px` } : undefined}
        />
        {/* Pictures sit under the shapes (the export writes pic before sp for the same reason) */}
        <ImageLayer
          images={visibleImages}
          layout={shapeLayout}
          selectedId={selectedImageId}
          onSelect={setSelectedImageId}
          onChange={updateImage}
          onRemove={removeImage}
          onBringFront={(id) => reorderImage(id, 'front')}
          onSendBack={(id) => reorderImage(id, 'back')}
          bounds={chartBounds}
          viewport={shapeViewport}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          data-testid="sheet-image-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset first: picking the same file twice must still fire a change event
            event.target.value = '';
            if (file) void insertImageFile(file);
          }}
        />
        {/* Shapes sit under the charts: charts are interactive panels, shapes are annotations */}
        <ShapeLayer
          shapes={visibleShapes}
          layout={shapeLayout}
          selectedId={selectedShapeId}
          onSelect={setSelectedShapeId}
          onChange={updateShape}
          onRemove={removeShape}
          onBringFront={(id) => reorderShape(id, 'front')}
          onSendBack={(id) => reorderShape(id, 'back')}
          bounds={chartBounds}
          viewport={shapeViewport}
        />
        {shapePaletteOpen ? (
          <ShapePalette
            onPick={(prst) => {
              // Excel 的顺序：选形状 → 在工作表上拖出来；单击则用默认大小
              setShapePaletteOpen(false);
              setShapeDrawPrst(prst);
            }}
            onClose={() => setShapePaletteOpen(false)}
          />
        ) : null}
        <ShapeDrawLayer
          prst={shapeDrawPrst}
          layout={shapeLayout}
          viewport={shapeViewport}
          surfaceRef={surfaceRef}
          hint={t('tools.sheet.shapeDrawHint')}
          onCancel={() => setShapeDrawPrst(null)}
          onCreate={(from, width, height) =>
            insertShapeAt(shapeDrawPrst ?? 'rect', from, width, height)
          }
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

      {/* Selection announcement for screen readers (P0-6): visual users get the highlight, readers get this */}
      <p role="status" aria-live="polite" className="sr-only" data-testid="sheet-a11y-status">
        {a11yStatus}
      </p>

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

      {/* P0-3: a click that did nothing now says why, once, then gets out of the way */}
      {issueNotice && (
        <p
          role="status"
          data-testid="sheet-issue-notice"
          className={
            issueNotice.level === 'error'
              ? 'text-sm text-red-600 dark:text-red-400'
              : 'text-sm text-amber-600 dark:text-amber-400'
          }
        >
          {t(`tools.sheet.issue.${issueNotice.code}`)}
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

      {namesOpen ? (
        <NameManagerPanel
          names={namedRanges}
          sheets={sheets.map((sheet) => ({ id: sheet.id, name: sheet.name }))}
          activeSheetId={activeSheetId}
          selectionRef={selectionLabel}
          onChange={updateNames}
          onClose={closeNames}
        />
      ) : null}

      {protectOpen ? (
        <ProtectDialog
          sheetName={activeSheet?.name ?? ''}
          state={activeProtection}
          busy={protectBusy}
          onApply={(input) => void applyProtection(input)}
          onClose={() => setProtectOpen(false)}
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
