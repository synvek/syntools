import { memo } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { useFlowStore } from '../store';
import { IMAGE_NODE_SIZE, type FlowNodeData } from '../model/types';

/** 图片节点：dataURL 内联渲染，等比适配（object-fit: contain） */
function ImageNodeComponent({ data, selected, width, height }: NodeProps) {
  const d = data as FlowNodeData;
  const w = width ?? IMAGE_NODE_SIZE.width;
  const h = height ?? IMAGE_NODE_SIZE.height;

  return (
    <div className="relative" style={{ width: w, height: h, cursor: 'grab' }}>
      <div
        className="h-full w-full overflow-hidden rounded-md bg-white dark:bg-gray-900"
        style={{
          borderWidth: Math.max(1, d.style.strokeWidth ?? 1),
          borderStyle: 'solid',
          borderColor: d.style.stroke ?? '#CBD5E1',
          opacity: d.style.opacity ?? 1,
          boxShadow: d.style.shadow ? '0 2px 5px rgba(15,23,42,0.25)' : undefined,
        }}
      >
        {d.src ? (
          <img
            src={d.src}
            alt={d.label}
            draggable={false}
            className="h-full w-full object-contain"
          />
        ) : null}
      </div>

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
          minWidth={48}
          minHeight={32}
          onResizeStart={() => useFlowStore.getState().commit()}
        />
      ) : null}
    </div>
  );
}

export const ImageNode = memo(ImageNodeComponent);
