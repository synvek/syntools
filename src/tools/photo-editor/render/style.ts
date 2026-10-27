import { isEffectActive } from '../core';
import { createCanvasElement } from '../model/assets';
import type { InnerShadowStyle, LayerStyle } from '../model/types';

/**
 * Layer style rendering: treat the layer content as an alpha silhouette and stack effects in PS order.
 *
 * Draw order (same as PS):
 *   shadow → outer glow → stroke (outside/center outside) → content → inner shadow → overlay → stroke inside
 *
 * Everything works in canvas-local coordinates (origin = composite buffer top-left; the buffer is
 * `core.stylePadding` larger than the layer box), so callers just prepare that buffer and place it by origin.
 */

/** Light angle → shadow offset. Canvas y points down, so +sin means down; 90° puts the light on top. */
export function effectOffset(angle: number, distance: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  // Normalize -0: `Math.cos(90°)` is slightly negative, and the resulting `-0` breaks "no offset" checks
  const x = -Math.cos(rad) * distance;
  const y = Math.sin(rad) * distance;
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = createCanvasElement(source.width, source.height);
  canvas.getContext('2d')?.drawImage(source, 0, 0);
  return canvas;
}

/** Tint the silhouette: blur by `blur`, then fill solid with source-in (the alpha shape survives) */
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
 * Morphological dilation (in place): stamp the silhouette around a circle of offsets.
 * The sample count grows with the radius; 24 directions is smooth enough up to about 100px.
 */
function dilateInPlace(canvas: HTMLCanvasElement, radius: number): void {
  const r = Math.round(radius);
  if (r <= 0) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // Snapshot before stamping, or accumulating while drawing would distort the shape
  const snapshot = cloneCanvas(canvas);
  const samples = Math.max(8, Math.min(24, Math.ceil(r * 1.5)));
  for (let i = 0; i < samples; i += 1) {
    const angle = (Math.PI * 2 * i) / samples;
    ctx.drawImage(snapshot, Math.cos(angle) * r, Math.sin(angle) * r);
  }
}

/** Morphological erosion: the dual of dilation on the complement (dilate it, then subtract from the source) */
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

/** Inner stroke ring: tint the whole silhouette, then punch out the inward-eroded part */
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

/** Inner shadow: tint everything → punch out the offset, blurred silhouette → keep only the inside */
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

/** How much stroke width falls outside / inside (center = half out, half in) */
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
 * Composite the layer content and its style into `ctx`. `ctx` carries no transform (origin = buffer top-left),
 * and `content` matches the output size; layer opacity / blend mode are applied by the caller outside.
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
