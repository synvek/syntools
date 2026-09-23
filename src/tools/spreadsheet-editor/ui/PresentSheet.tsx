import { columnIndexToName, type PresentCell, type PresentGrid } from '../core';

/**
 * 放映用的只读表格。
 *
 * 表格数据来自 `buildPresentGrid`（快照 → 纯数据），因此不需要 Univer 实例，
 * 也不会影响正在编辑的工作簿；合并单元格按 rowSpan / colSpan 还原。
 */

const CELL_WIDTH = 108;
const ROW_HEIGHT = 26;

export function PresentSheet({ grid }: { grid: PresentGrid }) {
  const merges = new Map<string, PresentGrid['merges'][number]>();
  for (const merge of grid.merges) merges.set(`${merge.row}:${merge.col}`, merge);

  // 被合并区域覆盖的格子不单独渲染
  const covered = new Set<string>();
  for (const merge of grid.merges) {
    for (let row = merge.row; row < merge.row + merge.rowSpan; row += 1) {
      for (let col = merge.col; col < merge.col + merge.colSpan; col += 1) {
        if (row !== merge.row || col !== merge.col) covered.add(`${row}:${col}`);
      }
    }
  }

  const byPosition = new Map<string, PresentCell>();
  for (const cell of grid.cells) byPosition.set(`${cell.row}:${cell.col}`, cell);

  const rows = [];
  for (let row = 0; row < grid.rows; row += 1) {
    const cells = [];
    for (let col = 0; col < grid.cols; col += 1) {
      const key = `${row}:${col}`;
      if (covered.has(key)) continue;
      const cell = byPosition.get(key);
      const merge = merges.get(key);
      cells.push(
        <td
          key={key}
          colSpan={merge?.colSpan ?? 1}
          rowSpan={merge?.rowSpan ?? 1}
          title={cell?.text}
          style={{
            width: merge ? undefined : CELL_WIDTH,
            height: ROW_HEIGHT,
            fontWeight: cell?.bold ? 600 : undefined,
            fontStyle: cell?.italic ? 'italic' : undefined,
            textDecoration: cell?.underline ? 'underline' : undefined,
            fontSize: cell?.fontSize ? Math.max(10, Math.min(20, cell.fontSize)) : undefined,
            color: cell?.color,
            background: cell?.background,
            textAlign: cell?.align,
          }}
          className="max-w-[280px] truncate border border-gray-200 px-1.5 align-middle text-[12px] text-gray-800"
        >
          {cell?.text ?? ''}
        </td>,
      );
    }
    rows.push(
      <tr key={row}>
        <th className="sticky left-0 z-10 w-10 border border-gray-200 bg-gray-100 px-1 text-[11px] font-normal text-gray-500">
          {row + 1}
        </th>
        {cells}
      </tr>,
    );
  }

  return (
    <div className="max-h-full max-w-full overflow-auto rounded-lg bg-white shadow-2xl">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 w-10 border border-gray-200 bg-gray-100" />
            {Array.from({ length: grid.cols }, (_, col) => (
              <th
                key={col}
                className="sticky top-0 z-10 border border-gray-200 bg-gray-100 px-1 text-[11px] font-normal text-gray-500"
                style={{ minWidth: CELL_WIDTH }}
              >
                {columnIndexToName(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      {grid.truncated ? (
        <p
          data-testid="present-sheet-truncated"
          className="border-t border-gray-200 px-2 py-1 text-[11px] text-gray-500"
        >
          …{grid.rows} × {grid.cols}
        </p>
      ) : null}
    </div>
  );
}
