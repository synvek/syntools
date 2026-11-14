import { readSheetComments, withSheetComments, type SheetCommentMap } from './comments';
import { sanitizeNamedRanges, type NamedRange } from './namedRanges';
import type { ChartConfig } from './charts';
import type { PivotConfig } from './pivot';
import type { RawChartParts } from './rawChartParts';
import type { SheetImageConfig } from './sheetImages';
import type { SheetProtectionState } from './sheetProtection';
import type { SheetShapeConfig } from './shapes';
import { sanitizeTables, type SheetTable } from './sheetTables';
import { readWorkbookExtras, withWorkbookExtras, type WorkbookExtras } from './xlsx-extras';
import type { WorkbookSnapshot } from './xlsx-io';

/**
 * 对象注册表（P2-5）：快照里由本工具持有、Univer 一无所知的那些内容。
 *
 * 之前 `SpreadsheetTool.tsx` 里有一段手写的九次合并——每加一种对象就要再抄一遍
 * "判断有没有内容 → 有就 `{...next, 字段}`" ，漏掉一行就表现为"保存后对象消失"，
 * 而这种漏接不会报错、只会静默丢内容。这里把它变成一张表：
 *
 * - 新增一种对象 = 在 `SPEC_BY_FIELD` 里加一条（`Record<SheetObjectField, …>` 少一条就编译不过）；
 * - 字段是否为空、怎么写、怎么读回、导出时降级报哪个 code，全部写在条目里；
 * - 不写空壳字段（`[]` / `null`）：草稿里"0 条"与"从没保存过"在快照上应当同形，
 *   否则每次读回都要区分 undefined 与空数组。
 */

/**
 * Univer `IWorkbookData` 自带的字段——它们由引擎负责，不属于对象注册表。
 * 其余字段都是本工具加的，`SheetObjectField` 由快照类型推导出来（不手抄字段名）。
 */
type UniverOwnedField =
  'id' | 'name' | 'appVersion' | 'locale' | 'sheetOrder' | 'sheets' | 'styles' | 'resources';

/**
 * 快照里由本工具持有的对象字段。
 *
 * `syntoolsPivotSheets` 被排除：它只出现在**导出的临时快照**上（`appendPivotSheets` 挂的），
 * 不参与持久化合并，也没有编辑器侧的状态可以读回。
 */
export type SheetObjectField = Exclude<
  keyof WorkbookSnapshot,
  UniverOwnedField | 'syntoolsPivotSheets'
>;

/** 编辑器侧当前持有的对象（组件里那些 ref 的值），键与注册表条目的 `key` 一一对应 */
export interface SheetObjectSource {
  charts: ChartConfig[];
  rawParts: RawChartParts | null;
  pivots: PivotConfig[];
  shapes: SheetShapeConfig[];
  images: SheetImageConfig[];
  namedRanges: NamedRange[];
  protection: SheetProtectionState[];
  tables: SheetTable[];
  comments: SheetCommentMap;
  extras: WorkbookExtras | null;
}

export interface SheetObjectSpec<K extends keyof SheetObjectSource = keyof SheetObjectSource> {
  /** 编辑器侧的值（`SheetObjectSource` 的键） */
  key: K;
  /** 写进快照的字段 */
  field: SheetObjectField;
  /** 从快照读回；字段缺失或形态不对时给空值（绝不抛错） */
  read: (snapshot: WorkbookSnapshot) => SheetObjectSource[K];
  /** 写进快照；没有内容时返回原引用，不写出空壳字段 */
  write: (snapshot: WorkbookSnapshot, source: SheetObjectSource) => WorkbookSnapshot;
  /**
   * 导出侧对应的保真度 code（`fidelity.ts`）。`null` = 这类对象导出不会降级，
   * 因此报告里不该出现它的告警；改 code 名而不同步这里，`fidelity.test.ts` 会失败。
   */
  fidelityCode: string | null;
}

/** 只在 `Array.isArray` 成立时取用：草稿来自 localStorage，形态不可信 */
function arrayOf<T>(value: readonly T[] | undefined | null): T[] {
  return Array.isArray(value) ? [...value] : [];
}

/**
 * 把值挂到快照上；空数组 / `undefined` 时删掉字段而不是写空壳。
 * 返回原引用表示"什么都没变"，方便上层省掉一次 JSON.stringify。
 */
function attach<T>(
  snapshot: WorkbookSnapshot,
  field: SheetObjectField,
  value: T | undefined,
): WorkbookSnapshot {
  const empty = value === undefined || (Array.isArray(value) && value.length === 0);
  if (empty) {
    if (!(field in snapshot)) return snapshot;
    const next = { ...snapshot } as Record<string, unknown>;
    delete next[field];
    return next as unknown as WorkbookSnapshot;
  }
  return { ...snapshot, [field]: value } as WorkbookSnapshot;
}

/** 保留条目自己的 `key` 字面量类型，放进同一张表时再退化成联合类型 */
function defineSpec<K extends keyof SheetObjectSource>(spec: SheetObjectSpec<K>): SheetObjectSpec {
  return spec;
}

/**
 * 字段 → 条目。`satisfies Record<SheetObjectField, …>` 是编译期守卫：
 * `WorkbookSnapshot` 上新增一个工具字段而这里没登记，`tsc` 直接报"缺哪个字段"。
 * 顺序即合并顺序（只为可读性；各条目写的是不同字段，互不影响）。
 */
const SPEC_BY_FIELD = {
  syntoolsCharts: defineSpec({
    key: 'charts',
    field: 'syntoolsCharts',
    read: (snapshot) => arrayOf(snapshot.syntoolsCharts),
    write: (snapshot, source) => attach(snapshot, 'syntoolsCharts', arrayOf(source.charts)),
    fidelityCode: 'sheet.chartsKept',
  }),
  syntoolsRawParts: defineSpec({
    key: 'rawParts',
    field: 'syntoolsRawParts',
    read: (snapshot) => snapshot.syntoolsRawParts ?? null,
    write: (snapshot, source) => attach(snapshot, 'syntoolsRawParts', source.rawParts ?? undefined),
    // 导入时保留的原生图表 part 已经计进图表的条数提示里，没有单独的降级告警
    fidelityCode: null,
  }),
  syntoolsPivots: defineSpec({
    key: 'pivots',
    field: 'syntoolsPivots',
    read: (snapshot) => arrayOf(snapshot.syntoolsPivots),
    write: (snapshot, source) => attach(snapshot, 'syntoolsPivots', arrayOf(source.pivots)),
    fidelityCode: 'sheet.pivotSnapshot',
  }),
  syntoolsShapes: defineSpec({
    key: 'shapes',
    field: 'syntoolsShapes',
    read: (snapshot) => arrayOf(snapshot.syntoolsShapes),
    write: (snapshot, source) => attach(snapshot, 'syntoolsShapes', arrayOf(source.shapes)),
    fidelityCode: 'sheet.shapesKept',
  }),
  syntoolsImages: defineSpec({
    key: 'images',
    field: 'syntoolsImages',
    read: (snapshot) => arrayOf(snapshot.syntoolsImages),
    write: (snapshot, source) => attach(snapshot, 'syntoolsImages', arrayOf(source.images)),
    fidelityCode: null,
  }),
  namedRanges: defineSpec({
    key: 'namedRanges',
    field: 'namedRanges',
    read: (snapshot) => arrayOf(snapshot.namedRanges),
    // 空名 / 引用识别不了的名称导出后就是坏文件，落盘前统一清洗
    write: (snapshot, source) =>
      attach(snapshot, 'namedRanges', sanitizeNamedRanges(arrayOf(source.namedRanges))),
    fidelityCode: null,
  }),
  syntoolsProtection: defineSpec({
    key: 'protection',
    field: 'syntoolsProtection',
    read: (snapshot) => arrayOf(snapshot.syntoolsProtection),
    write: (snapshot, source) => attach(snapshot, 'syntoolsProtection', arrayOf(source.protection)),
    fidelityCode: null,
  }),
  syntoolsTables: defineSpec({
    key: 'tables',
    field: 'syntoolsTables',
    read: (snapshot) => arrayOf(snapshot.syntoolsTables),
    write: (snapshot, source) =>
      attach(snapshot, 'syntoolsTables', sanitizeTables(arrayOf(source.tables))),
    fidelityCode: null,
  }),
  syntoolsComments: defineSpec({
    key: 'comments',
    field: 'syntoolsComments',
    read: (snapshot) => readSheetComments(snapshot),
    // 线程写进 xlsx 时会被压平成一条备注（P1-9），所以这里是 info 而不是"完全保留"
    write: (snapshot, source) => withSheetComments(snapshot, source.comments),
    fidelityCode: 'sheet.comments',
  }),
  syntoolsExtras: defineSpec({
    key: 'extras',
    field: 'syntoolsExtras',
    read: (snapshot) => readWorkbookExtras(snapshot),
    write: (snapshot, source) => withWorkbookExtras(snapshot, source.extras),
    fidelityCode: 'sheet.cfKept',
  }),
} satisfies Record<SheetObjectField, SheetObjectSpec>;

/** 注册表（顺序 = 合并顺序）：`withDocOwnedContent` 只遍历它，不再逐个字段手写 */
export const SHEET_OBJECT_SPECS: readonly SheetObjectSpec[] = Object.values(SPEC_BY_FIELD);

/** 快照里出现过的工具字段（调试 / 测试用；顺序与注册表一致） */
export const SHEET_OBJECT_FIELDS: readonly SheetObjectField[] = SHEET_OBJECT_SPECS.map(
  (spec) => spec.field,
);

/** 把编辑器侧的对象集合合并进快照（导出 / 持久化共用同一条路径） */
export function applySheetObjects(
  base: WorkbookSnapshot,
  source: SheetObjectSource,
): WorkbookSnapshot {
  let next = base;
  for (const spec of SHEET_OBJECT_SPECS) next = spec.write(next, source);
  return next;
}

/**
 * 反向：从快照读回全部对象。实例重建 / 采纳草稿时用它一次取全，
 * 组件里就不必再写十遍 `pending.syntoolsXxx ?? []`。
 */
export function readSheetObjects(snapshot: WorkbookSnapshot): SheetObjectSource {
  // 逐条写同一个对象：类型在 `SheetObjectSpec.key` 上已经保证 key 与 read 的返回值配对
  const values: Record<string, unknown> = {};
  for (const spec of SHEET_OBJECT_SPECS) values[spec.key] = spec.read(snapshot);
  return values as unknown as SheetObjectSource;
}
