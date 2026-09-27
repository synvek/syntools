import type { ConditionalFormattingOptions, DataValidation } from 'exceljs';

/**
 * .xlsx 往返保留层：条件格式与数据验证。
 *
 * 这两类内容 Univer 与 exceljs 的数据模型差异较大，暂不做双向语义映射，
 * 而是把 exceljs 读出的原始定义随工作簿快照一起保存
 * （存入 Univer 会原样保留的 workbook `resources`，见 xlsx-io 的实现），
 * 导出时再写回。这样「导入 → 编辑 → 导出」不会静默丢失原有条件格式 / 数据验证。
 *
 * 注意：本工具内新建的条件格式 / 数据验证目前在 Univer 侧，
 * 尚未映射回 .xlsx，导出损耗说明见 strings 的 unsupportedTip。
 */

/** 单个工作表中需往返保留的内容 */
export interface SheetExtras {
  conditionalFormattings?: ConditionalFormattingOptions[];
  /** 单元格地址 → 数据验证定义 */
  dataValidations?: Record<string, DataValidation>;
}

export interface WorkbookExtras {
  version: 1;
  /** 工作表名 → 附加内容（用名称而非 id：Univer 快照与 exceljs 的 id 体系不同） */
  sheets: Record<string, SheetExtras>;
}

/** 在快照 resources 中保存附加内容所用的资源名 */
export const EXTRAS_RESOURCE_NAME = 'SYNTOOLS_XLSX_EXTRAS';

/** exceljs 工作表形态：只声明本模块用到的成员 */
export interface WorksheetExtrasLike {
  name: string;
  conditionalFormattings?: ConditionalFormattingOptions[];
  dataValidations?: { model?: Record<string, DataValidation> };
  addConditionalFormatting?: (cf: ConditionalFormattingOptions) => void;
  getCell?: (address: string) => { dataValidation: DataValidation } | undefined;
}

/** 读取工作表中需往返保留的附加内容；没有则返回 null */
export function collectSheetExtras(worksheet: WorksheetExtrasLike): SheetExtras | null {
  const extras: SheetExtras = {};
  if (Array.isArray(worksheet.conditionalFormattings) && worksheet.conditionalFormattings.length) {
    extras.conditionalFormattings = worksheet.conditionalFormattings;
  }
  const model = worksheet.dataValidations?.model;
  if (model && Object.keys(model).length > 0) {
    extras.dataValidations = model;
  }
  return Object.keys(extras).length > 0 ? extras : null;
}

/** 把附加内容写回 exceljs 工作表 */
export function applySheetExtras(worksheet: WorksheetExtrasLike, extras: SheetExtras): void {
  for (const formatting of extras.conditionalFormattings ?? []) {
    worksheet.addConditionalFormatting?.(formatting);
  }
  for (const [address, validation] of Object.entries(extras.dataValidations ?? {})) {
    const cell = worksheet.getCell?.(address);
    if (cell) cell.dataValidation = validation;
  }
}

/** 从快照 resources 中读回附加内容；缺失或损坏时返回 null */
export function readWorkbookExtras(
  resources: readonly { name: string; data: string }[] | undefined,
): WorkbookExtras | null {
  const entry = resources?.find((item) => item.name === EXTRAS_RESOURCE_NAME);
  if (!entry) return null;
  try {
    const parsed = JSON.parse(entry.data) as WorkbookExtras;
    if (!parsed || parsed.version !== 1 || typeof parsed.sheets !== 'object' || !parsed.sheets) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** 把附加内容并入 resources；无内容时原样返回 */
export function withWorkbookExtras(
  resources: readonly { name: string; data: string }[] | undefined,
  extras: WorkbookExtras,
): { name: string; data: string }[] | undefined {
  if (Object.keys(extras.sheets).length === 0) {
    return resources ? [...resources] : undefined;
  }
  const rest = (resources ?? []).filter((item) => item.name !== EXTRAS_RESOURCE_NAME);
  return [...rest, { name: EXTRAS_RESOURCE_NAME, data: JSON.stringify(extras) }];
}

/** 统计附加内容规模（用于提示「有多少内容靠往返保留、未做语义映射」） */
export function countExtras(extras: WorkbookExtras | null): {
  conditionalFormattings: number;
  dataValidations: number;
} {
  let conditionalFormattings = 0;
  let dataValidations = 0;
  for (const sheet of Object.values(extras?.sheets ?? {})) {
    conditionalFormattings += sheet.conditionalFormattings?.length ?? 0;
    dataValidations += Object.keys(sheet.dataValidations ?? {}).length;
  }
  return { conditionalFormattings, dataValidations };
}
