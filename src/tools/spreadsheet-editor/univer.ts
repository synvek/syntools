import {
  CommandType,
  LocaleType,
  RedoCommandId,
  UndoCommandId,
  Univer,
  mergeLocales,
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
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
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
    deleteSheet,
    renameSheet,
    duplicateSheet,
  };
}
