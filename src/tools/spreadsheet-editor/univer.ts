import {
  BorderStyleTypes,
  BorderType,
  CommandType,
  HorizontalAlign,
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
import { OpenConditionalFormattingOperator } from '@univerjs/sheets-conditional-formatting-ui';
import '@univerjs/sheets-numfmt/facade';
import {
  buildAutoSum,
  DEFAULT_BORDER,
  readSheetFormat,
  shiftDecimals,
  toggleThousandSeparator,
  type BorderPresetId,
  type BorderSpec,
  type BorderStyleId,
  type SheetFormatPatch,
  type SheetFormatState,
  type UniverStyleLike,
} from './sheetFormat';
import type { FreezeMode, MergeMode, SheetPanelKind, SheetRibbonHost } from './commands';
import { reportSheetIssue } from './issues';

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

/**
 * Univer chrome configuration in one place.
 *
 * The tool ships its own Office-style ribbon, so Univer's built-in toolbar and header menu are off;
 * the header itself stays because it hosts the formula bar. Turning `toolbar: true` back on restores
 * Univer's ribbon without touching anything else.
 */
export const UNIVER_UI_CHROME = {
  header: true,
  toolbar: false,
  headerMenu: false,
  footer: false,
} as const;

export interface UniverHandle extends SheetRibbonHost {
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
  /**
   * 切换可编辑状态（P2-S7.2 工作表保护）。Univer 只提供工作簿级权限点，
   * 所以保护是按"当前活动表"映射到整本工作簿的只读开关。
   */
  setEditable(editable: boolean): void;
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
  /**
   * The built-in ribbon is turned off: this tool draws its own Office-style ribbon above the canvas
   * (see `SpreadsheetRibbon`). Only the header stays — it hosts the formula bar, which the ribbon does
   * not replace. Flipping `UNIVER_UI_CHROME` back to `toolbar: true` restores Univer's own toolbar.
   */
  univer.registerPlugin(UniverUIPlugin, { container, ...UNIVER_UI_CHROME });
  univer.registerPlugin(UniverDocsPlugin);
  univer.registerPlugin(UniverDocsUIPlugin);
  univer.registerPlugin(UniverSheetsPlugin);
  univer.registerPlugin(UniverSheetsUIPlugin, { formulaBar: true });
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

  /**
   * Ribbon state subscription: selection moves and style mutations both change what the ribbon must
   * highlight. Events are coalesced through `requestAnimationFrame`, otherwise dragging a selection
   * repaints the ribbon on every mousemove.
   */
  let selectionListener: (() => void) | null = null;
  let selectionDisposables: Array<{ dispose: () => void }> = [];

  const subscribeRibbonEvents = (): void => {
    if (!selectionListener) return;
    for (const disposable of selectionDisposables) disposable.dispose();
    let frame = 0;
    const schedule = (): void => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        selectionListener?.();
      });
    };
    selectionDisposables = [
      univerAPI.addEvent(univerAPI.Event.SelectionChanged, schedule),
      univerAPI.addEvent(univerAPI.Event.SheetZoomChanged, schedule),
      // Style commands are mutations, not selection moves: without this the toggles never reflect a
      // click until the user changes the selection
      univerAPI.addEvent(univerAPI.Event.CommandExecuted, (event) => {
        if (event.type === CommandType.MUTATION) schedule();
      }),
    ];
  };

  const onSelectionChange = (listener: () => void): (() => void) => {
    selectionListener = listener;
    subscribeRibbonEvents();
    return () => {
      selectionListener = null;
      for (const disposable of selectionDisposables) disposable.dispose();
      selectionDisposables = [];
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

  /**
   * 工作表保护 → 工作簿只读。Univer 的权限点是工作簿级的（`WorkbookEditablePermission`），
   * 没有"单表只读"，所以这里按调用方传入的布尔值整体切换；读取/渲染不受影响。
   */
  const setEditable = (editable: boolean): void => {
    try {
      univerAPI.getActiveWorkbook()?.setEditable(editable);
    } catch {
      // 实例还没挂载完成时忽略：挂载完成后调用方会再同步一次
    }
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

  /* ------------------------ ribbon host: format & ops ------------------------ */

  /**
   * Sampling cap for the selection style read. A whole-column selection can hold millions of cells and
   * `getCellStyles()` materializes all of them; 200 evenly spread samples give the same "is it bold /
   * mixed" answer at a fraction of the cost.
   */
  const MAX_SAMPLED_CELLS = 200;

  const activeFWorksheet = () => univerAPI.getActiveWorkbook()?.getActiveSheet() ?? null;
  const activeFRange = () => activeFWorksheet()?.getActiveRange() ?? null;

  /**
   * `getCellStyles()` yields `TextStyleValue` instances (a class wrapping the raw style in `_style`),
   * not plain objects — reading them directly made every toggle look "off".
   */
  function unwrapStyle(cell: unknown): UniverStyleLike {
    if (!cell || typeof cell !== 'object') return {};
    const wrapper = cell as { getValue?: () => UniverStyleLike; _style?: UniverStyleLike };
    if (typeof wrapper.getValue === 'function') return wrapper.getValue() ?? {};
    return wrapper as UniverStyleLike;
  }

  function sampleStyles(matrix: Array<Array<UniverStyleLike | null>>): UniverStyleLike[] {
    const total = matrix.reduce((sum, row) => sum + row.length, 0);
    const at = (index: number): UniverStyleLike => {
      let seen = 0;
      for (const row of matrix) {
        if (index < seen + row.length) return unwrapStyle(row[index - seen]);
        seen += row.length;
      }
      return {};
    };
    if (total <= MAX_SAMPLED_CELLS) {
      const all: UniverStyleLike[] = [];
      for (const row of matrix) for (const cell of row) all.push(unwrapStyle(cell));
      return all;
    }
    const stride = Math.max(1, Math.floor(total / MAX_SAMPLED_CELLS));
    const sampled: UniverStyleLike[] = [];
    for (let index = 0; index < total; index += stride) sampled.push(at(index));
    return sampled;
  }

  const getFormatState = (): SheetFormatState | null => {
    const range = activeFRange();
    if (!range) return null;
    let matrix: Array<Array<UniverStyleLike | null>> = [];
    try {
      matrix = range.getCellStyles() as unknown as Array<Array<UniverStyleLike | null>>;
    } catch (error) {
      // Without the read the ribbon shows every toggle as "off"; say so instead of pretending
      reportSheetIssue({ code: 'styleRead', level: 'notice', detail: String(error) });
      matrix = [];
    }
    let merged = false;
    try {
      merged = range.isMerged();
    } catch (error) {
      reportSheetIssue({ code: 'styleRead', level: 'notice', detail: String(error) });
      merged = false;
    }
    return readSheetFormat(sampleStyles(matrix), merged);
  };

  /**
   * Horizontal alignment via the command, not the facade: `FRange.setHorizontalAlignment` only accepts
   * `'left' | 'center' | 'normal'` in Univer 0.25.1 — there is no way to set right alignment through it.
   */
  const setHorizontalAlign = (align: 'general' | 'left' | 'center' | 'right'): void => {
    const workbook = univerAPI.getActiveWorkbook();
    const sheet = workbook?.getActiveSheet();
    const block = getActiveRange();
    if (!workbook || !sheet || !block) return;
    const value =
      align === 'right'
        ? HorizontalAlign.RIGHT
        : align === 'center'
          ? HorizontalAlign.CENTER
          : align === 'left'
            ? HorizontalAlign.LEFT
            : HorizontalAlign.UNSPECIFIED;
    void univerAPI.executeCommand('sheet.command.set-horizontal-text-align', {
      unitId: workbook.getId(),
      subUnitId: sheet.getSheetId(),
      range: block,
      value,
    });
  };

  /**
   * Style writes go through the facade so each click is a single undo step. Only the keys present in
   * `patch` are touched — sending everything would wipe formatting the user did not ask about.
   */
  const applyFormat = (patch: SheetFormatPatch): void => {
    const range = activeFRange();
    if (!range) return;
    if (patch.bold !== undefined) range.setFontWeight(patch.bold ? 'bold' : 'normal');
    if (patch.italic !== undefined) range.setFontStyle(patch.italic ? 'italic' : 'normal');
    if (patch.underline !== undefined) range.setFontLine(patch.underline ? 'underline' : 'none');
    if (patch.strike !== undefined) range.setFontLine(patch.strike ? 'line-through' : 'none');
    if (patch.fontFamily !== undefined) range.setFontFamily(patch.fontFamily);
    if (patch.fontSize !== undefined) range.setFontSize(patch.fontSize);
    if (patch.color !== undefined) range.setFontColor(patch.color ?? '#000000');
    if (patch.fill !== undefined) range.setBackground(patch.fill ?? '#ffffff');
    if (patch.hAlign !== undefined) setHorizontalAlign(patch.hAlign);
    if (patch.vAlign !== undefined) range.setVerticalAlignment(patch.vAlign);
    if (patch.wrap !== undefined) range.setWrap(patch.wrap);
    if (patch.numberFormat !== undefined) {
      range.setNumberFormat(patch.numberFormat || 'General');
    }
    // Painters copy borders too: `null` clears, a spec draws all four sides (P1-4)
    if (patch.border !== undefined)
      applyBorder(patch.border ? 'all' : 'none', patch.border ?? undefined);
  };

  const BORDER_PRESET_MAP: Record<BorderPresetId, BorderType> = {
    none: BorderType.NONE,
    all: BorderType.ALL,
    outside: BorderType.OUTSIDE,
    inside: BorderType.INSIDE,
    bottom: BorderType.BOTTOM,
    top: BorderType.TOP,
    left: BorderType.LEFT,
    right: BorderType.RIGHT,
    thickOutside: BorderType.OUTSIDE,
  };

  /** Line weight chosen in the ribbon; the ids are the tool's own, the numbers are Univer's */
  const BORDER_STYLE_MAP: Record<BorderStyleId, BorderStyleTypes> = {
    thin: BorderStyleTypes.THIN,
    medium: BorderStyleTypes.MEDIUM,
    thick: BorderStyleTypes.THICK,
    dashed: BorderStyleTypes.DASHED,
    dotted: BorderStyleTypes.DOTTED,
    double: BorderStyleTypes.DOUBLE,
  };

  const applyBorder = (preset: BorderPresetId, spec?: BorderSpec): void => {
    const range = activeFRange();
    if (!range) return;
    if (preset === 'none') {
      range.setBorder(BorderType.NONE, BorderStyleTypes.NONE, spec?.color ?? DEFAULT_BORDER.color);
      return;
    }
    // "粗外框" is a preset, not a weight: it overrides whatever the menu had selected
    const style =
      preset === 'thickOutside'
        ? BorderStyleTypes.THICK
        : BORDER_STYLE_MAP[spec?.style ?? DEFAULT_BORDER.style];
    range.setBorder(BORDER_PRESET_MAP[preset], style, spec?.color ?? DEFAULT_BORDER.color);
  };

  const applyNumberFormat = (pattern: string | null): void => {
    activeFRange()?.setNumberFormat(pattern || 'General');
  };

  const applyDecimalShift = (delta: number): void => {
    const range = activeFRange();
    if (!range) return;
    const current = getFormatState()?.numberFormat ?? '';
    range.setNumberFormat(shiftDecimals(current, delta));
  };

  const applyThousandToggle = (): void => {
    const range = activeFRange();
    if (!range) return;
    const current = getFormatState()?.numberFormat ?? '';
    range.setNumberFormat(toggleThousandSeparator(current));
  };

  const mergeSelection = (mode: MergeMode): void => {
    const range = activeFRange();
    if (!range) return;
    if (mode === 'unmerge') {
      // `merge()` cannot unmerge; the command is the documented way back
      void univerAPI.executeCommand('sheet.command.remove-worksheet-merge');
      return;
    }
    if (mode === 'across') range.mergeAcross({ isForceMerge: true });
    else range.merge({ isForceMerge: true });
    if (mode === 'center') range.setHorizontalAlignment('center');
  };

  const selectionBlock = () => {
    const range = getActiveRange();
    if (!range) return null;
    return {
      rows: range.endRow - range.startRow + 1,
      columns: range.endColumn - range.startColumn + 1,
      startRow: range.startRow,
      startColumn: range.startColumn,
      endRow: range.endRow,
      endColumn: range.endColumn,
    };
  };

  const insertCells = (kind: 'row' | 'column', where: 'before' | 'after'): void => {
    const sheet = activeFWorksheet();
    const block = selectionBlock();
    if (!sheet || !block) return;
    if (kind === 'row') {
      if (where === 'before') sheet.insertRowsBefore(block.startRow, block.rows);
      else sheet.insertRowsAfter(block.endRow, block.rows);
    } else if (where === 'before') {
      sheet.insertColumnsBefore(block.startColumn, block.columns);
    } else {
      sheet.insertColumnsAfter(block.endColumn, block.columns);
    }
  };

  const deleteCells = (kind: 'row' | 'column'): void => {
    const sheet = activeFWorksheet();
    const block = selectionBlock();
    if (!sheet || !block) return;
    if (kind === 'row') sheet.deleteRows(block.startRow, block.rows);
    else sheet.deleteColumns(block.startColumn, block.columns);
  };

  const autoFit = (kind: 'row' | 'column'): void => {
    const sheet = activeFWorksheet();
    const block = selectionBlock();
    if (!sheet || !block) return;
    if (kind === 'row') sheet.autoResizeRows(block.startRow, block.rows);
    else sheet.autoResizeColumns(block.startColumn, block.columns);
  };

  const setFreeze = (mode: FreezeMode): void => {
    const sheet = activeFWorksheet();
    if (!sheet) return;
    if (mode === 'none') {
      sheet.cancelFreeze();
      return;
    }
    const block = selectionBlock();
    const startRow = mode === 'row' ? 1 : mode === 'both' ? Math.max(1, block?.startRow ?? 1) : 0;
    const startColumn =
      mode === 'column' ? 1 : mode === 'both' ? Math.max(1, block?.startColumn ?? 1) : 0;
    sheet.setFreeze({
      xSplit: startColumn,
      ySplit: startRow,
      startRow,
      startColumn,
    });
  };

  const getFreezeState = (): FreezeMode => {
    const freeze = activeFWorksheet()?.getFreeze();
    if (!freeze) return 'none';
    const row = (freeze.ySplit ?? 0) > 0;
    const column = (freeze.xSplit ?? 0) > 0;
    if (row && column) return 'both';
    return row ? 'row' : column ? 'column' : 'none';
  };

  const setGridlinesHidden = (hidden: boolean): void => {
    activeFWorksheet()?.setHiddenGridlines(hidden);
  };

  const areGridlinesHidden = (): boolean => activeFWorksheet()?.hasHiddenGridLines() ?? false;

  const setZoomPercent = (percent: number): void => {
    activeFWorksheet()?.zoom(Math.min(4, Math.max(0.25, percent / 100)));
  };

  const getZoomPercent = (): number => Math.round((activeFWorksheet()?.getZoom() ?? 1) * 100);

  const sortSelection = (direction: 'asc' | 'desc'): void => {
    activeFRange()?.sort({ column: 0, ascending: direction === 'asc' });
  };

  const toggleFilter = (): void => {
    const sheet = activeFWorksheet();
    const range = activeFRange();
    if (!sheet || !range) return;
    const existing = sheet.getFilter();
    if (existing) {
      existing.remove();
      return;
    }
    range.createFilter();
  };

  const hasFilter = (): boolean => Boolean(activeFWorksheet()?.getFilter());

  /** AutoSum: insert `=SUM(range)` after the selected block (below it when vertical) */
  const applyAutoSum = (): void => {
    const block = selectionBlock();
    const sheet = activeFWorksheet();
    if (!block || !sheet) return;
    const target = buildAutoSum(block);
    sheet.getRange(target.row, target.column).setFormula(target.formula);
    sheet.getRange(target.row, target.column).activate();
  };

  const clearFormatting = (): void => {
    activeFRange()?.clearFormat();
  };

  const readSelectionText = (): string => {
    const range = activeFRange();
    if (!range) return '';
    try {
      return range
        .getDisplayValues()
        .map((row) => row.join('\t'))
        .join('\n');
    } catch (error) {
      reportSheetIssue({ code: 'styleRead', level: 'notice', detail: String(error) });
      return '';
    }
  };

  const writeMatrix = (matrix: string[][]): void => {
    const range = activeFRange();
    if (!range || matrix.length === 0 || matrix[0]?.length === 0) return;
    range.setValues(matrix.map((row) => row.map((value) => ({ v: value === '' ? null : value }))));
  };

  const clearSelection = (): void => {
    activeFRange()?.clearContent();
  };

  const setHyperlink = (url: string): void => {
    const range = activeFRange();
    if (!range) return;
    range.setHyperLink(url);
  };

  /** Operation ids of the plugin UIs that stay registered even though their toolbar is hidden */
  const PANEL_OPERATIONS: Record<Exclude<SheetPanelKind, 'hyperlink'>, string> = {
    // `CF_MENU_OPERATION.viewRule` — opens the "manage rules" sidebar
    conditionalFormatting: OpenConditionalFormattingOperator.id,
    dataValidation: 'data-validation.operation.open-validation-panel',
    filter: 'sheet.operation.open-filter-panel',
    findReplace: 'ui.operation.open-find-dialog',
  };

  const openPanel = (panel: SheetPanelKind): void => {
    const workbook = univerAPI.getActiveWorkbook();
    const sheetId = workbook?.getActiveSheet()?.getSheetId();
    const block = selectionBlock();
    try {
      if (panel === 'hyperlink') {
        // Same flow as Excel's "insert hyperlink": edit the link of the anchor cell
        void univerAPI.executeCommand('sheet.operation.open-hyper-link-edit-panel', {
          unitId: workbook?.getId(),
          subUnitId: sheetId,
          row: block?.startRow ?? 0,
          column: block?.startColumn ?? 0,
        });
        return;
      }
      if (panel === 'conditionalFormatting') {
        void univerAPI.executeCommand(PANEL_OPERATIONS.conditionalFormatting, { value: 2 });
        return;
      }
      if (panel === 'dataValidation') {
        void univerAPI.executeCommand(PANEL_OPERATIONS.dataValidation, { isAdd: true });
        return;
      }
      if (panel === 'filter') {
        if (!workbook || !sheetId || !block) return;
        void univerAPI.executeCommand(PANEL_OPERATIONS.filter, {
          unitId: workbook.getId(),
          subUnitId: sheetId,
          col: block.startColumn,
        });
        return;
      }
      void univerAPI.executeCommand(PANEL_OPERATIONS.findReplace);
    } catch (error) {
      // A plugin version without the operation must not break the ribbon, but a click that does
      // nothing is a bug report waiting to happen — publish it (P0-3)
      reportSheetIssue({
        code: 'panelUnavailable',
        level: 'notice',
        detail: `${panel}: ${String(error)}`,
      });
    }
  };

  const dispose = (): void => {
    mutationDisposable?.dispose();
    mutationDisposable = null;
    mutationListener = null;
    for (const disposable of selectionDisposables) disposable.dispose();
    selectionDisposables = [];
    selectionListener = null;
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
    const run = (): void => {
      frame = 0;
      listener();
    };
    const schedule = (): void => {
      if (frame) return;
      frame = window.requestAnimationFrame(run);
    };
    /**
     * 滚轮要单独接一层。
     *
     * Univer 0.25 的 `Event.Scroll` 来自 `ScrollManagerService` 的 `scrollInfo$`，只有"命令驱动"的
     * 滚动（`scrollToCell`、键盘翻页）会走到那里；**鼠标滚轮不会**。原来的实现只订阅门面事件，
     * 于是滚轮把表格滚走了、形状层却停在原地（`office-p4` 的"滚动跟随"用例就是这么挂的）。
     * wheel 之后隔一帧再读，是为了等 Univer 自己的滚动渲染把 offset 写回 scene。
     */
    const onWheel = (): void => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(run);
      });
    };
    // 滚轮之外的鼠标路径：拖动（canvas 内绘制的）滚动条，松手时补一次
    const onPointerUp = (): void => schedule();
    container.addEventListener('wheel', onWheel, { passive: true });
    container.addEventListener('pointerup', onPointerUp);
    // Keyboard paging / selection moves go through commands, not through the scroll event
    const disposables = [
      univerAPI.addEvent(univerAPI.Event.Scroll, schedule),
      univerAPI.addEvent(univerAPI.Event.SheetZoomChanged, schedule),
      univerAPI.addEvent(univerAPI.Event.SheetSkeletonChanged, schedule),
      univerAPI.addEvent(univerAPI.Event.CommandExecuted, schedule),
    ];
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('pointerup', onPointerUp);
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
    setEditable,
    addSheet,
    insertSheetWithValues,
    writeSheetValues,
    deleteSheet,
    renameSheet,
    duplicateSheet,
    getViewport,
    onViewportChange,
    // Ribbon host (see commands.ts): formatting, sheet operations and the state subscription
    getFormatState,
    applyFormat,
    applyBorder,
    applyNumberFormat,
    shiftDecimals: applyDecimalShift,
    toggleThousandSeparator: applyThousandToggle,
    mergeSelection,
    insertCells,
    deleteCells,
    autoFit,
    setFreeze,
    getFreezeState,
    setGridlinesHidden,
    areGridlinesHidden,
    setZoomPercent,
    getZoomPercent,
    sortSelection,
    toggleFilter,
    hasFilter,
    applyAutoSum,
    clearFormatting,
    readSelectionText,
    writeMatrix,
    clearSelection,
    setHyperlink,
    openPanel,
    onSelectionChange,
  };
}
