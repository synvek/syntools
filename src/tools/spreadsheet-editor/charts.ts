import type { ToolResult } from '@/core/types';
import { columnIndexToName, type WorkbookSnapshotLite } from './core';

/**
 * 图表纯逻辑层：把工作表的单元格区域转成「分类 + 系列」，
 * 再生成 ECharts 配置。不依赖 echarts 运行时，可单独单测。
 */

export interface ChartRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

export interface ChartSeries {
  name: string;
  /** 与 categories 一一对应；空值 / 非数值为 null（折线断开，不误画为 0） */
  data: (number | null)[];
}

export interface ChartData {
  categories: string[];
  series: ChartSeries[];
  /** 数据区域标签（如 A1:C10），用于面板标题 */
  rangeLabel: string;
}

export type ChartType = 'bar' | 'line' | 'pie';

type LiteCell = { v?: unknown; f?: unknown } | undefined;

/** 单元格值 → 数值；文本数字也接受，非数值返回 null */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function toText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return '';
  return String(value);
}

/**
 * 单元格区域 → 图表数据。
 *
 * 约定（与常见表格软件一致）：
 * - 首列若为文本，用作分类轴；否则分类为 1..N；
 * - 首行在「值列」上若为文本，用作系列名，数据从第二行开始。
 */
export function buildChartData(
  snapshot: WorkbookSnapshotLite,
  sheetId: string | null,
  range: ChartRange,
): ToolResult<ChartData> {
  const order = snapshot.sheetOrder ?? [];
  const target = sheetId && snapshot.sheets?.[sheetId] ? sheetId : order[0];
  const sheet = target ? snapshot.sheets?.[target] : undefined;
  if (!sheet) return { ok: false, error: 'EMPTY' };

  const startRow = Math.max(0, Math.min(range.startRow, range.endRow));
  const endRow = Math.max(range.startRow, range.endRow);
  const startColumn = Math.max(0, Math.min(range.startColumn, range.endColumn));
  const endColumn = Math.max(range.startColumn, range.endColumn);

  const rows: { text: string; num: number | null }[][] = [];
  for (let row = startRow; row <= endRow; row += 1) {
    const line: { text: string; num: number | null }[] = [];
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = sheet.cellData?.[String(row)]?.[String(column)] as LiteCell;
      const value = cell?.v;
      line.push({ text: toText(value), num: toNumber(value) });
    }
    rows.push(line);
  }
  if (rows.length < 2) return { ok: false, error: 'EMPTY' };

  const columnCount = rows[0].length;
  // 首列是否为分类轴（首行之后存在非数值文本）
  const firstColumnIsText = rows
    .slice(1)
    .some((line) => line[0].num === null && line[0].text !== '');
  const valueStart = firstColumnIsText ? 1 : 0;
  if (valueStart >= columnCount) return { ok: false, error: 'EMPTY' };

  // 首行在值列上是否为表头
  const hasHeaderRow = rows[0]
    .slice(valueStart)
    .some((cell) => cell.num === null && cell.text !== '');
  const dataRows = rows.slice(hasHeaderRow ? 1 : 0);
  if (dataRows.length === 0) return { ok: false, error: 'EMPTY' };

  const categories = dataRows.map((line, index) => {
    if (!firstColumnIsText) return String(index + 1);
    return line[0].text || String(index + 1);
  });

  const series: ChartSeries[] = [];
  for (let column = valueStart; column < columnCount; column += 1) {
    const fallback = columnIndexToName(startColumn + column);
    const name = hasHeaderRow ? rows[0][column].text || fallback : fallback;
    series.push({ name, data: dataRows.map((line) => line[column].num) });
  }
  // 整列都是空值的系列不展示
  const usable = series.filter((item) => item.data.some((value) => value !== null));
  if (usable.length === 0) return { ok: false, error: 'EMPTY' };

  return {
    ok: true,
    value: {
      categories,
      series: usable,
      rangeLabel: `${columnIndexToName(startColumn)}${startRow + 1}:${columnIndexToName(
        endColumn,
      )}${endRow + 1}`,
    },
  };
}

/** 生成 ECharts 配置（饼图取第一个系列按分类切片；其余按分类轴多系列） */
export function buildChartOption(data: ChartData, type: ChartType): Record<string, unknown> {
  if (type === 'pie') {
    const first = data.series[0];
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, type: 'scroll' },
      series: [
        {
          type: 'pie',
          radius: ['34%', '64%'],
          data: data.categories.map((name, index) => ({
            name,
            value: first?.data[index] ?? null,
          })),
          label: { formatter: '{b}: {c}' },
        },
      ],
    };
  }
  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, type: 'scroll' },
    grid: { left: 12, right: 20, top: 24, bottom: 44, containLabel: true },
    xAxis: { type: 'category', data: data.categories },
    yAxis: { type: 'value' },
    series: data.series.map((item) => ({
      name: item.name,
      type,
      data: item.data,
      ...(type === 'line' ? { smooth: true } : {}),
    })),
  };
}
