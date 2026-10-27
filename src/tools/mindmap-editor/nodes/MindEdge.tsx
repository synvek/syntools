import { getBezierPath, type EdgeProps } from '@xyflow/react';

/**
 * Mind map branch edge: smooth bezier curve, inherits the branch colour and thins out with depth.
 */
export function MindEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.45,
  });
  const meta = data as { color?: string; width?: number } | undefined;
  const color = meta?.color ?? '#94a3b8';
  const width = meta?.width ?? 2;
  return (
    <path
      id={id}
      className="mind-edge"
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
    />
  );
}
