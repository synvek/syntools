import { memo, useEffect, useRef, useState } from 'react';
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { useFlowStore } from '../store';
import {
  type FlowNodeData,
  isContainerKind,
  SWIMLANE_HEADER_HEIGHT,
  SWIMLANE_HEADER_WIDTH,
} from '../model/types';
import { shapeDefOf, shapeSize } from '../model/shapes';
import { drawDecor, drawShape } from './shapeDraw';
import { nodeDashArrayOf } from '../ops';
import { useQuickConnect } from '../quickConnect';

/**
 * 自由连线锚点：上下边各 3 个（含靠近两角的位置）、左右边各 1 个，共 8 个。
 * 配合 ConnectionMode.Loose，任意锚点都可作为起点或终点，接近 Draw.io 的自由连线体验。
 */
const HANDLES: Array<{ id: string; position: Position; offset: string }> = [
  { id: 't-l', position: Position.Top, offset: '25%' },
  { id: 't', position: Position.Top, offset: '50%' },
  { id: 't-r', position: Position.Top, offset: '75%' },
  { id: 'b-l', position: Position.Bottom, offset: '25%' },
  { id: 'b', position: Position.Bottom, offset: '50%' },
  { id: 'b-r', position: Position.Bottom, offset: '75%' },
  { id: 'l', position: Position.Left, offset: '50%' },
  { id: 'r', position: Position.Right, offset: '50%' },
];

/**
 * 悬停快速连线箭头（类 draw.io / ProcessOn）：点击即朝该方向生成同类型相连图形并自动连线。
 * 仅对普通图形显示；容器（泳道/编组）不提供。
 */
const QUICK_DIRS: Array<{
  dir: 'up' | 'down' | 'left' | 'right';
  pos: React.CSSProperties;
  rotate: number;
}> = [
  { dir: 'up', pos: { left: '50%', top: -18, transform: 'translate(-50%, -50%)' }, rotate: 0 },
  {
    dir: 'down',
    pos: { left: '50%', bottom: -18, transform: 'translate(-50%, 50%)' },
    rotate: 180,
  },
  { dir: 'left', pos: { left: -18, top: '50%', transform: 'translate(-50%, -50%)' }, rotate: -90 },
  { dir: 'right', pos: { right: -18, top: '50%', transform: 'translate(50%, -50%)' }, rotate: 90 },
];

function ShapeNodeComponent({ id, data, selected, width, height }: NodeProps) {
  const d = data as FlowNodeData;
  const def = shapeDefOf(d.kind);
  // 必须给出确定尺寸：若依赖父容器的百分比高度，节点会被撑成 0 高度而不可见
  const fallback = shapeSize(d.kind);
  const w = width ?? fallback.width;
  const h = height ?? fallback.height;
  const setNodeLabel = useFlowStore((s) => s.setNodeLabel);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(d.label);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, d.label]);

  const commit = () => {
    setNodeLabel(id, draft, true);
    setEditing(false);
  };

  const style = d.style;
  const strokeColor = selected ? '#1D4ED8' : style.stroke;
  const strokeWidth = selected ? style.strokeWidth + 1.5 : style.strokeWidth;
  const textColor = style.textColor ?? strokeColor;
  const isContainer = isContainerKind(d.kind);
  const isGroup = d.kind === 'group';
  // 纵向泳道与编组的标题栏在顶部；横向泳道在左侧
  const headerOnTop = def?.draw === 'laneV' || isGroup;

  return (
    <div
      className="group/node relative"
      onDoubleClick={() => !isContainer && setEditing(true)}
      style={{ width: w, height: h, cursor: 'grab' }}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="absolute inset-0 overflow-visible"
        style={style.shadow ? { filter: 'drop-shadow(0 2px 5px rgba(15,23,42,0.25))' } : undefined}
      >
        <g
          fill={style.fill}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fillOpacity={style.opacity ?? 1}
          strokeDasharray={nodeDashArrayOf(style.lineDash, strokeWidth)}
          style={{ transition: 'stroke 120ms ease' }}
        >
          {def ? drawShape(def, w, h, style) : <rect x={0} y={0} width={w} height={h} rx={4} />}
        </g>
        {def ? (
          <g stroke={strokeColor} strokeWidth={Math.max(1.5, strokeWidth - 0.5)}>
            {drawDecor(def, w, h)}
          </g>
        ) : null}
      </svg>

      {isContainer ? (
        headerOnTop ? (
          <div
            className="absolute left-0 top-0 flex items-center px-3 text-[13px] font-semibold"
            style={{
              height: isGroup ? 26 : SWIMLANE_HEADER_HEIGHT,
              width: w,
              color: style.stroke,
            }}
          >
            {d.label || (isGroup ? '编组' : '泳道')}
          </div>
        ) : (
          <div
            className="absolute left-0 top-0 flex items-center justify-center text-[13px] font-semibold"
            style={{
              width: SWIMLANE_HEADER_WIDTH,
              height: h,
              color: style.stroke,
              writingMode: 'vertical-rl',
            }}
          >
            {d.label || '泳道'}
          </div>
        )
      ) : editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="absolute inset-0 z-10 bg-white/90 px-2 text-center text-[13px] outline-none dark:bg-gray-900/90"
          style={{
            color: textColor,
            fontWeight: style.bold ? 700 : 400,
            fontStyle: style.italic ? 'italic' : 'normal',
            textAlign: style.align,
          }}
        />
      ) : (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 leading-tight"
          style={{
            color: textColor,
            fontSize: style.fontSize,
            fontWeight: style.bold ? 700 : 400,
            fontStyle: style.italic ? 'italic' : 'normal',
            textAlign: style.align,
            fontFamily: style.fontFamily,
          }}
        >
          {d.label || ' '}
        </div>
      )}

      {/* 尺寸调整：容器（泳道 / 编组）同样可缩放，只是最小尺寸更大 */}
      {selected ? (
        <NodeResizer
          minWidth={isContainer ? 200 : 48}
          minHeight={isContainer ? 140 : 32}
          onResizeStart={() => useFlowStore.getState().commit()}
        />
      ) : null}

      {/* 容器不提供连线锚点 */}
      {!isContainer &&
        HANDLES.map((handle) => (
          <Handle
            key={handle.id}
            id={handle.id}
            type="source"
            position={handle.position}
            style={
              handle.position === Position.Top || handle.position === Position.Bottom
                ? { left: handle.offset }
                : { top: handle.offset }
            }
            className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-blue-500 !ring-2 !ring-blue-300/70 opacity-0 transition-opacity group-hover/node:opacity-100"
          />
        ))}

      {/* 悬停快速连线箭头：按住拖出连线，松手弹出图形选择弹窗 */}
      {!isContainer &&
        QUICK_DIRS.map((q) => (
          <button
            key={q.dir}
            type="button"
            aria-label={`快速连线-${q.dir}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              useQuickConnect
                .getState()
                .start({ sourceId: id, dir: q.dir, x: e.clientX, y: e.clientY });
            }}
            className={`quick-connect nodrag nopan absolute z-20 flex cursor-crosshair items-center justify-center rounded-full bg-blue-500 text-white shadow-md ring-2 ring-white transition ${
              selected ? 'opacity-100' : 'opacity-0 group-hover/node:opacity-100'
            }`}
            style={q.pos}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3"
              style={{ transform: `rotate(${q.rotate}deg)` }}
            >
              <path
                d="M12 4 L12 20 M6 10 L12 4 L18 10"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
    </div>
  );
}

export const ShapeNode = memo(ShapeNodeComponent);
