import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SheetNotices, type SheetNoticesProps } from './SheetNotices';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && 'count' in options ? `${key}:${String(options.count)}` : key,
  }),
}));

function makeProps(overrides: Partial<SheetNoticesProps> = {}): SheetNoticesProps {
  return {
    chartEmpty: false,
    tableNotice: null,
    imageNotice: null,
    chartImport: null,
    runtimeError: false,
    storeStatus: { ok: true } as SheetNoticesProps['storeStatus'],
    onRetryStore: vi.fn(),
    onFreeSpace: vi.fn(),
    draftNotice: null,
    issueNotice: null,
    failure: null,
    ...overrides,
  };
}

describe('SheetNotices', () => {
  it('一切正常时什么都不渲染（不占位、不打断读屏）', () => {
    const { container } = render(<SheetNotices {...makeProps()} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryAllByRole('status')).toHaveLength(0);
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  it('图表选区为空 / 表格与图片的临时提示各自渲染', () => {
    render(
      <SheetNotices
        {...makeProps({ chartEmpty: true, tableNotice: '表头重复', imageNotice: '图太大' })}
      />,
    );

    expect(screen.getByText('tools.sheet.chartEmpty')).toBeTruthy();
    expect(screen.getByText('表头重复')).toBeTruthy();
    expect(screen.getByText('图太大')).toBeTruthy();
    expect(screen.getAllByRole('status')).toHaveLength(3);
  });

  it('导入报告：可编辑与保留各说一句，中间用分隔点', () => {
    render(
      <SheetNotices
        {...makeProps({
          chartImport: {
            editable: { total: 2, byType: { bar: 2 }, unknown: 0 },
            kept: { total: 1, byType: {}, unknown: 1 },
          },
        })}
      />,
    );

    const line = screen.getByRole('status');
    expect(line).toHaveTextContent('tools.sheet.chartImported:2');
    expect(line).toHaveTextContent('tools.sheet.chartKept:1');
    expect(line).toHaveTextContent('·');
  });

  it('导入报告：只有可编辑图表时不出现"原样保留"那句', () => {
    render(
      <SheetNotices
        {...makeProps({
          chartImport: {
            editable: { total: 1, byType: { line: 1 }, unknown: 0 },
            kept: { total: 0, byType: {}, unknown: 0 },
          },
        })}
      />,
    );

    expect(screen.getByRole('status')).not.toHaveTextContent('tools.sheet.chartKept');
  });

  it('草稿降级与彻底失败是两句话（一个可恢复、一个不能）', () => {
    const { rerender } = render(<SheetNotices {...makeProps({ draftNotice: 'degraded' })} />);
    expect(screen.getByText('tools.sheet.draftDegraded')).toBeTruthy();

    rerender(<SheetNotices {...makeProps({ draftNotice: 'failed' })} />);
    expect(screen.getByText('tools.sheet.draftSaveFailed')).toBeTruthy();
  });

  it('失败的点击提示按等级着色：notice 琥珀、error 红', () => {
    const { rerender } = render(
      <SheetNotices {...makeProps({ issueNotice: { code: 'clipboardRead', level: 'notice' } })} />,
    );
    expect(screen.getByTestId('sheet-issue-notice')).toHaveClass('text-amber-700');
    expect(screen.getByTestId('sheet-issue-notice')).toHaveTextContent(
      'tools.sheet.issue.clipboardRead',
    );

    rerender(
      <SheetNotices {...makeProps({ issueNotice: { code: 'cellEdit', level: 'error' } })} />,
    );
    expect(screen.getByTestId('sheet-issue-notice')).toHaveClass('text-red-600');
  });

  it('文档库不可用时出现可重试的提示', () => {
    render(
      <SheetNotices {...makeProps({ storeStatus: { ok: false, code: 'unavailable' } as never })} />,
    );

    const notice = screen.getByTestId('sheet-store-notice');
    expect(notice).toBeTruthy();
    expect(notice).toHaveTextContent('tools.sheet.storeUnavailable');
  });

  it('运行时崩溃与最后一次失败都用 alert 播报', () => {
    render(
      <SheetNotices
        {...makeProps({ runtimeError: true, failure: { ok: false, error: 'EXPORT_FAILED' } })}
      />,
    );

    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });
});
