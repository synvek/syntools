import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useFlowStore } from '../store';
import { type FlowNodeData, type ShapeKind, shapeSize } from '../model/types';

const HANDLES: Array<{ id: string; position: Position }> = [
  { id: 't', position: Position.Top },
  { id: 'r', position: Position.Right },
  { id: 'b', position: Position.Bottom },
  { id: 'l', position: Position.Left },
];

function shapeGeometry(kind: ShapeKind, w: number, h: number) {
  switch (kind) {
    case 'startEnd':
      return <rect x={0} y={0} width={w} height={h} rx={h / 2} ry={h / 2} />;
    case 'decision':
      return <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} />;
    case 'data':
      return <polygon points={`${h / 4},0 ${w},0 ${w - h / 4},${h} 0,${h}`} />;
    case 'swimlane':
      // 泳道：外侧圆角矩形 + 顶部标题条
      return (
        <g>
          <rect x={0} y={0} width={w} height={h} rx={10} ry={10} />
          <path
            d={`M0,10 a10,10 0 0 1 10,-10 h${w - 20} a10,10 0 0 1 10,10 v22 h-${w} z`}
            className="swimlane-header"
          />
        </g>
      );
    case 'bpmnTask':
      return <rect x={0} y={0} width={w} height={h} rx={8} ry={8} />;
    case 'rect':
    default:
      return <rect x={0} y={0} width={w} height={h} rx={4} ry={4} />;
  }
}

function ShapeNodeComponent({ id, data, selected, width, height }: NodeProps) {
  const d = data as FlowNodeData;
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
  const isSwimlane = d.kind === 'swimlane';

  return (
    <div
      className="group relative"
      onDoubleClick={() => !isSwimlane && setEditing(true)}
      style={{ width: w, height: h, cursor: 'grab' }}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="absolute inset-0 overflow-visible"
      >
        <g
          fill={style.fill}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          style={{ transition: 'stroke 120ms ease' }}
        >
          {shapeGeometry(d.kind, w, h)}
        </g>
      </svg>

      {isSwimlane ? (
        <div
          className="absolute left-0 top-0 flex h-[32px] items-center px-3 text-[13px] font-semibold"
          style={{ color: style.stroke, width: w }}
        >
          {d.label || '泳道'}
        </div>
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
            color: style.stroke,
            fontWeight: style.bold ? 700 : 400,
            fontStyle: style.italic ? 'italic' : 'normal',
            textAlign: style.align,
          }}
        />
      ) : (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 leading-tight"
          style={{
            color: style.stroke,
            fontSize: style.fontSize,
            fontWeight: style.bold ? 700 : 400,
            fontStyle: style.italic ? 'italic' : 'normal',
            textAlign: style.align,
          }}
        >
          {d.label || ' '}
        </div>
      )}

      {HANDLES.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={handle.position}
          className={`!h-2.5 !w-2.5 !border-2 !border-white !bg-blue-500 opacity-0 transition-opacity group-hover:opacity-100 ${
            selected ? '!opacity-100' : ''
          }`}
        />
      ))}
    </div>
  );
}

export const ShapeNode = memo(ShapeNodeComponent);
