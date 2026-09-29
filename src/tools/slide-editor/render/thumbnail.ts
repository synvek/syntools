import Konva from 'konva';
import type { Slide, SlideDoc } from '../model/types';
import { backgroundFillProps } from './background';
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

/** 缓存条目上限（LRU）：长文档下避免 dataURL 无限堆积 */
const CACHE_LIMIT = 240;

let offscreen: Offscreen | null = null;
const cache = new Map<string, string>();

/** 命中后移到队尾，保持 Map 的插入顺序即 LRU 顺序 */
function touch(key: string, value: string): void {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

/**
 * 单页内容指纹：只依赖「会影响这一页渲染结果」的字段。
 *
 * 不能用 doc.version —— 它是全局自增的，改任意一页都会让全部页的缓存失效。
 * 也不能带上 media 的 bytes/url 等运行态字段，否则必然 miss。
 */
function slideFingerprint(slide: Slide): string {
  const payload = JSON.stringify({
    background: slide.background ?? '',
    elements: slide.elements,
  });
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

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
  const key = `${slide.id}:${slideFingerprint(slide)}:${width}`;
  const cached = cache.get(key);
  if (cached) {
    touch(key, cached);
    return cached;
  }

  const scale = width / doc.width;
  const height = Math.round(doc.height * scale);
  target.stage.size({ width, height });
  target.layer.destroyChildren();
  target.layer.scale({ x: scale, y: scale });
  target.layer.position({ x: 0, y: 0 });

  const background = new Konva.Rect({
    width: doc.width,
    height: doc.height,
    ...backgroundFillProps(slide.background, doc.width, doc.height),
  });
  target.layer.add(background);

  for (const element of slide.elements) {
    // 隐藏元素不渲染，与画布 / 导出保持一致
    if (element.visible === false) continue;
    const node = createElementNode(element, { media: doc.media, onImageReady: () => undefined });
    node.listening(false);
    target.layer.add(node);
  }
  target.layer.draw();
  const url = target.stage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
  touch(key, url);
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
