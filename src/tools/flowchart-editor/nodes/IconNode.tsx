import { memo } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { useFlowStore } from '../store';
import { ICON_NODE_SIZE, type FlowNodeData } from '../model/types';
import { iconDefOf } from '../model/icons';
import { nodeDashArrayOf } from '../ops';

/** 内置图标节点：描边色即图标颜色，导出 SVG/PNG 与画布一致 */
function IconNodeComponent({ data, selected, width, height }: NodeProps) {
  const d = data as FlowNodeData;
  const w = width ?? ICON_NODE_SIZE.width;
  const h = height ?? ICON_NODE_SIZE.height;
  const def = iconDefOf(d.iconId);
  const color = selected ? '#1D4ED8' : (d.style.textColor ?? d.style.stroke ?? '#0F172A');
  const strokeWidth = Math.max(1.2, (d.style.fontSize ?? 14) / 8);

  return (
    <div className="relative" style={{ width: w, height: h, cursor: 'grab' }}>
      <svg
        width={w}
        height={h}
        viewBox="0 0 24 24"
        className="absolute inset-0"
        style={{
          opacity: d.style.opacity ?? 1,
          filter: d.style.shadow ? 'drop-shadow(0 2px 4px rgba(15,23,42,0.28))' : undefined,
          color,
        }}
      >
        {def ? (
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={nodeDashArrayOf(d.style.lineDash, strokeWidth)}
          >
            {def.paths.map((path, index) => (
              <path key={index} d={path} />
            ))}
          </g>
        ) : (
          <rect
            x={1}
            y={1}
            width={22}
            height={22}
            rx={3}
            fill="none"
            stroke="currentColor"
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {d.label ? (
        <span
          className="pointer-events-none absolute inset-x-0 -bottom-5 truncate text-center text-[11px] leading-tight"
          style={{ color: d.style.textColor ?? '#334155' }}
        >
          {d.label}
        </span>
      ) : null}

      {selected ? (
        <NodeResizer
          minWidth={24}
          minHeight={24}
          onResizeStart={() => useFlowStore.getState().commit()}
        />
      ) : null}
    </div>
  );
}

export const IconNode = memo(IconNodeComponent);
