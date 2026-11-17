import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkbookSnapshot } from '../xlsx-io';
import { useSheetFileIo, type UseFileIoOptions } from './useSheetFileIo';

const deps = vi.hoisted(() => ({
  odsToSnapshot: vi.fn(),
  checkImportFile: vi.fn(),
  buildExportFilename: vi.fn((name: string, ext: string) => `${name}.${ext}`),
  sanitizeFilename: vi.fn((name: string) => name.replace(/\s+/g, '-')),
  csvToSnapshot: vi.fn(),
  snapshotToCsv: vi.fn(),
  importXlsxToSnapshot: vi.fn(),
  exportSnapshotToBytes: vi.fn(),
  collectExportIssues: vi.fn(() => []),
  appendPivotSheets: vi.fn((snapshot: unknown) => snapshot),
  renderChartImages: vi.fn(async () => ({ 'chart-1': 'data:image/png;base64,x' })),
  printSheet: vi.fn(),
  exportSheetPdf: vi.fn(),
  downloadBytes: vi.fn(),
  createFidelityReport: vi.fn((tool: string, dir: string, issues: unknown[]) => ({
    tool,
    operation: dir,
    issues,
  })),
  isFidelityMuted: vi.fn(() => false),
}));

vi.mock('../core', () => ({
  CSV_BOM: '\uFEFF',
  buildExportFilename: deps.buildExportFilename,
  checkImportFile: deps.checkImportFile,
  sanitizeFilename: deps.sanitizeFilename,
}));
vi.mock('../csv', () => ({
  csvToSnapshot: deps.csvToSnapshot,
  snapshotToCsv: deps.snapshotToCsv,
}));
vi.mock('../ods', () => ({ odsToSnapshot: deps.odsToSnapshot }));
vi.mock('../xlsx-io', () => ({
  importXlsxToSnapshot: deps.importXlsxToSnapshot,
  exportSnapshotToBytes: deps.exportSnapshotToBytes,
}));
vi.mock('../fidelity', () => ({ collectExportIssues: deps.collectExportIssues }));
vi.mock('../pivotSheet', () => ({ appendPivotSheets: deps.appendPivotSheets }));
vi.mock('../chartRender', () => ({ renderChartImages: deps.renderChartImages }));
vi.mock('../print', () => ({
  printSheet: deps.printSheet,
  exportSheetPdf: deps.exportSheetPdf,
}));
vi.mock('@/core/pdf/download', () => ({ downloadBytes: deps.downloadBytes }));
vi.mock('@/core/fidelity', () => ({
  createFidelityReport: deps.createFidelityReport,
  isFidelityMuted: deps.isFidelityMuted,
}));

const SNAPSHOT = { sheetOrder: ['s1'], sheets: { s1: {} } } as unknown as WorkbookSnapshot;

function fakeHandle(overrides: Record<string, unknown> = {}) {
  return {
    getSnapshot: () => SNAPSHOT,
    getActiveSheetId: () => 's1',
    getActiveRange: () => ({ startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 }),
    ...overrides,
  };
}

function setup(overrides: Partial<UseFileIoOptions> = {}) {
  const handleRef = { current: fakeHandle() as never };
  const input = { accept: '', click: vi.fn(), current: null as HTMLInputElement | null };
  const importInputRef = { current: input as unknown as HTMLInputElement };
  const setBusy = vi.fn();
  const setFailure = vi.fn();
  const withDocOwnedContent = vi.fn((base: WorkbookSnapshot) => base);
  const applySnapshot = vi.fn();
  const persistNow = vi.fn();
  const flushDocSave = vi.fn();
  const options: UseFileIoOptions = {
    handleRef,
    title: '预算',
    locale: 'zhCN',
    importInputRef,
    setBusy,
    setFailure,
    withDocOwnedContent,
    applySnapshot,
    persistNow,
    flushDocSave,
    pivotConfigsRef: { current: [] },
    pivotValueLabelOf: (block) => block.label,
    chartDataMap: { 'chart-1': null },
    pivotBlankLabel: '(空白)',
    pivotValuesCaption: '值',
    ...overrides,
  };
  const view = renderHook(() => useSheetFileIo(options));
  return {
    view,
    handleRef,
    input,
    setBusy,
    setFailure,
    withDocOwnedContent,
    applySnapshot,
    persistNow,
    flushDocSave,
  };
}

function fileOf(name: string, text = 'a,b\n1,2'): File {
  return { name, text: async () => text } as unknown as File;
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.checkImportFile.mockReturnValue({ ok: true, value: 'xlsx' });
  deps.odsToSnapshot.mockResolvedValue({ ok: true, value: { ...SNAPSHOT, name: '导入' } });
  deps.importXlsxToSnapshot.mockResolvedValue({ ok: true, value: { ...SNAPSHOT, name: '导入' } });
  deps.exportSnapshotToBytes.mockResolvedValue({ ok: true, value: new Uint8Array([1]) });
  deps.snapshotToCsv.mockReturnValue({ ok: true, value: 'a,b\n1,2' });
  deps.csvToSnapshot.mockReturnValue({ ok: true, value: { ...SNAPSHOT, name: '表' } });
  deps.printSheet.mockResolvedValue({ ok: true, value: undefined });
  deps.exportSheetPdf.mockResolvedValue({ ok: true, value: new Uint8Array([2]) });
  deps.collectExportIssues.mockReturnValue([]);
  deps.isFidelityMuted.mockReturnValue(false);
});

describe('useSheetFileIo', () => {
  it('openImport 只把文件对话框限制到指定类型再点一下', () => {
    const { view, input } = setup();
    act(() => view.result.current.openImport('.csv'));
    expect(input.accept).toBe('.csv');
    expect(input.click).toHaveBeenCalled();
  });

  it('没有 input 元素时 openImport 是空操作（不抛异常）', () => {
    const { view } = setup({ importInputRef: { current: null } });
    expect(() => view.result.current.openImport('.csv')).not.toThrow();
  });

  it('导入类型不被接受：报错、不落盘、进度条复位', async () => {
    deps.checkImportFile.mockReturnValue({ ok: false, error: 'UNSUPPORTED_FORMAT' });
    const { view, setFailure, applySnapshot, persistNow } = setup();
    await act(() => view.result.current.importFile(fileOf('x.exe')));
    expect(setFailure).toHaveBeenCalledWith({ ok: false, error: 'UNSUPPORTED_FORMAT' });
    expect(applySnapshot).not.toHaveBeenCalled();
    expect(persistNow).not.toHaveBeenCalled();
    expect(view.result.current.printTarget).toBeNull();
  });

  it('导入失败（解析不了）：只报错，绝不用半成品覆盖当前文档', async () => {
    deps.importXlsxToSnapshot.mockResolvedValue({ ok: false, error: 'PART_UNREADABLE' });
    const { view, setFailure, applySnapshot, flushDocSave } = setup();
    await act(() => view.result.current.importFile(fileOf('a.xlsx')));
    expect(setFailure).toHaveBeenCalledWith({ ok: false, error: 'PART_UNREADABLE' });
    expect(applySnapshot).not.toHaveBeenCalled();
    expect(flushDocSave).not.toHaveBeenCalled();
  });

  it('导入成功：灌快照 + 立即落库（标题为空时用文件名）', async () => {
    const { view, applySnapshot, persistNow, flushDocSave, setBusy } = setup({ title: '  ' });
    await act(() => view.result.current.importFile(fileOf('a.xlsx')));
    expect(applySnapshot).toHaveBeenCalledWith(expect.objectContaining({ name: '导入' }), '导入');
    expect(persistNow).toHaveBeenCalledWith('导入');
    expect(flushDocSave).toHaveBeenCalled();
    expect(setBusy).toHaveBeenLastCalledWith(null);
  });

  it('导入有保真告警：弹同一个对话框（operation = import）', async () => {
    deps.importXlsxToSnapshot.mockImplementation(async (_file, outcome: { issues: string[] }) => {
      outcome.issues.push('sheet.importChartsheet');
      return { ok: true, value: SNAPSHOT };
    });
    const { view } = setup();
    await act(() => view.result.current.importFile(fileOf('a.xlsx')));
    expect(deps.createFidelityReport).toHaveBeenCalledWith('sheet', 'import', [
      'sheet.importChartsheet',
    ]);
    expect(view.result.current.fidelity).not.toBeNull();
  });

  it('保真报告被静音时导入不弹框', async () => {
    deps.isFidelityMuted.mockReturnValue(true);
    deps.importXlsxToSnapshot.mockImplementation(async (_file, outcome: { issues: string[] }) => {
      outcome.issues.push('sheet.importMacros');
      return { ok: true, value: SNAPSHOT };
    });
    const { view } = setup();
    await act(() => view.result.current.importFile(fileOf('a.xlsx')));
    expect(deps.createFidelityReport).not.toHaveBeenCalled();
    expect(view.result.current.fidelity).toBeNull();
  });

  it('按扩展名分流：ODS 走 OpenDocument 解析器，保真报告同样能收到样式损失', async () => {
    deps.checkImportFile.mockReturnValue({ ok: true, value: 'ods' });
    deps.odsToSnapshot.mockImplementation(async (_file, outcome: { issues: unknown[] }) => {
      outcome.issues.push({ code: 'sheet.importOdsStyleLoss', severity: 'info', count: 3 });
      return { ok: true, value: SNAPSHOT };
    });
    const { view, persistNow } = setup({ title: '' });
    await act(() => view.result.current.importFile(fileOf('a.ods')));
    expect(deps.odsToSnapshot).toHaveBeenCalled();
    expect(deps.importXlsxToSnapshot).not.toHaveBeenCalled();
    expect(persistNow).toHaveBeenCalled();
    expect(view.result.current.fidelity).not.toBeNull();
  });

  it('按扩展名分流：CSV 走纯逻辑解析器，不碰 exceljs', async () => {
    deps.checkImportFile.mockReturnValue({ ok: true, value: 'csv' });
    const { view, applySnapshot } = setup();
    await act(() => view.result.current.importFile(fileOf('数据.csv')));
    expect(deps.csvToSnapshot).toHaveBeenCalledWith('a,b\n1,2', '数据', 'zhCN');
    expect(deps.importXlsxToSnapshot).not.toHaveBeenCalled();
    expect(applySnapshot).toHaveBeenCalled();
  });

  it('导出成功：下载 xlsx + 给保真报告', async () => {
    const { view, withDocOwnedContent } = setup();
    await act(() => view.result.current.exportXlsx());
    expect(withDocOwnedContent).toHaveBeenCalled();
    expect(deps.appendPivotSheets).toHaveBeenCalled();
    expect(deps.downloadBytes).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      '预算.xlsx',
      expect.stringContaining('spreadsheetml'),
    );
    expect(view.result.current.fidelity).not.toBeNull();
  });

  it('导出失败：报错且不下载任何东西', async () => {
    deps.exportSnapshotToBytes.mockResolvedValue({ ok: false, error: 'EXPORT_FAILED' });
    const { view, setFailure } = setup();
    await act(() => view.result.current.exportXlsx());
    expect(setFailure).toHaveBeenCalledWith({ ok: false, error: 'EXPORT_FAILED' });
    expect(deps.downloadBytes).not.toHaveBeenCalled();
  });

  it('引擎还没建好时导出是空操作：不点亮进度条也不报错', async () => {
    const { view, setBusy, setFailure } = setup({ handleRef: { current: null } });
    await act(() => view.result.current.exportXlsx());
    expect(setBusy).not.toHaveBeenCalled();
    expect(setFailure).not.toHaveBeenCalled();
    expect(deps.downloadBytes).not.toHaveBeenCalled();
  });

  it('CSV 导出带 BOM（Excel 打开中文不乱码）', () => {
    const { view } = setup();
    act(() => view.result.current.exportCsv());
    const bytes = deps.downloadBytes.mock.calls[0][0] as Uint8Array;
    // TextDecoder 默认会吃掉 BOM，所以直接看字节：EF BB BF
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(deps.downloadBytes.mock.calls[0][1]).toBe('预算.csv');
    expect(deps.downloadBytes.mock.calls[0][2]).toBe('text/csv;charset=utf-8');
  });

  it('CSV 导出失败：报错不下载', () => {
    deps.snapshotToCsv.mockReturnValue({ ok: false, error: 'EXPORT_FAILED' });
    const { view, setFailure } = setup();
    act(() => view.result.current.exportCsv());
    expect(setFailure).toHaveBeenCalledWith({ ok: false, error: 'EXPORT_FAILED' });
    expect(deps.downloadBytes).not.toHaveBeenCalled();
  });

  it('打开打印对话框时把快照与选区定格', () => {
    const { view, withDocOwnedContent } = setup();
    act(() => view.result.current.openPrint());
    expect(withDocOwnedContent).toHaveBeenCalled();
    expect(view.result.current.printTarget).toEqual({
      snapshot: SNAPSHOT,
      sheetId: 's1',
      selection: { startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 },
    });
  });

  it('没有实例时不开打印对话框', () => {
    const { view } = setup({ handleRef: { current: null } });
    act(() => view.result.current.openPrint());
    expect(view.result.current.printTarget).toBeNull();
  });

  it('打印成功：关掉对话框并复位进度', async () => {
    const { view, setBusy } = setup();
    act(() => view.result.current.openPrint());
    await act(() => view.result.current.print({} as never, null));
    expect(deps.printSheet).toHaveBeenCalled();
    expect(view.result.current.printTarget).toBeNull();
    expect(setBusy).toHaveBeenLastCalledWith(null);
  });

  it('弹窗被浏览器拦：退回 PDF 下载，而不是让用户对着错误提示发呆', async () => {
    deps.printSheet.mockResolvedValue({ ok: false, error: 'PRINT_BLOCKED' });
    const { view } = setup();
    act(() => view.result.current.openPrint());
    await act(() => view.result.current.print({} as never, null));
    expect(deps.exportSheetPdf).toHaveBeenCalled();
    expect(deps.downloadBytes).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      '预算.pdf',
      'application/pdf',
    );
    expect(view.result.current.printTarget).toBeNull();
  });

  it('打印的其他失败：报错并保留对话框（用户可以改设置重试）', async () => {
    deps.printSheet.mockResolvedValue({ ok: false, error: 'PRINT_FAILED' });
    const { view, setFailure } = setup();
    act(() => view.result.current.openPrint());
    await act(() => view.result.current.print({} as never, null));
    expect(setFailure).toHaveBeenCalledWith({ ok: false, error: 'PRINT_FAILED' });
    expect(view.result.current.printTarget).not.toBeNull();
    expect(deps.exportSheetPdf).not.toHaveBeenCalled();
  });

  it('导出 PDF：成功下载，没有打印目标时是空操作', async () => {
    const { view } = setup();
    act(() => view.result.current.openPrint());
    await act(() => view.result.current.exportPdf({} as never, null));
    expect(deps.downloadBytes).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      '预算.pdf',
      'application/pdf',
    );

    deps.downloadBytes.mockClear();
    const { view: empty } = setup();
    await act(() => empty.result.current.exportPdf({} as never, null));
    expect(deps.downloadBytes).not.toHaveBeenCalled();
  });

  it('打印只渲染本表图表，且数据取最新一份（应用内看到什么，打印就是什么）', async () => {
    const snapshot = {
      sheetOrder: ['s1', 's2'],
      sheets: { s1: {}, s2: {} },
      syntoolsCharts: [
        { id: 'c1', sheetId: 's1' },
        { id: 'c2', sheetId: 's2' },
      ],
    } as unknown as WorkbookSnapshot;
    const { view } = setup({
      handleRef: { current: fakeHandle({ getSnapshot: () => snapshot }) as never },
      chartDataMap: { c1: { categories: ['A'], series: [] } as never },
    });
    act(() => view.result.current.openPrint());
    await act(() => view.result.current.print({} as never, null));
    const [charts, dataOf] = deps.renderChartImages.mock.calls[0] as unknown as [
      { id: string }[],
      (chart: { id: string }) => unknown,
    ];
    // 别的表上的图表不进这次打印
    expect(charts.map((chart) => chart.id)).toEqual(['c1']);
    expect(dataOf({ id: 'c1' })).toEqual({ categories: ['A'], series: [] });
    await waitFor(() => expect(deps.printSheet).toHaveBeenCalled());
  });
});
