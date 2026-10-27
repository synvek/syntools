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
 * Konva Stage lifecycle host (imperative, no react-konva).
 *
 * The same three constraints as slide-editor:
 * 1. no DOM at module top level (prerender SSR would crash); side effects only run inside `createStage()`;
 * 2. `PhotoCanvas` creates it a tick later inside useEffect, with a cancel guard for StrictMode;
 * 3. pointer interaction uses native container events (see `interaction/pointer.ts`) and Konva nodes stay
 *    `listening: false`, so hit tests and custom-drawn selections never fight over events.
 */

export interface PageTransform {
  scale: number;
  x: number;
  y: number;
  /** View rotation (degrees) about the viewport center; `x / y` is still the unrotated pan */
  rotation?: number;
}

/** Everything the overlay draws in one pass (selection / crop box / transform box) */
export interface OverlayState {
  doc: PhotoDoc;
  scale: number;
  selection: Selection | null;
  cropRect: Rect | null;
  /** Free-transform box; null hides it */
  transformBox: LayerBox | null;
  /** Gradient drag preview; null hides it */
  gradient: GradientGuide | null;
  /** Mesh warp control points (perspective / distort / skew / warp); null hides them */
  meshGrid: MeshGridState | null;
  /** Sample-source marker for stamp / healing; null hides it */
  cloneSource: { x: number; y: number } | null;
  /** Snap guides (only present during a drag) */
  snapGuides: SnapGuide[];
  /** Color sampler points (sampler tool) */
  samples: SamplePoint[];
  /** Quick mask canvas (white = selected); null means quick mask is off */
  quickMask: HTMLCanvasElement | null;
}

export interface StageHandle {
  stage: Konva.Stage;
  bgLayer: Konva.Layer;
  /** Channel isolation layer (display state): when set, contentLayer hides and only this channel shows */
  channelLayer: Konva.Layer;
  contentLayer: Konva.Layer;
  overlayLayer: Konva.Layer;
  setTransform: (transform: PageTransform) => void;
  setSize: (width: number, height: number) => void;
  renderBackground: (doc: PhotoDoc) => void;
  sync: (doc: PhotoDoc) => void;
  /** Redraw the overlay (clears, then repaints selection / crop box / transform box / sampler points) */
  renderOverlay: (state: OverlayState) => void;
  /** Switch the channel isolation view; pass null to return to normal display */
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
  // Stable e2e hook: tag the content canvas with data-testid (layer order changes canvas indices, so
  // document.querySelectorAll('canvas')[1] used to read the empty channel layer instead).
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
      // The quick mask must draw first: it punches out with destination-out, erasing earlier content
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
      // Hide the layer stack in isolation view, or stacking with the channel image shows a wrong picture
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

/** Factory re-export so overlays / thumbnails can reuse the node creation logic */
export { createLayerNode, updateLayerNode };
