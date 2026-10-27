/** Doodle board rendering: paint a Scene into any 2D context (shared by the screen canvas and offscreen export). */

import {
  GRID_SIZE,
  clampUnit,
  midpoint,
  withAlpha,
  type Op,
  type Point,
  type PolygonOp,
  type Scene,
  type ShapeOp,
  type StrokeOp,
  type TextOp,
} from './core';

/** Font stack matches the other tools on the site; CJK text uses the system sans-serif */
export const TEXT_FONT_FAMILY =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, -apple-system, sans-serif';

/** Clear the canvas (uses the backing size only, so no scene dimensions are needed) */
export function clearStage(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/** Grid background for export only: the on-screen grid is drawn with CSS */
export function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = GRID_SIZE; x < width; x += GRID_SIZE) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }
  for (let y = GRID_SIZE; y < height; y += GRID_SIZE) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

/** Draw everything in the scene (no background: CSS renders it on screen and export composites it separately) */
export function drawOps(ctx: CanvasRenderingContext2D, scene: Scene): void {
  for (const op of scene.ops) drawOp(ctx, op);
}

export function drawOp(ctx: CanvasRenderingContext2D, op: Op): void {
  switch (op.kind) {
    case 'stroke':
      drawStroke(ctx, op);
      break;
    case 'line':
    case 'arrow':
      drawLine(ctx, op);
      break;
    case 'rect':
      drawRect(ctx, op);
      break;
    case 'ellipse':
      drawEllipse(ctx, op);
      break;
    case 'polygon':
      drawPolygon(ctx, op);
      break;
    default:
      drawText(ctx, op);
      break;
  }
}

/* ----------------------------- Strokes ----------------------------- */

function widthAt(base: number, point: Point): number {
  return Math.max(0.5, base * (point.p > 0 ? point.p : 1));
}

/**
 * Stroke rendering (also used for incremental drawing while dragging):
 *
 * For every three consecutive points it draws a "midpoint quadratic Bezier" — endpoints at the
 * midpoints of neighbouring samples with the sample as the control point — segment by segment.
 * Redrawing the whole stroke at any moment therefore matches the finished stroke exactly (drawing
 * one long path instead would shift the tail when a point is appended, leaving ghosting).
 */
export function drawStroke(ctx: CanvasRenderingContext2D, op: StrokeOp): void {
  const points = op.points;
  if (points.length === 0) return;
  ctx.save();
  ctx.lineCap = op.mode === 'marker' ? 'butt' : 'round';
  ctx.lineJoin = 'round';
  const paint = withAlpha(op.color, op.opacity);
  ctx.strokeStyle = paint;
  ctx.fillStyle = paint;
  // Marker blends over content with multiply; the eraser really erases via destination-out (no white paint)
  ctx.globalCompositeOperation =
    op.mode === 'eraser' ? 'destination-out' : op.mode === 'marker' ? 'multiply' : 'source-over';

  if (points.length === 1) {
    const radius = Math.max(0.4, widthAt(op.width, points[0]) / 2);
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const start = i >= 2 ? midpoint(points[i - 2], prev) : prev;
    const end = i < points.length - 1 ? midpoint(prev, current) : current;
    ctx.beginPath();
    ctx.lineWidth = widthAt(op.width, prev);
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(prev.x, prev.y, end.x, end.y);
    ctx.stroke();
  }
  ctx.restore();
}

/* --------------------------- Shapes and text --------------------------- */

function applyStroke(ctx: CanvasRenderingContext2D, color: string, width: number, opacity: number) {
  ctx.lineWidth = Math.max(0.5, width);
  ctx.strokeStyle = withAlpha(color, opacity);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** Fill a closed shape with the "background colour" (same opacity as the stroke so the fill reads clearly) */
function fillIfNeeded(ctx: CanvasRenderingContext2D, op: ShapeOp | PolygonOp): void {
  if (!op.fill) return;
  ctx.fillStyle = withAlpha(op.fillColor ?? op.color, clampUnit(op.opacity));
  ctx.fill();
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  op: Extract<Op, { kind: 'line' | 'arrow' }>,
): void {
  const { from, to } = op;
  if (Math.hypot(to.x - from.x, to.y - from.y) < 0.5) return;
  ctx.save();
  applyStroke(ctx, op.color, op.width, op.opacity);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
  if (op.kind !== 'arrow') return;

  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = Math.max(8, op.width * 2.5);
  const spread = 0.42;
  ctx.save();
  applyStroke(ctx, op.color, op.width, op.opacity);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle - spread), to.y - size * Math.sin(angle - spread));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle + spread), to.y - size * Math.sin(angle + spread));
  ctx.stroke();
  ctx.restore();
}

function drawRect(ctx: CanvasRenderingContext2D, op: ShapeOp): void {
  if (op.w < 0.5 || op.h < 0.5) return;
  ctx.save();
  applyStroke(ctx, op.color, op.width, op.opacity);
  ctx.beginPath();
  ctx.rect(op.x, op.y, op.w, op.h);
  fillIfNeeded(ctx, op);
  ctx.stroke();
  ctx.restore();
}

function drawEllipse(ctx: CanvasRenderingContext2D, op: ShapeOp): void {
  if (op.w < 0.5 || op.h < 0.5) return;
  ctx.save();
  applyStroke(ctx, op.color, op.width, op.opacity);
  ctx.beginPath();
  ctx.ellipse(op.x + op.w / 2, op.y + op.h / 2, op.w / 2, op.h / 2, 0, 0, Math.PI * 2);
  fillIfNeeded(ctx, op);
  ctx.stroke();
  ctx.restore();
}

function drawPolygon(ctx: CanvasRenderingContext2D, op: PolygonOp): void {
  if (op.points.length < 2) return;
  ctx.save();
  applyStroke(ctx, op.color, op.width, op.opacity);
  ctx.beginPath();
  ctx.moveTo(op.points[0].x, op.points[0].y);
  for (let i = 1; i < op.points.length; i += 1) {
    ctx.lineTo(op.points[i].x, op.points[i].y);
  }
  if (op.points.length >= 3) ctx.closePath();
  fillIfNeeded(ctx, op);
  ctx.stroke();
  ctx.restore();
}

/**
 * Polygon placement preview: committed edges are solid, while last-point → cursor and
 * cursor → start are dashed; each vertex gets a dot so closing on the start point is obvious.
 */
export function drawPolygonPreview(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  hover: Point | null,
  color: string,
  width: number,
  opacity: number,
): void {
  if (points.length === 0) return;
  ctx.save();
  applyStroke(ctx, color, Math.max(1, width * 0.6), opacity);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  if (hover) {
    ctx.save();
    ctx.setLineDash([Math.max(4, width * 2), Math.max(3, width * 1.5)]);
    ctx.beginPath();
    const last = points[points.length - 1];
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(hover.x, hover.y);
    if (points.length >= 2) {
      ctx.moveTo(hover.x, hover.y);
      ctx.lineTo(points[0].x, points[0].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Vertex dots: the start point is drawn larger and highlighted to hint "click here to close"
  points.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, index === 0 ? width * 1.6 : width * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = index === 0 ? 'rgba(37, 99, 235, 0.9)' : withAlpha(color, opacity);
    ctx.fill();
  });
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, op: TextOp): void {
  const lines = op.text.split('\n');
  if (lines.every((line) => line.trim() === '')) return;
  ctx.save();
  ctx.font = `${op.size}px ${TEXT_FONT_FAMILY}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = withAlpha(op.color, op.opacity);
  lines.forEach((line, index) => {
    ctx.fillText(line, op.x, op.y + index * op.size * 1.25);
  });
  ctx.restore();
}

/** For the text editor overlay: the full `font` shorthand (matches canvas rendering) */
export function textFont(size: number): string {
  return `${size}px ${TEXT_FONT_FAMILY}`;
}
