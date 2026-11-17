import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HintTip } from '@/core/components/DocumentHeader';
import { clearDraft } from './draft';
import { Icon } from '@/core/components/Icon';
import { EditorStatusBar } from '@/core/components/EditorStatusBar';
import {
  EDITOR_STRIP_TITLE_INPUT_CLASS,
  STRIP_ICON_BUTTON_CLASS,
  formatBytes,
} from '@/core/components/editorChrome';
import { PresentOverlay } from '@/core/components/PresentOverlay';
import { ProgressBar } from '@/core/components/ProgressBar';
import { useViewportFill } from '@/core/hooks/useViewportFill';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import { useSettingsStore } from '@/stores/settings';
import type { ToolResult } from '@/core/types';
import { columnIndexToName, summarizeWorkbook, type WorkbookSummary } from './core';
import { CHART_TYPE_LABEL_KEY } from './charts';
import { registerChartStrings } from './chartStrings';
import { chartTypeBreakdown } from './chartImport';
import { registerShapeStrings } from './shapeStrings';
import { registerImageStrings } from './imageStrings';
import {
  buildSheetLayout,
  DEFAULT_SHEET_VIEWPORT,
  type SheetLayout,
  type SheetViewport,
} from './shapes';
import { ShapeLayer, ShapePalette } from './ui/ShapeOverlay';
import { ShapeDrawLayer } from './ui/ShapeDrawLayer';
import { ShapeFormatBar } from './ui/ShapeFormatBar';
import { ImageLayer } from './ui/ImageLayer';
import { registerStoreStrings } from './storeStrings';
import { useSheetDocLibrary } from './hooks/useSheetDocLibrary';
import { DocLibraryPanel, StorageNotice, VersionHistoryPanel } from './DocLibraryPanel';
import { useSheetTabs } from './hooks/useSheetTabs';
import { useSheetFileIo } from './hooks/useSheetFileIo';
import { useSheetComments } from './hooks/useSheetComments';
import { useSheetCharts } from './hooks/useSheetCharts';
import { useSheetObjects } from './hooks/useSheetObjects';
import { useSheetMeta } from './hooks/useSheetMeta';
import { useSheetPivot } from './hooks/useSheetPivot';
import { useSheetPersistence } from './hooks/useSheetPersistence';
import { useSheetInstance } from './hooks/useSheetInstance';
import { useSheetPresent } from './hooks/useSheetPresent';
import {
  ARIA_GRID_DOM_ID,
  buildAriaGrid,
  emptyAriaGrid,
  planAriaRange,
  type AriaRange,
} from './a11yGrid';
import { AriaGrid } from './AriaGrid';
import { SHEET_TEMPLATES, templateById, type SheetTemplate, type TemplateId } from './templates';
import { registerSpreadsheetStrings } from './strings';
import { registerRibbonStrings } from './ribbonStrings';
import { SpreadsheetRibbon, type RibbonBaseContext } from './SpreadsheetRibbon';
import {
  buildSheetMenu,
  resolveCommand,
  type SheetActions,
  type SheetCommandContext,
} from './commands';
import { parseClipboardMatrix, type SheetFormatState } from './sheetFormat';
import { NumberFormatDialog } from './ui/NumberFormatDialog';
import { FormatCellsDialog } from './ui/FormatCellsDialog';
import { ShortcutHelp } from './ui/ShortcutHelp';
import { SortDialog } from './ui/SortDialog';
import type { SortColumn } from './sorting';
import { auditFormulas, SUPPORTED_FUNCTION_COUNT, type FunctionAudit } from './sheetFunctions';
import { findShortcut, isMacPlatform } from './shortcuts';
import { commitFromDraft } from './formatCells';
import { createEmptySnapshot, type WorkbookSnapshot } from './xlsx-io';
import { reportSheetIssue, subscribeSheetIssues, type SheetIssue } from './issues';
import { createUniverInstance, type UniverHandle } from './univer';
import {
  PIVOT_SHOW_AS_LABEL_KEY,
  collectFieldKeys,
  computePivot,
  pivotValueLabel,
  readPivotSource,
  type PivotBlock,
} from './pivot';
import { registerPivotStrings } from './pivotStrings';
import { buildPivotSheet } from './pivotSheet';
import { PivotPanel } from './ui/PivotPanel';
import { PresentSheet } from './ui/PresentSheet';
import { ChartOverlay } from './ui/ChartOverlay';
import { PrintDialog } from './ui/PrintDialog';
import { CommentDialog } from './ui/CommentDialog';
import { countSheetComments, threadsForSheet } from './comments';
import { isFidelityMuted, muteFidelity } from '@/core/fidelity';
import { FidelityDialog } from '@/core/components/FidelityDialog';
import type { WorkbookExtras } from './xlsx-extras';
import { applySheetObjects, readSheetObjects, type SheetObjectSource } from './sheetObjects';
import { DEFAULT_SHEET_PRINT_OPTIONS, printSheet, type SheetPrintOptions } from './print';
import type { RawChartParts } from './rawChartParts';
import { SheetTabs } from './SheetTabs';
import { NameManagerPanel } from './ui/NameManagerPanel';
import { ProtectDialog } from './ui/ProtectDialog';
import { registerMetaStrings } from './metaStrings';
import { protectionFor } from './sheetProtection';
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
// 图片的读取与测量在 `imageSource.ts`（随 `useSheetObjects` 一起搬走）

/** 打印用的合成快照里只有一个工作表，id 固定即可 */
const PIVOT_SHEET_ID = 'pivot-print';
type BusyKind = 'import' | 'export' | null;

/** How long an inline failure notice stays on screen before it goes away by itself */
const ISSUE_NOTICE_MS = 6_000;

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
  /** "设置单元格格式" (P1-2) plus the selection snapshot it edits */
  const [formatCellsOpen, setFormatCellsOpen] = useState(false);
  const [formatCellsFormat, setFormatCellsFormat] = useState<SheetFormatState | null>(null);
  /** Keyboard cheat sheet (P1-1) */
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  /** "排序" dialog (P1-5): columns and header guess are captured when it opens */
  const [sortOpen, setSortOpen] = useState(false);
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const [sortHasHeader, setSortHasHeader] = useState(false);
  /** Result of "检查公式" (P1-10) */
  const [formulaReport, setFormulaReport] = useState<FunctionAudit | null>(null);
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

  /** Sheet area size: the bounds for dragging / resizing charts（图表层与形状/图片层共用） */
  const [chartBounds, setChartBounds] = useState({ width: 0, height: 0 });
  // 形状 / 图片（SHEET-02）的状态与动作在 `useSheetObjects` 里（P2-4）
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  /** Bumped on every mutation so the row/column layout is re-measured after a resize */
  const [shapeLayoutVersion, setShapeLayoutVersion] = useState(0);
  const shapeLayoutRef = useRef<SheetLayout>(buildSheetLayout(undefined));
  /** Grid → container projection for the shape layer: scrolls / zooms with the sheet (P4-SH6) */
  const [shapeViewport, setShapeViewport] = useState<SheetViewport>(DEFAULT_SHEET_VIEWPORT);
  // Cell comment threads (P1-2) 与面板状态在 `useSheetComments` 里（P2-4）；ref 与 state 同源保证
  // 快照合成读到的一定是最新的一份。
  /**
   * Persistence trigger: adding / moving / resizing / deleting a chart is not a Univer MUTATION, so
   * dirty tracking never sees it — persistence has to be requested explicitly. (Assigned once
   * scheduleSave exists.)
   */
  const scheduleSaveRef = useRef<() => void>(() => {});

  // 名称 / 保护 / 表格（P2-4 第七片）：三者都在快照里、都不是 Univer 的 mutation，规则全在 hook 里
  const {
    namedRanges,
    namedRangesRef,
    updateNames,
    namesOpen,
    selectionLabel,
    openNames,
    closeNames,
    tables,
    tablesRef,
    tableNotice,
    insertTable,
    deleteTable,
    protection,
    protectionRef,
    protectOpen,
    protectBusy,
    openProtect,
    closeProtect,
    applyProtection,
    pruneSheet: pruneMeta,
    adoptOnce: adoptMeta,
    reset: resetMeta,
  } = useSheetMeta({
    handleRef,
    onCommit: () => scheduleSaveRef.current(),
    messages: {
      tableNeedsRows: t('tools.sheet.tableInsertNeedsRows'),
      tableNotFound: t('tools.sheet.tableDeleteNotFound'),
    },
  });
  /** 标签栏刷新挂在 ref 上：透视 hook 比 `useSheetTabs` 声明得早，插入新表时要通知它 */
  const refreshSheetsRef = useRef<() => void>(() => {});

  /**
   * 值字段标签：占比 / 排名要带后缀（`金额 (占总计百分比)`）。
   * 插入到文档、导出、打印三处都走同一个回调，避免同一份透视在三个地方三种表头。
   */
  const pivotValueLabelOf = useCallback(
    (block: PivotBlock) =>
      pivotValueLabel(
        block,
        block.showAs === 'normal' ? '' : t(PIVOT_SHOW_AS_LABEL_KEY[block.showAs]),
      ),
    [t],
  );

  // 透视表（P2-4 第八片）：配置的生命周期、面板快照与「插入到文档」，视图派生与打印留在组件
  const {
    configs: pivotConfigs,
    configsRef: pivotConfigsRef,
    config: pivotConfig,
    snapshot: pivotSnapshot,
    open: pivotOpen,
    openRef: pivotOpenRef,
    openPanel: openPivot,
    closePanel: closePivot,
    applyConfig: applyPivotConfig,
    create: handlePivotCreate,
    select: handlePivotSelect,
    remove: handlePivotDelete,
    removeAll: handlePivotRemove,
    useSelection: handlePivotUseSelection,
    refresh: refreshPivot,
    insert: handlePivotInsert,
    adoptIfEmpty: adoptPivotsIfEmpty,
    reset: resetPivots,
  } = useSheetPivot({
    handleRef,
    onCommit: () => scheduleSaveRef.current(),
    onSheetsChanged: () => refreshSheetsRef.current(),
    isSheetProtected: (sheetId) => protectionFor(protectionRef.current, sheetId) !== null,
    valueLabel: pivotValueLabelOf,
    messages: {
      title: t('tools.sheet.pivotTitle'),
      blank: t('tools.sheet.pivotBlank'),
      values: t('tools.sheet.pivotValues'),
    },
  });

  /** Content such as conditional formatting / data validation that survives the snapshot round-trip without semantic mapping */
  const extrasRef = useRef<WorkbookExtras | null>(null);
  /** Excel native chart parts that came with the imported file (written back verbatim, never parsed) */
  const rawPartsRef = useRef<RawChartParts | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  /**
   * 浮动图表（P2-4 第 5 片）：配置 + 派生数据 + 选中态 + 四个动作都在 hook 里。
   * `chartBounds` 仍留在组件，因为形状 / 图片层用的是同一个尺寸。
   */
  const {
    charts,
    chartsRef,
    dataMap: chartDataMap,
    selectedId: selectedChartId,
    notice: chartNotice,
    importReport: chartImport,
    select: selectChart,
    insert: insertChart,
    update: updateChart,
    remove: removeChart,
    pickRange: pickRangeForChart,
    applyData: applyChartData,
    adoptIfEmpty: adoptChartsIfEmpty,
    reset: resetCharts,
  } = useSheetCharts({
    handleRef,
    bounds: chartBounds,
    onCommit: () => scheduleSaveRef.current(),
  });

  const [summary, setSummary] = useState<WorkbookSummary>({
    sheets: 0,
    rows: 0,
    columns: 0,
    cells: 0,
    formulas: 0,
  });
  const [busy, setBusy] = useState<BusyKind>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [runtimeError, setRuntimeError] = useState(false);
  /** 文档库的刷新函数在 hook 里，而库写入比它先声明：走 ref 取最新闭包 */
  const refreshDocsRef = useRef<() => void>(() => {});
  /** P2-6：启动时按 URL 参数打开模板，而 handler 定义在下面，所以通过 ref 调用 */
  const loadTemplateRef = useRef<(id: TemplateId, options?: { confirm?: boolean }) => void>(
    () => {},
  );
  /** Inline failure notice (P0-3); replaces the silent `catch {}` this module used to have */
  const [issueNotice, setIssueNotice] = useState<SheetIssue | null>(null);
  /** Screen-reader announcement of the current selection (P0-6) */
  const [a11yStatus, setA11yStatus] = useState('');
  /** 选区（P2-9）：无障碍网格只投影这一块，同样是"稳定后才更新"，避免方向键刷 DOM */
  const [selection, setSelection] = useState<AriaRange | null>(null);

  /**
   * 单元格批注（P2-4 第 4 片）：线程数据 + 面板状态 + 四个动作 + "只采纳第一次"的规则都在 hook 里。
   * 回落取 `activeSheetId` 而不是直接传值——标签栏的 state 比这里声明得晚。
   */
  const {
    comments: sheetComments,
    commentsRef,
    panelOpen: commentsOpen,
    cell: commentCell,
    author: commentAuthor,
    setAuthor: setCommentAuthor,
    openPanel: openComments,
    closePanel: closeComments,
    useCurrentCell: useCurrentCommentCell,
    adoptOnce: adoptComments,
    reset: resetComments,
    add: addSheetComment,
    reply: replySheetComment,
    toggleResolved: resolveSheetComment,
    remove: deleteSheetComment,
  } = useSheetComments({
    handleRef,
    fallbackSheetId: () => activeSheetId,
    onCommit: () => scheduleSaveRef.current(),
    anonymousAuthor: t('tools.sheet.commentAnonymous'),
  });

  /**
   * 漂浮形状与图片（P2-4 第 6 片）：两族对象的状态、插入 / 更新 / 删除 / 层级调整都在 hook 里。
   * 布局（`shapeLayoutRef`）仍留在组件——它由表格选区与滚动驱动，是画布的事。
   */
  const {
    shapes,
    shapesRef,
    selectedShapeId,
    selectShape,
    insertShape,
    updateShape,
    removeShape,
    reorderShape,
    paletteOpen: shapePaletteOpen,
    openPalette: openShapePalette,
    closePalette: closeShapePalette,
    drawPrst: shapeDrawPrst,
    choosePreset: chooseShapePreset,
    cancelDraw: cancelShapeDraw,
    images,
    imagesRef,
    selectedImageId,
    selectImage,
    imageAccept,
    addImageFile,
    updateImage,
    removeImage,
    reorderImage,
    imageNotice,
    adoptIfEmpty: adoptObjectsIfEmpty,
    reset: resetObjects,
  } = useSheetObjects({
    handleRef,
    layoutRef: shapeLayoutRef,
    onCommit: () => scheduleSaveRef.current(),
    messages: {
      imageTooLarge: t('tools.sheet.imageTooLarge'),
      imageReadFailed: t('tools.sheet.imageReadFailed'),
    },
  });

  /**
   * Everything this tool owns but Univer knows nothing about, as one value: charts / shapes /
   * pictures / pivots / names / protection / tables / comments plus the round-trip extras.
   * Which snapshot field each one lands in, and whether an empty value means "drop the field",
   * is declared in `sheetObjects.ts` (P2-5) — this object is only the wiring.
   */
  const sheetObjectSource = useCallback(
    (): SheetObjectSource => ({
      charts: chartsRef.current,
      rawParts: rawPartsRef.current,
      pivots: pivotConfigsRef.current,
      shapes: shapesRef.current,
      images: imagesRef.current,
      namedRanges: namedRangesRef.current,
      protection: protectionRef.current,
      tables: tablesRef.current,
      comments: commentsRef.current,
      extras: extrasRef.current,
    }),
    [
      chartsRef,
      commentsRef,
      imagesRef,
      namedRangesRef,
      pivotConfigsRef,
      protectionRef,
      shapesRef,
      tablesRef,
    ],
  );

  /** Merge the object set into a snapshot (save + export share this one path) */
  const withDocOwnedContent = useCallback(
    (base: WorkbookSnapshot): WorkbookSnapshot => applySheetObjects(base, sheetObjectSource()),
    [sheetObjectSource],
  );

  // 两级落盘（P2-4 第九片）：草稿去抖 + 文档库单槽；关页 / 切后台 / 卸载都兜住
  const {
    docId,
    docIdRef,
    adoptDocId,
    draftSaved,
    draftNotice,
    memoryBytes,
    persistNow,
    scheduleSave,
    flushDocSave,
    resetDraftState,
  } = useSheetPersistence({
    handleRef,
    withDocOwnedContent,
    syncChartData: applyChartData,
    getTitle: () => title,
    onSummary: setSummary,
    onDocSaved: () => refreshDocsRef.current(),
  });
  // 图表 / 名称 / 保护等 hook 声明得更早，通过 ref 拿到同一个 scheduleSave
  scheduleSaveRef.current = scheduleSave;

  // 演示视图（P2-4 第十一片）：只读网格的投影与开合，渲染不经过 Univer 实例
  const {
    presenting,
    grid: presentGrid,
    failed: presentFailed,
    open: openPresent,
    close: closePresent,
  } = useSheetPresent({ handleRef, withDocOwnedContent });

  /** Inline failure notices (P0-3): one at a time, auto-dismissed, never blocking */
  useEffect(() => subscribeSheetIssues((issue) => setIssueNotice(issue)), []);

  useEffect(() => {
    if (!issueNotice) return;
    const timer = window.setTimeout(() => setIssueNotice(null), ISSUE_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [issueNotice]);

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
      // 无障碍网格跟着同一次"稳定"更新：方向键连按时不该每按一次就重建一遍 DOM
      setSelection(range);
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
    // 先播一次：无障碍网格挂载时就该有内容，否则要等用户第一次移动选区
    announce();
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

  // 标签栏的状态与动作（P2-4）：引擎调用 + 刷新 + 落盘 + 删表清理，规则都在 hook 里
  const {
    sheets,
    activeSheetId,
    refresh: refreshSheets,
    add: addSheet,
    select: selectSheet,
    rename: renameSheetInEngine,
    remove: removeSheet,
    duplicate: duplicateSheetInEngine,
    setHidden: setSheetHiddenInEngine,
  } = useSheetTabs({
    handleRef,
    onRemoved: pruneMeta,
    onCommit: () => scheduleSaveRef.current(),
    onError: (message) => setFailure({ ok: false, error: message }),
    lastVisibleMessage: t('tools.sheet.lastVisibleSheet'),
  });
  // 「插入到文档」会新建工作表：让标签栏重新取一遍（hook 声明得早，只能通过 ref 回调）
  refreshSheetsRef.current = refreshSheets;

  /**
   * Univer 实例的创建 / 重建 / 销毁（P2-4 第十片）。
   * 生命周期（一个 tick 后创建、重建前抓快照、订阅与退订）在 hook 里；
   * 下面的具名回调只回答"重建后各域该做什么"。
   */
  // 语言 / 主题变化必须重建实例：这两个值打成一个稳定对象给 hook 当依赖
  const engineOptions = useMemo(() => ({ locale: univerLocale, dark }), [univerLocale, dark]);
  useSheetInstance({
    containerRef,
    handleRef,
    pendingRef,
    subscriptionRef: unsubscribeRef,
    engineOptions,
    create: createUniverInstance,
    adopt: (snapshot) => {
      // Tool-owned content: read back through the registry (P2-5), then keep the per-family
      // "first restore wins" rules below. On an instance rebuild (StrictMode's second mount,
      // theme / locale switch) `snapshot` is a raw Univer snapshot without these fields, so
      // overwriting would simply drop them.
      const adopted = readSheetObjects(snapshot);
      if (!extrasRef.current) extrasRef.current = adopted.extras;
      if (!rawPartsRef.current) {
        rawPartsRef.current = adopted.rawParts;
      }
      // 重建拿到的是原始 Univer 快照：已经有图表（来自草稿）时不覆盖
      adoptChartsIfEmpty(adopted.charts, rawPartsRef.current);
      // 形状与图片同样"空才采纳"，两族互不影响
      adoptObjectsIfEmpty({ shapes: adopted.shapes, images: adopted.images });
      // 实例重建（StrictMode / 换主题）拿到的是原始快照：只采纳第一次，别抹掉用户刚写的批注
      adoptComments(adopted.comments);
      adoptMeta({
        namedRanges: adopted.namedRanges,
        protection: adopted.protection,
        tables: adopted.tables,
      });
      // 透视配置同样"空才采纳"：重建快照里本来就没有透视，有内容就说明来自草稿
      adoptPivotsIfEmpty(adopted.pivots);
    },
    onHostChange: setRibbonHost,
    onReady: (handle) => {
      refreshSheets();
      // Re-apply the read-only switch after every rebuild (locale / theme rebuilds the instance)
      handle.setEditable(protectionFor(protectionRef.current, handle.getActiveSheetId()) === null);
      const initial = handle.getSnapshot();
      setSummary(summarizeWorkbook(initial));
      applyChartData(initial, handle.getActiveSheetId());
    },
    onMutation: () => {
      // Dirty tracking: only modifications that reach the snapshot trigger debounced persistence
      scheduleSave();
      // 透视表是"源数据的视图"：源表一改就重算，而不是等用户手动刷新
      if (pivotOpenRef.current) refreshPivot();
      // Column widths / row heights may have changed: shapes are anchored through them
      setShapeLayoutVersion((version) => version + 1);
      // 无障碍投影读的是选区那一块，代价很小：内容一变就跟上，不必等下一次移动选区
      setSelection(handleRef.current?.getActiveRange() ?? null);
    },
    onViewport: (handle) => setShapeViewport(handle.getViewport() ?? DEFAULT_SHEET_VIEWPORT),
    onFailure: () => setRuntimeError(true),
  });

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

  /** 活动表受保护 → 整个工作簿切只读（Univer 只有工作簿级 editable 权限） */
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.setEditable(protectionFor(protection, activeSheetId) === null);
  }, [protection, activeSheetId]);

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
   * 无障碍投影（P2-9）：只读选区那一块（含行列号与显示值）。
   * 读值走引擎的按区域接口，不再克隆整份快照——所以刷新频率可以跟着选区与 mutation 走。
   */
  const ariaGrid = useMemo(() => {
    const handle = handleRef.current;
    const plan = planAriaRange(selection);
    if (!handle || !plan) return emptyAriaGrid();
    const values = handle.readRangeText({
      startRow: plan.startRow,
      startColumn: plan.startColumn,
      endRow: plan.startRow + plan.rowCount - 1,
      endColumn: plan.startColumn + plan.columnCount - 1,
    });
    return buildAriaGrid({ ...plan, sheetId: activeSheetId ?? '', values });
  }, [activeSheetId, selection]);

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
      // Every object family comes back through the registry (P2-5) instead of ten hand-written
      // `snapshot.syntoolsXxx ?? []` lines. The two families this block used to forget are the
      // reason it is a registry: opening another document kept the previous one's pictures and
      // shapes on the canvas, and the next save wrote *those* into the new document.
      const objects = readSheetObjects(snapshot);
      extrasRef.current = objects.extras;
      rawPartsRef.current = objects.rawParts;
      // 换文档：图表必须无条件替换（同时清掉上一份的提示与选中态）
      resetCharts(objects.charts, objects.rawParts);
      // 换文档：必须无条件替换，上一份的批注不能挂在新文档上
      resetComments(objects.comments);
      // 换文档：配置无条件替换，并清掉活动实例 / 关掉面板（上一份的源区域不能挂在新文档上）
      resetPivots(objects.pivots);
      // 名称 / 保护 / 表格随同一份快照走：换文档必须无条件替换（上一份不能挂在新文档上）
      resetMeta({
        namedRanges: objects.namedRanges,
        protection: objects.protection,
        tables: objects.tables,
      });
      // 换文档：形状与图片无条件替换，选中态 / 绘制模式一起清掉
      resetObjects({ shapes: objects.shapes, images: objects.images });
      applyChartData(handle.getSnapshot(), handle.getActiveSheetId());
      refreshSummary();
      refreshSheets();
    },
    [
      applyChartData,
      refreshSummary,
      refreshSheets,
      resetComments,
      resetCharts,
      resetMeta,
      resetObjects,
      resetPivots,
    ],
  );

  /** 清空重来（新建 / 删除当前文档后）：编辑器与草稿都回到"空工作簿" */
  const loadEmptyWorkbook = () => {
    applySnapshot(createEmptySnapshot('', univerLocale), '');
    clearDraft();
    resetDraftState();
  };

  /**
   * 文档库编排（P2-4 第 2 片）：列表 / 版本 / 面板 / 降级状态与全部库里动作都在 hook 里，
   * 组件只提供"怎么把快照灌进编辑器"和"删掉当前文档后怎么清空"。
   */
  const {
    docs,
    versions,
    libraryOpen,
    versionsOpen,
    storeStatus,
    storageUsage,
    init: initLibrary,
    refreshDocs,
    adoptNewDoc,
    openLibrary,
    closeLibrary,
    openVersions,
    closeVersions,
    retryStore,
    deleteVersionById,
    clearAllVersions,
    openDoc,
    duplicateDoc,
    removeDoc,
    restoreVersion,
  } = useSheetDocLibrary({
    docIdRef,
    onAdoptDocId: adoptDocId,
    onOpenSnapshot: applySnapshot,
    onResetWorkbook: loadEmptyWorkbook,
    onPersist: (nextTitle) => persistNow(nextTitle),
    onFlush: flushDocSave,
    messages: {
      untitled: t('tools.sheet.untitledDoc'),
      copySuffix: t('tools.sheet.copySuffix'),
      deleteConfirm: (title) => t('tools.sheet.deleteDocConfirm', { title }),
      restoreConfirm: t('tools.sheet.restoreConfirm'),
      clearVersionsConfirm: t('tools.sheet.clearVersionsConfirm'),
    },
  });
  // 库写入（持久化 hook）比文档库 hook 先声明：写成功后通过 ref 刷新列表
  refreshDocsRef.current = refreshDocs;

  // Startup: adopt the document-library pointer (content already came from the localStorage draft, avoiding a race with instance creation)
  useEffect(() => {
    // P2-6：`?template=budget` 直达模板。这是用户点链接进来的明确意图，
    // 所以覆盖草稿内容、不弹确认；顺手把参数从地址栏抹掉，刷新时不会又生成一份新文档。
    const wanted = templateById(
      typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('template'),
    );
    if (wanted) {
      loadTemplateRef.current(wanted.id, { confirm: false });
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
    void initLibrary();
  }, [initLibrary]);

  // Title changes are persisted too (skipped on first render so merely opening the page does not create an empty document)
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    scheduleSave();
  }, [title, scheduleSave]);

  // 标签栏的六个动作只是 hook 的薄包装：动作本身（刷新 / 清理 / 落盘 / 报错）都在 useSheetTabs 里
  const handleAddSheet = () => {
    addSheet();
    setFailure(null);
  };

  const handleSelectSheet = (id: string) => selectSheet(id);

  const handleRenameSheet = (id: string, name: string) => renameSheetInEngine(id, name);

  const handleDeleteSheet = (id: string) => removeSheet(id);

  const handleDuplicateSheet = (id: string) => duplicateSheetInEngine(id);

  /** 隐藏 / 取消隐藏（P2-7）：拒绝时 hook 已经报过错，这里只负责清掉旧的失败提示 */
  const handleToggleSheetHidden = (id: string, hidden: boolean) => {
    if (setSheetHiddenInEngine(id, hidden)) setFailure(null);
  };

  /**
   * 文件进出（P2-4 第 3 片）：导入 / 导出 xlsx·csv / 打印·PDF 与它们的"忙 / 失败 / 保真报告"，
   * 全部在 hook 里；组件只提供快照合成方式与几个落盘回调。
   */
  const {
    printTarget,
    fidelity,
    closeFidelity,
    closePrint,
    openImport,
    importFile,
    exportXlsx,
    exportCsv,
    openPrint,
    print: printWithOptions,
    exportPdf,
  } = useSheetFileIo({
    handleRef,
    title,
    locale: univerLocale,
    importInputRef,
    setBusy,
    setFailure,
    withDocOwnedContent,
    applySnapshot,
    persistNow: (nextTitle) => persistNow(nextTitle),
    flushDocSave,
    pivotConfigsRef,
    pivotValueLabelOf,
    chartDataMap,
    pivotBlankLabel: t('tools.sheet.pivotBlank'),
    pivotValuesCaption: t('tools.sheet.pivotValues'),
  });

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
      pivotValueLabelOf,
      t('tools.sheet.pivotValues'),
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

  const handleClear = () => {
    loadEmptyWorkbook();
  };

  const handleNew = () => {
    const hasContent = summary.cells > 0 || title.trim().length > 0;
    if (hasContent && !window.confirm(t('common.discardConfirm'))) return;
    // A new document gets a fresh id; the previous workbook stays in the library
    adoptNewDoc();
    loadEmptyWorkbook();
  };

  /**
   * 打开一份内置模板（P2-6）。和"新建"同一套路：先占一个新的文档 id，再灌内容，
   * 于是模板天然是"新文档"，不会覆盖库里的东西，也能立刻被保存 / 起名 / 导出。
   *
   * `confirm: false` 给 URL 直达用：`?template=budget` 是用户的明确意图，
   * 不该再弹一次"放弃当前内容？"（那份草稿此时还没被看到过）。
   */
  const loadTemplate = (template: SheetTemplate, options: { confirm?: boolean } = {}): void => {
    if (options.confirm !== false) {
      const hasContent = summary.cells > 0 || title.trim().length > 0;
      if (hasContent && !window.confirm(t('common.discardConfirm'))) return;
    }
    const nextTitle = t(template.titleKey);
    adoptNewDoc();
    applySnapshot(template.build(nextTitle, univerLocale), nextTitle);
    closeLibrary();
    persistNow(nextTitle);
    // 显式动作：库里的条目现在就要在，不等 10 秒的防抖
    flushDocSave();
  };

  const handleUseTemplate = (id: TemplateId, options?: { confirm?: boolean }) => {
    const template = templateById(id);
    if (template) loadTemplate(template, options);
  };
  // 启动副作用要调用它，而那时 handleUseTemplate 还在后面的语句里：走 ref，避免把整块提前
  loadTemplateRef.current = handleUseTemplate;

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
    // 同一个入口也收 .ods：分流在 `checkImportFile`，用户不必先记住自己手里是哪种容器
    importXlsx: () => openImport('.xlsx,.xlsm,.ods'),
    importCsv: () => openImport('.csv'),
    exportXlsx: () => void exportXlsx(),
    exportCsv: exportCsv,
    print: openPrint,
    library: openLibrary,
    versions: openVersions,
    clear: handleClear,
    undo: () => handleRef.current?.undo(),
    redo: () => handleRef.current?.redo(),
    insertChart,
    insertShape: openShapePalette,
    insertImage: () => imageInputRef.current?.click(),
    insertPivot: openPivot,
    openNames,
    insertTable,
    deleteTable,
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
    openProtect,
    // 命令表也走同一套投影：只置位不建网格会让第二次演示停留在上一份内容
    present: openPresent,
    promptHyperlink: () => {
      const url = window.prompt(t('tools.sheet.r.hyperlinkPrompt'), 'https://');
      if (url === null) return;
      handleRef.current?.setHyperlink(url.trim());
    },
    openNumberFormat: () => {
      setNumberFormatInitial(handleRef.current?.getFormatState()?.numberFormat ?? '');
      setNumberFormatOpen(true);
    },
    openFormatCells: () => {
      // Snapshot the selection now: the dialog must describe what it is about to change
      setFormatCellsFormat(handleRef.current?.getFormatState() ?? null);
      setFormatCellsOpen(true);
    },
    openShortcuts: () => setShortcutsOpen(true),
    checkFormulas: () => {
      setFormulaReport(auditFormulas(ribbonHost?.readSelectionFormulas() ?? []));
    },
    openSort: () => {
      // Whatever the dialog says about columns must describe the selection it will reorder
      const info = ribbonHost?.describeSortRange();
      if (!info) return;
      setSortColumns(info.columns);
      setSortHasHeader(info.hasHeader);
      setSortOpen(true);
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

  /**
   * Keyboard layer (P1-1).
   *
   * A ref keeps the listener stable across renders while still seeing the current context (busy
   * flags, protection, the live host). `defaultPrevented` is the contract with the sheet engine: if
   * its keymap already ran, we must not run the command a second time.
   */
  const commandCtxRef = useRef<SheetCommandContext | null>(null);
  commandCtxRef.current = { ...ribbonBase, host: ribbonHost, format: null };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      const id = findShortcut(event, isMacPlatform());
      if (!id) return;
      const ctx = commandCtxRef.current;
      if (!ctx) return;
      const command = resolveCommand(ctx, id);
      if (command.disabled) return;
      // The browser would otherwise print / save / open its own dialog
      event.preventDefault();
      command.run();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
      {/*
       * Format Cells (P1-2). It lives here rather than inside the ribbon because it must apply
       * through the same host instance the rest of the tool edits; the *format snapshot* is taken
       * when the dialog opens, so a stale ribbon state can never seed it.
       */}
      {/*
       * Formula audit result (P1-10). A short inline card instead of a dialog: the answer is one
       * sentence and the user should stay in the grid.
       */}
      {formulaReport ? (
        <div
          role="status"
          data-testid="sheet-formula-audit"
          className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-200"
        >
          <span>
            {formulaReport.formulas === 0
              ? t('tools.sheet.formulaAuditNone')
              : formulaReport.unsupported.length === 0
                ? t('tools.sheet.formulaAuditOk', {
                    count: formulaReport.formulas,
                    total: SUPPORTED_FUNCTION_COUNT,
                  })
                : t('tools.sheet.formulaAuditMissing', {
                    names: formulaReport.unsupported.join(', '),
                  })}
          </span>
          <button
            type="button"
            onClick={() => setFormulaReport(null)}
            aria-label={t('tools.sheet.printCancel')}
            className="text-green-700 hover:text-green-900 dark:text-green-300"
          >
            ×
          </button>
        </div>
      ) : null}
      <SortDialog
        open={sortOpen}
        columns={sortColumns}
        hasHeader={sortHasHeader}
        onClose={() => setSortOpen(false)}
        onApply={(keys, hasHeader) => {
          ribbonHost?.sortRange(keys, hasHeader);
          setSortOpen(false);
        }}
      />
      <ShortcutHelp
        open={shortcutsOpen}
        ctx={{ ...ribbonBase, host: ribbonHost, format: null }}
        onClose={() => setShortcutsOpen(false)}
      />
      <FormatCellsDialog
        open={formatCellsOpen}
        format={formatCellsFormat}
        onClose={() => setFormatCellsOpen(false)}
        onApply={(draft) => {
          const commit = commitFromDraft(draft);
          ribbonHost?.applyFormat(commit.patch);
          if (commit.border) ribbonHost?.applyBorder(commit.border.preset, commit.border.spec);
          setFormatCellsOpen(false);
        }}
      />

      {libraryOpen ? (
        <DocLibraryPanel
          currentDocId={docId}
          docs={docs}
          onOpen={openDoc}
          onDuplicate={duplicateDoc}
          onDelete={removeDoc}
          onNew={handleNew}
          onClose={closeLibrary}
          usage={storageUsage}
          templates={SHEET_TEMPLATES}
          onTemplate={handleUseTemplate}
        />
      ) : null}
      {versionsOpen ? (
        <VersionHistoryPanel
          versions={versions}
          onRestore={restoreVersion}
          onClose={closeVersions}
          onDeleteVersion={deleteVersionById}
          onClearVersions={clearAllVersions}
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
          // 投影网格是兄弟节点：用 aria-owns 挂成子节点，`aria-activedescendant` 才指向合法后代
          aria-owns={ARIA_GRID_DOM_ID}
          aria-activedescendant={ariaGrid.activeId ?? undefined}
          style={sheetHeight ? { height: `${sheetHeight}px` } : undefined}
        />
        {/* 画布对读屏是不可见的：叠一层视觉隐藏的 grid 把"在哪 / 是什么"投影出去（P2-9） */}
        <AriaGrid model={ariaGrid} />
        {/* Pictures sit under the shapes (the export writes pic before sp for the same reason) */}
        <ImageLayer
          images={visibleImages}
          layout={shapeLayout}
          selectedId={selectedImageId}
          onSelect={selectImage}
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
          accept={imageAccept}
          className="hidden"
          data-testid="sheet-image-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset first: picking the same file twice must still fire a change event
            event.target.value = '';
            if (file) void addImageFile(file);
          }}
        />
        {/* Shapes sit under the charts: charts are interactive panels, shapes are annotations */}
        <ShapeLayer
          shapes={visibleShapes}
          layout={shapeLayout}
          selectedId={selectedShapeId}
          onSelect={selectShape}
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
              chooseShapePreset(prst);
            }}
            onClose={closeShapePalette}
          />
        ) : null}
        <ShapeDrawLayer
          prst={shapeDrawPrst}
          layout={shapeLayout}
          viewport={shapeViewport}
          surfaceRef={surfaceRef}
          hint={t('tools.sheet.shapeDrawHint')}
          onCancel={cancelShapeDraw}
          onCreate={(from, width, height) =>
            insertShape(shapeDrawPrst ?? 'rect', from, width, height)
          }
        />
        {visibleCharts.map((config) => (
          <ChartOverlay
            key={config.id}
            config={config}
            data={chartDataMap[config.id] ?? null}
            selected={config.id === selectedChartId}
            bounds={chartBounds}
            onSelect={() => selectChart(config.id)}
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
        onToggleHidden={handleToggleSheetHidden}
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
        accept=".xlsx,.xlsm,.ods,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void importFile(file);
        }}
      />

      {runtimeError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.sheet', { ok: false, error: 'RUNTIME_FAILED' })}
        </p>
      )}

      {/* P2-3: 文档库不可用 / 空间不足——说清原因，并能就地重试；空间不足还能去删旧版本 */}
      <StorageNotice status={storeStatus} onRetry={retryStore} onFreeSpace={openVersions} />

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
        onClose={closeFidelity}
        onMute={muteFidelity}
      />

      {pivotOpen && pivotConfig && pivotView ? (
        <PivotPanel
          config={pivotConfig}
          configs={pivotConfigs}
          onSelect={handlePivotSelect}
          onCreate={handlePivotCreate}
          onDelete={handlePivotDelete}
          fields={pivotView.source.fields}
          result={pivotView.result}
          empty={pivotView.source.records.length === 0}
          recordCount={pivotView.source.records.length}
          keysByColumn={pivotFieldKeys}
          onConfigChange={applyPivotConfig}
          onUseSelection={handlePivotUseSelection}
          onRefresh={refreshPivot}
          onRemove={handlePivotRemove}
          onClose={closePivot}
          onInsert={handlePivotInsert}
          inserted={
            Boolean(pivotConfig.outputSheetId) &&
            sheets.some((sheet) => sheet.id === pivotConfig.outputSheetId)
          }
          onExport={() => void exportXlsx()}
          onPrint={handlePivotPrint}
        />
      ) : null}

      {printTarget ? (
        <PrintDialog
          snapshot={printTarget.snapshot}
          sheetId={printTarget.sheetId}
          selection={printTarget.selection}
          busy={busy !== null}
          onCancel={closePrint}
          onPrint={(options, range) => void printWithOptions(options, range)}
          onExportPdf={(options, range) => void exportPdf(options, range)}
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
          onUseCurrentCell={useCurrentCommentCell}
          onClose={closeComments}
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
          onClose={closeProtect}
        />
      ) : null}

      {presenting ? (
        <PresentOverlay
          title={title.trim() || t('tools.sheet.titlePlaceholder')}
          onClose={closePresent}
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
