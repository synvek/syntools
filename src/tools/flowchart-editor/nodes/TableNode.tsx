import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store';
import { nodeDashArrayOf } from '../ops';
import { TABLE_NODE_SIZE, type FlowNodeData, type TableData } from '../model/types';
import {
  cellAt,
  columnWidths,
  computeTableLayout,
  insertCol,
  insertRow,
  mergeCells,
  normalizeTable,
  removeCol,
  removeRow,
  rowHeights,
  splitCell,
} from '../model/table';

/** 表格节点锚点：上下左右各一个边中点，便于连线吸附 */
const HANDLES: Array<{ id: string; position: Position }> = [
  { id: 't', position: Position.Top },
  { id: 'b', position: Position.Bottom },
  { id: 'l', position: Position.Left },
  { id: 'r', position: Position.Right },
];

interface CellRef {
  row: number;
  col: number;
}

function sumBefore(sizes: number[], index: number): number {
  let total = 0;
  for (let i = 0; i < index && i < sizes.length; i += 1) total += sizes[i];
  return total;
}

function spanSum(sizes: number[], from: number, count: number): number {
  let total = 0;
  for (let i = from; i < from + count && i < sizes.length; i += 1) total += sizes[i];
  return total;
}

/** 向右再合并一列（已到边界则保持不变） */
function mergeRight(table: TableData, cell: CellRef): TableData {
  const t = normalizeTable(table);
  const current = t.cells?.[cell.row]?.[cell.col];
  if (!current) return t;
  const colSpan = current.colspan ?? 1;
  if (colSpan >= t.cols - cell.col) return t;
  return mergeCells(t, cell.row, cell.col, current.rowspan ?? 1, colSpan + 1);
}

function TableTool({
  testId,
  title,
  onClick,
  children,
}: {
  testId: string;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      title={title}
      aria-label={title}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-semibold text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-gray-200 dark:hover:bg-blue-500/20"
    >
      {children}
    </button>
  );
}

/**
 * 表格节点：SVG 绘制单元格，双击就地编辑文本。
 * 结构操作（行列增删 / 合并拆分）通过选中节点后在节点内的工具条完成，
 * 纯逻辑位于 `model/table.ts`，可独立单测。
 */
function TableNodeComponent({ id, data, selected, width, height }: NodeProps) {
  const { t } = useTranslation();
  const d = data as FlowNodeData;
  const w = width ?? TABLE_NODE_SIZE.width;
  const h = height ?? TABLE_NODE_SIZE.height;

  const table = useMemo(() => normalizeTable(d.table), [d.table]);
  const boxes = useMemo(() => computeTableLayout(table), [table]);
  const colW = useMemo(() => columnWidths(table, w), [table, w]);
  const rowH = useMemo(() => rowHeights(table, h), [table, h]);

  const [active, setActive] = useState<CellRef | null>(null);
  const [editing, setEditing] = useState<CellRef | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    setDraft(cellAt(table, editing.row, editing.col).text ?? '');
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, [editing, table]);

  const commit = () => {
    if (!editing) return;
    useFlowStore.getState().setTableCellText(id, editing.row, editing.col, draft, true);
    setEditing(null);
  };

  const applyTable = (next: TableData) => useFlowStore.getState().setNodeTable(id, next, true);
  const target: CellRef = active ?? { row: table.rows - 1, col: table.cols - 1 };

  const stroke = selected ? '#1D4ED8' : d.style.stroke;
  const strokeWidth = selected ? d.style.strokeWidth + 0.8 : d.style.strokeWidth;
  const textColor = d.style.textColor ?? stroke;

  const geom = (b: { row: number; col: number; rowSpan: number; colSpan: number }) => ({
    x: sumBefore(colW, b.col),
    y: sumBefore(rowH, b.row),
    bw: spanSum(colW, b.col, b.colSpan),
    bh: spanSum(rowH, b.row, b.rowSpan),
  });

  return (
    <div
      className="group/node relative"
      data-kind="table"
      data-testid="flowchart-table"
      style={{ width: w, height: h, cursor: 'grab' }}
      onDoubleClick={() => !editing && setEditing(active ?? { row: 0, col: 0 })}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="absolute inset-0"
        style={{
          opacity: d.style.opacity ?? 1,
          filter: d.style.shadow ? 'drop-shadow(0 2px 5px rgba(15,23,42,0.25))' : undefined,
        }}
      >
        {boxes.map((b) => {
          const { x, y, bw, bh } = geom(b);
          return (
            <rect
              key={`${b.row}-${b.col}`}
              x={x}
              y={y}
              width={bw}
              height={bh}
              fill={b.cell.fill ?? d.style.fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={nodeDashArrayOf(d.style.lineDash, strokeWidth)}
            />
          );
        })}
      </svg>

      {boxes.map((b) => {
        const { x, y, bw, bh } = geom(b);
        const isActive = active?.row === b.row && active?.col === b.col;
        const align = b.cell.align ?? d.style.align;
        return (
          <div
            key={`t-${b.row}-${b.col}`}
            data-testid={`table-cell-${b.row}-${b.col}`}
            className="absolute flex items-center overflow-hidden px-1.5 text-[12px]"
            style={{
              left: x,
              top: y,
              width: bw,
              height: bh,
              color: textColor,
              justifyContent:
                align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
              fontWeight: (b.cell.bold ?? d.style.bold) ? 700 : 400,
              fontStyle: d.style.italic ? 'italic' : 'normal',
              fontFamily: d.style.fontFamily,
              whiteSpace: 'pre-wrap',
              lineHeight: d.style.lineHeight ?? 1.25,
              boxShadow: isActive ? 'inset 0 0 0 2px rgba(29,78,216,0.7)' : undefined,
            }}
            onPointerDown={(e) => {
              if (editing) return;
              // 必须阻止冒泡：否则 React Flow 会在节点上启动拖拽，双击进入编辑会被吞掉
              e.stopPropagation();
              setActive({ row: b.row, col: b.col });
            }}
          >
            {editing && isActive ? (
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  // 阻止冒泡：提交后 textarea 卸载，避免全局快捷键误判为画布操作
                  e.stopPropagation();
                  if (e.key === 'Escape') {
                    setEditing(null);
                    return;
                  }
                  // Enter 换行（单元格支持多行），⌘/Ctrl+Enter 提交
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    commit();
                  }
                }}
                className="nodrag absolute inset-0 resize-none rounded-sm bg-white/95 px-1 outline-none dark:bg-gray-900/95"
                style={{ color: textColor, font: 'inherit' }}
              />
            ) : (
              b.cell.text
            )}
          </div>
        );
      })}

      {selected ? (
        <div
          className="nodrag nopan absolute z-30 flex items-center gap-0.5 rounded-md border border-gray-200 bg-white/95 px-1 py-0.5 shadow-sm dark:border-gray-600 dark:bg-gray-800/95"
          style={{ top: -30, left: 0 }}
        >
          <TableTool
            testId="table-insert-row"
            title={t('tools.flowchart.tableInsertRow')}
            onClick={() => applyTable(insertRow(table, target.row))}
          >
            ↓+
          </TableTool>
          <TableTool
            testId="table-insert-col"
            title={t('tools.flowchart.tableInsertCol')}
            onClick={() => applyTable(insertCol(table, target.col))}
          >
            →+
          </TableTool>
          <TableTool
            testId="table-remove-row"
            title={t('tools.flowchart.tableRemoveRow')}
            onClick={() => applyTable(removeRow(table, target.row))}
          >
            ↓−
          </TableTool>
          <TableTool
            testId="table-remove-col"
            title={t('tools.flowchart.tableRemoveCol')}
            onClick={() => applyTable(removeCol(table, target.col))}
          >
            →−
          </TableTool>
          <TableTool
            testId="table-merge"
            title={t('tools.flowchart.tableMerge')}
            onClick={() => applyTable(mergeRight(table, target))}
          >
            ⤢
          </TableTool>
          <TableTool
            testId="table-split"
            title={t('tools.flowchart.tableSplit')}
            onClick={() => applyTable(splitCell(table, target.row, target.col))}
          >
            ⤡
          </TableTool>
        </div>
      ) : null}

      {selected ? (
        <NodeResizer
          minWidth={80}
          minHeight={40}
          onResizeStart={() => useFlowStore.getState().commit()}
        />
      ) : null}

      {HANDLES.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={handle.position}
          className="!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent"
        >
          <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-blue-500 ring-2 ring-blue-300/70 opacity-0 transition-opacity group-hover/node:opacity-100" />
        </Handle>
      ))}
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
