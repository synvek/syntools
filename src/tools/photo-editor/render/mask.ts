import { MAX_VECTOR_FEATHER, orientPolygon, traceSelection } from '../core';
import { createCanvasElement, getCanvas, registerCanvas } from '../model/assets';
import type { MaskRef, Rect, Selection, VectorMaskRef } from '../model/types';

/**
 * Layer mask: a grayscale canvas (white = shown, black = hidden).
 *
 * Mask pixels also live in the asset registry (`MaskRef.assetId`); the document stores only a reference.
 * Three responsibilities here:
 * 1. create mask canvases (reveal all / hide all / clip by polygon);
 * 2. bake the mask through "feather → density → invert" into an alpha image ready for `destination-in`;
 * 3. apply the baked result to the target canvas.
 *
 * Bakes cache by `maskSignature`, so an unchanged mask skips blurring (the priciest step on big images).
 */

const cache = new Map<string, HTMLCanvasElement>();
const CACHE_LIMIT = 16;

export function createMaskCanvas(width: number, height: number, mode: 'show' | 'hide'): string {
  const canvas = createCanvasElement(
    Math.max(1, Math.round(width)),
    Math.max(1, Math.round(height)),
  );
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = mode === 'show' ? '#ffffff' : '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return registerCanvas(canvas);
}

/** Build a mask from a polygon (selection outline): white inside, black outside */
export function createMaskCanvasFromPolygon(
  width: number,
  height: number,
  polygon: number[],
): string {
  const canvas = createCanvasElement(
    Math.max(1, Math.round(width)),
    Math.max(1, Math.round(height)),
  );
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (polygon.length >= 6) {
      ctx.beginPath();
      ctx.moveTo(polygon[0], polygon[1]);
      for (let i = 2; i + 1 < polygon.length; i += 2) ctx.lineTo(polygon[i], polygon[i + 1]);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }
  return registerCanvas(canvas);
}

/** Build a mask from a selection (boolean multi-outlines supported): white inside, black outside */
export function createMaskCanvasFromSelection(
  width: number,
  height: number,
  selection: Selection,
): string {
  const canvas = createCanvasElement(
    Math.max(1, Math.round(width)),
    Math.max(1, Math.round(height)),
  );
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    traceSelection(ctx, selection);
    ctx.fill('nonzero');
  }
  return registerCanvas(canvas);
}

/**
 * Bake the mask into an alpha image.
 *
 * Key point: `destination-in` looks only at **source alpha**, but the mask canvas is opaque gray (even
 * black has alpha=255), so using it as-is would clip nothing. Hence the grayscale → alpha conversion:
 * `alpha = luminance × density`, and invert swaps black and white before reading luminance.
 * The result caches by `maskSignature`, so an unchanged mask skips blurring and the per-pixel scan.
 */
export function bakeMask(mask: MaskRef, signature: string): HTMLCanvasElement | null {
  const cached = cache.get(signature);
  if (cached) return cached;
  const source = getCanvas(mask.assetId);
  if (!source) return null;

  const out = createCanvasElement(source.width, source.height);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.filter = mask.feather > 0 ? `blur(${Math.min(64, mask.feather)}px)` : 'none';
  if (mask.inverted) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.globalCompositeOperation = 'difference';
  }
  ctx.drawImage(source, 0, 0);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';

  // Luminance → alpha (0.299/0.587/0.114 are the Rec.601 luminance weights)
  const image = ctx.getImageData(0, 0, out.width, out.height);
  const data = image.data;
  const density = Math.min(1, Math.max(0, mask.density));
  for (let i = 0; i < data.length; i += 4) {
    const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i + 3] = Math.round(luminance * density);
  }
  ctx.putImageData(image, 0, 0);

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(signature, out);
  return out;
}

/**
 * Apply the mask to the target canvas: keep only what the mask paints white (`destination-in`).
 * `rect` is where the mask lands on the target canvas (target coordinates).
 */
export function applyMask(
  target: HTMLCanvasElement,
  mask: MaskRef,
  signature: string,
  rect: Rect,
): void {
  const baked = bakeMask(mask, signature);
  const ctx = target.getContext('2d');
  if (!baked || !ctx) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(baked, rect.x, rect.y, Math.max(1, rect.width), Math.max(1, rect.height));
  ctx.restore();
}

/* ------------------------------ Vector mask ------------------------------ */

/**
 * Vector mask → current path (local coordinates, origin at the layer's top-left).
 *
 * It shares the selection's nonzero semantics: union outlines forward, difference outlines reversed.
 * Invert adds a forward layer frame so the interior winding cancels out and gets punched through, exactly
 * like `core.invertSelection`, avoiding a second geometric implementation.
 */
export function traceVectorMask(
  ctx: CanvasRenderingContext2D,
  mask: VectorMaskRef,
  size: { width: number; height: number },
): void {
  ctx.beginPath();
  if (mask.inverted) {
    ctx.moveTo(0, 0);
    ctx.lineTo(size.width, 0);
    ctx.lineTo(size.width, size.height);
    ctx.lineTo(0, size.height);
    ctx.closePath();
  }
  for (const contour of mask.contours) {
    const path = orientPolygon(contour.path, mask.inverted ? !contour.add : contour.add);
    if (path.length < 6) continue;
    ctx.moveTo(path[0], path[1]);
    for (let i = 2; i < path.length; i += 2) ctx.lineTo(path[i], path[i + 1]);
    ctx.closePath();
  }
}

/**
 * Apply the vector mask to the target canvas (`destination-in`, keeping only the inside of the outlines).
 *
 * Feathering blurs the mask itself (`filter: blur`), never the target canvas —
 * that would blur the layer content too. So bake a same-size mask image, then clip in one pass.
 */
export function applyVectorMask(
  target: HTMLCanvasElement,
  mask: VectorMaskRef,
  offset: { x: number; y: number },
  size: { width: number; height: number },
): void {
  const ctx = target.getContext('2d');
  if (!ctx) return;
  const baked = createCanvasElement(target.width, target.height);
  const bctx = baked.getContext('2d');
  if (!bctx) return;
  if (mask.feather > 0) {
    bctx.filter = `blur(${Math.min(MAX_VECTOR_FEATHER, mask.feather)}px)`;
  }
  bctx.translate(offset.x, offset.y);
  traceVectorMask(bctx, mask, size);
  bctx.fillStyle = '#ffffff';
  // Inverted outlines already have flipped directions; both cases use nonzero
  bctx.fill('nonzero');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(baked, 0, 0);
  ctx.restore();
}

/** Mask thumbnail (panel display): gray image on white */
export function maskThumbnail(mask: MaskRef, max = 44): string | null {
  const source = getCanvas(mask.assetId);
  if (!source) return null;
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const canvas = createCanvasElement(
    Math.max(1, Math.round(source.width * scale)),
    Math.max(1, Math.round(source.height * scale)),
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
