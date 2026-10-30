import { buildPivot, pivotToMatrix, type PivotConfig, type PivotResult } from './pivot';
import { createEmptySheet, type SheetSnapshot, type WorkbookSnapshot } from './xlsx-io';

/**
 * 透视结果 -> 工作表（P2-4.6 导出 / P2-4.7 打印共用）。
 *
 * 两者共用同一份矩阵，保证"面板里看到的数字"和"导出去/打出来的数字"不会各算一套。
 * 这里只做"静态值"：单元格里是数字与文本，没有公式、没有 pivotTable part ——
 * 因此 Excel 打开不会有修复提示，代价是不可刷新（保真报告会写明）。
 */

/** 一张只读工作表；`null` 表示没有可写的数据（空源区域） */
export function buildPivotSheet(
  id: string,
  config: PivotConfig,
  result: PivotResult,
  blankLabel: string,
): SheetSnapshot | null {
  if (result.rowKeys.length === 0) return null;
  const matrix = pivotToMatrix(result, config, blankLabel);
  // 工作表重名在 Excel 里会被当成损坏：名字后面补序号保证唯一（id 里的数字正好可用）
  const suffix = id.replace(/[^0-9]/g, '');
  const sheet = createEmptySheet(id, `${config.name || 'Pivot'}${suffix ? ` ${suffix}` : ''}`);
  matrix.forEach((line, row) => {
    line.forEach((value, column) => {
      if (value === '' || value === undefined) return;
      sheet.cellData[String(row)] ??= {};
      sheet.cellData[String(row)][String(column)] = { v: value };
    });
  });
  return sheet;
}

/**
 * 导出前把每个透视结果追加成工作表。
 *
 * 用传入的 `snapshot` 计算（不是"已经加好工作表的 next"），避免透视表把上一张透视表当成源数据。
 */
export function appendPivotSheets(
  snapshot: WorkbookSnapshot,
  configs: PivotConfig[],
  blankLabel: string,
): WorkbookSnapshot {
  if (configs.length === 0) return snapshot;
  const next: WorkbookSnapshot = {
    ...snapshot,
    sheets: { ...snapshot.sheets },
    sheetOrder: [...snapshot.sheetOrder],
  };
  configs.forEach((config, index) => {
    const id = `pivot${index + 1}`;
    const sheet = buildPivotSheet(id, config, buildPivot(snapshot, config), blankLabel);
    if (!sheet) return;
    next.sheets[id] = sheet;
    next.sheetOrder.push(id);
  });
  return next;
}
