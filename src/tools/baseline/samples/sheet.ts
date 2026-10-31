import {
  createEmptySheet,
  createEmptySnapshot,
  type WorkbookSnapshot,
} from '../../spreadsheet-editor/xlsx-io';
import type { MergeRange } from '../../spreadsheet-editor/core';

export interface SheetSample {
  id: string;
  title: string;
  /** Recorded in the report so a reviewer knows the number is expected, not a bug */
  notes?: string;
  snapshot: () => WorkbookSnapshot;
}

const CF_PLUGIN = 'SHEET_CONDITIONAL_FORMATTING_PLUGIN';
const DV_PLUGIN = 'SHEET_DATA_VALIDATION_PLUGIN';

const range = (startRow: number, startColumn: number, endRow: number, endColumn: number) => ({
  startRow,
  startColumn,
  endRow,
  endColumn,
});

/** One sheet with the given cells; keys are 0-based row/column strings */
function sheetWith(cells: Record<string, Record<string, unknown>>): WorkbookSnapshot {
  const snapshot = createEmptySnapshot('baseline');
  const sheetId = snapshot.sheetOrder[0];
  snapshot.sheets[sheetId].cellData = cells as WorkbookSnapshot['sheets'][string]['cellData'];
  return snapshot;
}

function withResources(build: (sheetId: string) => Record<string, unknown>): WorkbookSnapshot {
  const snapshot = createEmptySnapshot('baseline');
  const sheetId = snapshot.sheetOrder[0];
  return { ...snapshot, resources: build(sheetId) };
}

export const sheetSamples: SheetSample[] = [
  {
    id: 'sheet/cells-basic',
    title: '文本 / 数字 / 布尔',
    snapshot: () =>
      sheetWith({
        '0': { '0': { v: 'Region' }, '1': { v: 'Amount' } },
        '1': { '0': { v: 'North' }, '1': { v: 1200 } },
        '2': { '0': { v: 'South' }, '1': { v: 980.5 } },
        '3': { '0': { v: 'Active' }, '1': { v: true } },
      }),
  },
  {
    id: 'sheet/formulas',
    title: '公式 + 缓存值',
    snapshot: () =>
      sheetWith({
        '0': { '0': { v: 10 }, '1': { v: 20 } },
        '1': { '0': { v: 30 }, '1': { v: 60, f: '=SUM(A1:A2)' } },
        '2': { '0': { v: 90, f: '=B2+A2' } },
        '3': { '0': { v: 3, f: '=COUNTA(A1:A3)' } },
      }),
  },
  {
    id: 'sheet/formats',
    title: '日期 / 百分比 / 千分位格式',
    snapshot: () =>
      sheetWith({
        '0': { '0': { v: 45306, s: { n: { pattern: 'yyyy-mm-dd' } } } },
        '1': { '0': { v: 0.125, s: { n: { pattern: '0.00%' } } } },
        '2': { '0': { v: 1234567.891, s: { n: { pattern: '#,##0.00' } } } },
        '3': { '0': { v: 'bold', s: { bl: 1, fs: 14, cl: { rgb: '#FF0000' } } } },
      }),
  },
  {
    id: 'sheet/merges-freeze-hidden',
    title: '合并 / 冻结 / 隐藏表',
    snapshot: () => {
      const snapshot = createEmptySnapshot('baseline');
      const mainId = snapshot.sheetOrder[0];
      const main = snapshot.sheets[mainId];
      main.cellData = {
        '0': { '0': { v: 'Merged' }, '1': { v: '' } },
        '1': { '0': { v: 1 }, '1': { v: 2 } },
      };
      main.mergeData = [
        { startRow: 0, startColumn: 0, endRow: 0, endColumn: 1 } as MergeRange,
        { startRow: 0, startColumn: 3, endRow: 1, endColumn: 3 } as MergeRange,
      ];
      main.freeze = { xSplit: 1, ySplit: 2, startRow: 1, startColumn: 0 };

      const hidden = createEmptySheet('sheet-hidden', 'Archive');
      hidden.hidden = 1;
      hidden.cellData = { '0': { '0': { v: 'hidden value' } } };
      snapshot.sheets[hidden.id] = hidden;
      snapshot.sheetOrder = [mainId, hidden.id];
      return snapshot;
    },
  },
  {
    id: 'sheet/cf',
    title: '条件格式：色阶 + 单元格规则',
    notes: '导出后规则以 extras 通道往返，cfRules 跨通道计数（before=2、after=2）',
    snapshot: () =>
      withResources((sheetId) => ({
        [CF_PLUGIN]: {
          'unit-1': {
            [sheetId]: [
              {
                cfId: 'cf-color-scale',
                stopIfTrue: false,
                ranges: [range(1, 1, 5, 1)],
                rule: {
                  type: 'colorScale',
                  config: [
                    { index: 0, color: '#FF0000', value: { type: 'min' } },
                    { index: 1, color: '#00FF00', value: { type: 'percent', value: 50 } },
                    { index: 2, color: '#0000FF', value: { type: 'max' } },
                  ],
                },
              },
              {
                cfId: 'cf-greater',
                stopIfTrue: false,
                ranges: [range(0, 0, 9, 0)],
                rule: {
                  type: 'highlightCell',
                  subType: 'number',
                  operator: 'greaterThan',
                  value: 5,
                  style: { bg: { rgb: '#FFFF00' }, bl: 1 },
                },
              },
            ],
          },
        },
      })),
  },
  {
    id: 'sheet/dv',
    title: '数据验证：下拉列表 + 整数区间',
    notes: '导出后规则以 extras 通道往返，dvRules 跨通道计数',
    snapshot: () =>
      withResources((sheetId) => ({
        [DV_PLUGIN]: {
          'unit-1': {
            [sheetId]: [
              {
                uid: 'dv-list',
                type: 'list',
                formula1: 'a,b,c',
                allowBlank: true,
                ranges: [range(0, 0, 4, 0)],
              },
              {
                uid: 'dv-whole',
                type: 'whole',
                operator: 'between',
                formula1: '1',
                formula2: '10',
                ranges: [range(0, 2, 2, 2)],
              },
            ],
          },
        },
      })),
  },
  {
    id: 'sheet/chart',
    title: '原生图表（柱状图）',
    notes: '导出为原生图表 part；导入不解析为可编辑图表，改由 rawChartParts 记录保留数量',
    snapshot: () => {
      const snapshot = sheetWith({
        '0': { '0': { v: 'Quarter' }, '1': { v: 'Revenue' } },
        '1': { '0': { v: 'Q1' }, '1': { v: 120 } },
        '2': { '0': { v: 'Q2' }, '1': { v: 150 } },
        '3': { '0': { v: 'Q3' }, '1': { v: 90 } },
      });
      const sheetId = snapshot.sheetOrder[0];
      snapshot.syntoolsCharts = [
        {
          id: 'chart-1',
          type: 'bar',
          range: range(0, 0, 3, 1),
          sheetId,
          x: 320,
          y: 40,
          width: 420,
          height: 260,
        },
      ];
      return snapshot;
    },
  },
  {
    id: 'sheet/shapes',
    title: '浮动形状（原生 xdr:sp）',
    notes:
      '形状按单元格锚定导出为 oneCellAnchor + xdr:sp；导入应原样读回（prst / 锚点 / 尺寸 / 文字）',
    snapshot: () => {
      const snapshot = sheetWith({
        '0': { '0': { v: 'Note' }, '1': { v: 'Value' } },
        '1': { '0': { v: 'Alpha' }, '1': { v: 12 } },
        '2': { '0': { v: 'Beta' }, '1': { v: 34 } },
      });
      const sheetId = snapshot.sheetOrder[0];
      snapshot.syntoolsShapes = [
        {
          id: 'shape-1',
          prst: 'roundRect',
          sheetId,
          from: { col: 3, row: 1, colOff: 8, rowOff: 6 },
          width: 180,
          height: 90,
          fill: '#4472c4',
          stroke: '#2f5597',
          strokeWidth: 1,
          text: 'Callout',
          z: 1,
        },
        {
          id: 'shape-2',
          prst: 'rightArrow',
          sheetId,
          from: { col: 3, row: 3, colOff: 8, rowOff: 6 },
          width: 140,
          height: 60,
          fill: '#ff8800',
          stroke: '#773300',
          strokeWidth: 2,
          z: 2,
        },
      ];
      return snapshot;
    },
  },
  {
    id: 'sheet/hyperlink-note-error',
    title: '超链接 / 批注 / 错误值',
    snapshot: () =>
      sheetWith({
        '0': {
          '0': {
            v: 'Example',
            custom: { hyperlink: { url: 'https://example.com', text: 'Example' } },
          },
        },
        '1': { '0': { v: 'annotated', custom: { note: '基线批注' } } },
        '2': { '0': { v: '#VALUE!', custom: { error: '#VALUE!' } } },
      }),
  },
];
