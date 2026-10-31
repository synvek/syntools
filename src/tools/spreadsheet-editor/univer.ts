import {
  CommandType,
  LocaleType,
  RedoCommandId,
  UndoCommandId,
  Univer,
  mergeLocales,
  type ICellData,
  type IWorkbookData,
} from '@univerjs/core';
import { FUniver } from '@univerjs/core/facade';
import DesignEnUS from '@univerjs/design/locale/en-US';
import DesignZhCN from '@univerjs/design/locale/zh-CN';
import { UniverDocsPlugin } from '@univerjs/docs';
import { UniverDocsUIPlugin } from '@univerjs/docs-ui';
import DocsUIEnUS from '@univerjs/docs-ui/locale/en-US';
import DocsUIZhCN from '@univerjs/docs-ui/locale/zh-CN';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import '@univerjs/engine-formula/facade';
import {
  IRenderManagerService,
  SHEET_VIEWPORT_KEY,
  UniverRenderEnginePlugin,
} from '@univerjs/engine-render';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import SheetsEnUS from '@univerjs/sheets/locale/en-US';
import SheetsZhCN from '@univerjs/sheets/locale/zh-CN';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';
import { UniverSheetsFormulaUIPlugin } from '@univerjs/sheets-formula-ui';
import SheetsFormulaUIEnUS from '@univerjs/sheets-formula-ui/locale/en-US';
import SheetsFormulaUIZhCN from '@univerjs/sheets-formula-ui/locale/zh-CN';
import { UniverSheetsNumfmtPlugin } from '@univerjs/sheets-numfmt';
import { UniverSheetsNumfmtUIPlugin } from '@univerjs/sheets-numfmt-ui';
import SheetsNumfmtUIEnUS from '@univerjs/sheets-numfmt-ui/locale/en-US';
import SheetsNumfmtUIZhCN from '@univerjs/sheets-numfmt-ui/locale/zh-CN';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
import SheetsUIEnUS from '@univerjs/sheets-ui/locale/en-US';
import SheetsUIZhCN from '@univerjs/sheets-ui/locale/zh-CN';
import { UniverUIPlugin } from '@univerjs/ui';
import UIEnUS from '@univerjs/ui/locale/en-US';
import UIZhCN from '@univerjs/ui/locale/zh-CN';
// P1 feature plugins: conditional formatting / data validation / filter / sort / hyperlink / find-replace
import { UniverSheetsConditionalFormattingPlugin } from '@univerjs/sheets-conditional-formatting';
import { UniverSheetsConditionalFormattingUIPlugin } from '@univerjs/sheets-conditional-formatting-ui';
import ConditionalFormattingUIEnUS from '@univerjs/sheets-conditional-formatting-ui/locale/en-US';
import ConditionalFormattingUIZhCN from '@univerjs/sheets-conditional-formatting-ui/locale/zh-CN';
import { UniverSheetsDataValidationPlugin } from '@univerjs/sheets-data-validation';
import { UniverSheetsDataValidationUIPlugin } from '@univerjs/sheets-data-validation-ui';
import DataValidationEnUS from '@univerjs/sheets-data-validation/locale/en-US';
import DataValidationZhCN from '@univerjs/sheets-data-validation/locale/zh-CN';
import DataValidationUIEnUS from '@univerjs/sheets-data-validation-ui/locale/en-US';
import DataValidationUIZhCN from '@univerjs/sheets-data-validation-ui/locale/zh-CN';
import { UniverSheetsFilterPlugin } from '@univerjs/sheets-filter';
import { UniverSheetsFilterUIPlugin } from '@univerjs/sheets-filter-ui';
import FilterEnUS from '@univerjs/sheets-filter/locale/en-US';
import FilterZhCN from '@univerjs/sheets-filter/locale/zh-CN';
import FilterUIEnUS from '@univerjs/sheets-filter-ui/locale/en-US';
import FilterUIZhCN from '@univerjs/sheets-filter-ui/locale/zh-CN';
import { UniverSheetsSortPlugin } from '@univerjs/sheets-sort';
import { UniverSheetsSortUIPlugin } from '@univerjs/sheets-sort-ui';
import SortUIEnUS from '@univerjs/sheets-sort-ui/locale/en-US';
import SortUIZhCN from '@univerjs/sheets-sort-ui/locale/zh-CN';
import { UniverSheetsHyperLinkPlugin } from '@univerjs/sheets-hyper-link';
import { UniverSheetsHyperLinkUIPlugin } from '@univerjs/sheets-hyper-link-ui';
import HyperLinkEnUS from '@univerjs/sheets-hyper-link/locale/en-US';
import HyperLinkZhCN from '@univerjs/sheets-hyper-link/locale/zh-CN';
import HyperLinkUIEnUS from '@univerjs/sheets-hyper-link-ui/locale/en-US';
import HyperLinkUIZhCN from '@univerjs/sheets-hyper-link-ui/locale/zh-CN';
import { UniverFindReplacePlugin } from '@univerjs/find-replace';
import FindReplaceEnUS from '@univerjs/find-replace/locale/en-US';
import FindReplaceZhCN from '@univerjs/find-replace/locale/zh-CN';
import { UniverSheetsFindReplacePlugin } from '@univerjs/sheets-find-replace';
// Side-effect imports: add workbook methods such as createWorkbook / getActiveWorkbook to FUniver
import '@univerjs/sheets/facade';
import '@univerjs/sheets-ui/facade';
import '@univerjs/sheets-conditional-formatting/facade';
import '@univerjs/sheets-data-validation/facade';
import '@univerjs/sheets-filter/facade';
import '@univerjs/sheets-sort/facade';
import '@univerjs/sheets-hyper-link/facade';
import '@univerjs/sheets-find-replace/facade';
// Styles must be imported in the order design → ui → docs-ui → sheets-ui → formula-ui → numfmt-ui → feature plugins
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/sheets-formula-ui/lib/index.css';
import '@univerjs/sheets-numfmt-ui/lib/index.css';
import '@univerjs/sheets-conditional-formatting-ui/lib/index.css';
import '@univerjs/sheets-data-validation-ui/lib/index.css';
import '@univerjs/sheets-filter-ui/lib/index.css';
import '@univerjs/sheets-sort-ui/lib/index.css';
import '@univerjs/sheets-hyper-link-ui/lib/index.css';
import '@univerjs/find-replace/lib/index.css';
import { createEmptySnapshot, type WorkbookSnapshot } from './xlsx-io';
import type { SheetViewport } from './shapes';

/**
 * Univer adapter layer: plugin registration, locales, theme and lifecycle funnel through one entry
 * point. Only the lazy-loaded SpreadsheetTool imports this module, so Univer stays out of the
 * initial bundle.
 */

export interface SheetInfo {
  id: string;
  name: string;
  hidden: boolean;
  tabColor?: string;
}

/** 写进单元格的值：空串在 Univer 里应该写成 null，否则会留下"有内容的空单元格" */
export type SheetCellValue = string | number | null;

export interface UniverHandle {
  loadSnapshot(snapshot: WorkbookSnapshot): void;
  getSnapshot(): WorkbookSnapshot;
  dispose(): void;
  /** List every sheet of the current workbook (in display order) */
  getSheets(): SheetInfo[];
  /** Id of the active sheet */
  getActiveSheetId(): string | null;
  /** Switch the active sheet */
  setActiveSheet(id: string): void;
  /**
   * Subscribe to "changes that land in the snapshot" (Univer MUTATION).
   * Lets dirty tracking follow edit events instead of a periodic full save() poll; returns an
   * unsubscribe function.
   */
  onMutation(listener: () => void): () => void;
  /** Current selection (0-based inclusive); null when nothing is selected */
  getActiveRange(): {
    startRow: number;
    startColumn: number;
    endRow: number;
    endColumn: number;
  } | null;
  /** Append a new sheet at the end; leave the name out to let Univer generate one */
  addSheet(name?: string): void;
  /**
   * 追加一张带数据的工作表（值从 A1 开始铺），返回新表 id。
   * 透视表「插入到文档」用它把结果矩阵落成真实工作表。
   */
  insertSheetWithValues(name: string, values: SheetCellValue[][]): string | null;
  /**
   * 用值矩阵覆盖某张表（从 A1 开始）。`clear` 先按旧范围清空——
   * 重新计算后行列可能变少，不清就会留下上一版的尾巴。
   */
  writeSheetValues(
    sheetId: string,
    values: SheetCellValue[][],
    clear?: { rows: number; columns: number },
  ): boolean;
  /** Delete a sheet (at least one is kept; deleting the last one is a no-op) */
  deleteSheet(id: string): void;
  /** Rename a sheet */
  renameSheet(id: string, name: string): void;
  /** Undo the last document mutation (Univer's own undo stack) */
  undo(): void;
  /** Redo the last undone mutation */
  redo(): void;
  /** Duplicate a sheet (the copy is inserted after the source) */
  duplicateSheet(id: string): void;
  /**
   * Grid → container projection, for the floating overlay layers (shapes).
   * Null when the render unit is not ready yet (first frames, or a disposed instance).
   */
  getViewport(): SheetViewport | null;
  /** Subscribe to scroll / zoom / skeleton changes; returns an unsubscribe function */
  onViewportChange(listener: () => void): () => void;
}

const ZH_LOCALE = mergeLocales(
  DesignZhCN,
  UIZhCN,
  DocsUIZhCN,
  SheetsZhCN,
  SheetsUIZhCN,
  SheetsFormulaUIZhCN,
  SheetsNumfmtUIZhCN,
  ConditionalFormattingUIZhCN,
  DataValidationZhCN,
  DataValidationUIZhCN,
  FilterZhCN,
  FilterUIZhCN,
  SortUIZhCN,
  HyperLinkZhCN,
  HyperLinkUIZhCN,
  FindReplaceZhCN,
);
const EN_LOCALE = mergeLocales(
  DesignEnUS,
  UIEnUS,
  DocsUIEnUS,
  SheetsEnUS,
  SheetsUIEnUS,
  SheetsFormulaUIEnUS,
  SheetsNumfmtUIEnUS,
  ConditionalFormattingUIEnUS,
  DataValidationEnUS,
  DataValidationUIEnUS,
  FilterEnUS,
  FilterUIEnUS,
  SortUIEnUS,
  HyperLinkEnUS,
  HyperLinkUIEnUS,
  FindReplaceEnUS,
);

/**
 * Create a Univer instance and mount it into `container`.
 * A locale / theme change requires rebuilding the instance, so callers should take a snapshot first
 * (see pendingRef in SpreadsheetTool).
 */
export function createUniverInstance(
  container: HTMLElement,
  options: { locale: 'zhCN' | 'enUS'; dark: boolean },
): UniverHandle {
  const locale = options.locale === 'enUS' ? LocaleType.EN_US : LocaleType.ZH_CN;
  const univer = new Univer({
    locale,
    locales: { [LocaleType.ZH_CN]: ZH_LOCALE, [LocaleType.EN_US]: EN_LOCALE },
    darkMode: options.dark,
  });

  univer.registerPlugin(UniverRenderEnginePlugin);
  univer.registerPlugin(UniverFormulaEnginePlugin);
  univer.registerPlugin(UniverUIPlugin, { container, header: true, toolbar: true, footer: false });
  univer.registerPlugin(UniverDocsPlugin);
  univer.registerPlugin(UniverDocsUIPlugin);
  univer.registerPlugin(UniverSheetsPlugin);
  univer.registerPlugin(UniverSheetsUIPlugin);
  univer.registerPlugin(UniverSheetsFormulaPlugin);
  univer.registerPlugin(UniverSheetsFormulaUIPlugin);
  univer.registerPlugin(UniverSheetsNumfmtPlugin);
  univer.registerPlugin(UniverSheetsNumfmtUIPlugin);
  // P1 feature plugins: conditional formatting / data validation / hyperlink / filter / sort / find-replace
  univer.registerPlugin(UniverSheetsConditionalFormattingPlugin);
  univer.registerPlugin(UniverSheetsConditionalFormattingUIPlugin);
  univer.registerPlugin(UniverSheetsDataValidationPlugin);
  univer.registerPlugin(UniverSheetsDataValidationUIPlugin);
  univer.registerPlugin(UniverSheetsHyperLinkPlugin);
  univer.registerPlugin(UniverSheetsHyperLinkUIPlugin);
  univer.registerPlugin(UniverSheetsFilterPlugin);
  univer.registerPlugin(UniverSheetsFilterUIPlugin);
  univer.registerPlugin(UniverSheetsSortPlugin);
  univer.registerPlugin(UniverSheetsSortUIPlugin);
  univer.registerPlugin(UniverFindReplacePlugin);
  univer.registerPlugin(UniverSheetsFindReplacePlugin);

  const univerAPI = FUniver.newAPI(univer);
  // A workbook instance must exist, otherwise Univer renders the chrome without the grid canvas
  univerAPI.createWorkbook(createEmptySnapshot() as unknown as Partial<IWorkbookData>);

  // Dirty tracking: only MUTATIONs reach the snapshot; resubscribe after loading a new workbook (the old instance is gone)
  let mutationListener: (() => void) | null = null;
  let mutationDisposable: { dispose: () => void } | null = null;
  const resubscribe = (): void => {
    mutationDisposable?.dispose();
    mutationDisposable =
      univerAPI.getActiveWorkbook()?.onCommandExecuted((info) => {
        if (info.type === CommandType.MUTATION) mutationListener?.();
      }) ?? null;
  };

  const onMutation = (listener: () => void): (() => void) => {
    mutationListener = listener;
    resubscribe();
    return () => {
      mutationListener = null;
      mutationDisposable?.dispose();
      mutationDisposable = null;
    };
  };

  const loadSnapshot = (snapshot: WorkbookSnapshot): void => {
    const current = univerAPI.getActiveWorkbook();
    if (current) univerAPI.disposeUnit(current.getId());
    univerAPI.createWorkbook(snapshot as unknown as Partial<IWorkbookData>);
    resubscribe();
  };

  const getSnapshot = (): WorkbookSnapshot => {
    const workbook = univerAPI.getActiveWorkbook();
    return (workbook?.save() ?? {}) as unknown as WorkbookSnapshot;
  };

  const getSheets = (): SheetInfo[] => {
    const workbook = univerAPI.getActiveWorkbook();
    if (!workbook) return [];
    return workbook.getSheets().map((sheet) => ({
      id: sheet.getSheetId(),
      name: sheet.getSheetName(),
      hidden: sheet.isSheetHidden(),
      tabColor: sheet.getTabColor(),
    }));
  };

  const getActiveSheetId = (): string | null => {
    return univerAPI.getActiveWorkbook()?.getActiveSheet()?.getSheetId() ?? null;
  };

  const setActiveSheet = (id: string): void => {
    univerAPI.getActiveWorkbook()?.setActiveSheet(id);
  };

  const getActiveRange = (): {
    startRow: number;
    startColumn: number;
    endRow: number;
    endColumn: number;
  } | null => {
    const range = univerAPI.getActiveWorkbook()?.getActiveSheet()?.getActiveRange();
    if (!range) return null;
    const model = range.getRange();
    return {
      startRow: model.startRow,
      startColumn: model.startColumn,
      endRow: model.endRow,
      endColumn: model.endColumn,
    };
  };

  // Drive Univer's own history stack so the menu and its toolbar undo/redo stay in sync
  const undo = (): void => {
    void univerAPI.executeCommand(UndoCommandId);
  };

  const redo = (): void => {
    void univerAPI.executeCommand(RedoCommandId);
  };

  const addSheet = (name?: string): void => {
    univerAPI.getActiveWorkbook()?.insertSheet(name);
  };

  /** 空串 → `{ v: null }`：Univer 里空串是"有值的空单元格"，会让已用范围判断变脏 */
  const toCellMatrix = (values: SheetCellValue[][]): ICellData[][] =>
    values.map((row) => row.map((value) => ({ v: value === '' ? null : value })));

  const writeSheetValues = (
    sheetId: string,
    values: SheetCellValue[][],
    clear?: { rows: number; columns: number },
  ): boolean => {
    const sheet = univerAPI.getActiveWorkbook()?.getSheetBySheetId(sheetId);
    if (!sheet || values.length === 0 || !values[0]?.length) return false;
    if (clear && clear.rows > 0 && clear.columns > 0) {
      sheet.getRange(0, 0, clear.rows, clear.columns).clear();
    }
    sheet.getRange(0, 0, values.length, values[0].length).setValues(toCellMatrix(values));
    return true;
  };

  const insertSheetWithValues = (name: string, values: SheetCellValue[][]): string | null => {
    const workbook = univerAPI.getActiveWorkbook();
    if (!workbook) return null;
    const sheet = workbook.insertSheet(name);
    const id = sheet?.getSheetId();
    if (!id) return null;
    if (values.length > 0 && values[0]?.length > 0) {
      sheet.getRange(0, 0, values.length, values[0].length).setValues(toCellMatrix(values));
    }
    return id;
  };

  const deleteSheet = (id: string): void => {
    const workbook = univerAPI.getActiveWorkbook();
    if (!workbook || workbook.getNumSheets() <= 1) return;
    workbook.deleteSheet(id);
  };

  const renameSheet = (id: string, name: string): void => {
    const sheet = univerAPI.getActiveWorkbook()?.getSheetBySheetId(id);
    sheet?.setName(name);
  };

  const duplicateSheet = (id: string): void => {
    const workbook = univerAPI.getActiveWorkbook();
    if (!workbook) return;
    const sheet = workbook.getSheetBySheetId(id);
    if (sheet) workbook.duplicateSheet(sheet);
  };

  const dispose = (): void => {
    mutationDisposable?.dispose();
    mutationDisposable = null;
    mutationListener = null;
    univer.dispose();
    container.replaceChildren();
  };

  /**
   * Grid → container projection for the floating overlays (P4-SH6).
   *
   * Three offsets have to be combined, and none of them is exposed as a single public "cell → screen"
   * call:
   *
   * 1. the canvas element's position inside the tool container (ribbon + formula bar sit above it);
   * 2. `viewMain`'s own left/top, which Univer sets to the row-header width / column-header height;
   * 3. the viewport scroll, in content px, plus the scene scale (the sheet zoom).
   *
   * Everything is returned in CSS px of the *container*, which is exactly the overlay's coordinate
   * space (both are children of the same `relative` box).
   */
  const getViewport = (): SheetViewport | null => {
    const workbook = univerAPI.getActiveWorkbook();
    const unitId = workbook?.getId();
    if (!unitId) return null;
    let render;
    try {
      render = univer.__getInjector().get(IRenderManagerService)?.getRenderById(unitId);
    } catch {
      // The injector is internal API: a version bump that renames it must degrade, not crash the tool
      return null;
    }
    if (!render) return null;
    const viewMain = render.scene.getViewport(SHEET_VIEWPORT_KEY.VIEW_MAIN);
    if (!viewMain) return null;
    const zoom = Math.abs(render.scene.scaleX) || 1;
    const scroll = render.scene.getViewportScrollXY(viewMain);
    const containerBox = container.getBoundingClientRect();
    const canvasBox = render.engine.getCanvasElement().getBoundingClientRect();
    const headerX = (viewMain.left ?? 0) * zoom;
    const headerY = (viewMain.top ?? 0) * zoom;
    return {
      originX: canvasBox.left - containerBox.left + headerX,
      originY: canvasBox.top - containerBox.top + headerY,
      scrollX: scroll.x,
      scrollY: scroll.y,
      zoom,
      // The canvas also covers the row / column headers; only the remainder shows cells
      width: Math.max(0, canvasBox.width - headerX),
      height: Math.max(0, canvasBox.height - headerY),
    };
  };

  const onViewportChange = (listener: () => void): (() => void) => {
    let frame = 0;
    const schedule = (): void => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        listener();
      });
    };
    // Scroll fires per wheel tick; zoom and column/row resizing move the grid origin as well
    const disposables = [
      univerAPI.addEvent(univerAPI.Event.Scroll, schedule),
      univerAPI.addEvent(univerAPI.Event.SheetZoomChanged, schedule),
      univerAPI.addEvent(univerAPI.Event.SheetSkeletonChanged, schedule),
    ];
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      for (const disposable of disposables) disposable.dispose();
    };
  };

  return {
    loadSnapshot,
    getSnapshot,
    dispose,
    getSheets,
    getActiveSheetId,
    setActiveSheet,
    getActiveRange,
    onMutation,
    undo,
    redo,
    addSheet,
    insertSheetWithValues,
    writeSheetValues,
    deleteSheet,
    renameSheet,
    duplicateSheet,
    getViewport,
    onViewportChange,
  };
}
