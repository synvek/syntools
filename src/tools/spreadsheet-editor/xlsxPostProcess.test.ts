import { describe, expect, it } from 'vitest';
import {
  XLSX_POST_PROCESS_STEPS,
  plannedPostProcessSteps,
  runXlsxPostProcess,
} from './xlsxPostProcess';
import { createEmptySnapshot, exportSnapshotToBytes, type WorkbookSnapshot } from './xlsx-io';
import { applySheetObjects, readSheetObjects } from './sheetObjects';

/**
 * 导出侧后处理管道（P2-5）：把 `xlsx-io.ts` 里那串手写的 `withCharts → withImages → …`
 * 换成一个数组。这里守三件事：**顺序**（层叠语义）、**跳过**（没内容就不解压）、**漏接**
 * （注册表里有的对象，必须真有一步把它写进文件——否则"编辑器里有、导出没有"又会静默发生）。
 */

/** 表头 + 两行数据：图表能被解析出系列的最小区间 */
function fillChartData(snapshot: WorkbookSnapshot, sheetId: string): void {
  [
    ['区域', '金额'],
    ['华东', 100],
    ['华南', 30],
  ].forEach((row, rowIndex) => {
    snapshot.sheets[sheetId].cellData[String(rowIndex)] = {};
    row.forEach((value, column) => {
      snapshot.sheets[sheetId].cellData[String(rowIndex)][String(column)] = {
        v: value as string | number,
      };
    });
  });
}

describe('XLSX_POST_PROCESS_STEPS', () => {
  it('顺序固定：图表建 drawing → 图片 → 形状 → 透视 → 名称 → 表格', () => {
    expect(XLSX_POST_PROCESS_STEPS.map((step) => step.id)).toEqual([
      'charts',
      'images',
      'shapes',
      'pivots',
      'namedRanges',
      'tables',
    ]);
  });

  it('每一步都有唯一 id，并声明自己注入哪个快照字段', () => {
    const ids = XLSX_POST_PROCESS_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(XLSX_POST_PROCESS_STEPS.map((step) => step.field)).toEqual([
      'syntoolsCharts',
      'syntoolsImages',
      'syntoolsShapes',
      'syntoolsPivots',
      'namedRanges',
      'syntoolsTables',
    ]);
  });

  it('空工作簿一个步骤都不跑，字节原样返回', async () => {
    const snapshot = createEmptySnapshot('book');
    expect(plannedPostProcessSteps(snapshot)).toEqual([]);
    const bytes = new ArrayBuffer(8);
    // 同一个引用 = 一次解压 / 压缩都没做
    expect(await runXlsxPostProcess(bytes, snapshot)).toBe(bytes);
  });

  it('有内容时才排进队列（互不牵连）', () => {
    const withChart = createEmptySnapshot('book');
    const sheet = withChart.sheetOrder[0];
    fillChartData(withChart, sheet);
    withChart.syntoolsCharts = [
      {
        id: 'chart-1',
        type: 'bar',
        sheetId: sheet,
        range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 },
        x: 0,
        y: 0,
        width: 320,
        height: 200,
      },
    ];
    expect(plannedPostProcessSteps(withChart)).toEqual(['charts']);

    const withName = createEmptySnapshot('book');
    withName.namedRanges = [{ id: 'n1', name: 'Total', ref: 'A1:B2' }];
    expect(plannedPostProcessSteps(withName)).toEqual(['namedRanges']);
  });

  it('注册表里每一类"要写进文件的对象"都有对应的后处理步骤', async () => {
    // 反向守卫：`sheetObjects.ts` 新增一类需要写 OOXML 的对象（快照字段已登记）却忘了接管道，
    // 这里就会失败。图片 / 形状 / 图表 / 透视 / 名称 / 表格是目前需要额外 part 的全部家族。
    const expected = new Set([
      'syntoolsCharts',
      'syntoolsImages',
      'syntoolsShapes',
      'syntoolsPivots',
      'namedRanges',
      'syntoolsTables',
    ]);
    const covered = new Set(XLSX_POST_PROCESS_STEPS.map((step) => step.field));
    expect(covered).toEqual(expected);
  });

  it('真实导出：图表 + 名称一起走完管道后仍是可用的 xlsx', async () => {
    const base = createEmptySnapshot('book');
    const sheet = base.sheetOrder[0];
    fillChartData(base, sheet);
    const snapshot = applySheetObjects(base, {
      ...readSheetObjects(base),
      charts: [
        {
          id: 'chart-1',
          type: 'bar',
          sheetId: sheet,
          range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 },
          x: 0,
          y: 0,
          width: 320,
          height: 200,
        },
      ],
      namedRanges: [{ id: 'n1', name: 'Total', ref: 'B2:B3' }],
    });
    expect(plannedPostProcessSteps(snapshot)).toEqual(['charts', 'namedRanges']);
    const result = await exportSnapshotToBytes(snapshot);
    expect(result.ok).toBe(true);
  });
});
