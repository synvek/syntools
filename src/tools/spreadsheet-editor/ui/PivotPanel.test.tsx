import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.restoreAllMocks());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { computePivot, readPivotSource, type PivotConfig } from '../pivot';
import { PivotPanel } from './PivotPanel';

/** P2-4.4 交叉表 UI：字段分配、合计行列、空值/空源提示 */

const SALES: unknown[][] = [
  ['区域', '季度', '金额'],
  ['华东', 'Q1', 100],
  ['华东', 'Q2', 50],
  ['华南', 'Q1', 30],
  ['华南', 'Q2', 20],
];

function snapshotOf(rows: unknown[][]) {
  const cellData: Record<string, Record<string, { v?: unknown }>> = {};
  rows.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      cellData[String(rowIndex)] ??= {};
      cellData[String(rowIndex)][String(colIndex)] = { v: value };
    });
  });
  return { sheets: { s1: { cellData } } };
}

function configOf(overrides: Partial<PivotConfig> = {}): PivotConfig {
  return {
    id: 'pivot-1',
    name: '透视表',
    sheetId: 's1',
    range: { startRow: 0, startColumn: 0, endRow: 4, endColumn: 2 },
    rows: [0],
    cols: [1],
    values: [{ column: 2, aggregation: 'sum' }],
    filters: {},
    hasHeader: true,
    ...overrides,
  };
}

function renderPanel(
  overrides: Partial<PivotConfig> = {},
  rows: unknown[][] = SALES,
  inserted = false,
) {
  const config = configOf(overrides);
  const snapshot = snapshotOf(rows);
  const source = readPivotSource(snapshot, config);
  const result = computePivot(config, source);
  const callbacks = {
    onConfigChange: vi.fn(),
    onUseSelection: vi.fn(),
    onRefresh: vi.fn(),
    onRemove: vi.fn(),
    onClose: vi.fn(),
    onInsert: vi.fn(),
    inserted,
    onExport: vi.fn(),
    onPrint: vi.fn(),
  };
  render(
    <PivotPanel
      config={config}
      fields={source.fields}
      result={result}
      empty={source.records.length === 0}
      recordCount={source.records.length}
      keysByColumn={{
        0: [
          { key: 't:华东', label: '华东' },
          { key: 't:华南', label: '华南' },
        ],
      }}
      {...callbacks}
    />,
  );
  return callbacks;
}

describe('PivotPanel', () => {
  it('renders the cross table with row/column totals', () => {
    renderPanel();
    const table = within(screen.getByTestId('sheet-pivot')).getByRole('table');
    const rows = within(table).getAllByRole('row');
    // 表头 + 2 行 + 合计行
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('华东');
    expect(rows[1]).toHaveTextContent('100');
    expect(rows[1]).toHaveTextContent('150');
    // 最后一行的总计
    expect(rows[3]).toHaveTextContent('130');
    expect(rows[3]).toHaveTextContent('200');
  });

  it('assigns a field to rows when its zone button is clicked', () => {
    const { onConfigChange } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '季度 → tools.sheet.pivotRows' }));
    expect(onConfigChange).toHaveBeenCalledTimes(1);
    const next = onConfigChange.mock.calls[0][0] as PivotConfig;
    expect(next.rows).toEqual([0, 1]);
    // 同一字段不能同时留在列区
    expect(next.cols).toEqual([]);
  });

  it('removes a field from its zone', () => {
    const { onConfigChange } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '区域 ✕' }));
    const next = onConfigChange.mock.calls[0][0] as PivotConfig;
    expect(next.rows).toEqual([]);
  });

  it('changes the aggregation of the value field', () => {
    const { onConfigChange } = renderPanel();
    fireEvent.change(screen.getByLabelText('金额 tools.sheet.pivotValues'), {
      target: { value: 'avg' },
    });
    const next = onConfigChange.mock.calls[0][0] as PivotConfig;
    expect(next.values).toEqual([{ column: 2, aggregation: 'avg' }]);
  });

  it('shows the empty hint and disables export when the source has no data', () => {
    renderPanel({}, [['区域', '季度', '金额']]);
    expect(screen.getByText('tools.sheet.pivotEmpty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tools.sheet.pivotExportXlsx' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'tools.sheet.pivotInsertDoc' })).toBeDisabled();
  });

  it('inserts the pivot into the document', () => {
    const { onInsert } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'tools.sheet.pivotInsertDoc' }));
    expect(onInsert).toHaveBeenCalledTimes(1);
  });

  it('offers update instead of insert once the sheet exists', () => {
    renderPanel({}, SALES, true);
    expect(screen.getByRole('button', { name: 'tools.sheet.pivotUpdateDoc' })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'tools.sheet.pivotInsertDoc' }),
    ).not.toBeInTheDocument();
  });

  it('toggles a filter value without dropping the field', () => {
    const { onConfigChange } = renderPanel({ filters: { 0: [] } });
    fireEvent.click(screen.getByRole('button', { name: '区域 tools.sheet.pivotFilters' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '华东' }));
    const next = onConfigChange.mock.calls[0][0] as PivotConfig;
    expect(next.filters[0]).toEqual(['t:华东']);
  });
});
