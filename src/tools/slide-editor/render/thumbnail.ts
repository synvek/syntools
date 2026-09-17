import Konva from 'konva';
import type { Slide, SlideDoc } from '../model/types';
import { createElementNode } from './nodes';

/**
 * 离屏缩略图：用一个隐藏 Konva.Stage 逐页渲染并导出 dataURL。
 * 按 `slideId + version + width` 缓存，只有文档变更时才重绘。
 */

interface Offscreen {
  host: HTMLDivElement;
  stage: Konva.Stage;
  layer: Konva.Layer;
}

let offscreen: Offscreen | null = null;
const cache = new Map<string, string>();

function ensureOffscreen(): Offscreen | null {
  if (offscreen) return offscreen;
  if (typeof document === 'undefined') return null;
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'absolute',
    left: '-99999px',
    top: '0',
    width: '320px',
    height: '180px',
    pointerEvents: 'none',
  });
  document.body.appendChild(host);
  const stage = new Konva.Stage({ container: host, width: 320, height: 180 });
  const layer = new Konva.Layer();
  stage.add(layer);
  offscreen = { host, stage, layer };
  return offscreen;
}

export function renderThumbnail(doc: SlideDoc, slide: Slide, width = 240): string | undefined {
  const target = ensureOffscreen();
  if (!target) return undefined;
  const key = `${slide.id}:${doc.version}:${width}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const scale = width / doc.width;
  const height = Math.round(doc.height * scale);
  target.stage.size({ width, height });
  target.layer.destroyChildren();
  target.layer.scale({ x: scale, y: scale });
  target.layer.position({ x: 0, y: 0 });

  const background = new Konva.Rect({
    width: doc.width,
    height: doc.height,
    fill: slide.background ?? '#FFFFFF',
  });
  target.layer.add(background);

  for (const element of slide.elements) {
    const node = createElementNode(element, { media: doc.media, onImageReady: () => undefined });
    node.listening(false);
    target.layer.add(node);
  }
  target.layer.draw();
  const url = target.stage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
  cache.set(key, url);
  return url;
}

export function invalidateThumbnails(): void {
  cache.clear();
}

export function disposeThumbnails(): void {
  if (!offscreen) return;
  offscreen.stage.destroy();
  offscreen.host.remove();
  offscreen = null;
  cache.clear();
}
