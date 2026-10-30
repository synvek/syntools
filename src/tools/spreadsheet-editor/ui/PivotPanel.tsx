import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PivotAggregation, PivotConfig, PivotField, PivotKey, PivotResult } from '../pivot';
import { PIVOT_AGGREGATIONS } from '../pivot';

/**
 * 透视表面板（P2-4.4）：字段区（行/列/值/筛选）+ 交叉表结果 + 合计行列。
 *
 * 纯受控：配置与结果都由 `SpreadsheetTool` 提供，面板只负责"改配置"和"展示"。
 * 这样"源数据变更即重算"落在一处（工具层），面板不需要知道 Univer 的存在。
 */

type Zone = 'rows' | 'cols' | 'values' | 'filters';

interface PivotPanelProps {
  config: PivotConfig;
  /** 源区域里可用的字段（含表头名） */
  fields: PivotField[];
  result: PivotResult | null;
  /** 源区域没有任何记录 */
  empty: boolean;
  /** 参与聚合的记录数（截断提示用） */
  recordCount: number;
  /** 每个字段的可选键（筛选列表用，由工具层从源数据算好） */
  keysByColumn: Record<number, { key: string; label: string }[]>;
  onConfigChange: (next: PivotConfig) => void;
  onUseSelection: () => void;
  onRefresh: () => void;
  onRemove: () => void;
  onClose: () => void;
  onExport: () => void;
  onPrint: () => void;
}

const AGGREGATION_KEYS: Record<PivotAggregation, string> = {
  sum: 'tools.sheet.pivotSum',
  count: 'tools.sheet.pivotCount',
  avg: 'tools.sheet.pivotAvg',
  min: 'tools.sheet.pivotMin',
  max: 'tools.sheet.pivotMax',
};

const ZONE_LABEL: Record<Zone, string> = {
  rows: 'tools.sheet.pivotRows',
  cols: 'tools.sheet.pivotCols',
  values: 'tools.sheet.pivotValues',
  filters: 'tools.sheet.pivotFilters',
};

export function PivotPanel({
  config,
  fields,
  result,
  empty,
  recordCount,
  keysByColumn,
  onConfigChange,
  onUseSelection,
  onRefresh,
  onRemove,
  onClose,
  onExport,
  onPrint,
}: PivotPanelProps) {
  const { t } = useTranslation();
  const [openFilter, setOpenFilter] = useState<number | null>(null);

  const labelOf = (column: number) =>
    fields.find((field) => field.column === column)?.label ?? String(column);

  /**
   * 一个字段同时只属于一个区域（Excel 也允许行+筛选并存，但首版不做：
   * 隐藏的维度会让"为什么这一行不在了"变得难以解释）。
   */
  const assign = (zone: Zone, column: number) => {
    const next: PivotConfig = {
      ...config,
      rows: config.rows.filter((item) => item !== column),
      cols: config.cols.filter((item) => item !== column),
      values: config.values.filter((item) => item.column !== column),
      filters: { ...config.filters },
    };
    delete next.filters[column];
    if (zone === 'rows') next.rows = [...next.rows, column];
    if (zone === 'cols') next.cols = [...next.cols, column];
    // 值区支持多个字段（Excel 的"列 × 值"二维表头）；同一列不会重复加入
    if (zone === 'values') {
      next.values = [...next.values, { column, aggregation: 'sum' }];
    }
    if (zone === 'filters') next.filters[column] = [];
    onConfigChange(next);
  };

  const unassign = (column: number) => {
    const next: PivotConfig = {
      ...config,
      rows: config.rows.filter((item) => item !== column),
      cols: config.cols.filter((item) => item !== column),
      values: config.values.filter((item) => item.column !== column),
      filters: { ...config.filters },
    };
    delete next.filters[column];
    onConfigChange(next);
  };

  const setAggregation = (column: number, aggregation: PivotAggregation) => {
    onConfigChange({
      ...config,
      values: config.values.map((field) =>
        field.column === column ? { ...field, aggregation } : field,
      ),
    });
  };

  const toggleFilterValue = (column: number, key: string) => {
    const current = config.filters[column] ?? [];
    // 空数组 = 不过滤；勾满等价于不过滤，这里允许显式保留子集
    const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
    onConfigChange({ ...config, filters: { ...config.filters, [column]: next } });
  };

  const zoneChips = (zone: Zone): number[] => {
    if (zone === 'rows') return config.rows;
    if (zone === 'cols') return config.cols;
    if (zone === 'values') return config.values.map((field) => field.column);
    return Object.keys(config.filters).map(Number);
  };

  const aggregationLabel = (aggregation: PivotAggregation) => t(AGGREGATION_KEYS[aggregation]);

  const blocks = result?.blocks ?? [];
  const multi = blocks.length > 1;
  const hasCols = (result?.colFields.length ?? 0) > 0;
  const colCount = hasCols ? (result?.colKeys.length ?? 0) : 1;
  const labelOfKeys = (keys: PivotKey[]) =>
    keys.map((key) => (key.blank ? t('tools.sheet.pivotBlank') : key.label)).join(' / ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.sheet.pivotTitle')}
    >
      <div
        data-testid="sheet-pivot"
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-700">
          <h2 className="text-sm font-semibold">{t('tools.sheet.pivotTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('tools.sheet.pivotClose')}
            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <span className="font-medium">{t('tools.sheet.pivotSource')}</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 font-mono dark:bg-gray-800">
              {rangeLabel(config)}
            </span>
            <button
              type="button"
              onClick={onUseSelection}
              className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              {t('tools.sheet.pivotUseSelection')}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              {t('tools.sheet.pivotRefresh')}
            </button>
          </div>

          {/* 字段区：拖拽与点击两种用法，键盘/触屏用户不依赖拖拽 */}
          <div>
            <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              {t('tools.sheet.pivotFieldHint')}
            </p>
            <div className="flex flex-wrap gap-1">
              {fields.map((field) => (
                <div
                  key={field.column}
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData('text/pivot-field', String(field.column))
                  }
                  className="flex items-center gap-1 rounded border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800"
                >
                  <span className="cursor-move">{field.label}</span>
                  {(['rows', 'cols', 'values', 'filters'] as Zone[]).map((zone) => (
                    <button
                      key={zone}
                      type="button"
                      title={`${field.label} → ${t(ZONE_LABEL[zone])}`}
                      aria-label={`${field.label} → ${t(ZONE_LABEL[zone])}`}
                      onClick={() => assign(zone, field.column)}
                      className="rounded px-1 text-[10px] text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      {t(ZONE_LABEL[zone]).slice(0, 1)}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {(['rows', 'cols', 'values', 'filters'] as Zone[]).map((zone) => (
              <div
                key={zone}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const raw = event.dataTransfer.getData('text/pivot-field');
                  const column = Number(raw);
                  if (Number.isFinite(column)) assign(zone, column);
                }}
                className="min-h-16 rounded border border-dashed border-gray-300 p-1.5 dark:border-gray-600"
              >
                <p className="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {t(ZONE_LABEL[zone])}
                </p>
                <div className="flex flex-wrap gap-1">
                  {zoneChips(zone).map((column) => (
                    <span
                      key={column}
                      className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    >
                      {labelOf(column)}
                      {zone === 'values' ? (
                        <select
                          value={
                            config.values.find((field) => field.column === column)?.aggregation ??
                            'sum'
                          }
                          aria-label={`${labelOf(column)} ${t('tools.sheet.pivotValues')}`}
                          onChange={(event) =>
                            setAggregation(column, event.target.value as PivotAggregation)
                          }
                          className="rounded bg-transparent text-[11px] outline-none"
                        >
                          {PIVOT_AGGREGATIONS.map((aggregation) => (
                            <option key={aggregation} value={aggregation}>
                              {aggregationLabel(aggregation)}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      <button
                        type="button"
                        // 筛选区有两个按钮：一个是"选值"、一个是"移除"。名字必须不同，
                        // 否则读屏和测试都只能看到两个一模一样的 "区域 ✕"
                        aria-label={
                          zone === 'filters'
                            ? `${labelOf(column)} ${t('tools.sheet.pivotFilters')}`
                            : `${labelOf(column)} ✕`
                        }
                        onClick={() =>
                          zone === 'filters' ? setOpenFilter(column) : unassign(column)
                        }
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {zone === 'filters' ? '⚙' : '✕'}
                      </button>
                      {zone === 'filters' ? (
                        <button
                          type="button"
                          aria-label={`${labelOf(column)} ✕`}
                          onClick={() => unassign(column)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>
                {zone === 'filters' && openFilter !== null ? (
                  <div className="mt-1 max-h-24 overflow-auto rounded border border-gray-200 p-1 text-[11px] dark:border-gray-700">
                    {(keysByColumn[openFilter] ?? []).map((key) => {
                      const selected = (config.filters[openFilter] ?? []).includes(key.key);
                      return (
                        <label key={key.key} className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleFilterValue(openFilter, key.key)}
                          />
                          <span>{key.label || t('tools.sheet.pivotBlank')}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {empty ? (
            <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {t('tools.sheet.pivotEmpty')}
            </p>
          ) : null}

          {result?.truncated ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('tools.sheet.pivotTruncated', { count: recordCount })}
            </p>
          ) : null}

          {result && result.skippedValues > 0 ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('tools.sheet.pivotSkipped', {
                count: result.skippedValues,
                aggregation: aggregationLabel(config.values[0]?.aggregation ?? 'sum'),
              })}
            </p>
          ) : null}

          {result && result.rowKeys.length > 0 ? (
            <div className="min-h-0 overflow-auto rounded border border-gray-200 dark:border-gray-700">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th
                      rowSpan={multi ? 2 : 1}
                      className="sticky left-0 z-10 bg-gray-50 px-2 py-1 text-left font-medium dark:bg-gray-800"
                    />
                    {Array.from({ length: colCount }).map((_, colIndex) => (
                      <th
                        key={`col-${colIndex}`}
                        colSpan={multi ? blocks.length : 1}
                        className="px-2 py-1 text-right font-medium"
                      >
                        {hasCols && result.colKeys[colIndex]
                          ? labelOfKeys(result.colKeys[colIndex])
                          : ''}
                      </th>
                    ))}
                    {hasCols ? (
                      <th
                        colSpan={multi ? blocks.length : 1}
                        className="px-2 py-1 text-right font-medium"
                      >
                        {t('tools.sheet.pivotGrandTotal')}
                      </th>
                    ) : null}
                  </tr>
                  {multi ? (
                    <tr className="bg-gray-50 text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {Array.from({ length: colCount }).flatMap((_, colIndex) =>
                        blocks.map((block) => (
                          <th
                            key={`v-${colIndex}-${block.label}`}
                            className="px-2 py-0.5 text-right font-normal"
                          >
                            {block.label}
                          </th>
                        )),
                      )}
                      {hasCols
                        ? blocks.map((block) => (
                            <th
                              key={`vt-${block.label}`}
                              className="px-2 py-0.5 text-right font-normal"
                            >
                              {block.label}
                            </th>
                          ))
                        : null}
                    </tr>
                  ) : null}
                </thead>
                <tbody>
                  {result.rowKeys.map((keys, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-t border-gray-100 odd:bg-white even:bg-gray-50/60 dark:border-gray-800 dark:odd:bg-transparent dark:even:bg-gray-800/40"
                    >
                      <th className="sticky left-0 z-10 bg-inherit px-2 py-1 text-left font-normal">
                        {labelOfKeys(keys)}
                      </th>
                      {Array.from({ length: colCount }).flatMap((_, colIndex) =>
                        blocks.map((block) => {
                          const value = block.cells[rowIndex][colIndex];
                          return (
                            <td
                              key={`c-${colIndex}-${block.label}`}
                              className="px-2 py-1 text-right tabular-nums"
                            >
                              {value === null ? '' : formatCell(value)}
                            </td>
                          );
                        }),
                      )}
                      {hasCols
                        ? blocks.map((block) => {
                            const value = block.rowTotals[rowIndex];
                            return (
                              <td
                                key={`t-${block.label}`}
                                className="px-2 py-1 text-right font-medium tabular-nums"
                              >
                                {value === null ? '' : formatCell(value)}
                              </td>
                            );
                          })
                        : null}
                    </tr>
                  ))}
                  {hasCols ? (
                    <tr className="border-t-2 border-gray-300 bg-gray-100 font-medium dark:border-gray-600 dark:bg-gray-800">
                      <th className="sticky left-0 z-10 bg-gray-100 px-2 py-1 text-left dark:bg-gray-800">
                        {t('tools.sheet.pivotGrandTotal')}
                      </th>
                      {Array.from({ length: colCount }).flatMap((_, colIndex) =>
                        blocks.map((block) => {
                          const value = block.colTotals[colIndex];
                          return (
                            <td
                              key={`ct-${colIndex}-${block.label}`}
                              className="px-2 py-1 text-right tabular-nums"
                            >
                              {value === null ? '' : formatCell(value)}
                            </td>
                          );
                        }),
                      )}
                      {blocks.map((block) => (
                        <td key={`gt-${block.label}`} className="px-2 py-1 text-right tabular-nums">
                          {block.grandTotal === null ? '' : formatCell(block.grandTotal)}
                        </td>
                      ))}
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-4 py-2 dark:border-gray-700">
          <button
            type="button"
            onClick={onExport}
            disabled={empty || !result || result.rowKeys.length === 0}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {t('tools.sheet.pivotExportXlsx')}
          </button>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {t('tools.sheet.pivotSnapshot')}
          </span>
          <button
            type="button"
            onClick={onPrint}
            disabled={empty || !result || result.rowKeys.length === 0}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            {t('tools.sheet.pivotPrint')}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
          >
            {t('tools.sheet.pivotRemove')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A1 记法（含表头行），面板顶部显示源区域用 */
function rangeLabel(config: PivotConfig): string {
  const { startRow, startColumn, endRow, endColumn } = config.range;
  return `${columnName(Math.min(startColumn, endColumn))}${Math.min(startRow, endRow) + 1}:${columnName(
    Math.max(startColumn, endColumn),
  )}${Math.max(startRow, endRow) + 1}`;
}

function columnName(index: number): string {
  let name = '';
  let value = index;
  while (value >= 0) {
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26) - 1;
  }
  return name;
}

/** 聚合结果的小数位：平均值保留两位，其余原样（与导出矩阵口径一致） */
function formatCell(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}
