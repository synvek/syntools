import {
  columnIndexToName,
  PRESENT_CELL_WIDTH,
  PRESENT_COL_HEADER_HEIGHT,
  PRESENT_ROW_HEIGHT,
  PRESENT_ROW_HEADER_WIDTH,
  type PresentCell,
  type PresentGrid,
  type PresentObject,
} from '../core';

/**
 * Read-only grid used by present mode.
 *
 * Data comes from `buildPresentGrid` (snapshot → plain data), so no Univer instance is needed and the
 * workbook being edited is untouched; merged cells are restored via rowSpan / colSpan.
 *
 * 对象层（P2-10）：图片 / 形状 / 图表按 `PresentGrid.objects` 的坐标叠在表格上方。坐标已经由
 * `buildPresentGrid` 换算成"相对整张表的 CSS px"，这里只负责画，不再做任何几何计算——
 * 一旦两端各算一次，必然出现 1px 级别的错位，且改列宽时会双份改。
 */

const CELL_WIDTH = PRESENT_CELL_WIDTH;
const ROW_HEIGHT = PRESENT_ROW_HEIGHT;

function ObjectLayer({ objects }: { objects: PresentObject[] }) {
  if (objects.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      {objects.map((object) => {
        const box = {
          left: object.left,
          top: object.top,
          width: object.width,
          height: object.height,
          zIndex: 1 + object.z,
        };
        if (object.kind === 'image') {
          return (
            <img
              key={object.id}
              data-testid={`present-image-${object.id}`}
              src={object.src}
              alt={object.name ?? ''}
              className="absolute object-contain"
              style={box}
            />
          );
        }
        if (object.kind === 'shape') {
          return (
            <div
              key={object.id}
              data-testid={`present-shape-${object.id}`}
              className="absolute flex items-center justify-center overflow-hidden text-center text-[12px] text-gray-800"
              style={{
                ...box,
                background: object.fill,
                border: object.strokeWidth
                  ? `${object.strokeWidth}px solid ${object.stroke ?? 'transparent'}`
                  : undefined,
                borderRadius: object.rotation ? undefined : 4,
                transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
              }}
            >
              {object.text}
            </div>
          );
        }
        // 图表：演示视图里是定位占位框。位图需要离屏跑一遍 ECharts（与打印同一条路），
        // 属于 P1-6 的能力，演示侧暂不重复引入；这里至少让位置、尺寸、标题是对的。
        return (
          <div
            key={object.id}
            data-testid={`present-chart-${object.id}`}
            className="absolute flex flex-col items-center justify-center gap-1 rounded border border-dashed border-gray-300 bg-white/80 text-[12px] text-gray-500"
            style={box}
          >
            <span className="font-medium text-gray-600">{object.label || 'Chart'}</span>
            <span className="text-[11px]">
              {object.width} × {object.height}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PresentSheet({ grid }: { grid: PresentGrid }) {
  const merges = new Map<string, PresentGrid['merges'][number]>();
  for (const merge of grid.merges) merges.set(`${merge.row}:${merge.col}`, merge);

  // Cells covered by a merged region are not rendered separately
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
            textDecoration: cell?.underline
              ? `underline${cell.underline === 'double' ? ' double' : ''}`
              : undefined,
            verticalAlign: cell?.baseline,
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
        <th
          className="sticky left-0 z-10 border border-gray-200 bg-gray-100 px-1 text-[11px] font-normal text-gray-500"
          style={{ width: PRESENT_ROW_HEADER_WIDTH, height: ROW_HEIGHT }}
        >
          {row + 1}
        </th>
        {cells}
      </tr>,
    );
  }

  return (
    <div className="max-h-full max-w-full overflow-auto rounded-lg bg-white shadow-2xl">
      {/* relative 包裹层：对象层的坐标就是相对这里（和投影用的原点一致） */}
      <div className="relative">
        <table className="border-collapse">
          <thead>
            <tr>
              <th
                className="sticky left-0 top-0 z-20 border border-gray-200 bg-gray-100"
                style={{ width: PRESENT_ROW_HEADER_WIDTH, height: PRESENT_COL_HEADER_HEIGHT }}
              />
              {Array.from({ length: grid.cols }, (_, col) => (
                <th
                  key={col}
                  className="sticky top-0 z-10 border border-gray-200 bg-gray-100 px-1 text-[11px] font-normal text-gray-500"
                  style={{ minWidth: CELL_WIDTH, height: PRESENT_COL_HEADER_HEIGHT }}
                >
                  {columnIndexToName(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
        <ObjectLayer objects={grid.objects} />
      </div>
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
