import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SheetActions, SheetCommandContext, SheetRibbonHost } from '../commands';
import { SHEET_MOBILE_ACTIONS, SheetMobileBar } from './SheetMobileBar';

/** 只填命令用得到的字段；`host` / `format` 由组件自己拼 */
function makeCtx(
  overrides: Partial<SheetCommandContext> = {},
): Omit<SheetCommandContext, 'host' | 'format'> {
  return {
    // i18n 直通：断言里直接看到文案 key
    t: (key: string) => key,
    actions: {
      undo: vi.fn(),
      redo: vi.fn(),
      openFormatCells: vi.fn(),
      exportXlsx: vi.fn(),
    } as unknown as SheetActions,
    busy: false,
    cellCount: 3,
    canExportXlsx: true,
    sheetCount: 1,
    hasActiveSheet: true,
    activeSheetName: 'Sheet1',
    protectedSheet: false,
    hasTable: false,
    hasDocId: true,
    hasTitle: true,
    ...overrides,
  };
}

const fakeHost = {} as SheetRibbonHost;

describe('SheetMobileBar', () => {
  it('渲染 6 个动作，文案与图标都来自命令表', () => {
    render(<SheetMobileBar ctx={makeCtx()} host={fakeHost} />);

    expect(SHEET_MOBILE_ACTIONS).toHaveLength(6);
    expect(screen.getByTestId('sheet-mobile-bar')).toHaveAttribute(
      'aria-label',
      'tools.sheet.mobileBarLabel',
    );
    expect(screen.getByTestId('sheet-mobile-undo')).toHaveAttribute(
      'aria-label',
      'tools.sheet.undo',
    );
    expect(screen.getByTestId('sheet-mobile-exportXlsx')).toHaveAttribute(
      'aria-label',
      'tools.sheet.exportXlsx',
    );
  });

  it('点击直接执行对应命令', () => {
    const ctx = makeCtx();
    render(<SheetMobileBar ctx={ctx} host={fakeHost} />);

    fireEvent.click(screen.getByTestId('sheet-mobile-undo'));
    fireEvent.click(screen.getByTestId('sheet-mobile-redo'));
    fireEvent.click(screen.getByTestId('sheet-mobile-formatCells'));
    fireEvent.click(screen.getByTestId('sheet-mobile-exportXlsx'));

    expect(ctx.actions.undo).toHaveBeenCalledTimes(1);
    expect(ctx.actions.redo).toHaveBeenCalledTimes(1);
    expect(ctx.actions.openFormatCells).toHaveBeenCalledTimes(1);
    expect(ctx.actions.exportXlsx).toHaveBeenCalledTimes(1);
  });

  it('实例还没建好：需要 host 的动作全部禁用（不做"点了没反应"）', () => {
    render(<SheetMobileBar ctx={makeCtx()} host={null} />);

    expect(screen.getByTestId('sheet-mobile-formatCells')).toBeDisabled();
    expect(screen.getByTestId('sheet-mobile-autoSum')).toBeDisabled();
    expect(screen.getByTestId('sheet-mobile-clearContent')).toBeDisabled();
    // 撤销 / 重做 / 导出不依赖 host
    expect(screen.getByTestId('sheet-mobile-undo')).toBeEnabled();
  });

  it('受保护的工作表：编辑类禁用，导出仍可点', () => {
    render(<SheetMobileBar ctx={makeCtx({ protectedSheet: true })} host={fakeHost} />);

    expect(screen.getByTestId('sheet-mobile-autoSum')).toBeDisabled();
    expect(screen.getByTestId('sheet-mobile-clearContent')).toBeDisabled();
    expect(screen.getByTestId('sheet-mobile-exportXlsx')).toBeEnabled();
  });

  it('忙碌 / 空文档时导出禁用（沿用命令表的谓词）', () => {
    const { rerender } = render(<SheetMobileBar ctx={makeCtx({ busy: true })} host={fakeHost} />);
    expect(screen.getByTestId('sheet-mobile-exportXlsx')).toBeDisabled();

    rerender(<SheetMobileBar ctx={makeCtx({ canExportXlsx: false })} host={fakeHost} />);
    expect(screen.getByTestId('sheet-mobile-exportXlsx')).toBeDisabled();
  });

  it('给了 onEditCell 才出现「编辑」按钮，点击交给调用方（浮层由工具侧持有）', () => {
    const onEditCell = vi.fn();
    const { rerender } = render(
      <SheetMobileBar ctx={makeCtx()} host={fakeHost} onEditCell={onEditCell} />,
    );

    const edit = screen.getByTestId('sheet-mobile-edit-cell');
    expect(edit).toHaveTextContent('tools.sheet.cellEditOpen');
    fireEvent.click(edit);
    expect(onEditCell).toHaveBeenCalledTimes(1);

    // 嵌入场景（没有浮层）传空就不该出现这颗按钮，命令按钮数量不受影响
    rerender(<SheetMobileBar ctx={makeCtx()} host={fakeHost} />);
    expect(screen.queryByTestId('sheet-mobile-edit-cell')).toBeNull();
    expect(SHEET_MOBILE_ACTIONS).toHaveLength(6);
  });

  it('没有实例 / 忙碌 / 受保护时「编辑」禁用（与命令表同一套判断）', () => {
    const { rerender } = render(
      <SheetMobileBar ctx={makeCtx()} host={null} onEditCell={vi.fn()} />,
    );
    expect(screen.getByTestId('sheet-mobile-edit-cell')).toBeDisabled();

    rerender(<SheetMobileBar ctx={makeCtx({ busy: true })} host={fakeHost} onEditCell={vi.fn()} />);
    expect(screen.getByTestId('sheet-mobile-edit-cell')).toBeDisabled();

    rerender(
      <SheetMobileBar
        ctx={makeCtx({ protectedSheet: true })}
        host={fakeHost}
        onEditCell={vi.fn()}
      />,
    );
    expect(screen.getByTestId('sheet-mobile-edit-cell')).toBeDisabled();

    rerender(<SheetMobileBar ctx={makeCtx()} host={fakeHost} onEditCell={vi.fn()} />);
    expect(screen.getByTestId('sheet-mobile-edit-cell')).toBeEnabled();
  });
});
