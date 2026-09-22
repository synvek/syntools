import { getBezierPath, type EdgeProps } from '@xyflow/react';

/**
 * 脑图分支连线：平滑贝塞尔曲线，颜色继承所属分支，层级越深越细。
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
