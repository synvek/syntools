import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CurvePoint } from '../model/types';

/**
 * 曲线编辑器（RGB 主通道）。
 *
 * 采用**固定 x 的 5 个控制点**（0 / 64 / 128 / 192 / 255），纵向拖拽调整输出值：
 * 相比「自由增删控制点」的实现更稳、无自交风险，同时保留了曲线最核心的
 * 「压暗阴影 / 提亮中间调 / 收高光」能力。LUT 由 `core.buildCurveLut`（PCHIP）生成。
 */

const SIZE = 200;
const PAD = 10;

export function CurveEditor({
  points,
  label,
  onChange,
  onCommit,
}: {
  points: CurvePoint[];
  label: string;
  onChange: (points: CurvePoint[]) => void;
  onCommit: () => void;
}) {
  const rootRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef<number | null>(null);

  const toSvg = (event: PointerEvent | ReactPointerEvent) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const scale = SIZE / Math.max(1, rect.width);
    return {
      x: (event.clientX - rect.left) * scale,
      y: (event.clientY - rect.top) * scale,
    };
  };

  const valueFromY = (y: number) => {
    const inner = SIZE - PAD * 2;
    const normalized = 1 - (y - PAD) / inner;
    return Math.max(0, Math.min(255, Math.round(normalized * 255)));
  };

  const screenOf = (point: CurvePoint) => ({
    x: PAD + (point.x / 255) * (SIZE - PAD * 2),
    y: PAD + (1 - point.y / 255) * (SIZE - PAD * 2),
  });

  const startDrag = (index: number) => (event: ReactPointerEvent<SVGCircleElement>) => {
    event.preventDefault();
    dragging.current = index;
    const onMove = (move: PointerEvent) => {
      const index2 = dragging.current;
      if (index2 === null) return;
      const { y } = toSvg(move);
      const next = points.map((point, i) =>
        i === index2 ? { ...point, y: valueFromY(y) } : point,
      );
      onChange(next);
    };
    const onUp = () => {
      dragging.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onCommit();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const line = points.map((point) => {
    const { x, y } = screenOf(point);
    return `${x},${y}`;
  });

  return (
    <svg
      ref={rootRef}
      role="img"
      aria-label={label}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-32 w-full touch-none rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
    >
      {/* 网格 */}
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={`v-${ratio}`}
          x1={PAD + ratio * (SIZE - PAD * 2)}
          y1={PAD}
          x2={PAD + ratio * (SIZE - PAD * 2)}
          y2={SIZE - PAD}
          stroke="currentColor"
          className="text-gray-200 dark:text-gray-700"
          strokeWidth={1}
        />
      ))}
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={`h-${ratio}`}
          x1={PAD}
          y1={PAD + ratio * (SIZE - PAD * 2)}
          x2={SIZE - PAD}
          y2={PAD + ratio * (SIZE - PAD * 2)}
          stroke="currentColor"
          className="text-gray-200 dark:text-gray-700"
          strokeWidth={1}
        />
      ))}
      {/* 参考对角线 */}
      <line
        x1={PAD}
        y1={SIZE - PAD}
        x2={SIZE - PAD}
        y2={PAD}
        stroke="currentColor"
        className="text-gray-300 dark:text-gray-600"
        strokeDasharray="4 4"
        strokeWidth={1}
      />
      <polyline points={line.join(' ')} fill="none" stroke="#2563EB" strokeWidth={2} />
      {points.map((point, index) => {
        const { x, y } = screenOf(point);
        return (
          <circle
            key={point.x}
            cx={x}
            cy={y}
            r={5}
            fill="#ffffff"
            stroke="#2563EB"
            strokeWidth={2}
            className="cursor-ns-resize"
            data-testid={`curve-point-${index}`}
            onPointerDown={startDrag(index)}
          />
        );
      })}
    </svg>
  );
}
