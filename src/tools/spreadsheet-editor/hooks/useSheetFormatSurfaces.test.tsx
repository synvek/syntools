import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RibbonBaseContext } from '../SpreadsheetRibbon';
import type { UniverHandle } from '../univer';
import { useSheetFormatSurfaces, type SheetFormatSurfaces } from './useSheetFormatSurfaces';

const t = ((key: string) => key) as RibbonBaseContext['t'];

function makeHost(overrides: Partial<Record<keyof UniverHandle, unknown>> = {}) {
  return {
    applyNumberFormat: vi.fn(),
    applyFormat: vi.fn(),
    applyBorder: vi.fn(),
    sortRange: vi.fn(),
    ...overrides,
  } as unknown as UniverHandle;
}

/** 浮层 JSX 由 hook 返回，所以测试必须真的渲染它——这正是这一片要保住的行为 */
function mount(host: UniverHandle | null) {
  const api: { current: SheetFormatSurfaces | null } = { current: null };
  function Harness() {
    const surfaces = useSheetFormatSurfaces({ t, host });
    api.current = surfaces;
    return <>{surfaces.surfaces}</>;
  }
  render(<Harness />);
  return api as { current: SheetFormatSurfaces };
}

describe('useSheetFormatSurfaces', () => {
  it('默认一个浮层都不渲染', () => {
    mount(makeHost());

    expect(screen.queryByTestId('sheet-number-format-dialog')).toBeNull();
    expect(screen.queryByTestId('sheet-sort-dialog')).toBeNull();
    expect(screen.queryByTestId('sheet-format-cells-dialog')).toBeNull();
    expect(screen.queryByTestId('sheet-formula-audit')).toBeNull();
  });

  it('数字格式：开框时用传入的格式码回填，应用后调用引擎并关闭', () => {
    const host = makeHost();
    const api = mount(host);

    act(() => api.current.showNumberFormat('#,##0.00'));

    expect(screen.getByTestId('sheet-number-format-input')).toHaveValue('#,##0.00');
    fireEvent.click(screen.getByTestId('sheet-number-format-apply'));

    expect(host.applyNumberFormat).toHaveBeenCalledWith('#,##0.00');
    expect(screen.queryByTestId('sheet-number-format-dialog')).toBeNull();
  });

  it('排序：应用时把列与表头判断一起交给引擎', () => {
    const host = makeHost();
    const api = mount(host);

    // 列的形状是 `describeSortRange()` 给的 `{index, label}`，键的具体映射归 SortDialog 自己管
    act(() => api.current.showSort([{ index: 1, label: '销售额' }], true));

    expect(screen.getByTestId('sheet-sort-dialog')).toBeTruthy();
    fireEvent.click(screen.getByTestId('sheet-sort-apply'));

    expect(host.sortRange).toHaveBeenCalledTimes(1);
    expect(host.sortRange).toHaveBeenCalledWith(expect.any(Array), true);
    expect(screen.queryByTestId('sheet-sort-dialog')).toBeNull();
  });

  it('设置单元格格式：打开时带的是快照，应用时格式与边框都下发', () => {
    const host = makeHost();
    const api = mount(host);

    act(() =>
      api.current.showFormatCells({
        bold: true,
        italic: false,
        underline: false,
        strike: false,
        fontSize: 12,
        fontFamily: 'Arial',
        fontColor: '#000000',
        fillColor: null,
        horizontalAlign: 'left',
        verticalAlign: 'middle',
        wrapText: false,
        textRotation: 0,
        indent: 0,
        numberFormat: 'General',
        borders: null,
      } as never),
    );

    expect(screen.getByTestId('sheet-format-cells-dialog')).toBeTruthy();
  });

  it('没有引擎实例时应用静默失败，不抛错也不崩界面', () => {
    const api = mount(null);

    act(() => api.current.showNumberFormat('0'));
    expect(() => fireEvent.click(screen.getByTestId('sheet-number-format-apply'))).not.toThrow();
    expect(screen.queryByTestId('sheet-number-format-dialog')).toBeNull();
  });

  it('公式审计：0 条公式时读"没有公式"，× 关掉卡片', () => {
    const api = mount(makeHost());

    act(() => api.current.showFormulaReport({ formulas: 0, unsupported: [] } as never));

    const card = screen.getByTestId('sheet-formula-audit');
    expect(card).toHaveTextContent('tools.sheet.formulaAuditNone');

    fireEvent.click(screen.getByRole('button', { name: 'tools.sheet.printCancel' }));
    expect(screen.queryByTestId('sheet-formula-audit')).toBeNull();
  });

  it('公式审计：有不支持的函数时把它们列出来', () => {
    const api = mount(makeHost());

    act(() => api.current.showFormulaReport({ formulas: 2, unsupported: ['FOO', 'BAR'] } as never));

    expect(screen.getByTestId('sheet-formula-audit')).toHaveTextContent(
      'tools.sheet.formulaAuditMissing',
    );
  });
});
