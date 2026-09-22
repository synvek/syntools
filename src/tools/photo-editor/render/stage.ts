import Konva from 'konva';
import type { PhotoDoc, Rect, Selection } from '../model/types';
import { createLayerNode, updateLayerNode } from './nodes';
import { drawCrop, drawSelection, clearOverlay } from './overlays';
import { syncLayers } from './sync';

/**
 * Konva Stage 生命周期宿主（命令式托管，不使用 react-konva）。
 *
 * 与 slide-editor 一致的三条约束：
 * 1. 模块顶层不触碰 DOM（避免 prerender SSR 崩溃），副作用只在 `createStage()` 被调用时展开；
 * 2. 由 `PhotoCanvas` 在 useEffect 内延后一拍创建，StrictMode 双挂载靠 cancel 守卫规避；
 * 3. 指针交互走容器原生事件（见 `interaction/pointer.ts`），Konva 节点一律 `listening: false`，
 *    避免命中检测与自绘选区互相抢事件。
 */

export interface PageTransform {
  scale: number;
  x: number;
  y: number;
}

export interface StageHandle {
  stage: Konva.Stage;
  bgLayer: Konva.Layer;
  contentLayer: Konva.Layer;
  overlayLayer: Konva.Layer;
  setTransform: (transform: PageTransform) => void;
  setSize: (width: number, height: number) => void;
  renderBackground: (doc: PhotoDoc) => void;
  sync: (doc: PhotoDoc) => void;
  setSelection: (selection: Selection | null, scale: number) => void;
  setCropRect: (rect: Rect | null, doc: PhotoDoc, scale: number) => void;
  destroy: () => void;
}

export function createStage(container: HTMLDivElement): StageHandle {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 480;

  const stage = new Konva.Stage({ container, width, height });
  const bgLayer = new Konva.Layer({ listening: false });
  const contentLayer = new Konva.Layer({ listening: false });
  const overlayLayer = new Konva.Layer({ listening: false });
  stage.add(bgLayer, contentLayer, overlayLayer);

  const handle: StageHandle = {
    stage,
    bgLayer,
    contentLayer,
    overlayLayer,

    setTransform: (transform) => {
      for (const layer of [bgLayer, contentLayer, overlayLayer]) {
        layer.scale({ x: transform.scale, y: transform.scale });
        layer.position({ x: transform.x, y: transform.y });
        layer.batchDraw();
      }
    },

    setSize: (w, h) => {
      stage.size({ width: w, height: h });
      stage.batchDraw();
    },

    renderBackground: (doc) => {
      bgLayer.destroyChildren();
      const page = new Konva.Rect({
        x: 0,
        y: 0,
        width: doc.width,
        height: doc.height,
        fill: doc.background === 'transparent' ? undefined : doc.background,
        stroke: '#94A3B8',
        strokeWidth: 1 / Math.max(0.2, bgLayer.scaleX() || 1),
        name: 'page',
      });
      bgLayer.add(page);
      bgLayer.batchDraw();
    },

    sync: (doc) => {
      syncLayers(contentLayer, doc);
    },

    setSelection: (selection, scale) => {
      clearOverlay(overlayLayer);
      if (selection) drawSelection(overlayLayer, selection, scale);
      overlayLayer.batchDraw();
    },

    setCropRect: (rect, doc, scale) => {
      clearOverlay(overlayLayer);
      if (rect) drawCrop(overlayLayer, rect, doc, scale);
      overlayLayer.batchDraw();
    },

    destroy: () => {
      stage.destroy();
    },
  };

  return handle;
}

/** 工厂转发：供 overlays / 缩略图复用节点创建逻辑 */
export { createLayerNode, updateLayerNode };
