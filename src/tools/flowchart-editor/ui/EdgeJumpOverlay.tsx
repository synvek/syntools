import { useMemo } from 'react';
import { useViewport } from '@xyflow/react';
import { useFlowStore } from '../store';
import { computeEdgeJumps } from '../model/jumps';

/**
 * 连线跳线覆盖层（弧线跨越）。
 *
 * 绘制在两遍：先用画布背景色画一条较粗的弧线「擦掉」底下的直线，
 * 再用连线自身颜色画细弧，从而呈现「跨线」效果。
 * 与 Viewport 同步变换，保证与 React Flow 的连线严格对齐。
 */
export function EdgeJumpOverlay() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const { x: vx, y: vy, zoom } = useViewport();
  const marks = useMemo(() => computeEdgeJumps(nodes, edges), [nodes, edges]);

  if (marks.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 5 }}
      data-testid="flowchart-edge-jumps"
      aria-hidden="true"
    >
      <g transform={`translate(${vx}, ${vy}) scale(${zoom})`}>
        {marks.map((m, i) => {
          const dx = Math.cos(m.angle) * m.radius;
          const dy = Math.sin(m.angle) * m.radius;
          const d = `M${m.x - dx},${m.y - dy} A${m.radius},${m.radius} 0 0 ${m.sweep} ${m.x + dx},${m.y + dy}`;
          return (
            <path
              key={`mask-${i}`}
              d={d}
              fill="none"
              stroke="var(--flow-canvas-bg, #ffffff)"
              strokeWidth={6}
            />
          );
        })}
        {marks.map((m, i) => {
          const dx = Math.cos(m.angle) * m.radius;
          const dy = Math.sin(m.angle) * m.radius;
          const d = `M${m.x - dx},${m.y - dy} A${m.radius},${m.radius} 0 0 ${m.sweep} ${m.x + dx},${m.y + dy}`;
          return (
            <path
              key={`arc-${i}`}
              d={d}
              fill="none"
              stroke={m.stroke}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          );
        })}
      </g>
    </svg>
  );
}
