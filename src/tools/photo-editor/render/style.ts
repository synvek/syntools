import { isEffectActive } from '../core';
import { createCanvasElement } from '../model/assets';
import type { InnerShadowStyle, LayerStyle } from '../model/types';

/**
 * 图层样式渲染：把「图层内容」整体当作 alpha 剪影，按 Photoshop 的效果顺序叠加。
 *
 * 绘制顺序（与 PS 一致）：
 *   投影 → 外发光 → 描边（外侧/居中在外） → 图层内容 → 内阴影 → 颜色叠加 → 描边（内侧/居中在内）
 *
 * 全部在「画布本地坐标」里工作（坐标原点 = 合成缓冲左上角，缓冲比图层包围盒四周多出
 * `core.stylePadding` 的留白），因此调用方只需准备一张大一圈的缓冲并把它按 origin 摆回文档。
 */

/** 光照角度 → 阴影偏移。Canvas 的 y 轴向下，故 sin 取正号表示「向下」；角度 90° = 光源在上。 */
export function effectOffset(angle: number, distance: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  // 归一化 -0：`Math.cos(90°)` 会有极小负值，乘出 `-0` 会让「无偏移」的比较变得意外
  const x = -Math.cos(rad) * distance;
  const y = Math.sin(rad) * distance;
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = createCanvasElement(source.width, source.height);
  canvas.getContext('2d')?.drawImage(source, 0, 0);
  return canvas;
}

/** 着色剪影：把内容按 `blur` 模糊后，用 source-in 覆盖成纯色（alpha 形状保留） */
function tintedSilhouette(
  content: HTMLCanvasElement,
  color: string,
  opacity: number,
  blur: number,
): HTMLCanvasElement {
  const canvas = createCanvasElement(content.width, content.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  if (blur > 0) ctx.filter = `blur(${Math.max(0.1, blur)}px)`;
  ctx.globalAlpha = Math.min(1, Math.max(0, opacity));
  ctx.drawImage(content, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * 形态学膨胀（原地）：沿圆周平移叠加剪影。
 * 采样数随半径增加，24 个方向对 100px 以内的半径已足够平滑。
 */
function dilateInPlace(canvas: HTMLCanvasElement, radius: number): void {
  const r = Math.round(radius);
  if (r <= 0) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // 快照后叠加，避免「边叠边涨」导致形状失真
  const snapshot = cloneCanvas(canvas);
  const samples = Math.max(8, Math.min(24, Math.ceil(r * 1.5)));
  for (let i = 0; i < samples; i += 1) {
    const angle = (Math.PI * 2 * i) / samples;
    ctx.drawImage(snapshot, Math.cos(angle) * r, Math.sin(angle) * r);
  }
}

/** 形态学腐蚀：由「补集膨胀」的对偶关系得到（补集膨胀后再从原图减掉） */
function erode(source: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const out = cloneCanvas(source);
  const r = Math.round(radius);
  if (r <= 0) return out;
  const complement = createCanvasElement(source.width, source.height);
  const cctx = complement.getContext('2d');
  const ctx = out.getContext('2d');
  if (!cctx || !ctx) return out;
  cctx.fillStyle = '#000000';
  cctx.fillRect(0, 0, complement.width, complement.height);
  cctx.globalCompositeOperation = 'destination-out';
  cctx.drawImage(source, 0, 0);
  dilateInPlace(complement, r);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(complement, 0, 0);
  return out;
}

/** 内侧描边环：整块剪影着色后挖掉「向内腐蚀」的部分 */
function innerRing(
  content: HTMLCanvasElement,
  color: string,
  opacity: number,
  size: number,
): HTMLCanvasElement {
  const ring = tintedSilhouette(content, color, opacity, 0);
  const shrunk = erode(content, size);
  const ctx = ring.getContext('2d');
  if (ctx) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(shrunk, 0, 0);
  }
  return ring;
}

/** 内阴影：整块着色 → 挖掉「偏移 + 模糊的剪影」→ 只保留剪影内部 */
function innerShadowBuffer(
  content: HTMLCanvasElement,
  effect: InnerShadowStyle,
): HTMLCanvasElement {
  const canvas = createCanvasElement(content.width, content.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = effect.color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const offset = effectOffset(effect.angle, effect.distance);
  ctx.globalCompositeOperation = 'destination-out';
  if (effect.size > 0) ctx.filter = `blur(${Math.max(0.1, effect.size)}px)`;
  ctx.drawImage(content, offset.x, offset.y);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(content, 0, 0);
  return canvas;
}

/** 外侧 / 内侧各承担多少描边宽度（居中 = 一半在外、一半在内） */
export function strokeWidths(
  position: 'outside' | 'center' | 'inside',
  size: number,
): { outside: number; inside: number } {
  const total = Math.max(0, size);
  if (position === 'outside') return { outside: total, inside: 0 };
  if (position === 'inside') return { outside: 0, inside: total };
  const outside = total / 2;
  return { outside, inside: total - outside };
}

/**
 * 把图层内容与样式合成到 `ctx`。`ctx` 不做坐标变换（原点 = 缓冲左上角），
 * `content` 与返回值尺寸一致；图层透明度 / 混合模式由调用方在此之外施加。
 */
export function paintLayerStyle(
  ctx: CanvasRenderingContext2D,
  style: LayerStyle,
  content: HTMLCanvasElement,
): void {
  const paint = (buffer: HTMLCanvasElement, opacity: number, dx = 0, dy = 0) => {
    ctx.save();
    ctx.globalAlpha *= Math.min(1, Math.max(0, opacity));
    ctx.drawImage(buffer, dx, dy);
    ctx.restore();
  };

  const shadow = style.dropShadow;
  if (isEffectActive(shadow) && shadow) {
    const buffer = tintedSilhouette(content, shadow.color, shadow.opacity, shadow.size);
    if (shadow.spread > 0) dilateInPlace(buffer, shadow.spread);
    const offset = effectOffset(shadow.angle, shadow.distance);
    paint(buffer, 1, offset.x, offset.y);
  }

  const glow = style.outerGlow;
  if (isEffectActive(glow) && glow) {
    paint(tintedSilhouette(content, glow.color, glow.opacity, glow.size), 1);
  }

  const stroke = style.stroke;
  if (isEffectActive(stroke) && stroke) {
    const { outside } = strokeWidths(stroke.position, stroke.size);
    if (outside > 0) {
      const ring = tintedSilhouette(content, stroke.color, stroke.opacity, 0);
      dilateInPlace(ring, outside);
      paint(ring, 1);
    }
  }

  ctx.drawImage(content, 0, 0);

  const innerShadow = style.innerShadow;
  if (isEffectActive(innerShadow) && innerShadow) {
    paint(innerShadowBuffer(content, innerShadow), innerShadow.opacity);
  }

  const overlay = style.colorOverlay;
  if (isEffectActive(overlay) && overlay) {
    paint(tintedSilhouette(content, overlay.color, overlay.opacity, 0), 1);
  }

  if (isEffectActive(stroke) && stroke) {
    const { inside } = strokeWidths(stroke.position, stroke.size);
    if (inside > 0) paint(innerRing(content, stroke.color, stroke.opacity, inside), 1);
  }
}
