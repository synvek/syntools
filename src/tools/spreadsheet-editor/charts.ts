import type { ToolResult } from '@/core/types';
import { columnIndexToName, parseCellRef, type WorkbookSnapshotLite } from './core';

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

/**
 * 工作表内图表的持久化配置。
 * 几何量为「相对工作表区域」的像素值，随快照保存（见 xlsx-io 的 syntoolsCharts）。
 */
export interface ChartConfig {
  id: string;
  type: ChartType;
  /** 数据区域（0 基闭区间） */
  range: ChartRange;
  /** 图表所属工作表：切换工作表后仍读取原表数据，并只在原表上显示 */
  sheetId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 区域 → A1 记法（"A1:C10"） */
export function buildRangeLabel(range: ChartRange): string {
  const startRow = Math.min(range.startRow, range.endRow);
  const endRow = Math.max(range.startRow, range.endRow);
  const startColumn = Math.min(range.startColumn, range.endColumn);
  const endColumn = Math.max(range.startColumn, range.endColumn);
  return `${columnIndexToName(startColumn)}${startRow + 1}:${columnIndexToName(endColumn)}${
    endRow + 1
  }`;
}

/** A1 记法 → 区域；非法返回 null（单格 "A1" 视为 1×1） */
export function parseRangeLabel(label: string): ChartRange | null {
  const text = label.trim();
  if (!text) return null;
  const [startRef, endRef] = text.split(':');
  const start = parseCellRef(startRef ?? '');
  const end = parseCellRef(endRef ?? startRef ?? '');
  if (!start || !end) return null;
  return {
    startRow: Math.min(start.row, end.row),
    startColumn: Math.min(start.column, end.column),
    endRow: Math.max(start.row, end.row),
    endColumn: Math.max(start.column, end.column),
  };
}

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

/** 系列的「引用」信息（导出 .xlsx 原生图表时用；行列为 0 基绝对坐标） */
export interface ChartSeriesRef {
  name: string;
  /** 系列名所在单元格；无表头时为 null（导出时改用 name 字面量） */
  nameCell: { row: number; column: number } | null;
  /** 值列（0 基绝对列号） */
  column: number;
  startRow: number;
  endRow: number;
  data: (number | null)[];
}

/**
 * 图表结构化解码：既含「值」（站内 ECharts 渲染 / 导出时的缓存），
 * 也含「引用」（导出为 Excel 原生图表的数据来源）。
 * 两者共用同一套判定，避免出现「站内画的和导出到 Excel 的不是一回事」。
 */
export interface ChartSpec {
  categories: string[];
  /** 分类列（0 基绝对列号）；null 表示无分类列（Excel 默认按 1..N） */
  categoryColumn: number | null;
  categoryStartRow: number;
  categoryEndRow: number;
  series: ChartSeriesRef[];
  rangeLabel: string;
}

/**
 * 单元格区域 → 图表结构（值 + 引用）。
 *
 * 约定（与常见表格软件一致）：
 * - 首列若为文本，用作分类轴；否则分类为 1..N；
 * - 首行在「值列」上若为文本，用作系列名，数据从第二行开始。
 */
export function resolveChart(
  snapshot: WorkbookSnapshotLite,
  sheetId: string | null,
  range: ChartRange,
): ToolResult<ChartSpec> {
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
  const dataStart = hasHeaderRow ? 1 : 0;
  const dataRows = rows.slice(dataStart);
  if (dataRows.length === 0) return { ok: false, error: 'EMPTY' };

  const categories = dataRows.map((line, index) => {
    if (!firstColumnIsText) return String(index + 1);
    return line[0].text || String(index + 1);
  });

  const series: ChartSeriesRef[] = [];
  for (let column = valueStart; column < columnCount; column += 1) {
    const absoluteColumn = startColumn + column;
    const fallback = columnIndexToName(absoluteColumn);
    series.push({
      name: hasHeaderRow ? rows[0][column].text || fallback : fallback,
      nameCell: hasHeaderRow ? { row: startRow, column: absoluteColumn } : null,
      column: absoluteColumn,
      startRow: startRow + dataStart,
      endRow,
      data: dataRows.map((line) => line[column].num),
    });
  }
  // 整列都是空值的系列不展示
  const usable = series.filter((item) => item.data.some((value) => value !== null));
  if (usable.length === 0) return { ok: false, error: 'EMPTY' };

  return {
    ok: true,
    value: {
      categories,
      categoryColumn: firstColumnIsText ? startColumn : null,
      categoryStartRow: startRow + dataStart,
      categoryEndRow: endRow,
      series: usable,
      rangeLabel: buildRangeLabel({ startRow, startColumn, endRow, endColumn }),
    },
  };
}

/** 区域 → 图表数据（站内渲染用；与 resolveChart 共用同一套判定） */
export function buildChartData(
  snapshot: WorkbookSnapshotLite,
  sheetId: string | null,
  range: ChartRange,
): ToolResult<ChartData> {
  const resolved = resolveChart(snapshot, sheetId, range);
  if (!resolved.ok) return resolved;
  const spec = resolved.value;
  return {
    ok: true,
    value: {
      categories: spec.categories,
      series: spec.series.map((item): ChartSeries => ({ name: item.name, data: item.data })),
      rangeLabel: spec.rangeLabel,
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
