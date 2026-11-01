/**
 * 工作表保护（P2-S7.2）：`sheetProtection` 双向 + 编辑器侧只读。
 *
 * 术语对齐（这是本模块最容易搞错的地方，exceljs 的属性语义和 OOXML 是反的）：
 * - OOXML：`formatCells="0"` 表示**允许**设置格式，`="1"` 表示禁止；`sheet="1"` 表示已保护。
 * - exceljs 模型：`formatCells: true` 表示允许，`selectLockedCells: false` 表示禁止选择锁定单元格。
 * 本模块对外统一用"**true = 允许**"，与用户在 UI 上的直觉一致，进出 exceljs 时各转一次。
 *
 * 密码：只在"开启保护"那一刻用 exceljs 算一次 SHA-512 哈希（含盐与 spinCount），结果存进快照。
 * 之后每次导出都写同一份哈希，导出结果才是可复现的；编辑器本身不做密码校验（Excel 才会）。
 */

/** 允许的操作；缺省 = 禁止（与 Excel 的保护默认值一致） */
export interface SheetProtectionFlags {
  /** 允许选择锁定单元格 */
  selectLockedCells?: boolean;
  /** 允许选择未锁定单元格 */
  selectUnlockedCells?: boolean;
  formatCells?: boolean;
  formatColumns?: boolean;
  formatRows?: boolean;
  insertColumns?: boolean;
  insertRows?: boolean;
  insertHyperlinks?: boolean;
  deleteColumns?: boolean;
  deleteRows?: boolean;
  sort?: boolean;
  autoFilter?: boolean;
  pivotTables?: boolean;
}

/** exceljs 算出的密码哈希；没有密码时整体省略 */
export interface SheetProtectionPassword {
  algorithmName: string;
  hashValue: string;
  saltValue: string;
  spinCount: number;
}

/** One protected sheet as carried by the snapshot */
export interface SheetProtectionState {
  sheetId: string;
  enabled: boolean;
  flags: SheetProtectionFlags;
  password?: SheetProtectionPassword;
}

/** exceljs 写 sheetProtection 时的模型形态（只声明本模块用到的字段） */
interface ExcelSheetProtectionModel {
  sheet?: boolean;
  objects?: boolean;
  scenarios?: boolean;
  selectLockedCells?: boolean;
  selectUnlockedCells?: boolean;
  formatCells?: boolean;
  formatColumns?: boolean;
  formatRows?: boolean;
  insertColumns?: boolean;
  insertRows?: boolean;
  insertHyperlinks?: boolean;
  deleteColumns?: boolean;
  deleteRows?: boolean;
  sort?: boolean;
  autoFilter?: boolean;
  pivotTables?: boolean;
  algorithmName?: string;
  hashValue?: string;
  saltValue?: string;
  spinCount?: number;
}

/** 只声明读取用到的成员，避免把 exceljs 的 Worksheet 类型带进快照层 */
export interface WorksheetProtectionLike {
  sheetProtection?: ExcelSheetProtectionModel | null;
}

const ALLOW_KEYS = [
  'formatCells',
  'formatColumns',
  'formatRows',
  'insertColumns',
  'insertRows',
  'insertHyperlinks',
  'deleteColumns',
  'deleteRows',
  'sort',
  'autoFilter',
  'pivotTables',
] as const;

/**
 * exceljs 模型 → 我们的"允许"口径。
 * `formatCells` 等：模型 true = 允许；`objects` / `scenarios`：模型 false = 禁止；
 * `selectLockedCells` 反着：模型 false = 禁止。
 */
export function fromExcelProtection(
  model: ExcelSheetProtectionModel | null | undefined,
): SheetProtectionState | null {
  if (!model || model.sheet !== true) return null;
  const flags: SheetProtectionFlags = {};
  for (const key of ALLOW_KEYS) {
    if (model[key] === true) flags[key] = true;
  }
  // 默认允许选择单元格；只有显式 false（= OOXML 里写了 1）才算禁止
  flags.selectLockedCells = model.selectLockedCells !== false;
  flags.selectUnlockedCells = model.selectUnlockedCells !== false;
  const password =
    model.algorithmName && model.hashValue && model.saltValue
      ? {
          algorithmName: model.algorithmName,
          hashValue: model.hashValue,
          saltValue: model.saltValue,
          spinCount: model.spinCount ?? 100000,
        }
      : undefined;
  return { sheetId: '', enabled: true, flags, ...(password ? { password } : {}) };
}

/** 我们的"允许"口径 → exceljs 模型（只写"需要覆盖默认值"的字段，保持 XML 干净） */
export function toExcelProtection(state: SheetProtectionState): ExcelSheetProtectionModel | null {
  if (!state.enabled) return null;
  const model: ExcelSheetProtectionModel = { sheet: true };
  for (const key of ALLOW_KEYS) {
    if (state.flags[key] === true) model[key] = true;
  }
  // 默认允许选择：只有禁止时才需要写（模型 false → OOXML selectLockedCells="1"）
  if (state.flags.selectLockedCells === false) model.selectLockedCells = false;
  if (state.flags.selectUnlockedCells === false) model.selectUnlockedCells = false;
  /**
   * 对象 / 方案一律显式禁止：exceljs 的模型只能表达"禁止"（false → `objects="1"`），
   * 表达不了"允许"，所以不提供这个开关，也不假装支持。Excel 保护工作表时的默认值就是这样。
   */
  model.objects = false;
  model.scenarios = false;
  if (state.password) {
    model.algorithmName = state.password.algorithmName;
    model.hashValue = state.password.hashValue;
    model.saltValue = state.password.saltValue;
    model.spinCount = state.password.spinCount;
  }
  return model;
}

/** 从 exceljs worksheet 读出保护状态；未保护返回 null */
export function readSheetProtection(
  worksheet: WorksheetProtectionLike,
): SheetProtectionState | null {
  return fromExcelProtection(worksheet.sheetProtection ?? null);
}

/** 把保护状态写到 exceljs worksheet；关闭保护时清空 */
export function applySheetProtection(
  worksheet: { sheetProtection?: unknown },
  state: SheetProtectionState | null,
): void {
  if (!state || !state.enabled) {
    worksheet.sheetProtection = null;
    return;
  }
  worksheet.sheetProtection = toExcelProtection(state);
}

/**
 * 开启保护时生成密码哈希。
 *
 * 走一趟临时 workbook 而不是自己实现哈希：exceljs 的 `protect()` 已经封装了 salt 生成 +
 * SHA-512 + spinCount，重复实现一遍只会带来"两边算法不一致、Excel 打不开"的风险。
 */
export async function createPasswordHash(
  password: string,
): Promise<SheetProtectionPassword | undefined> {
  const value = password.trim();
  if (!value) return undefined;
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('hash');
  await worksheet.protect(value, {});
  const model = (worksheet as unknown as WorksheetProtectionLike).sheetProtection;
  if (!model?.algorithmName || !model.hashValue || !model.saltValue) return undefined;
  return {
    algorithmName: model.algorithmName,
    hashValue: model.hashValue,
    saltValue: model.saltValue,
    spinCount: model.spinCount ?? 100000,
  };
}

/** 某张表是否处于保护态 */
export function protectionFor(
  list: readonly SheetProtectionState[],
  sheetId: string | null | undefined,
): SheetProtectionState | null {
  if (!sheetId) return null;
  return list.find((item) => item.sheetId === sheetId && item.enabled) ?? null;
}

/** 开关一张表的保护（关闭直接移除，快照里不留 enabled:false 的残渣） */
export function setProtection(
  list: readonly SheetProtectionState[],
  sheetId: string,
  next: SheetProtectionState | null,
): SheetProtectionState[] {
  const rest = list.filter((item) => item.sheetId !== sheetId);
  if (!next || !next.enabled) return rest;
  return [...rest, { ...next, sheetId }];
}
