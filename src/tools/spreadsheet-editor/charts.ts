import type { ToolResult } from '@/core/types';
import { columnIndexToName, parseCellRef, type WorkbookSnapshotLite } from './core';

/**
 * Chart pure-logic layer: turns a sheet cell range into "categories + series", then into an ECharts
 * option. No dependency on the echarts runtime, so it can be unit tested in isolation.
 */

export interface ChartRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

export interface ChartSeries {
  name: string;
  /** One entry per category; blank / non-numeric values are null (the line breaks instead of dropping to 0) */
  data: (number | null)[];
}

export interface ChartData {
  categories: string[];
  series: ChartSeries[];
  /** Data range label (e.g. A1:C10), used as the panel title */
  rangeLabel: string;
}

export type ChartType = 'bar' | 'line' | 'pie';

/**
 * Persisted config for an in-sheet chart.
 * Geometry is in pixels relative to the sheet area and is saved with the snapshot (see syntoolsCharts
 * in xlsx-io).
 */
export interface ChartConfig {
  id: string;
  type: ChartType;
  /** Data range (0-based inclusive) */
  range: ChartRange;
  /** Sheet the chart belongs to: it keeps reading that sheet and only shows on it after a sheet switch */
  sheetId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Range → A1 notation ("A1:C10") */
export function buildRangeLabel(range: ChartRange): string {
  const startRow = Math.min(range.startRow, range.endRow);
  const endRow = Math.max(range.startRow, range.endRow);
  const startColumn = Math.min(range.startColumn, range.endColumn);
  const endColumn = Math.max(range.startColumn, range.endColumn);
  return `${columnIndexToName(startColumn)}${startRow + 1}:${columnIndexToName(endColumn)}${
    endRow + 1
  }`;
}

/** A1 notation → range; null when invalid (a single cell "A1" is treated as 1×1) */
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

/** Cell value → number; numeric strings are accepted, anything else returns null */
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

/** A series' "reference" info (used when exporting a native .xlsx chart; rows/columns are 0-based absolute) */
export interface ChartSeriesRef {
  name: string;
  /** Cell holding the series name; null without a header row (the export then uses the literal name) */
  nameCell: { row: number; column: number } | null;
  /** Value column (0-based absolute index) */
  column: number;
  startRow: number;
  endRow: number;
  data: (number | null)[];
}

/**
 * Resolved chart structure: carries both the values (for in-app ECharts rendering and export caches)
 * and the references (the data source for native Excel charts). Both come from the same resolution,
 * so what the app draws and what Excel receives can never diverge.
 */
export interface ChartSpec {
  categories: string[];
  /** Category column (0-based absolute index); null means no category column (Excel uses 1..N) */
  categoryColumn: number | null;
  categoryStartRow: number;
  categoryEndRow: number;
  series: ChartSeriesRef[];
  rangeLabel: string;
}

/**
 * Cell range → chart structure (values + references).
 *
 * Conventions (same as common spreadsheet apps):
 * - if the first column is text, it becomes the category axis; otherwise categories are 1..N;
 * - if the first row of the value columns is text, it becomes the series names and data starts on
 *   the second row.
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
  // Whether the first column is the category axis (non-numeric text exists below the first row)
  const firstColumnIsText = rows
    .slice(1)
    .some((line) => line[0].num === null && line[0].text !== '');
  const valueStart = firstColumnIsText ? 1 : 0;
  if (valueStart >= columnCount) return { ok: false, error: 'EMPTY' };

  // Whether the first row of the value columns is a header
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
  // Series whose column is entirely empty are dropped
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

/** Range → chart data (for in-app rendering; shares the resolution logic with resolveChart) */
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

/** Build an ECharts option (a pie slices the first series by category; the rest use a category axis with multiple series) */
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
