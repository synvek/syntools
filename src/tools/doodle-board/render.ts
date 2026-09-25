/** 涂鸦画板渲染：把 Scene 绘制到任意 2D 上下文（屏幕画布与导出离屏共用）。 */

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

/** 字体栈与站内其他工具保持一致，中文用系统黑体 */
export const TEXT_FONT_FAMILY =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, -apple-system, sans-serif';

/** 清空画布（只看 backing size，因此无需场景尺寸） */
export function clearStage(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/** 网格背景导出用：屏幕上的网格由 CSS 绘制，这里只服务导出 */
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

/** 绘制场景全部内容（不含背景：屏幕上的背景由 CSS 层呈现，导出时单独合成） */
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

/* ----------------------------- 笔画 ----------------------------- */

function widthAt(base: number, point: Point): number {
  return Math.max(0.5, base * (point.p > 0 ? point.p : 1));
}

/**
 * 笔画绘制（同时也是绘制过程中的增量绘制）：
 *
 * 每相邻三点做一次「中点二次贝塞尔」，即以相邻点的中点为端点、采样点为控制点，
 * 逐段 stroke —— 这样任意时刻重画整条笔画的结果与落笔结束时完全一致
 * （若用整条 path 一次画完，中途插入新点会让尾部曲线变化，出现重影）。
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
  // 荧光笔用 multiply 叠在内容上；橡皮用 destination-out 做真擦除（不再涂白色）
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

/* --------------------------- 形状与文字 --------------------------- */

function applyStroke(ctx: CanvasRenderingContext2D, color: string, width: number, opacity: number) {
  ctx.lineWidth = Math.max(0.5, width);
  ctx.strokeStyle = withAlpha(color, opacity);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** 按「背景色」填充闭合图形（与描边同一不透明度，肉眼可直接看出填充色） */
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
 * 多边形落点预览：已确定的边用实线，末点→光标与光标→起点的收边用虚线，
 * 并给每个顶点画一个小圆点，便于判断是否点回起点闭合。
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

  // 顶点圆点：起点画大一圈并高亮，提示「点回这里闭合」
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

/** 文本编辑器覆盖层用：完整 font 简写（与 canvas 渲染保持一致） */
export function textFont(size: number): string {
  return `${size}px ${TEXT_FONT_FAMILY}`;
}
