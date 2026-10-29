import Konva from 'konva';
import type { Slide, SlideDoc } from '../model/types';
import { backgroundFillProps } from '../render/background';
import { createElementNode } from '../render/nodes';

/**
 * Per-slide raster export (PDF / PNG).
 *
 * A separate offscreen stage from thumbnails: export resolution is far higher (1920px+), and sharing the
 * cache would push large images into the thumbnail LRU, wasting memory.
 */

/** Target width for export: at least 1920px; widescreen documents take the larger of that and 2× the original size */
const MIN_EXPORT_WIDTH = 1920;

let host: HTMLDivElement | null = null;
let stage: Konva.Stage | null = null;
let layer: Konva.Layer | null = null;

function ensureStage(width: number, height: number): boolean {
  if (typeof document === 'undefined') return false;
  if (!host) {
    host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    Object.assign(host.style, {
      position: 'absolute',
      left: '-99999px',
      top: '0',
      pointerEvents: 'none',
    });
    document.body.appendChild(host);
  }
  if (!stage) {
    stage = new Konva.Stage({ container: host, width, height });
    layer = new Konva.Layer();
    stage.add(layer);
  }
  stage.size({ width, height });
  return true;
}

/** One slide → PNG dataURL */
export function renderSlideToDataUrl(
  doc: SlideDoc,
  slide: Slide,
  width?: number,
): string | undefined {
  const pixelWidth = Math.max(width ?? MIN_EXPORT_WIDTH, doc.width * 2);
  const scale = pixelWidth / doc.width;
  const pixelHeight = Math.round(doc.height * scale);
  if (!ensureStage(pixelWidth, pixelHeight) || !layer || !stage) return undefined;

  layer.destroyChildren();
  layer.scale({ x: scale, y: scale });
  layer.position({ x: 0, y: 0 });
  layer.add(
    new Konva.Rect({
      width: doc.width,
      height: doc.height,
      ...backgroundFillProps(slide.background, doc.width, doc.height),
    }),
  );
  for (const element of slide.elements) {
    if (element.visible === false) continue;
    const node = createElementNode(element, {
      media: doc.media,
      // Offscreen export has no chance to await async decoding: undecoded images draw a placeholder, and callers
      // can prewarm through imageCache (trigger one canvas render before exporting) to avoid it
      onImageReady: () => undefined,
    });
    node.listening(false);
    layer.add(node);
  }
  layer.draw();
  return stage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
}

/** PNG dataURL → bytes */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function disposeRaster(): void {
  stage?.destroy();
  host?.remove();
  stage = null;
  layer = null;
  host = null;
}
