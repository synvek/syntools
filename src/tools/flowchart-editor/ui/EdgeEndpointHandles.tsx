import { useEffect, useRef } from 'react';
import { useViewport } from '@xyflow/react';
import { useFlowStore } from '../store';
import { absoluteRectOf } from '../core';

/** 八个锚点在图形内的相对位置与外法线方向（与 ShapeNode 的 HANDLES 一致） */
const HANDLE_SIDES: Record<string, { fx: number; fy: number }> = {
  't-l': { fx: 0.25, fy: 0 },
  t: { fx: 0.5, fy: 0 },
  't-r': { fx: 0.75, fy: 0 },
  'b-l': { fx: 0.25, fy: 1 },
  b: { fx: 0.5, fy: 1 },
  'b-r': { fx: 0.75, fy: 1 },
  l: { fx: 0, fy: 0.5 },
  r: { fx: 1, fy: 0.5 },
};

/** 方块边长（画布单位，随缩放同步）：小于箭头长度，覆盖箭头根部但能看到大部分箭头 */
const SQUARE = 9;
const MIN_SQUARE_PX = 7;

/**
 * 用自绘小方块替代 React Flow 默认的大圆重连端点。
 * 方块中心严格等于连线终点（即图形边缘上的锚点位置），因此只盖住箭头根部、
 * 仍能看到大部分箭头；同时比原来的圆形小得多。
 *
 * 交互：方块自身接收按下，并通过**原生 mousedown 监听**向 React Flow 隐藏的原生端点
 * 派发一次 mousedown，后续拖拽/吸附/投放全部由 React Flow 完成（其拖拽监听挂在 document 上）。
 * 这里必须用原生监听而非 React 的 onMouseDown：在 React 事件处理器内部派发的合成事件不会被处理。
 */
function EndpointSquare(props: {
  edgeId: string;
  end: 'source' | 'target';
  left: number;
  top: number;
  size: number;
}) {
  const { edgeId, end, left, top, size } = props;
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDown = (e: MouseEvent) => {
      const circle = document.querySelector<SVGElement>(
        `.react-flow__edge[data-id="${edgeId}"] .react-flow__edgeupdater-${end}`,
      );
      if (!circle) return;
      e.preventDefault();
      e.stopPropagation();
      circle.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: e.clientX,
          clientY: e.clientY,
        }),
      );
    };
    el.addEventListener('mousedown', onDown);
    return () => el.removeEventListener('mousedown', onDown);
  }, [edgeId, end]);

  return (
    <button
      ref={ref}
      type="button"
      data-testid="edge-endpoint"
      data-end={end}
      aria-label={end === 'source' ? '重连起点' : '重连终点'}
      title={end === 'source' ? '重连起点' : '重连终点'}
      className="edge-endpoint pointer-events-auto absolute cursor-grab rounded-[2px] border border-white bg-blue-600 shadow-sm transition-colors hover:bg-blue-700 active:cursor-grabbing"
      style={{ left, top, width: size, height: size }}
    />
  );
}

/** 选中连线两端的重连端点方块 */
export function EdgeEndpointHandles() {
  const { x: vx, y: vy, zoom } = useViewport();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const selectedEdges = useFlowStore((s) => s.selectedEdges);

  if (selectedEdges.length === 0) return null;

  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const selected = new Set(selectedEdges);
  const size = Math.max(MIN_SQUARE_PX, SQUARE * zoom);
  const items: Array<{
    key: string;
    edgeId: string;
    end: 'source' | 'target';
    left: number;
    top: number;
  }> = [];

  for (const edge of edges) {
    if (!selected.has(edge.id)) continue;
    for (const end of ['source', 'target'] as const) {
      const node = byId.get(end === 'source' ? edge.source : edge.target);
      if (!node) continue;
      const rect = absoluteRectOf(node, byId);
      const handleId = (end === 'source' ? edge.sourceHandle : edge.targetHandle) ?? '';
      const side = HANDLE_SIDES[handleId];
      let px: number;
      let py: number;
      if (side) {
        px = rect.x + rect.width * side.fx;
        py = rect.y + rect.height * side.fy;
      } else {
        // 无锚点信息的连线（如导入数据）：按两端相对方位取朝向对方的边中点
        const other = byId.get(end === 'source' ? edge.target : edge.source);
        const oRect = other ? absoluteRectOf(other, byId) : rect;
        const dx = oRect.x + oRect.width / 2 - (rect.x + rect.width / 2);
        const dy = oRect.y + oRect.height / 2 - (rect.y + rect.height / 2);
        if (Math.abs(dx) >= Math.abs(dy)) {
          px = rect.x + (dx >= 0 ? rect.width : 0);
          py = rect.y + rect.height / 2;
        } else {
          px = rect.x + rect.width / 2;
          py = rect.y + (dy >= 0 ? rect.height : 0);
        }
      }
      // 方块中心 = 连线终点（图形边缘），不做任何外移
      items.push({
        key: `${edge.id}-${end}`,
        edgeId: edge.id,
        end,
        left: vx + px * zoom - size / 2,
        top: vy + py * zoom - size / 2,
      });
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {items.map((it) => (
        <EndpointSquare
          key={it.key}
          edgeId={it.edgeId}
          end={it.end}
          left={it.left}
          top={it.top}
          size={size}
        />
      ))}
    </div>
  );
}
