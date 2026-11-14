import { buildChartPlan, injectChartsIntoXlsx } from './chartXml';
import { buildImagePlan, injectImagesIntoXlsx } from './imagesXml';
import { buildPivotXlsxPlan, injectPivotTablesIntoXlsx } from './pivotXlsx';
import { buildShapePlan, injectShapesIntoXlsx } from './shapesXml';
import { injectNamedRanges } from './namedRanges';
import { injectTablesIntoXlsx } from './sheetTables';
import type { SheetObjectField } from './sheetObjects';
import type { WorkbookSnapshot } from './xlsx-io';

/**
 * 导出侧的 zip 后处理管道（P2-5，替换技术债 #3）。
 *
 * exceljs 写不出 `pivotTable` / `xdr:sp` / `drawing` / 原生 table part，这些内容都是把
 * `workbook.xlsx.writeBuffer()` 的产物再解压、改部件、压回去。原来这段是 `xlsx-io.ts` 里一长串
 * 手写的 `const withXxx = ... ? await injectXxx(withYyy, ...) : withYyy`：
 *
 * - **顺序不明**：为什么图片在形状前、图表在最前，只写在行间注释里，挪动一行没人发现；
 * - **漏接静默**：新增一种 part 忘了接进链条，结果是"编辑器里有、导出的文件里没有"；
 * - **无法单测**：链条长在导出函数内部，想断言"没有内容时一个字节都不改"只能跑整个导出。
 *
 * 现在每一步是一条注册表条目：`prepare` 决定这一步要不要跑（有内容才返回注入函数），
 * 顺序由数组顺序决定。`xlsx-io.ts` 只剩一句 `runXlsxPostProcess(buffer, snapshot)`。
 */

/** 后处理链条的字节类型（与 exceljs `writeBuffer()` 的产物一致） */
export type XlsxBytes = ArrayBuffer;
export type XlsxInjector = (bytes: XlsxBytes) => Promise<XlsxBytes>;

export interface XlsxPostProcessStep {
  /** 步骤名，同时用作测试与排错时的标识 */
  id: string;
  /** 这一步注入的对象家族（`null` = 不对应快照字段，例如名称与 table part 由别的字段驱动） */
  field: SheetObjectField | null;
  /** 有内容时返回注入函数；返回 `null` 表示这一步跳过（一个字节都不改） */
  prepare: (snapshot: WorkbookSnapshot) => XlsxInjector | null;
}

/**
 * 顺序即层叠顺序，都是刻意排的：
 * 1. 图表先建出每张表的 drawing part；
 * 2. 图片、形状往同一个 drawing 里追加（同一张表 Excel 只允许一个 drawing part），
 *    先图片后形状 = 形状压在图片上，与编辑态里浮层的叠放一致；
 * 3. 透视表是独立 part，只依赖工作表名，放在 drawing 之后；
 * 4. 名称要改 `workbook.xml`，table part 要引用 sheet 关系，各自独立但放在最后，
 *    避免前面步骤再动已经改过的部件。
 */
export const XLSX_POST_PROCESS_STEPS: readonly XlsxPostProcessStep[] = [
  {
    id: 'charts',
    field: 'syntoolsCharts',
    prepare: (snapshot) => {
      const plan = buildChartPlan(snapshot);
      const hasInApp = Object.keys(plan.chartsBySheet).length > 0;
      if (!hasInApp && plan.passthrough === null) return null;
      return (bytes) => injectChartsIntoXlsx(bytes, plan);
    },
  },
  {
    id: 'images',
    field: 'syntoolsImages',
    prepare: (snapshot) => {
      const plan = buildImagePlan(snapshot);
      if (Object.keys(plan.imagesBySheet).length === 0) return null;
      return (bytes) => injectImagesIntoXlsx(bytes, plan);
    },
  },
  {
    id: 'shapes',
    field: 'syntoolsShapes',
    prepare: (snapshot) => {
      const plan = buildShapePlan(snapshot);
      if (Object.keys(plan.shapesBySheet).length === 0) return null;
      return (bytes) => injectShapesIntoXlsx(bytes, plan);
    },
  },
  {
    id: 'pivots',
    field: 'syntoolsPivots',
    prepare: (snapshot) => {
      const plan = buildPivotXlsxPlan(snapshot);
      if (plan.items.length === 0) return null;
      return (bytes) => injectPivotTablesIntoXlsx(bytes, plan);
    },
  },
  {
    id: 'namedRanges',
    field: 'namedRanges',
    prepare: (snapshot) => {
      const names = snapshot.namedRanges ?? [];
      if (names.length === 0) return null;
      return (bytes) => injectNamedRanges(bytes, names, snapshot.sheetOrder, snapshot.sheets);
    },
  },
  {
    id: 'tables',
    field: 'syntoolsTables',
    prepare: (snapshot) => {
      if ((snapshot.syntoolsTables ?? []).length === 0) return null;
      return (bytes) => injectTablesIntoXlsx(bytes, snapshot);
    },
  },
];

/** 当前快照会跑哪些步骤（顺序同上）；导出前的提示与测试都用它 */
export function plannedPostProcessSteps(snapshot: WorkbookSnapshot): string[] {
  return XLSX_POST_PROCESS_STEPS.filter((step) => step.prepare(snapshot) !== null).map(
    (step) => step.id,
  );
}

/**
 * 依次跑完所有步骤。没有内容的步骤被整段跳过，因此空工作簿导出时
 * 返回的就是 exceljs 的原始字节（同一个 ArrayBuffer 引用，一次解压/压缩都不做）。
 */
export async function runXlsxPostProcess(
  bytes: XlsxBytes,
  snapshot: WorkbookSnapshot,
): Promise<XlsxBytes> {
  let next = bytes;
  for (const step of XLSX_POST_PROCESS_STEPS) {
    const inject = step.prepare(snapshot);
    if (inject) next = await inject(next);
  }
  return next;
}
