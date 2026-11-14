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

/** P1-7 ①：多实例栏（列出 / 切换 / 新建 / 删除），以及"不传就不显示"的嵌入场景 */
describe('PivotPanel 多实例', () => {
  function renderInstances(overrides: Partial<PivotConfig> = {}) {
    const config = configOf(overrides);
    const snapshot = snapshotOf(SALES);
    const source = readPivotSource(snapshot, config);
    const result = computePivot(config, source);
    const callbacks = {
      onConfigChange: vi.fn(),
      onUseSelection: vi.fn(),
      onRefresh: vi.fn(),
      onRemove: vi.fn(),
      onClose: vi.fn(),
      onInsert: vi.fn(),
      onExport: vi.fn(),
      onPrint: vi.fn(),
      onSelect: vi.fn(),
      onCreate: vi.fn(),
      onDelete: vi.fn(),
    };
    render(
      <PivotPanel
        config={config}
        configs={[
          { ...config, id: 'pivot-1', name: '透视 A' },
          { ...config, id: 'pivot-2', name: '透视 B' },
        ]}
        fields={source.fields}
        result={result}
        empty={false}
        recordCount={source.records.length}
        keysByColumn={{}}
        inserted={false}
        {...callbacks}
      />,
    );
    return callbacks;
  }

  it('实例栏列出全部透视，切换时回传 id', () => {
    const callbacks = renderInstances();
    const select = screen.getByLabelText('tools.sheet.pivotSelect') as HTMLSelectElement;
    expect(within(select).getAllByRole('option')).toHaveLength(2);
    expect(within(select).getByText('透视 A')).toBeTruthy();
    fireEvent.change(select, { target: { value: 'pivot-2' } });
    expect(callbacks.onSelect).toHaveBeenCalledWith('pivot-2');
  });

  it('新建与删除按钮分别回传"新建"和"当前实例 id"', () => {
    const callbacks = renderInstances();
    fireEvent.click(screen.getByText('tools.sheet.pivotNew'));
    expect(callbacks.onCreate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('tools.sheet.pivotDelete'));
    expect(callbacks.onDelete).toHaveBeenCalledWith('pivot-1');
  });

  it('不传 configs 时不渲染实例栏（嵌入场景不该出现空下拉）', () => {
    renderPanel();
    expect(screen.queryByLabelText('tools.sheet.pivotSelect')).toBeNull();
  });
});

/** P1-7 ③：计算字段（四则运算 + [列名] 引用），错误必须当场说清楚 */
describe('PivotPanel 计算字段', () => {
  function lastConfig(callbacks: { onConfigChange: ReturnType<typeof vi.fn> }): PivotConfig {
    return callbacks.onConfigChange.mock.calls.at(-1)?.[0] as PivotConfig;
  }

  it('新建计算字段后同时写入定义与值字段', () => {
    const callbacks = renderPanel({ values: [] });
    fireEvent.click(screen.getByText('tools.sheet.pivotCalcAdd'));
    fireEvent.change(screen.getByLabelText('tools.sheet.pivotCalcName'), {
      target: { value: '双倍金额' },
    });
    fireEvent.change(screen.getByLabelText('tools.sheet.pivotCalcExpression'), {
      target: { value: '[金额] * 2' },
    });
    fireEvent.click(screen.getByText('tools.sheet.pivotCalcSave'));
    const next = lastConfig(callbacks);
    expect(next.calcFields).toEqual([{ id: 'calc-1', name: '双倍金额', expression: '[金额] * 2' }]);
    expect(next.values).toEqual([{ column: -1, aggregation: 'sum', calcId: 'calc-1' }]);
  });

  it('表达式引用不存在的字段时不能保存，并显示原因', () => {
    const callbacks = renderPanel({ values: [] });
    fireEvent.click(screen.getByText('tools.sheet.pivotCalcAdd'));
    fireEvent.change(screen.getByLabelText('tools.sheet.pivotCalcName'), {
      target: { value: '毛利' },
    });
    fireEvent.change(screen.getByLabelText('tools.sheet.pivotCalcExpression'), {
      target: { value: '[金额] - [不存在]' },
    });
    expect(screen.getByText('tools.sheet.pivotCalcUnknownField')).toBeTruthy();
    expect(screen.getByText('tools.sheet.pivotCalcSave')).toBeDisabled();
    expect(callbacks.onConfigChange).not.toHaveBeenCalled();
  });

  it('删除计算字段的值条目时，定义一起清掉', () => {
    const callbacks = renderPanel({
      values: [{ column: -1, aggregation: 'sum', calcId: 'calc-1' }],
      calcFields: [{ id: 'calc-1', name: '毛利', expression: '[金额] * 2' }],
    });
    fireEvent.click(screen.getByLabelText('毛利 ✕'));
    const next = lastConfig(callbacks);
    expect(next.values).toEqual([]);
    expect(next.calcFields).toEqual([]);
  });

  it('出错的字段在值区标出原因，而不是静默留空', () => {
    renderPanel({
      values: [{ column: -1, aggregation: 'sum', calcId: 'calc-1' }],
      calcFields: [{ id: 'calc-1', name: '毛利', expression: '[不存在] * 2' }],
    });
    expect(screen.getByText(/毛利: tools\.sheet\.pivotCalcUnknownField/)).toBeTruthy();
  });
});

/** P1-7 ④：同一字段可以既做行/列字段又做筛选；值字段不能再筛选（与 Excel 一致） */
describe('PivotPanel 字段跨区复用', () => {
  function lastConfig(callbacks: { onConfigChange: ReturnType<typeof vi.fn> }): PivotConfig {
    return callbacks.onConfigChange.mock.calls.at(-1)?.[0] as PivotConfig;
  }

  it('已经是筛选的字段再加进行区时，筛选不丢', () => {
    const callbacks = renderPanel({ rows: [], filters: { 0: [] } });
    fireEvent.click(screen.getByLabelText('区域 → tools.sheet.pivotRows'));
    const next = lastConfig(callbacks);
    expect(next.rows).toEqual([0]);
    expect(next.filters).toEqual({ 0: [] });
  });

  it('值字段不能再做筛选（值字段没有可分组的键）', () => {
    const callbacks = renderPanel({
      rows: [],
      values: [{ column: 2, aggregation: 'sum' }],
      filters: { 2: [] },
    });
    fireEvent.click(screen.getByLabelText('金额 → tools.sheet.pivotValues'));
    expect(lastConfig(callbacks).filters[2]).toBeUndefined();
  });

  it('从行区摘掉字段时，筛选保留', () => {
    const callbacks = renderPanel({ rows: [0], filters: { 0: [] } });
    // 行区与筛选区各有一个"区域 ✕"，行区那个在前
    fireEvent.click(screen.getAllByLabelText('区域 ✕')[0]);
    const next = lastConfig(callbacks);
    expect(next.rows).toEqual([]);
    expect(next.filters).toEqual({ 0: [] });
  });

  it('筛选区的 ✕ 只去掉筛选，行字段还在', () => {
    const callbacks = renderPanel({ rows: [0], filters: { 0: [] } });
    // 行区与筛选区各有一个"区域 ✕"，筛选区那个在最后
    const buttons = screen.getAllByLabelText('区域 ✕');
    fireEvent.click(buttons[buttons.length - 1]);
    const next = lastConfig(callbacks);
    expect(next.rows).toEqual([0]);
    expect(next.filters[0]).toBeUndefined();
  });
});
