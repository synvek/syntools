/**
 * ARIA 网格投影（P2-9）。
 *
 * 编辑区是 canvas：读屏软件从 DOM 里什么也拿不到，所以要在旁边叠一层**视觉隐藏**的
 * `role="grid"`，把"读屏需要的那点信息"投影出来——行号、列号、显示值、当前活动格。
 *
 * 拆成两步（第二片把"读值"从整份快照换成了引擎的按区域读取）：
 *
 * 1. `planAriaRange` 纯几何：归一化选区、按上限截断。**先保列宽**，一行里的横向关系比
 *    "多读几行"更有用；截断要如实标记，界面才能说"只投影了前 N 格"。
 * 2. `buildAriaGrid` 纯布局：拿一块显示值矩阵铺成行/列，标出活动格与稳定 DOM id。
 *
 * 两步都是纯函数：`planAriaRange` 不碰数据，`buildAriaGrid` 不碰引擎，读值由调用方注入。
 * 这样"读多少、怎么读"（引擎 API）与"投影成什么样"（无障碍语义）可以分开演进。
 */
export interface AriaRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

/** 归一化 + 截断之后的几何 */
export interface AriaRangePlan {
  startRow: number;
  startColumn: number;
  rowCount: number;
  columnCount: number;
  /** 选区比投影上限更大：只投影了一部分 */
  truncated: boolean;
}

export interface AriaGridInput extends AriaRangePlan {
  sheetId: string;
  /** 显示值矩阵（按行）；缺的格子视为空 */
  values: string[][];
}

export interface AriaGridCell {
  row: number;
  column: number;
  /** 稳定的 DOM id，供 `aria-activedescendant` 指过来 */
  id: string;
  /** 显示值；空单元格是空字符串，读屏文案由调用方补上"空白" */
  text: string;
  /** 选区左上角：当前活动格 */
  active: boolean;
}

export interface AriaGridModel extends AriaRangePlan {
  sheetId: string;
  /** 按行分组，渲染时直接 map */
  rows: AriaGridCell[][];
  activeId: string | null;
}

/** 一次最多投影多少格：读屏逐格读，超过这个量既没有意义也拖慢渲染 */
export const ARIA_GRID_MAX_CELLS = 600;

/**
 * 投影网格的 DOM id。
 * 画布（`role="application"`）用 `aria-owns` 把它挂成自己的"子节点"，
 * 于是 `aria-activedescendant` 指向的格子对读屏而言是合法的后代。
 */
export const ARIA_GRID_DOM_ID = 'sheet-a11y-grid';

export function ariaCellId(sheetId: string, row: number, column: number): string {
  return `sheet-a11y-${sheetId || 'sheet'}-r${row}-c${column}`;
}

/**
 * 选区的投影几何：反向选区（从右下往左上拖）与负数都要归一化——
 * DOM 的 id 不能出现负行列。
 */
export function planAriaRange(
  range: AriaRange | null,
  maxCells: number = ARIA_GRID_MAX_CELLS,
): AriaRangePlan | null {
  if (!range) return null;

  const startRow = Math.max(0, Math.min(range.startRow, range.endRow));
  const startColumn = Math.max(0, Math.min(range.startColumn, range.endColumn));
  const endRow = Math.max(range.startRow, range.endRow);
  const endColumn = Math.max(range.startColumn, range.endColumn);

  let rowCount = endRow - startRow + 1;
  let columnCount = endColumn - startColumn + 1;
  let truncated = false;

  if (rowCount > 0 && columnCount > 0 && rowCount * columnCount > maxCells) {
    truncated = true;
    // 先保列宽（一行里的横向关系比"多读几行"更有用）：按列数回算行数，再兜一次列数上限
    rowCount = Math.max(1, Math.min(rowCount, Math.floor(maxCells / columnCount)));
    columnCount = Math.max(1, Math.min(columnCount, Math.floor(maxCells / rowCount)));
  }

  return { startRow, startColumn, rowCount, columnCount, truncated };
}

export function buildAriaGrid(input: AriaGridInput): AriaGridModel {
  const { sheetId, startRow, startColumn, rowCount, columnCount, truncated, values } = input;
  const rows: AriaGridCell[][] = [];

  for (let r = 0; r < rowCount; r += 1) {
    const row = startRow + r;
    const valuesInRow = values[r] ?? [];
    const cells: AriaGridCell[] = [];
    for (let c = 0; c < columnCount; c += 1) {
      const column = startColumn + c;
      cells.push({
        row,
        column,
        id: ariaCellId(sheetId, row, column),
        text: valuesInRow[c] ?? '',
        active: row === startRow && column === startColumn,
      });
    }
    rows.push(cells);
  }

  return {
    sheetId,
    startRow,
    startColumn,
    rowCount,
    columnCount,
    rows,
    activeId:
      rows.length > 0 && columnCount > 0 ? ariaCellId(sheetId, startRow, startColumn) : null,
    truncated,
  };
}

/** 空模型：还没选区 / 引擎没就绪时用，渲染层据此返回 null */
export function emptyAriaGrid(): AriaGridModel {
  return {
    sheetId: '',
    startRow: 0,
    startColumn: 0,
    rowCount: 0,
    columnCount: 0,
    rows: [],
    activeId: null,
    truncated: false,
  };
}
