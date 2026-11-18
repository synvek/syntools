import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UniverHandle } from '../univer';
import { resetSheetIssues, subscribeSheetIssues, type SheetIssue } from '../issues';
import { useSheetCommandSurface, type SheetCommandSurfaceDeps } from './useSheetCommandSurface';

/**
 * 这些用例锁的是"点了会怎样"的规则，而不是实现细节：90 行接线搬出组件之前一条测试都没有。
 */

const FORMAT = { numberFormat: '#,##0.00', bold: false } as unknown as ReturnType<
  UniverHandle['getFormatState']
>;

function makeHost(overrides: Partial<Record<keyof UniverHandle, unknown>> = {}) {
  return {
    undo: vi.fn(),
    redo: vi.fn(),
    getFormatState: vi.fn(() => FORMAT),
    setHyperlink: vi.fn(),
    writeMatrix: vi.fn(),
    readSelectionFormulas: vi.fn(() => ['=SUM(A1:A2)']),
    describeSortRange: vi.fn(() => ({ columns: ['销售额'], hasHeader: true })),
    ...overrides,
  } as unknown as UniverHandle;
}

function makeDeps(overrides: Partial<SheetCommandSurfaceDeps> = {}) {
  const host = makeHost();
  const deps: SheetCommandSurfaceDeps = {
    t: ((key: string) => key) as SheetCommandSurfaceDeps['t'],
    handleRef: { current: host },
    host,
    imageInputRef: { current: null },
    newDoc: vi.fn(),
    clear: vi.fn(),
    openImport: vi.fn(),
    exportXlsx: vi.fn(async () => {}),
    exportCsv: vi.fn(),
    openPrint: vi.fn(),
    openLibrary: vi.fn(),
    openVersions: vi.fn(),
    openPresent: vi.fn(),
    insertChart: vi.fn(),
    insertShape: vi.fn(),
    insertPivot: vi.fn(),
    openNames: vi.fn(),
    insertTable: vi.fn(),
    deleteTable: vi.fn(),
    openComments: vi.fn(),
    openProtect: vi.fn(),
    addSheet: vi.fn(),
    duplicateSheet: vi.fn(),
    renameSheet: vi.fn(),
    deleteSheet: vi.fn(),
    activeSheet: { id: 's1', name: '明细' },
    showNumberFormat: vi.fn(),
    showFormatCells: vi.fn(),
    showShortcuts: vi.fn(),
    showFormulaReport: vi.fn(),
    showSort: vi.fn(),
    busy: false,
    summary: { sheets: 1, rows: 2, columns: 2, cells: 4, formulas: 0 },
    sheetCount: 1,
    protectedSheet: false,
    hasTable: false,
    docId: 'doc-1',
    title: '工作簿',
    hasFloatingObjects: false,
    ...overrides,
  };
  const view = renderHook(() => useSheetCommandSurface(deps));
  return { deps, media: view, actions: view.result.current.sheetActions };
}

beforeEach(() => {
  resetSheetIssues();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useSheetCommandSurface：引擎动作', () => {
  it('撤销 / 重做 / 插入图片都只是把事件转给对应入口', () => {
    const click = vi.fn();
    const { deps, actions } = makeDeps({ imageInputRef: { current: { click } as never } });

    actions.undo();
    actions.redo();
    actions.insertImage();
    actions.importXlsx();
    actions.importCsv();

    expect(deps.handleRef.current?.undo).toHaveBeenCalledTimes(1);
    expect(deps.handleRef.current?.redo).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    // .ods 走同一个入口：分流交给 checkImportFile，用户不必先认容器
    expect(deps.openImport).toHaveBeenNthCalledWith(1, '.xlsx,.xlsm,.ods');
    expect(deps.openImport).toHaveBeenNthCalledWith(2, '.csv');
  });

  it('没有实例时不抛错（句柄为 null 是最常见的时序）', () => {
    const { actions } = makeDeps({ handleRef: { current: null }, host: null });

    expect(() => actions.undo()).not.toThrow();
    expect(() => actions.openFormatCells()).not.toThrow();
  });
});

describe('useSheetCommandSurface：重命名', () => {
  it('取消 prompt 不重命名', () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => null),
    );
    const { deps, actions } = makeDeps();

    actions.renameSheet();

    expect(deps.renameSheet).not.toHaveBeenCalled();
  });

  it('只加空格 / 名字没变都不重命名，正常输入会 trim', () => {
    const { deps, actions } = makeDeps();

    vi.stubGlobal(
      'prompt',
      vi.fn(() => '   '),
    );
    actions.renameSheet();
    expect(deps.renameSheet).not.toHaveBeenCalled();

    vi.stubGlobal(
      'prompt',
      vi.fn(() => '明细'),
    );
    actions.renameSheet();
    expect(deps.renameSheet).not.toHaveBeenCalled();

    vi.stubGlobal(
      'prompt',
      vi.fn(() => '  汇总  '),
    );
    actions.renameSheet();
    expect(deps.renameSheet).toHaveBeenCalledWith('s1', '汇总');
  });

  it('没有活动表时复制 / 删除 / 重命名都不动作', () => {
    const prompt = vi.fn(() => 'x');
    vi.stubGlobal('prompt', prompt);
    const { deps, actions } = makeDeps({ activeSheet: null });

    actions.duplicateSheet();
    actions.deleteSheet();
    actions.renameSheet();

    expect(deps.duplicateSheet).not.toHaveBeenCalled();
    expect(deps.deleteSheet).not.toHaveBeenCalled();
    expect(prompt).not.toHaveBeenCalled();
  });
});

describe('useSheetCommandSurface：对话框开合前先快照', () => {
  it('数字格式框拿到的是当前格的格式码，不是上一次的值', () => {
    const { deps, actions } = makeDeps();

    actions.openNumberFormat();

    expect(deps.showNumberFormat).toHaveBeenCalledWith('#,##0.00');
  });

  it('设置单元格格式框快照整份格式；引擎未就绪时传 null 而不是拒绝打开', () => {
    const first = makeDeps();
    first.actions.openFormatCells();
    expect(first.deps.showFormatCells).toHaveBeenCalledWith(FORMAT);

    const second = makeDeps({ handleRef: { current: null } });
    second.actions.openFormatCells();
    expect(second.deps.showFormatCells).toHaveBeenCalledWith(null);
  });

  it('排序拿不到选区信息就不弹窗（不弹一个空对话框）', () => {
    const withRange = makeDeps();
    withRange.actions.openSort();
    expect(withRange.deps.showSort).toHaveBeenCalledWith(['销售额'], true);

    const withoutRange = makeDeps({
      host: makeHost({ describeSortRange: vi.fn(() => null) }),
    });
    withoutRange.actions.openSort();
    expect(withoutRange.deps.showSort).not.toHaveBeenCalled();
  });

  it('检查公式：没有选中公式时给空审计，而不是 undefined', () => {
    const { deps, actions } = makeDeps({ host: null });

    actions.checkFormulas();

    expect(deps.showFormulaReport).toHaveBeenCalledTimes(1);
    expect(deps.showFormulaReport).toHaveBeenCalledWith(
      expect.objectContaining({ formulas: 0, unsupported: [] }),
    );
  });

  it('超链接：取消不写、正常输入 trim 后写入', () => {
    const { deps, actions } = makeDeps();

    vi.stubGlobal(
      'prompt',
      vi.fn(() => null),
    );
    actions.promptHyperlink();
    expect(deps.handleRef.current?.setHyperlink).not.toHaveBeenCalled();

    vi.stubGlobal(
      'prompt',
      vi.fn(() => '  https://a.example  '),
    );
    actions.promptHyperlink();
    expect(deps.handleRef.current?.setHyperlink).toHaveBeenCalledWith('https://a.example');
  });
});

describe('useSheetCommandSurface：剪贴板', () => {
  it('剪贴板不可用时报 clipboardRead，而不是静默失败', () => {
    const issues: SheetIssue[] = [];
    const stop = subscribeSheetIssues((issue) => issues.push(issue));
    vi.stubGlobal('navigator', { clipboard: undefined });
    const { deps, actions } = makeDeps();

    actions.pasteFromClipboard();
    actions.copyToClipboard('x');
    stop();

    expect(issues.map((issue) => issue.code)).toEqual(['clipboardRead', 'clipboardWrite']);
    expect(deps.handleRef.current?.writeMatrix).not.toHaveBeenCalled();
  });

  it('粘贴纯空白不写矩阵（否则看起来"没反应"其实把选区清了）', async () => {
    vi.stubGlobal('navigator', { clipboard: { readText: vi.fn(async () => '   \n ') } });
    const { deps, actions } = makeDeps();

    actions.pasteFromClipboard();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.handleRef.current?.writeMatrix).not.toHaveBeenCalled();
  });

  it('粘贴有内容时解析成矩阵写回', async () => {
    vi.stubGlobal('navigator', { clipboard: { readText: vi.fn(async () => 'a\tb\n1\t2') } });
    const { deps, actions } = makeDeps();

    actions.pasteFromClipboard();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.handleRef.current?.writeMatrix).toHaveBeenCalledWith([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('useSheetCommandSurface：ribbonBase 派生的事实', () => {
  it('只有浮动对象的工作簿仍然可导出（导出写的是原生 xdr 部件）', () => {
    const empty = makeDeps({ summary: { sheets: 1, rows: 0, columns: 0, cells: 0, formulas: 0 } });

    expect(empty.media.result.current.ribbonBase.canExportXlsx).toBe(false);

    const withChart = makeDeps({
      summary: { sheets: 1, rows: 0, columns: 0, cells: 0, formulas: 0 },
      hasFloatingObjects: true,
    });

    expect(withChart.media.result.current.ribbonBase.canExportXlsx).toBe(true);
  });

  it('标题只有空格不算"有标题"，活动表名缺省为 null', () => {
    const { media } = makeDeps({ title: '   ', activeSheet: null });

    expect(media.result.current.ribbonBase.hasTitle).toBe(false);
    expect(media.result.current.ribbonBase.activeSheetName).toBeNull();
    expect(media.result.current.ribbonBase.hasActiveSheet).toBe(false);
  });
});
