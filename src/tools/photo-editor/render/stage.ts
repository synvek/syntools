import Konva from 'konva';
import type { LayerBox, MeshGridState, SamplePoint, SnapGuide } from '../core';
import type { PhotoDoc, Rect, Selection } from '../model/types';
import { createLayerNode, updateLayerNode } from './nodes';
import {
  clearOverlay,
  drawCrop,
  drawCloneSource,
  drawGradientGuide,
  drawMeshGrid,
  drawQuickMask,
  drawSamples,
  drawSelection,
  drawSnapGuides,
  drawTransformBox,
} from './overlays';
import type { GradientGuide } from './overlays';
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
  /** 旋转视图角度（度）：绕视口中心旋转；`x / y` 仍表示未旋转时的平移量 */
  rotation?: number;
}

/** 覆盖层一次要画的全部内容（选区 / 裁剪框 / 变换框） */
export interface OverlayState {
  doc: PhotoDoc;
  scale: number;
  selection: Selection | null;
  cropRect: Rect | null;
  /** 自由变换框；null 表示不显示 */
  transformBox: LayerBox | null;
  /** 渐变拖拽示意；null 表示不显示 */
  gradient: GradientGuide | null;
  /** 网格变形控制点（透视 / 扭曲 / 斜切 / 变形）；null 表示不显示 */
  meshGrid: MeshGridState | null;
  /** 图章 / 修复的取样源标记；null 表示不显示 */
  cloneSource: { x: number; y: number } | null;
  /** 吸附参考线（拖拽过程中才会出现） */
  snapGuides: SnapGuide[];
  /** 颜色取样点（取样器工具） */
  samples: SamplePoint[];
  /** 快速蒙版画布（白 = 选中）；null 表示未进入快速蒙版 */
  quickMask: HTMLCanvasElement | null;
}

export interface StageHandle {
  stage: Konva.Stage;
  bgLayer: Konva.Layer;
  /** 通道隔离视图层（显示态）：非空时隐藏 contentLayer，只显示这张单通道图 */
  channelLayer: Konva.Layer;
  contentLayer: Konva.Layer;
  overlayLayer: Konva.Layer;
  setTransform: (transform: PageTransform) => void;
  setSize: (width: number, height: number) => void;
  renderBackground: (doc: PhotoDoc) => void;
  sync: (doc: PhotoDoc) => void;
  /** 重绘覆盖层（清空后按传入状态重画选区 / 裁剪框 / 变换框 / 取样点） */
  renderOverlay: (state: OverlayState) => void;
  /** 切换通道隔离视图；传 null 回到正常显示 */
  setChannelView: (canvas: HTMLCanvasElement | null) => void;
  destroy: () => void;
}

export function createStage(container: HTMLDivElement): StageHandle {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 480;

  const stage = new Konva.Stage({ container, width, height });
  const bgLayer = new Konva.Layer({ listening: false });
  const channelLayer = new Konva.Layer({ listening: false, visible: false });
  const contentLayer = new Konva.Layer({ listening: false });
  const overlayLayer = new Konva.Layer({ listening: false });
  stage.add(bgLayer, channelLayer, contentLayer, overlayLayer);
  // E2E 稳定读取：给内容层画布加 data-testid（图层顺序变化会改变 canvas 索引，
  // 测试里原本用 document.querySelectorAll('canvas')[1] 会误读到空白的通道层）。
  (contentLayer.getCanvas() as unknown as { _canvas: HTMLCanvasElement })._canvas.setAttribute(
    'data-testid',
    'photo-content-canvas',
  );
  let channelNode: Konva.Image | null = null;

  const handle: StageHandle = {
    stage,
    bgLayer,
    channelLayer,
    contentLayer,
    overlayLayer,

    setTransform: (transform) => {
      for (const layer of [bgLayer, channelLayer, contentLayer, overlayLayer]) {
        layer.scale({ x: transform.scale, y: transform.scale });
        layer.rotation(transform.rotation ?? 0);
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

    renderOverlay: ({
      doc,
      scale,
      selection,
      cropRect,
      transformBox,
      gradient,
      meshGrid,
      cloneSource,
      snapGuides,
      samples,
      quickMask,
    }) => {
      clearOverlay(overlayLayer);
      // 快速蒙版必须最先画：它用 destination-out 挖空，会擦掉同图层先前的内容
      if (quickMask) drawQuickMask(overlayLayer, quickMask, doc, scale);
      if (selection) drawSelection(overlayLayer, selection, scale);
      if (cropRect) drawCrop(overlayLayer, cropRect, doc, scale);
      if (transformBox) {
        drawTransformBox(overlayLayer, transformBox, scale, 26 / Math.max(0.05, scale));
      }
      if (gradient) drawGradientGuide(overlayLayer, gradient, scale);
      if (meshGrid) drawMeshGrid(overlayLayer, meshGrid, scale);
      if (cloneSource) drawCloneSource(overlayLayer, cloneSource, scale);
      if (snapGuides.length > 0) drawSnapGuides(overlayLayer, snapGuides, doc, scale);
      if (samples.length > 0) drawSamples(overlayLayer, samples, scale);
      overlayLayer.batchDraw();
    },

    setChannelView: (canvas) => {
      channelLayer.destroyChildren();
      channelNode = null;
      if (!canvas) {
        channelLayer.visible(false);
        contentLayer.visible(true);
        channelLayer.batchDraw();
        contentLayer.batchDraw();
        return;
      }
      channelNode = new Konva.Image({
        image: canvas,
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height,
        listening: false,
        perfectDrawEnabled: false,
      });
      channelLayer.add(channelNode);
      channelLayer.visible(true);
      // 隔离显示时隐藏图层栈：避免与单通道图叠加出错误画面
      contentLayer.visible(false);
      channelLayer.batchDraw();
      contentLayer.batchDraw();
    },

    destroy: () => {
      stage.destroy();
    },
  };

  return handle;
}

/** 工厂转发：供 overlays / 缩略图复用节点创建逻辑 */
export { createLayerNode, updateLayerNode };
