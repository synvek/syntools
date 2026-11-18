import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SheetActions, SheetCommandContext } from '../commands';
import { SheetFooter, type SheetFooterProps } from './SheetFooter';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && 'count' in options ? `${key}:${String(options.count)}` : key,
  }),
}));

const SHEET = { id: 's1', name: '明细', hidden: false };

/** 工具条直接渲染真实子组件，所以命令上下文必须完整（只缺组件自己拼的 host / format） */
function makeCtx(
  overrides: Partial<SheetCommandContext> = {},
): Omit<SheetCommandContext, 'host' | 'format'> {
  return {
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
    activeSheetName: '明细',
    protectedSheet: false,
    hasTable: false,
    hasDocId: true,
    hasTitle: true,
    ...overrides,
  };
}

function makeProps(overrides: Partial<SheetFooterProps> = {}): SheetFooterProps {
  return {
    a11yStatus: 'B3，共 1 行 1 列，内容：销售额',
    tabs: {
      sheets: [SHEET] as never,
      activeId: 's1',
      onSelect: vi.fn(),
      onAdd: vi.fn(),
      onRename: vi.fn(),
      onDelete: vi.fn(),
      onDuplicate: vi.fn(),
      onToggleHidden: vi.fn(),
    },
    stats: [
      { label: '工作表', value: 1 },
      { label: '单元格', value: 4 },
    ],
    commentCount: 0,
    memory: '1.2 MB',
    narrow: false,
    mobileCtx: makeCtx(),
    mobileHost: null,
    onEditCell: vi.fn(),
    cellEdit: null,
    onCancelCellEdit: vi.fn(),
    onSubmitCellEdit: vi.fn(),
    ...overrides,
  };
}

describe('SheetFooter', () => {
  it('读屏播报槽永远是 live region（即使还没内容）', () => {
    render(<SheetFooter {...makeProps({ a11yStatus: '' })} />);

    const slot = screen.getByTestId('sheet-a11y-status');
    expect(slot).toHaveAttribute('aria-live', 'polite');
    expect(slot).toHaveAttribute('role', 'status');
    expect(slot).toHaveTextContent('');
  });

  it('状态栏列出全部统计与内存占用', () => {
    render(<SheetFooter {...makeProps()} />);

    expect(screen.getByText('工作表: 1')).toBeTruthy();
    expect(screen.getByText('单元格: 4')).toBeTruthy();
    expect(screen.getByText('common.memoryUsage')).toBeTruthy();
  });

  it('有批注时状态栏多一句，没有就不渲染', () => {
    const { rerender } = render(<SheetFooter {...makeProps({ commentCount: 2 })} />);
    expect(screen.getByText('tools.sheet.commentCount:2')).toBeTruthy();

    rerender(<SheetFooter {...makeProps({ commentCount: 0 })} />);
    expect(screen.queryByText('tools.sheet.commentCount:2')).toBeNull();
  });

  it('宽屏：工具条与改值浮层都不出现（即使传了 cellEdit）', () => {
    render(
      <SheetFooter {...makeProps({ narrow: false, cellEdit: { address: 'A1', value: 'x' } })} />,
    );

    expect(screen.queryByTestId('sheet-mobile-bar')).toBeNull();
    expect(screen.queryByTestId('sheet-cell-edit-sheet')).toBeNull();
  });

  it('窄屏：工具条出现；有 cellEdit 时才出现改值浮层', () => {
    const { rerender } = render(<SheetFooter {...makeProps({ narrow: true })} />);

    expect(screen.getByTestId('sheet-mobile-bar')).toBeTruthy();
    expect(screen.queryByTestId('sheet-cell-edit-sheet')).toBeNull();

    rerender(
      <SheetFooter {...makeProps({ narrow: true, cellEdit: { address: 'A1', value: 'x' } })} />,
    );
    expect(screen.getByTestId('sheet-cell-edit-sheet')).toBeTruthy();
    expect(screen.getByTestId('sheet-cell-edit-input')).toHaveValue('x');
  });
});
