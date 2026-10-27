import type { ShapeDef } from '../model/shapes';
import { drawDecor, drawShape } from '../nodes/shapeDraw';

/**
 * Shape thumbnail: reuses the canvas drawing logic (`drawShape`) so previews match what gets drawn.
 * The sidebar shape library, the quick-connect picker and the right-click "change shape" menu all share this one implementation.
 */
export function ShapeGlyph({
  def,
  className = 'h-7 w-7',
}: {
  def: ShapeDef;
  /** Size class (defaults to the shape library's) */
  className?: string;
}) {
  const w = def.size.width;
  const h = def.size.height;
  const strokeWidth = Math.max(2, w / 38);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g fill="#EFF6FF" stroke="#2563EB" strokeWidth={strokeWidth}>
        {drawShape(def, w, h)}
      </g>
      {/* Overlay the internal decorations as on the canvas (separators, history H, event circles, etc.) to make thumbnails more recognizable */}
      <g stroke="#2563EB" fill="#2563EB" strokeWidth={Math.max(1.5, strokeWidth - 0.5)}>
        {drawDecor(def, w, h)}
      </g>
    </svg>
  );
}
