import { editorMenuItem, type EditorMenu } from '@/core/components/editorChrome';
import type { RibbonMenuItem, RibbonTab } from '@/core/components/ribbon/types';
import {
  BORDER_PRESETS,
  FONT_FAMILY_PRESETS,
  FONT_SIZE_PRESETS,
  NUMBER_FORMAT_PRESETS,
  type BorderPresetId,
  type SheetFormatPatch,
  type SheetFormatState,
} from './sheetFormat';

/**
 * Command layer of the spreadsheet: every user-facing action is described once here and projected onto
 * **both** the kept menu bar and the new ribbon. That is what keeps the two chromes from drifting.
 *
 * The module is free of `@univerjs/*` imports — actions only talk to `SheetRibbonHost`, so the whole
 * registry is unit-testable with a fake host (see commands.test.ts).
 */

export type MergeMode = 'merge' | 'center' | 'across' | 'unmerge';
export type FreezeMode = 'none' | 'row' | 'column' | 'both';
export type SheetPanelKind =
  'conditionalFormatting' | 'dataValidation' | 'filter' | 'hyperlink' | 'findReplace';

/** Everything the ribbon needs from the Univer adapter (implemented by `univer.ts`) */
export interface SheetRibbonHost {
  getFormatState(): SheetFormatState | null;
  applyFormat(patch: SheetFormatPatch): void;
  applyBorder(preset: BorderPresetId): void;
  applyNumberFormat(pattern: string | null): void;
  shiftDecimals(delta: number): void;
  toggleThousandSeparator(): void;
  mergeSelection(mode: MergeMode): void;
  insertCells(kind: 'row' | 'column', where: 'before' | 'after'): void;
  deleteCells(kind: 'row' | 'column'): void;
  autoFit(kind: 'row' | 'column'): void;
  setFreeze(mode: FreezeMode): void;
  getFreezeState(): FreezeMode;
  setGridlinesHidden(hidden: boolean): void;
  areGridlinesHidden(): boolean;
  setZoomPercent(percent: number): void;
  getZoomPercent(): number;
  sortSelection(direction: 'asc' | 'desc'): void;
  toggleFilter(): void;
  hasFilter(): boolean;
  applyAutoSum(): void;
  clearFormatting(): void;
  /** Selection as TSV — used by copy / cut */
  readSelectionText(): string;
  /** Write a pasted TSV matrix at the selection anchor */
  writeMatrix(matrix: string[][]): void;
  clearSelection(): void;
  /** Apply (or, with an empty url, remove) the hyperlink of the anchor cell */
  setHyperlink(url: string): void;
  openPanel(panel: SheetPanelKind): void;
  /** Fires on selection change and on every mutation (so the ribbon state follows edits) */
  onSelectionChange(listener: () => void): () => void;
}

/** Document-level actions owned by `SpreadsheetTool` (dialogs, import / export, doc library…) */
export interface SheetActions {
  newDoc: () => void;
  importXlsx: () => void;
  importCsv: () => void;
  exportXlsx: () => void;
  exportCsv: () => void;
  print: () => void;
  library: () => void;
  versions: () => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  insertChart: () => void;
  insertShape: () => void;
  insertImage: () => void;
  insertPivot: () => void;
  openNames: () => void;
  insertTable: () => void;
  deleteTable: () => void;
  addSheet: () => void;
  duplicateSheet: () => void;
  renameSheet: () => void;
  deleteSheet: () => void;
  openComments: () => void;
  openProtect: () => void;
  present: () => void;
  promptHyperlink: () => void;
  openNumberFormat: () => void;
  copyToClipboard: (text: string) => void;
  pasteFromClipboard: () => void;
}

export interface SheetCommandContext {
  t: (key: string, options?: Record<string, unknown>) => string;
  host: SheetRibbonHost | null;
  format: SheetFormatState | null;
  actions: SheetActions;
  busy: boolean;
  /** Cell count of the current workbook — gates export / print */
  cellCount: number;
  /** Cells *or* floating objects: a sheet with only shapes/charts is still exportable */
  canExportXlsx: boolean;
  sheetCount: number;
  hasActiveSheet: boolean;
  activeSheetName: string | null;
  /** The active sheet is protected → editing commands are disabled */
  protectedSheet: boolean;
  hasTable: boolean;
  hasDocId: boolean;
  hasTitle: boolean;
}

/** One command, described once and reused by the menu bar and the ribbon */
export interface SheetCommand {
  id: string;
  /** i18n key (already registered by `strings.ts` / `ribbonStrings.ts`) */
  labelKey: string;
  icon: string;
  run: (ctx: SheetCommandContext) => void;
  disabled?: (ctx: SheetCommandContext) => boolean;
  active?: (ctx: SheetCommandContext) => boolean;
}

const noHost = (ctx: SheetCommandContext): boolean => ctx.host === null;
/** Document-level commands: only the document state matters */
const actionBlocked = (ctx: SheetCommandContext): boolean => ctx.busy || ctx.protectedSheet;
/** Grid-level commands: a protected sheet or a not-yet-ready render unit both make them unavailable */
const editBlocked = (ctx: SheetCommandContext): boolean =>
  ctx.busy || ctx.protectedSheet || ctx.host === null;
const noHostOrBusy = (ctx: SheetCommandContext): boolean => ctx.busy || noHost(ctx);

/**
 * Next font size of the preset ladder (grow / shrink buttons).
 * A size that is not on the ladder (imported 13pt) steps to the neighbouring preset, not two steps away.
 */
export function nextFontSize(current: number, step: 1 | -1): number {
  const exact = FONT_SIZE_PRESETS.indexOf(current);
  if (exact !== -1) {
    const next = Math.min(FONT_SIZE_PRESETS.length - 1, Math.max(0, exact + step));
    return FONT_SIZE_PRESETS[next] ?? current;
  }
  const candidate =
    step > 0
      ? FONT_SIZE_PRESETS.find((size) => size > current)
      : [...FONT_SIZE_PRESETS].reverse().find((size) => size < current);
  return candidate ?? current;
}

function setZoom(ctx: SheetCommandContext, delta: number): void {
  if (!ctx.host) return;
  const next = Math.min(400, Math.max(25, ctx.host.getZoomPercent() + delta));
  ctx.host.setZoomPercent(next);
}

const formatCommand = (
  id: string,
  labelKey: string,
  icon: string,
  patch: (next: boolean) => SheetFormatPatch,
  key: 'bold' | 'italic' | 'underline' | 'strike' | 'wrap',
): SheetCommand => ({
  id,
  labelKey,
  icon,
  run: (ctx) => {
    // Mixed selections behave like "off" so a click always turns the attribute on
    const current = ctx.format?.[key];
    ctx.host?.applyFormat(patch(current !== true));
  },
  disabled: editBlocked,
  active: (ctx) => ctx.format?.[key] === true,
});

const alignCommand = (
  id: string,
  labelKey: string,
  icon: string,
  patch: SheetFormatPatch,
  match: (format: SheetFormatState) => boolean,
): SheetCommand => ({
  id,
  labelKey,
  icon,
  run: (ctx) => ctx.host?.applyFormat(patch),
  disabled: editBlocked,
  active: (ctx) => (ctx.format ? match(ctx.format) : false),
});

/**
 * The command table. Ribbon groups and menus both reference entries by id, so a command can never
 * exist in one chrome and be missing from the other.
 */
const SHEET_COMMAND_DEFS = {
  /* ---------------------------------- file ---------------------------------- */
  newDoc: {
    id: 'newDoc',
    labelKey: 'common.newDoc',
    icon: 'newDoc',
    run: (ctx: SheetCommandContext) => ctx.actions.newDoc(),
  },
  importXlsx: {
    id: 'importXlsx',
    labelKey: 'tools.sheet.importXlsx',
    icon: 'upload',
    run: (ctx: SheetCommandContext) => ctx.actions.importXlsx(),
    disabled: (ctx: SheetCommandContext) => ctx.busy,
  },
  importCsv: {
    id: 'importCsv',
    labelKey: 'tools.sheet.importCsv',
    icon: 'upload',
    run: (ctx: SheetCommandContext) => ctx.actions.importCsv(),
    disabled: (ctx: SheetCommandContext) => ctx.busy,
  },
  exportXlsx: {
    id: 'exportXlsx',
    labelKey: 'tools.sheet.exportXlsx',
    icon: 'download',
    run: (ctx: SheetCommandContext) => ctx.actions.exportXlsx(),
    disabled: (ctx: SheetCommandContext) => ctx.busy || !ctx.canExportXlsx,
  },
  exportCsv: {
    id: 'exportCsv',
    labelKey: 'tools.sheet.exportCsv',
    icon: 'download',
    run: (ctx: SheetCommandContext) => ctx.actions.exportCsv(),
    disabled: (ctx: SheetCommandContext) => ctx.busy || ctx.cellCount === 0,
  },
  print: {
    id: 'print',
    labelKey: 'tools.sheet.print',
    icon: 'file',
    run: (ctx: SheetCommandContext) => ctx.actions.print(),
    disabled: (ctx: SheetCommandContext) => ctx.busy || ctx.cellCount === 0,
  },
  library: {
    id: 'library',
    labelKey: 'tools.sheet.library',
    icon: 'database',
    run: (ctx: SheetCommandContext) => ctx.actions.library(),
  },
  versions: {
    id: 'versions',
    labelKey: 'tools.sheet.versions',
    icon: 'clock',
    run: (ctx: SheetCommandContext) => ctx.actions.versions(),
    disabled: (ctx: SheetCommandContext) => !ctx.hasDocId,
  },
  clearDoc: {
    id: 'clearDoc',
    labelKey: 'common.clear',
    icon: 'trash',
    run: (ctx: SheetCommandContext) => ctx.actions.clear(),
    disabled: (ctx: SheetCommandContext) => ctx.cellCount === 0 && !ctx.hasTitle,
  },

  /* ---------------------------------- edit ---------------------------------- */
  undo: {
    id: 'undo',
    labelKey: 'tools.sheet.undo',
    icon: 'undo',
    run: (ctx: SheetCommandContext) => ctx.actions.undo(),
  },
  redo: {
    id: 'redo',
    labelKey: 'tools.sheet.redo',
    icon: 'redo',
    run: (ctx: SheetCommandContext) => ctx.actions.redo(),
  },
  find: {
    id: 'find',
    labelKey: 'tools.sheet.r.find',
    icon: 'search',
    run: (ctx: SheetCommandContext) => ctx.host?.openPanel('findReplace'),
    disabled: noHostOrBusy,
  },

  /* -------------------------------- clipboard ------------------------------- */
  copy: {
    id: 'copy',
    labelKey: 'tools.sheet.r.copy',
    icon: 'copy',
    run: (ctx: SheetCommandContext) => {
      if (!ctx.host) return;
      const text = ctx.host.readSelectionText();
      if (text) ctx.actions.copyToClipboard(text);
    },
    disabled: noHostOrBusy,
  },
  cut: {
    id: 'cut',
    labelKey: 'tools.sheet.r.cut',
    icon: 'scissors',
    run: (ctx: SheetCommandContext) => {
      if (!ctx.host) return;
      const text = ctx.host.readSelectionText();
      if (text) ctx.actions.copyToClipboard(text);
      ctx.host.clearSelection();
    },
    disabled: noHostOrBusy,
  },
  paste: {
    id: 'paste',
    labelKey: 'tools.sheet.r.paste',
    icon: 'copy',
    run: (ctx: SheetCommandContext) => ctx.actions.pasteFromClipboard(),
    disabled: noHostOrBusy,
  },

  /* ---------------------------------- font ---------------------------------- */
  bold: formatCommand('bold', 'tools.sheet.r.bold', 'bold', (next) => ({ bold: next }), 'bold'),
  italic: formatCommand(
    'italic',
    'tools.sheet.r.italic',
    'italic',
    (next) => ({ italic: next }),
    'italic',
  ),
  underline: formatCommand(
    'underline',
    'tools.sheet.r.underline',
    'underline',
    (next) => ({ underline: next }),
    'underline',
  ),
  strike: formatCommand(
    'strike',
    'tools.sheet.r.strike',
    'strike',
    (next) => ({ strike: next }),
    'strike',
  ),
  growFont: {
    id: 'growFont',
    labelKey: 'tools.sheet.r.growFont',
    icon: 'fontGrow',
    run: (ctx: SheetCommandContext) => {
      const size = ctx.format?.fontSize ?? 11;
      ctx.host?.applyFormat({ fontSize: nextFontSize(size, 1) });
    },
    disabled: editBlocked,
  },
  shrinkFont: {
    id: 'shrinkFont',
    labelKey: 'tools.sheet.r.shrinkFont',
    icon: 'fontShrink',
    run: (ctx: SheetCommandContext) => {
      const size = ctx.format?.fontSize ?? 11;
      ctx.host?.applyFormat({ fontSize: nextFontSize(size, -1) });
    },
    disabled: editBlocked,
  },
  clearFormat: {
    id: 'clearFormat',
    labelKey: 'tools.sheet.r.clearFormat',
    icon: 'eraser',
    run: (ctx: SheetCommandContext) => ctx.host?.clearFormatting(),
    disabled: noHostOrBusy,
  },

  /* --------------------------------- borders -------------------------------- */
  borders: {
    id: 'borders',
    labelKey: 'tools.sheet.r.borders',
    icon: 'borders',
    run: (ctx: SheetCommandContext) => ctx.host?.applyBorder('bottom'),
    disabled: noHostOrBusy,
  },

  /* ---------------------------------- align --------------------------------- */
  alignTop: alignCommand(
    'alignTop',
    'tools.sheet.r.alignTop',
    'alignTopCell',
    { vAlign: 'top' },
    (f) => f.vAlign === 'top',
  ),
  alignMiddle: alignCommand(
    'alignMiddle',
    'tools.sheet.r.alignMiddle',
    'alignMiddleCell',
    { vAlign: 'middle' },
    (f) => f.vAlign === 'middle',
  ),
  alignBottom: alignCommand(
    'alignBottom',
    'tools.sheet.r.alignBottom',
    'alignBottomCell',
    { vAlign: 'bottom' },
    (f) => f.vAlign === 'bottom',
  ),
  alignLeft: alignCommand(
    'alignLeft',
    'tools.sheet.r.alignLeft',
    'alignLeftCell',
    { hAlign: 'left' },
    (f) => f.hAlign === 'left',
  ),
  alignCenter: alignCommand(
    'alignCenter',
    'tools.sheet.r.alignCenter',
    'alignCenterCell',
    { hAlign: 'center' },
    (f) => f.hAlign === 'center',
  ),
  alignRight: alignCommand(
    'alignRight',
    'tools.sheet.r.alignRight',
    'alignRightCell',
    { hAlign: 'right' },
    (f) => f.hAlign === 'right',
  ),
  wrapText: formatCommand(
    'wrapText',
    'tools.sheet.r.wrapText',
    'wrapText',
    (next) => ({ wrap: next }),
    'wrap',
  ),

  /* ---------------------------------- merge --------------------------------- */
  mergeCenter: {
    id: 'mergeCenter',
    labelKey: 'tools.sheet.r.mergeCenter',
    icon: 'mergeCenter',
    run: (ctx: SheetCommandContext) => ctx.host?.mergeSelection('center'),
    disabled: noHostOrBusy,
  },
  mergeAcross: {
    id: 'mergeAcross',
    labelKey: 'tools.sheet.r.mergeAcross',
    icon: 'mergeAcross',
    run: (ctx: SheetCommandContext) => ctx.host?.mergeSelection('across'),
    disabled: noHostOrBusy,
  },
  mergeCells: {
    id: 'mergeCells',
    labelKey: 'tools.sheet.r.mergeCells',
    icon: 'mergeCenter',
    run: (ctx: SheetCommandContext) => ctx.host?.mergeSelection('merge'),
    disabled: noHostOrBusy,
  },
  unmergeCells: {
    id: 'unmergeCells',
    labelKey: 'tools.sheet.r.unmerge',
    icon: 'unmerge',
    run: (ctx: SheetCommandContext) => ctx.host?.mergeSelection('unmerge'),
    disabled: noHostOrBusy,
  },

  /* --------------------------------- numbers -------------------------------- */
  currency: {
    id: 'currency',
    labelKey: 'tools.sheet.r.currency',
    icon: 'currency',
    run: (ctx: SheetCommandContext) => ctx.host?.applyNumberFormat('¥#,##0.00'),
    disabled: noHostOrBusy,
  },
  percent: {
    id: 'percent',
    labelKey: 'tools.sheet.r.percent',
    icon: 'percent',
    run: (ctx: SheetCommandContext) => ctx.host?.applyNumberFormat('0.00%'),
    disabled: noHostOrBusy,
  },
  thousand: {
    id: 'thousand',
    labelKey: 'tools.sheet.r.thousand',
    icon: 'thousandSeparator',
    run: (ctx: SheetCommandContext) => ctx.host?.toggleThousandSeparator(),
    disabled: noHostOrBusy,
  },
  increaseDecimal: {
    id: 'increaseDecimal',
    labelKey: 'tools.sheet.r.increaseDecimal',
    icon: 'decimalAdd',
    run: (ctx: SheetCommandContext) => ctx.host?.shiftDecimals(1),
    disabled: noHostOrBusy,
  },
  decreaseDecimal: {
    id: 'decreaseDecimal',
    labelKey: 'tools.sheet.r.decreaseDecimal',
    icon: 'decimalRemove',
    run: (ctx: SheetCommandContext) => ctx.host?.shiftDecimals(-1),
    disabled: noHostOrBusy,
  },
  numberFormatCustom: {
    id: 'numberFormatCustom',
    labelKey: 'tools.sheet.r.numberCustom',
    icon: 'numberFormat',
    run: (ctx: SheetCommandContext) => ctx.actions.openNumberFormat(),
    disabled: noHostOrBusy,
  },

  /* ---------------------------------- cells --------------------------------- */
  insertRowsAbove: {
    id: 'insertRowsAbove',
    labelKey: 'tools.sheet.r.insertRowsAbove',
    icon: 'insertCell',
    run: (ctx: SheetCommandContext) => ctx.host?.insertCells('row', 'before'),
    disabled: editBlocked,
  },
  insertRowsBelow: {
    id: 'insertRowsBelow',
    labelKey: 'tools.sheet.r.insertRowsBelow',
    icon: 'insertCell',
    run: (ctx: SheetCommandContext) => ctx.host?.insertCells('row', 'after'),
    disabled: editBlocked,
  },
  insertColumnsLeft: {
    id: 'insertColumnsLeft',
    labelKey: 'tools.sheet.r.insertColumnsLeft',
    icon: 'insertCell',
    run: (ctx: SheetCommandContext) => ctx.host?.insertCells('column', 'before'),
    disabled: editBlocked,
  },
  insertColumnsRight: {
    id: 'insertColumnsRight',
    labelKey: 'tools.sheet.r.insertColumnsRight',
    icon: 'insertCell',
    run: (ctx: SheetCommandContext) => ctx.host?.insertCells('column', 'after'),
    disabled: editBlocked,
  },
  deleteRows: {
    id: 'deleteRows',
    labelKey: 'tools.sheet.r.deleteRows',
    icon: 'deleteCell',
    run: (ctx: SheetCommandContext) => ctx.host?.deleteCells('row'),
    disabled: editBlocked,
  },
  deleteColumns: {
    id: 'deleteColumns',
    labelKey: 'tools.sheet.r.deleteColumns',
    icon: 'deleteCell',
    run: (ctx: SheetCommandContext) => ctx.host?.deleteCells('column'),
    disabled: editBlocked,
  },
  autoFitRow: {
    id: 'autoFitRow',
    labelKey: 'tools.sheet.r.autoFitRow',
    icon: 'rowHeight',
    run: (ctx: SheetCommandContext) => ctx.host?.autoFit('row'),
    disabled: editBlocked,
  },
  autoFitColumn: {
    id: 'autoFitColumn',
    labelKey: 'tools.sheet.r.autoFitColumn',
    icon: 'columnWidth',
    run: (ctx: SheetCommandContext) => ctx.host?.autoFit('column'),
    disabled: editBlocked,
  },

  /* --------------------------------- editing -------------------------------- */
  autoSum: {
    id: 'autoSum',
    labelKey: 'tools.sheet.r.autoSum',
    icon: 'autoSum',
    run: (ctx: SheetCommandContext) => ctx.host?.applyAutoSum(),
    disabled: editBlocked,
  },
  clearContent: {
    id: 'clearContent',
    labelKey: 'tools.sheet.r.clearContent',
    icon: 'trash',
    run: (ctx: SheetCommandContext) => ctx.host?.clearSelection(),
    disabled: editBlocked,
  },
  sortAsc: {
    id: 'sortAsc',
    labelKey: 'tools.sheet.r.sortAsc',
    icon: 'sortAsc',
    run: (ctx: SheetCommandContext) => ctx.host?.sortSelection('asc'),
    disabled: editBlocked,
  },
  sortDesc: {
    id: 'sortDesc',
    labelKey: 'tools.sheet.r.sortDesc',
    icon: 'sortDesc',
    run: (ctx: SheetCommandContext) => ctx.host?.sortSelection('desc'),
    disabled: editBlocked,
  },
  toggleFilter: {
    id: 'toggleFilter',
    labelKey: 'tools.sheet.r.filter',
    icon: 'filter',
    run: (ctx: SheetCommandContext) => ctx.host?.toggleFilter(),
    disabled: editBlocked,
    active: (ctx: SheetCommandContext) => ctx.host?.hasFilter() ?? false,
  },

  /* --------------------------------- styles --------------------------------- */
  conditionalFormatting: {
    id: 'conditionalFormatting',
    labelKey: 'tools.sheet.r.conditionalFormat',
    icon: 'conditionalFormat',
    run: (ctx: SheetCommandContext) => ctx.host?.openPanel('conditionalFormatting'),
    disabled: noHostOrBusy,
  },

  /* --------------------------------- insert --------------------------------- */
  hyperlink: {
    id: 'hyperlink',
    labelKey: 'tools.sheet.r.hyperlink',
    icon: 'link',
    run: (ctx: SheetCommandContext) => ctx.actions.promptHyperlink(),
    disabled: actionBlocked,
  },
  insertChart: {
    id: 'insertChart',
    labelKey: 'tools.sheet.insertChart',
    icon: 'chart',
    run: (ctx: SheetCommandContext) => ctx.actions.insertChart(),
    disabled: (ctx: SheetCommandContext) => ctx.busy,
  },
  insertShape: {
    id: 'insertShape',
    labelKey: 'tools.sheet.insertShape',
    icon: 'shapes',
    run: (ctx: SheetCommandContext) => ctx.actions.insertShape(),
    disabled: (ctx: SheetCommandContext) => ctx.busy,
  },
  insertImage: {
    id: 'insertImage',
    labelKey: 'tools.sheet.insertImage',
    icon: 'image',
    run: (ctx: SheetCommandContext) => ctx.actions.insertImage(),
    disabled: (ctx: SheetCommandContext) => ctx.busy || ctx.protectedSheet,
  },
  insertPivot: {
    id: 'insertPivot',
    labelKey: 'tools.sheet.insertPivot',
    icon: 'pivot',
    run: (ctx: SheetCommandContext) => ctx.actions.insertPivot(),
    disabled: (ctx: SheetCommandContext) => ctx.busy,
  },
  /** Short ribbon label for the same action ("插入透视表" does not fit a 52px large button) */
  pivotTable: {
    id: 'pivotTable',
    labelKey: 'tools.sheet.r.pivotTable',
    icon: 'pivot',
    run: (ctx: SheetCommandContext) => ctx.actions.insertPivot(),
    disabled: (ctx: SheetCommandContext) => ctx.busy,
  },
  insertTable: {
    id: 'insertTable',
    labelKey: 'tools.sheet.tableInsert',
    icon: 'table',
    run: (ctx: SheetCommandContext) => ctx.actions.insertTable(),
    disabled: (ctx: SheetCommandContext) => ctx.busy || ctx.cellCount === 0 || ctx.protectedSheet,
  },
  deleteTable: {
    id: 'deleteTable',
    labelKey: 'tools.sheet.tableDelete',
    icon: 'trash',
    run: (ctx: SheetCommandContext) => ctx.actions.deleteTable(),
    disabled: (ctx: SheetCommandContext) => ctx.busy || ctx.protectedSheet || !ctx.hasTable,
  },
  openNames: {
    id: 'openNames',
    labelKey: 'tools.sheet.namesTitle',
    icon: 'tag',
    run: (ctx: SheetCommandContext) => ctx.actions.openNames(),
    disabled: (ctx: SheetCommandContext) => ctx.busy,
  },
  comment: {
    id: 'comment',
    labelKey: 'tools.sheet.comments',
    icon: 'comment',
    run: (ctx: SheetCommandContext) => ctx.actions.openComments(),
  },

  /* --------------------------------- sheets --------------------------------- */
  addSheet: {
    id: 'addSheet',
    labelKey: 'tools.sheet.addSheet',
    icon: 'newDoc',
    run: (ctx: SheetCommandContext) => ctx.actions.addSheet(),
    disabled: (ctx: SheetCommandContext) => ctx.busy,
  },
  duplicateSheet: {
    id: 'duplicateSheet',
    labelKey: 'tools.sheet.duplicate',
    icon: 'copy',
    run: (ctx: SheetCommandContext) => ctx.actions.duplicateSheet(),
    disabled: (ctx: SheetCommandContext) => ctx.busy || !ctx.hasActiveSheet,
  },
  renameSheet: {
    id: 'renameSheet',
    labelKey: 'tools.sheet.rename',
    icon: 'text',
    run: (ctx: SheetCommandContext) => ctx.actions.renameSheet(),
    disabled: (ctx: SheetCommandContext) => ctx.busy || !ctx.hasActiveSheet,
  },
  deleteSheet: {
    id: 'deleteSheet',
    labelKey: 'tools.sheet.delete',
    icon: 'trash',
    run: (ctx: SheetCommandContext) => ctx.actions.deleteSheet(),
    disabled: (ctx: SheetCommandContext) => ctx.busy || !ctx.hasActiveSheet || ctx.sheetCount <= 1,
  },

  /* --------------------------------- review --------------------------------- */
  protect: {
    id: 'protect',
    labelKey: 'tools.sheet.protectMenuOn',
    icon: 'lock',
    run: (ctx: SheetCommandContext) => ctx.actions.openProtect(),
    disabled: (ctx: SheetCommandContext) => ctx.busy || !ctx.hasActiveSheet,
  },
  dataValidation: {
    id: 'dataValidation',
    labelKey: 'tools.sheet.r.dataValidation',
    icon: 'dataValidation',
    run: (ctx: SheetCommandContext) => ctx.host?.openPanel('dataValidation'),
    disabled: noHostOrBusy,
  },
  present: {
    id: 'present',
    labelKey: 'tools.sheet.present',
    icon: 'present',
    run: (ctx: SheetCommandContext) => ctx.actions.present(),
    disabled: (ctx: SheetCommandContext) => ctx.cellCount === 0,
  },

  /* ---------------------------------- view ---------------------------------- */
  freezeTopRow: {
    id: 'freezeTopRow',
    labelKey: 'tools.sheet.r.freezeTopRow',
    icon: 'freeze',
    run: (ctx: SheetCommandContext) => ctx.host?.setFreeze('row'),
    disabled: noHostOrBusy,
    active: (ctx: SheetCommandContext) => ctx.host?.getFreezeState() === 'row',
  },
  freezeFirstColumn: {
    id: 'freezeFirstColumn',
    labelKey: 'tools.sheet.r.freezeFirstColumn',
    icon: 'freeze',
    run: (ctx: SheetCommandContext) => ctx.host?.setFreeze('column'),
    disabled: noHostOrBusy,
    active: (ctx: SheetCommandContext) => ctx.host?.getFreezeState() === 'column',
  },
  freezePanes: {
    id: 'freezePanes',
    labelKey: 'tools.sheet.r.freezePanes',
    icon: 'freeze',
    run: (ctx: SheetCommandContext) => ctx.host?.setFreeze('both'),
    disabled: noHostOrBusy,
    active: (ctx: SheetCommandContext) => ctx.host?.getFreezeState() === 'both',
  },
  unfreeze: {
    id: 'unfreeze',
    labelKey: 'tools.sheet.r.unfreeze',
    icon: 'freeze',
    run: (ctx: SheetCommandContext) => ctx.host?.setFreeze('none'),
    disabled: noHostOrBusy,
  },
  toggleGridlines: {
    id: 'toggleGridlines',
    labelKey: 'tools.sheet.r.gridlines',
    icon: 'gridlines',
    run: (ctx: SheetCommandContext) => {
      if (!ctx.host) return;
      ctx.host.setGridlinesHidden(!ctx.host.areGridlinesHidden());
    },
    disabled: noHostOrBusy,
    active: (ctx: SheetCommandContext) => (ctx.host ? !ctx.host.areGridlinesHidden() : false),
  },
  zoomIn: {
    id: 'zoomIn',
    labelKey: 'tools.sheet.r.zoomIn',
    icon: 'zoomIn',
    run: (ctx: SheetCommandContext) => setZoom(ctx, 10),
    disabled: noHostOrBusy,
  },
  zoomOut: {
    id: 'zoomOut',
    labelKey: 'tools.sheet.r.zoomOut',
    icon: 'zoomOut',
    run: (ctx: SheetCommandContext) => setZoom(ctx, -10),
    disabled: noHostOrBusy,
  },
  zoomReset: {
    id: 'zoomReset',
    labelKey: 'tools.sheet.r.zoomReset',
    icon: 'actualSize',
    run: (ctx: SheetCommandContext) => ctx.host?.setZoomPercent(100),
    disabled: noHostOrBusy,
  },
} satisfies Record<string, SheetCommand>;

/** Widened value type keeps `disabled` / `active` optional on every entry while ids stay literal */
export const SHEET_COMMANDS: Record<keyof typeof SHEET_COMMAND_DEFS, SheetCommand> =
  SHEET_COMMAND_DEFS;

export type SheetCommandId = keyof typeof SHEET_COMMAND_DEFS;

/** Resolve a command against the current context (label, icon, disabled, active) */
export function resolveCommand(ctx: SheetCommandContext, id: SheetCommandId) {
  const command = SHEET_COMMANDS[id];
  return {
    id: command.id,
    label: ctx.t(command.labelKey),
    icon: command.icon,
    disabled: command.disabled?.(ctx) ?? false,
    active: command.active?.(ctx) ?? false,
    run: () => command.run(ctx),
  };
}

/* ---------------------------------- menus --------------------------------- */

/**
 * The menu bar kept from the previous design. Entries are resolved from the same command table, so
 * labels, disabled rules and behaviour match the ribbon exactly.
 */
export function buildSheetMenus(ctx: SheetCommandContext): EditorMenu[] {
  const entry = (id: SheetCommandId, options: { shortcut?: string; danger?: boolean } = {}) => {
    const command = resolveCommand(ctx, id);
    return editorMenuItem(command.id, command.label, command.run, {
      ...options,
      disabled: command.disabled,
    });
  };
  const protectLabel = ctx.protectedSheet
    ? ctx.t('tools.sheet.protectMenuOff')
    : ctx.t('tools.sheet.protectMenuOn');

  return [
    {
      id: 'file',
      label: ctx.t('common.menuFile'),
      entries: [
        entry('newDoc', { shortcut: '⌘N' }),
        entry('importXlsx'),
        entry('importCsv'),
        { type: 'separator' },
        entry('exportXlsx'),
        entry('exportCsv'),
        entry('print'),
        { type: 'separator' },
        entry('library'),
        entry('versions'),
        { type: 'separator' },
        entry('clearDoc', { danger: true }),
      ],
    },
    {
      id: 'edit',
      label: ctx.t('common.menuEdit'),
      entries: [
        entry('undo', { shortcut: '⌘Z' }),
        entry('redo', { shortcut: '⇧⌘Z' }),
        { type: 'separator' },
        entry('cut', { shortcut: '⌘X' }),
        entry('copy', { shortcut: '⌘C' }),
        entry('paste', { shortcut: '⌘V' }),
        { type: 'separator' },
        entry('clearContent'),
        entry('clearFormat'),
        entry('autoSum'),
        entry('sortAsc'),
        entry('sortDesc'),
        { type: 'separator' },
        entry('find', { shortcut: '⌘F' }),
      ],
    },
    {
      id: 'insert',
      label: ctx.t('common.menuInsert'),
      entries: [
        entry('insertChart'),
        entry('insertShape'),
        entry('insertImage'),
        entry('insertPivot'),
        entry('openNames'),
        entry('hyperlink'),
        { type: 'separator' },
        entry('insertTable'),
        entry('deleteTable'),
        { type: 'separator' },
        entry('addSheet'),
        entry('duplicateSheet'),
        entry('renameSheet'),
        entry('deleteSheet', { danger: true }),
      ],
    },
    {
      id: 'view',
      label: ctx.t('common.menuView'),
      entries: [
        entry('comment'),
        editorMenuItem('view-protect', protectLabel, ctx.actions.openProtect, {
          disabled: ctx.busy || !ctx.hasActiveSheet,
        }),
        { type: 'separator' },
        entry('conditionalFormatting'),
        entry('dataValidation'),
        { type: 'separator' },
        entry('freezeTopRow'),
        entry('toggleGridlines'),
        { type: 'separator' },
        entry('present'),
      ],
    },
  ];
}

/* --------------------------------- ribbon --------------------------------- */

function menuItems(ctx: SheetCommandContext, ids: SheetCommandId[]): RibbonMenuItem[] {
  return ids.map((id) => {
    const command = resolveCommand(ctx, id);
    return {
      id: command.id,
      label: command.label,
      icon: command.icon,
      disabled: command.disabled,
      checked: command.active,
      onSelect: command.run,
    };
  });
}

/**
 * The seven Excel tabs. Group ids are stable so `data-testid="ribbon-<group>-<item>"` selectors and
 * the low-priority groups of the overflow logic stay predictable.
 */
export function buildSheetRibbonTabs(ctx: SheetCommandContext): RibbonTab[] {
  const format = ctx.format;
  const numfmtOptions = NUMBER_FORMAT_PRESETS.map((preset) => ({
    value: preset.pattern,
    label: ctx.t(`tools.sheet.r.${preset.labelKey}`),
  }));
  const activeNumberFormat = format?.numberFormat ?? '';

  const asItem = (id: SheetCommandId, size: 'large' | 'small' = 'small') => {
    const command = resolveCommand(ctx, id);
    // Commands with an `active` predicate are toggles: they keep their aria-pressed state visible
    return SHEET_COMMANDS[id].active
      ? {
          kind: 'toggle' as const,
          id: command.id,
          label: command.label,
          icon: command.icon,
          size,
          disabled: command.disabled,
          active: command.active,
          onSelect: command.run,
        }
      : {
          kind: 'button' as const,
          id: command.id,
          label: command.label,
          icon: command.icon,
          size,
          disabled: command.disabled,
          onSelect: command.run,
        };
  };

  const borderMenu: RibbonMenuItem[] = BORDER_PRESETS.map((preset) => ({
    id: preset.id,
    label: ctx.t(`tools.sheet.r.${preset.labelKey}`),
    icon: preset.icon,
    disabled: noHostOrBusy(ctx),
    onSelect: () => ctx.host?.applyBorder(preset.id),
  }));

  const conditionalMenu: RibbonMenuItem[] = [
    {
      id: 'cf-manage',
      label: ctx.t('tools.sheet.r.manageRules'),
      icon: 'conditionalFormat',
      disabled: noHostOrBusy(ctx),
      onSelect: () => ctx.host?.openPanel('conditionalFormatting'),
    },
  ];

  return [
    {
      id: 'home',
      label: ctx.t('tools.sheet.tab.home'),
      groups: [
        {
          id: 'clipboard',
          label: ctx.t('tools.sheet.grp.clipboard'),
          priority: 9,
          items: [
            {
              kind: 'split',
              id: 'paste-group',
              label: ctx.t('tools.sheet.r.paste'),
              icon: 'copy',
              disabled: noHostOrBusy(ctx),
              onSelect: ctx.actions.pasteFromClipboard,
              menu: menuItems(ctx, ['paste', 'copy', 'cut']),
            },
            asItem('copy'),
            asItem('cut'),
          ],
        },
        {
          id: 'font',
          label: ctx.t('tools.sheet.grp.font'),
          priority: 8,
          items: [
            {
              kind: 'select',
              id: 'font-family',
              label: ctx.t('tools.sheet.r.fontFamily'),
              value: format?.fontFamily ?? '',
              width: 'sm',
              disabled: editBlocked(ctx),
              options: [
                { value: '', label: ctx.t('tools.sheet.r.fontDefault') },
                ...FONT_FAMILY_PRESETS.map((font) => ({ value: font, label: font })),
              ],
              onChange: (value) => ctx.host?.applyFormat({ fontFamily: value || null }),
            },
            {
              kind: 'select',
              id: 'font-size',
              label: ctx.t('tools.sheet.r.fontSize'),
              value: format?.fontSize ? String(format.fontSize) : '',
              width: 'xs',
              disabled: editBlocked(ctx),
              options: [
                ...(format?.fontSize && !FONT_SIZE_PRESETS.includes(format.fontSize)
                  ? [{ value: String(format.fontSize), label: String(format.fontSize) }]
                  : []),
                ...FONT_SIZE_PRESETS.map((size) => ({ value: String(size), label: String(size) })),
              ],
              onChange: (value) => ctx.host?.applyFormat({ fontSize: Number(value) || null }),
            },
            asItem('growFont'),
            asItem('shrinkFont'),
            asItem('bold'),
            asItem('italic'),
            asItem('underline'),
            asItem('strike'),
            {
              kind: 'split',
              id: 'borders',
              label: ctx.t('tools.sheet.r.borders'),
              icon: 'borders',
              disabled: noHostOrBusy(ctx),
              onSelect: () => ctx.host?.applyBorder('bottom'),
              menu: borderMenu,
            },
            {
              kind: 'color',
              id: 'fill-color',
              label: ctx.t('tools.sheet.r.fillColor'),
              icon: 'fillColor',
              value: format?.fill ?? null,
              disabled: editBlocked(ctx),
              onPick: (color) => ctx.host?.applyFormat({ fill: color }),
              onReset: () => ctx.host?.applyFormat({ fill: null }),
              resetLabel: ctx.t('tools.sheet.r.noFill'),
            },
            {
              kind: 'color',
              id: 'font-color',
              label: ctx.t('tools.sheet.r.fontColor'),
              icon: 'fontColor',
              value: format?.color ?? null,
              disabled: editBlocked(ctx),
              onPick: (color) => ctx.host?.applyFormat({ color }),
              onReset: () => ctx.host?.applyFormat({ color: null }),
              resetLabel: ctx.t('tools.sheet.r.autoColor'),
            },
          ],
        },
        {
          id: 'align',
          label: ctx.t('tools.sheet.grp.align'),
          priority: 6,
          items: [
            asItem('alignTop'),
            asItem('alignMiddle'),
            asItem('alignBottom'),
            asItem('alignLeft'),
            asItem('alignCenter'),
            asItem('alignRight'),
            asItem('wrapText'),
            {
              kind: 'split',
              id: 'merge',
              label: ctx.t('tools.sheet.r.mergeCenter'),
              icon: 'mergeCenter',
              active: format?.merged ?? false,
              disabled: noHostOrBusy(ctx),
              onSelect: () => ctx.host?.mergeSelection('center'),
              menu: menuItems(ctx, ['mergeCenter', 'mergeCells', 'mergeAcross', 'unmergeCells']),
            },
          ],
        },
        {
          id: 'number',
          label: ctx.t('tools.sheet.grp.number'),
          priority: 5,
          items: [
            {
              kind: 'select',
              id: 'number-format',
              label: ctx.t('tools.sheet.r.numberFormat'),
              value: activeNumberFormat,
              width: 'xs',
              disabled: noHostOrBusy(ctx),
              options: numfmtOptions,
              onChange: (value) => ctx.host?.applyNumberFormat(value || null),
            },
            asItem('currency'),
            asItem('percent'),
            asItem('thousand'),
            asItem('increaseDecimal'),
            asItem('decreaseDecimal'),
          ],
        },
        {
          id: 'styles',
          label: ctx.t('tools.sheet.grp.styles'),
          priority: 3,
          items: [
            {
              kind: 'split',
              id: 'conditional-format',
              label: ctx.t('tools.sheet.r.conditionalFormat'),
              icon: 'conditionalFormat',
              disabled: noHostOrBusy(ctx),
              onSelect: () => ctx.host?.openPanel('conditionalFormatting'),
              menu: conditionalMenu,
            },
            asItem('insertTable'),
          ],
        },
        {
          id: 'cells',
          label: ctx.t('tools.sheet.grp.cells'),
          priority: 2,
          items: [
            {
              kind: 'menu',
              id: 'insert-cells',
              label: ctx.t('tools.sheet.r.insertCells'),
              icon: 'insertCell',
              size: 'large',
              disabled: editBlocked(ctx),
              menu: menuItems(ctx, [
                'insertRowsAbove',
                'insertRowsBelow',
                'insertColumnsLeft',
                'insertColumnsRight',
              ]),
            },
            {
              kind: 'menu',
              id: 'delete-cells',
              label: ctx.t('tools.sheet.r.deleteCells'),
              icon: 'deleteCell',
              size: 'large',
              disabled: editBlocked(ctx),
              menu: menuItems(ctx, ['deleteRows', 'deleteColumns']),
            },
            {
              kind: 'menu',
              id: 'format-cells',
              label: ctx.t('tools.sheet.r.formatCells'),
              icon: 'rowHeight',
              size: 'large',
              disabled: editBlocked(ctx),
              menu: menuItems(ctx, ['autoFitRow', 'autoFitColumn', 'numberFormatCustom']),
            },
          ],
        },
        {
          id: 'editing',
          label: ctx.t('tools.sheet.grp.editing'),
          priority: 1,
          items: [
            asItem('autoSum', 'large'),
            {
              kind: 'menu',
              id: 'sort-filter',
              label: ctx.t('tools.sheet.r.sortFilter'),
              icon: 'sortAsc',
              size: 'large',
              disabled: editBlocked(ctx),
              menu: menuItems(ctx, ['sortAsc', 'sortDesc', 'toggleFilter']),
            },
            {
              kind: 'split',
              id: 'clear',
              label: ctx.t('common.clear'),
              icon: 'trash',
              disabled: editBlocked(ctx),
              onSelect: () => ctx.host?.clearSelection(),
              menu: menuItems(ctx, ['clearContent', 'clearFormat']),
            },
            asItem('find', 'small'),
          ],
        },
      ],
    },
    {
      id: 'insert',
      label: ctx.t('tools.sheet.tab.insert'),
      groups: [
        {
          id: 'tables',
          label: ctx.t('tools.sheet.grp.tables'),
          items: [asItem('pivotTable', 'large'), asItem('insertTable', 'large')],
        },
        {
          id: 'illustrations',
          label: ctx.t('tools.sheet.grp.illustrations'),
          items: [
            asItem('insertChart', 'large'),
            asItem('insertShape', 'large'),
            asItem('insertImage', 'large'),
          ],
        },
        {
          id: 'links',
          label: ctx.t('tools.sheet.grp.links'),
          items: [asItem('hyperlink', 'large')],
        },
        {
          id: 'comment-group',
          label: ctx.t('tools.sheet.grp.comments'),
          items: [asItem('comment', 'large')],
        },
      ],
    },
    {
      id: 'layout',
      label: ctx.t('tools.sheet.tab.layout'),
      groups: [
        {
          id: 'page-setup',
          label: ctx.t('tools.sheet.grp.pageSetup'),
          onLauncher: ctx.actions.print,
          items: [asItem('print', 'large')],
        },
        {
          id: 'sheet-options',
          label: ctx.t('tools.sheet.grp.sheetOptions'),
          items: [asItem('toggleGridlines', 'large')],
        },
      ],
    },
    {
      id: 'formulas',
      label: ctx.t('tools.sheet.tab.formulas'),
      groups: [
        {
          id: 'function-library',
          label: ctx.t('tools.sheet.grp.functions'),
          items: [asItem('autoSum', 'large'), asItem('numberFormatCustom', 'large')],
        },
        {
          id: 'defined-names',
          label: ctx.t('tools.sheet.grp.names'),
          items: [asItem('openNames', 'large')],
        },
      ],
    },
    {
      id: 'data',
      label: ctx.t('tools.sheet.tab.data'),
      groups: [
        {
          id: 'sort-filter',
          label: ctx.t('tools.sheet.grp.sortFilter'),
          items: [
            asItem('sortAsc', 'large'),
            asItem('sortDesc', 'large'),
            asItem('toggleFilter', 'large'),
          ],
        },
        {
          id: 'data-tools',
          label: ctx.t('tools.sheet.grp.dataTools'),
          items: [asItem('dataValidation', 'large')],
        },
        {
          id: 'pivot-group',
          label: ctx.t('tools.sheet.grp.pivot'),
          items: [asItem('pivotTable', 'large')],
        },
      ],
    },
    {
      id: 'review',
      label: ctx.t('tools.sheet.tab.review'),
      groups: [
        {
          id: 'comments-group',
          label: ctx.t('tools.sheet.grp.comments'),
          items: [asItem('comment', 'large')],
        },
        {
          id: 'protect-group',
          label: ctx.t('tools.sheet.grp.protect'),
          items: [asItem('protect', 'large')],
        },
        {
          id: 'changes',
          label: ctx.t('tools.sheet.grp.changes'),
          items: [asItem('versions', 'large')],
        },
      ],
    },
    {
      id: 'view',
      label: ctx.t('tools.sheet.tab.view'),
      groups: [
        {
          id: 'freeze-group',
          label: ctx.t('tools.sheet.grp.views'),
          priority: 3,
          items: [
            {
              kind: 'split',
              id: 'freeze',
              label: ctx.t('tools.sheet.r.freezePanes'),
              icon: 'freeze',
              active: ctx.host?.getFreezeState() !== 'none' && ctx.host !== null,
              disabled: noHostOrBusy(ctx),
              onSelect: () => ctx.host?.setFreeze('both'),
              menu: menuItems(ctx, [
                'freezeTopRow',
                'freezeFirstColumn',
                'freezePanes',
                'unfreeze',
              ]),
            },
            asItem('toggleGridlines'),
          ],
        },
        {
          id: 'window',
          label: ctx.t('tools.sheet.grp.window'),
          priority: 2,
          items: [asItem('zoomOut'), asItem('zoomIn'), asItem('zoomReset')],
        },
        {
          id: 'show',
          label: ctx.t('tools.sheet.grp.show'),
          priority: 1,
          items: [asItem('present', 'large')],
        },
      ],
    },
  ];
}
