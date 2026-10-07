import type { ShapeDef } from '../model/shapes';
import { drawShape } from '../nodes/shapeDraw';

/**
 * 图形缩略图：直接复用画布的绘制逻辑（`drawShape`），保证预览与画上去的效果一致。
 * 侧边图形库、快速连线选择弹窗、右键「切换形状」共用这一份实现。
 */
export function ShapeGlyph({
  def,
  className = 'h-7 w-7',
}: {
  def: ShapeDef;
  /** 尺寸类（默认与图形库一致） */
  className?: string;
}) {
  const w = def.size.width;
  const h = def.size.height;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g fill="#EFF6FF" stroke="#2563EB" strokeWidth={Math.max(2, w / 38)}>
        {drawShape(def, w, h)}
      </g>
    </svg>
  );
}
