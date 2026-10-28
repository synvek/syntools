import Konva from 'konva';
import type { Guide } from '../core';
import type { SlideDoc, SlideElement } from '../model/types';
import { attachInteraction, type StageCallbacks } from '../interaction/pointer';
import { renderAdjustHandles, type AdjustHandleOptions } from './adjustHandles';
import { renderCommentAnchors } from './commentAnchors';
import type { CommentThread } from '../../../core/comments/model';
import { createElementNode } from './nodes';
import {
  createMarquee,
  createTransformer,
  drawCustomGuides,
  drawGuides,
  clearGuides,
} from './overlays';
import { syncElements } from './sync';

/**
 * Konva Stage lifecycle host (imperative, not react-konva):
 * - side effects only run when this module is called; nothing touches the DOM at module scope (avoids prerender/SSR crashes);
 * - `SlideCanvas.tsx` creates it deferred inside useEffect, and a cancel guard covers StrictMode's double mount.
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
  transformer: Konva.Transformer;
  marquee: Konva.Rect;
  callbacks: StageCallbacks;
  setTransform: (transform: PageTransform) => void;
  setSize: (width: number, height: number) => void;
  renderBackground: (doc: SlideDoc, invisibleElements: SlideElement[]) => void;
  /** `enteredGroups` = group path currently open for child editing (P1-1.5) */
  sync: (elements: SlideElement[], doc: SlideDoc, options?: { enteredGroups?: string[] }) => void;
  showGuides: (guides: Guide[], size: { width: number; height: number }) => void;
  hideGuides: () => void;
  /** Draw the persistent manual guides (styled differently from the temporary drag guides) */
  renderCustomGuides: (
    guides: { id: string; axis: 'x' | 'y'; position: number }[],
    size: { width: number; height: number },
  ) => void;
  setSelection: (ids: string[], elements?: SlideElement[], options?: AdjustHandleOptions) => void;
  /** Numbered comment markers for the current slide (P1-2) */
  renderComments: (threads: CommentThread[], activeId: string | null) => void;
  /** Pen tool preview polyline (viewport coordinates); pass an empty array to hide it */
  renderPenPreview: (points: { x: number; y: number }[]) => void;
  destroy: () => void;
}

export function createStage(container: HTMLDivElement, callbacks: StageCallbacks): StageHandle {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 450;

  const stage = new Konva.Stage({ container, width, height });
  const bgLayer = new Konva.Layer();
  const contentLayer = new Konva.Layer();
  const overlayLayer = new Konva.Layer({ listening: false });
  stage.add(bgLayer, contentLayer, overlayLayer);

  const transformer = createTransformer(contentLayer, {
    onTransformEnd: (changes) => callbacks.onTransformEnd(changes),
  });
  const marquee = createMarquee(overlayLayer);
  // Pen preview: a dashed polyline through the points placed so far
  const penPreview = new Konva.Line({
    points: [],
    stroke: '#2563EB',
    strokeWidth: 1.5,
    dash: [5, 4],
    listening: false,
    visible: false,
  });
  overlayLayer.add(penPreview);

  const handle: StageHandle = {
    stage,
    bgLayer,
    contentLayer,
    overlayLayer,
    transformer,
    marquee,
    callbacks,
    setTransform: (transform) => {
      bgLayer.scale({ x: transform.scale, y: transform.scale });
      bgLayer.position({ x: transform.x, y: transform.y });
      contentLayer.scale({ x: transform.scale, y: transform.scale });
      contentLayer.position({ x: transform.x, y: transform.y });
      bgLayer.batchDraw();
      contentLayer.batchDraw();
    },
    setSize: (w, h) => {
      stage.size({ width: w, height: h });
      stage.batchDraw();
    },
    renderBackground: (doc, invisibleElements) => {
      bgLayer.destroyChildren();
      const page = new Konva.Rect({
        x: 0,
        y: 0,
        width: doc.width,
        height: doc.height,
        fill: '#FFFFFF',
        shadowColor: '#0F172A',
        shadowBlur: 24 / Math.max(0.2, bgLayer.scaleX()),
        shadowOpacity: 0.18,
        shadowOffset: { x: 0, y: 6 },
        listening: true,
        name: 'page',
      });
      bgLayer.add(page);
      if (invisibleElements.length > 0) {
        const group = new Konva.Group({ listening: false, opacity: 0.4 });
        for (const element of invisibleElements) {
          const node = createElementNode(element, {
            media: doc.media,
            onImageReady: () => bgLayer.batchDraw(),
          });
          node.listening(false);
          group.add(node);
        }
        bgLayer.add(group);
      }
      bgLayer.batchDraw();
    },
    sync: (elements, doc, options) => {
      syncElements(contentLayer, elements, {
        media: doc.media,
        onImageReady: () => contentLayer.batchDraw(),
        enteredGroups: options?.enteredGroups,
      });
    },

    renderComments: (threads, activeId) => {
      renderCommentAnchors(contentLayer, threads, activeId, callbacks.onSelectComment);
    },
    showGuides: (guides, size) => drawGuides(contentLayer, guides, size),
    hideGuides: () => clearGuides(contentLayer),
    renderCustomGuides: (guides, size) => drawCustomGuides(contentLayer, guides, size),
    renderPenPreview: (points) => {
      if (points.length === 0) {
        penPreview.visible(false);
        overlayLayer.batchDraw();
        return;
      }
      const flat =
        points.length === 1
          ? [points[0].x, points[0].y, points[0].x, points[0].y]
          : points.flatMap((point) => [point.x, point.y]);
      penPreview.points(flat);
      penPreview.visible(true);
      overlayLayer.batchDraw();
    },
    setSelection: (ids, elements, options) => {
      // The shape being node-edited must not keep resize/rotate handles: they would sit on top of the anchors
      const framed = options?.pathEditId ? ids.filter((id) => id !== options.pathEditId) : ids;
      const nodes = framed
        .map((id) => contentLayer.findOne<Konva.Node>(`#${id}`))
        .filter((node): node is Konva.Node => Boolean(node));
      transformer.nodes(nodes.length > 0 ? nodes : []);
      if (elements) {
        renderAdjustHandles(
          contentLayer,
          elements,
          ids,
          {
            onShapeAdjust: callbacks.onShapeAdjust,
            onConnectorEnd: callbacks.onConnectorEnd,
            onPathCommands: callbacks.onPathCommands,
            onPathActive: callbacks.onPathActive,
            onPathToggleSmooth: callbacks.onPathToggleSmooth,
          },
          options,
        );
      }
      contentLayer.batchDraw();
    },
    destroy: () => {
      transformer.destroy();
      stage.destroy();
    },
  };

  attachInteraction(handle);
  return handle;
}
