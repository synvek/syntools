import Konva from 'konva';
import { imagesToPdf } from '@/core/pdf/convert';
import type { ToolResult } from '@/core/types';
import type { Slide, SlideDoc } from '../model/types';
import { backgroundFillProps } from '../render/background';
import { createElementNode } from '../render/nodes';

/**
 * 逐页光栅导出（PDF / PNG）。
 *
 * 与缩略图分开用一个独立离屏舞台：导出分辨率远高于缩略图（1920px+），
 * 若共用缓存会把大图塞进缩略图 LRU，白白吃掉内存。
 */

/** 导出用的目标宽度：至少 1920px，宽屏文档按 2 倍原始尺寸取更大值 */
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

/** 单页 → PNG dataURL */
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
      // 离屏导出没有异步等待机会：图片未解码时先画占位，调用方可通过
      // imageCache 预热（导出前先触发一次画布渲染）来规避
      onImageReady: () => undefined,
    });
    node.listening(false);
    layer.add(node);
  }
  layer.draw();
  return stage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
}

/** PNG dataURL → 字节 */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** 全部页面 → PDF（每页一张位图，按像素尺寸建页） */
export async function exportSlidesToPdf(doc: SlideDoc): Promise<ToolResult<Uint8Array>> {
  const images: { bytes: Uint8Array; mime: string }[] = [];
  for (const slide of doc.slides) {
    const dataUrl = renderSlideToDataUrl(doc, slide);
    if (!dataUrl) return { ok: false, error: 'RENDER_FAILED' };
    images.push({ bytes: dataUrlToBytes(dataUrl), mime: 'image/png' });
  }
  if (images.length === 0) return { ok: false, error: 'EMPTY' };
  return imagesToPdf(images);
}

export function disposeRaster(): void {
  stage?.destroy();
  host?.remove();
  stage = null;
  layer = null;
  host = null;
}
