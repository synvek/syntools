import { describe, expect, it, vi } from 'vitest';
import {
  SHEET_COMMANDS,
  buildSheetMenus,
  buildSheetRibbonTabs,
  nextFontSize,
  resolveCommand,
  type SheetActions,
  type SheetCommandContext,
  type SheetRibbonHost,
} from './commands';
import { EMPTY_SHEET_FORMAT, type SheetFormatState } from './sheetFormat';
import type { RibbonGroup, RibbonItem, RibbonTab } from '@/core/components/ribbon/types';

/**
 * The command table is the single source of truth for both the menu bar and the ribbon, so these tests
 * guard the contract between them: ids, disabled rules, toggle semantics and the tab structure.
 */

function fakeHost(overrides: Partial<SheetRibbonHost> = {}): SheetRibbonHost {
  return {
    getFormatState: () => EMPTY_SHEET_FORMAT,
    applyFormat: vi.fn(),
    applyBorder: vi.fn(),
    applyNumberFormat: vi.fn(),
    shiftDecimals: vi.fn(),
    toggleThousandSeparator: vi.fn(),
    mergeSelection: vi.fn(),
    insertCells: vi.fn(),
    deleteCells: vi.fn(),
    autoFit: vi.fn(),
    setFreeze: vi.fn(),
    getFreezeState: () => 'none',
    setGridlinesHidden: vi.fn(),
    areGridlinesHidden: () => false,
    setZoomPercent: vi.fn(),
    getZoomPercent: () => 100,
    sortSelection: vi.fn(),
    toggleFilter: vi.fn(),
    hasFilter: () => false,
    applyAutoSum: vi.fn(),
    clearFormatting: vi.fn(),
    readSelectionText: () => 'a\tb',
    writeMatrix: vi.fn(),
    clearSelection: vi.fn(),
    setHyperlink: vi.fn(),
    openPanel: vi.fn(),
    onSelectionChange: () => () => undefined,
    ...overrides,
  };
}

function fakeActions(): SheetActions {
  const noop = vi.fn();
  return {
    newDoc: noop,
    importXlsx: noop,
    importCsv: noop,
    exportXlsx: noop,
    exportCsv: noop,
    print: noop,
    library: noop,
    versions: noop,
    clear: noop,
    undo: noop,
    redo: noop,
    insertChart: noop,
    insertShape: noop,
    insertImage: noop,
    insertPivot: noop,
    openNames: noop,
    insertTable: noop,
    deleteTable: noop,
    addSheet: noop,
    duplicateSheet: noop,
    renameSheet: noop,
    deleteSheet: noop,
    openComments: noop,
    openProtect: noop,
    present: noop,
    promptHyperlink: noop,
    openNumberFormat: noop,
    copyToClipboard: noop,
    pasteFromClipboard: noop,
  };
}

function makeCtx(overrides: Partial<SheetCommandContext> = {}): SheetCommandContext {
  return {
    t: (key: string) => key,
    host: fakeHost(),
    format: EMPTY_SHEET_FORMAT,
    actions: fakeActions(),
    busy: false,
    cellCount: 10,
    canExportXlsx: true,
    sheetCount: 2,
    hasActiveSheet: true,
    activeSheetName: 'Sheet1',
    protectedSheet: false,
    hasTable: false,
    hasDocId: true,
    hasTitle: true,
    ...overrides,
  };
}

const allItems = (tabs: RibbonTab[]): RibbonItem[] =>
  tabs.flatMap((tab) => tab.groups.flatMap((group) => group.items));

describe('sheet command registry', () => {
  it('feeds the menu bar with stable ids', () => {
    const menus = buildSheetMenus(makeCtx());
    expect(menus.map((menu) => menu.id)).toEqual(['file', 'edit', 'insert', 'view']);
    const fileIds = menus[0]?.entries
      .filter(
        (entry): entry is Extract<typeof entry, { type?: 'item' }> => entry.type !== 'separator',
      )
      .map((entry) => entry.id);
    expect(fileIds).toContain('newDoc');
    expect(fileIds).toContain('exportXlsx');
  });

  it('greys out export when the workbook has no cells or objects', () => {
    const ctx = makeCtx({ cellCount: 0, canExportXlsx: false });
    expect(resolveCommand(ctx, 'exportXlsx').disabled).toBe(true);
    expect(resolveCommand(ctx, 'exportCsv').disabled).toBe(true);
    expect(resolveCommand(ctx, 'exportXlsx').disabled).toBe(true);
  });

  it('disables document actions while busy', () => {
    const ctx = makeCtx({ busy: true });
    expect(resolveCommand(ctx, 'importXlsx').disabled).toBe(true);
    expect(resolveCommand(ctx, 'addSheet').disabled).toBe(true);
    expect(resolveCommand(ctx, 'insertChart').disabled).toBe(true);
  });

  it('disables editing commands on a protected sheet but keeps navigation', () => {
    const ctx = makeCtx({ protectedSheet: true });
    expect(resolveCommand(ctx, 'bold').disabled).toBe(true);
    expect(resolveCommand(ctx, 'insertRowsAbove').disabled).toBe(true);
    expect(resolveCommand(ctx, 'openNames').disabled).toBe(false);
  });

  it('disables formatting when no Univer instance is ready', () => {
    const ctx = makeCtx({ host: null });
    expect(resolveCommand(ctx, 'bold').disabled).toBe(true);
    expect(resolveCommand(ctx, 'conditionalFormatting').disabled).toBe(true);
  });

  it('toggles bold from the current selection state', () => {
    const host = fakeHost();
    const ctx = makeCtx({ host, format: { ...EMPTY_SHEET_FORMAT, bold: false } });
    resolveCommand(ctx, 'bold').run();
    expect(host.applyFormat).toHaveBeenCalledWith({ bold: true });
  });

  it('treats a mixed selection as "off" so a click turns it on', () => {
    const host = fakeHost();
    const mixed: SheetFormatState = { ...EMPTY_SHEET_FORMAT, bold: 'mixed' };
    const ctx = makeCtx({ host, format: mixed });
    expect(resolveCommand(ctx, 'bold').active).toBe(false);
    resolveCommand(ctx, 'bold').run();
    expect(host.applyFormat).toHaveBeenCalledWith({ bold: true });
  });

  it('clamps zoom between 25% and 400%', () => {
    const host = fakeHost({ getZoomPercent: () => 25 });
    resolveCommand(makeCtx({ host }), 'zoomOut').run();
    expect(host.setZoomPercent).toHaveBeenCalledWith(25);

    const high = fakeHost({ getZoomPercent: () => 400 });
    resolveCommand(makeCtx({ host: high }), 'zoomIn').run();
    expect(high.setZoomPercent).toHaveBeenCalledWith(400);
  });

  it('steps through the font size ladder', () => {
    expect(nextFontSize(11, 1)).toBe(12);
    expect(nextFontSize(11, -1)).toBe(10);
    expect(nextFontSize(72, 1)).toBe(72);
    expect(nextFontSize(8, -1)).toBe(8);
    // Off-ladder sizes snap to the next preset instead of jumping to the extremes
    expect(nextFontSize(13, 1)).toBe(14);
  });
});

describe('spreadsheet ribbon tabs', () => {
  it('exposes the seven Excel tabs in order', () => {
    const tabs = buildSheetRibbonTabs(makeCtx());
    expect(tabs.map((tab) => tab.id)).toEqual([
      'home',
      'insert',
      'layout',
      'formulas',
      'data',
      'review',
      'view',
    ]);
  });

  it('gives every group a caption and unique ids inside each tab', () => {
    const tabs = buildSheetRibbonTabs(makeCtx());
    const groups: RibbonGroup[] = tabs.flatMap((tab) => tab.groups);
    expect(groups.every((group) => group.label.length > 0)).toBe(true);
    // Only one tab renders at a time, and `data-testid` is built from group+item, so per-tab
    // uniqueness is the real requirement (Office repeats commands across tabs too).
    for (const tab of tabs) {
      const ids = tab.groups.flatMap((group) =>
        group.items.map((item) => `${group.id}:${item.id}`),
      );
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('renders formatting commands as toggles with the selection state', () => {
    const ctx = makeCtx({
      format: { ...EMPTY_SHEET_FORMAT, bold: true, underline: true, hAlign: 'center' },
    });
    const items = allItems(buildSheetRibbonTabs(ctx));
    const activeOf = (id: string): boolean | undefined => {
      const item = items.find((candidate) => candidate.id === id);
      return item && 'active' in item ? item.active : undefined;
    };
    expect(items.find((item) => item.id === 'bold')?.kind).toBe('toggle');
    expect(activeOf('bold')).toBe(true);
    expect(activeOf('underline')).toBe(true);
    expect(activeOf('alignCenter')).toBe(true);
    expect(activeOf('alignLeft')).toBe(false);
  });

  it('wires the border split button menu to the border presets', () => {
    const host = fakeHost();
    const tabs = buildSheetRibbonTabs(makeCtx({ host }));
    const borders = allItems(tabs).find((item) => item.id === 'borders');
    expect(borders?.kind).toBe('split');
    if (borders?.kind !== 'split') throw new Error('borders must be a split button');
    expect(borders.menu.map((entry) => entry.id)).toEqual([
      'bottom',
      'top',
      'left',
      'right',
      'none',
      'all',
      'outside',
      'inside',
      'thickOutside',
    ]);
    borders.menu.find((entry) => entry.id === 'none')?.onSelect();
    expect(host.applyBorder).toHaveBeenCalledWith('none');
  });

  it('offers the number format presets and applies the chosen pattern', () => {
    const host = fakeHost();
    const items = allItems(buildSheetRibbonTabs(makeCtx({ host })));
    const select = items.find((item) => item.id === 'number-format');
    expect(select?.kind).toBe('select');
    if (select?.kind !== 'select') throw new Error('number format must be a select');
    expect(select.options.map((option) => option.value)).toContain('0.00%');
    select.onChange('0.00%');
    expect(host.applyNumberFormat).toHaveBeenCalledWith('0.00%');
  });

  it('greys out the whole formatting surface when no instance is ready', () => {
    const items = allItems(buildSheetRibbonTabs(makeCtx({ host: null })));
    expect(items.filter((item) => item.disabled).length).toBeGreaterThan(10);
  });

  it('keeps the command table free of duplicate ids', () => {
    const ids = Object.keys(SHEET_COMMANDS);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
