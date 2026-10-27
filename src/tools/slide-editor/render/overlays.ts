import Konva from 'konva';
import type { Guide } from '../core';

/**
 * Canvas overlays: transform handles (Transformer), alignment guides, marquee rect.
 * The Transformer and guides live in the already-scaled content layer, so their coordinates are page coordinates;
 * the marquee lives in the unscaled overlay layer, so its coordinates are stage coordinates.
 */

export interface TransformChange {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface TransformerOptions {
  /** With a multi-select, returns each affected element's landing box; the caller must write them all back (or they reset on the next sync) */
  onTransformEnd: (changes: TransformChange[]) => void;
}

/** Shift state: while held, the Transformer scales proportionally (matching PowerPoint / WPS) */
let shiftHeld = false;
let shiftBound = false;
function bindShiftTracker(): void {
  if (shiftBound || typeof window === 'undefined') return;
  shiftBound = true;
  const sync = (event: KeyboardEvent) => {
    shiftHeld = event.shiftKey;
  };
  window.addEventListener('keydown', sync);
  window.addEventListener('keyup', sync);
  window.addEventListener('blur', () => {
    shiftHeld = false;
  });
}

export function createTransformer(
  contentLayer: Konva.Layer,
  options: TransformerOptions,
): Konva.Transformer {
  const transformer = new Konva.Transformer({
    rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
    keepRatio: false,
    flipEnabled: false,
    ignoreStroke: true,
    boundBoxFunc: (oldBox, newBox) => {
      if (Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8) return oldBox;
      return newBox;
    },
    anchorSize: 9,
    borderStroke: '#2563EB',
    anchorStroke: '#2563EB',
    anchorFill: '#FFFFFF',
  });
  transformer.on('transformend', () => {
    // With a multi-select, take each node's landing box: Konva has already applied the group transform to every member
    const changes: TransformChange[] = [];
    for (const node of transformer.nodes()) {
      if (!node.id()) continue;
      changes.push({
        id: node.id(),
        x: Math.round(node.x()),
        y: Math.round(node.y()),
        width: Math.round(node.width() * Math.abs(node.scaleX())),
        height: Math.round(node.height() * Math.abs(node.scaleY())),
        rotation: Math.round(node.rotation()),
      });
    }
    if (changes.length > 0) options.onTransformEnd(changes);
  });
  bindShiftTracker();
  // Follow Shift continuously during the transform: hold to constrain, release for free, no need to restart
  transformer.on('transformstart transform', () => {
    transformer.keepRatio(shiftHeld);
  });
  contentLayer.add(transformer);
  return transformer;
}

/** Guides: drawn as dashed lines in page coordinates */
export function drawGuides(
  contentLayer: Konva.Layer,
  guides: Guide[],
  size: { width: number; height: number },
): void {
  const group = contentLayer.findOne<Konva.Group>(`#guides`);
  if (group) group.destroy();
  if (guides.length === 0) return;
  const next = new Konva.Group({ id: 'guides', listening: false });
  for (const guide of guides) {
    const line = new Konva.Line({
      points:
        guide.axis === 'x'
          ? [guide.position, 0, guide.position, size.height]
          : [0, guide.position, size.width, guide.position],
      stroke: '#F43F5E',
      strokeWidth: 1 / Math.max(0.1, contentLayer.scaleX()),
      dash: [4, 4],
      listening: false,
    });
    next.add(line);
  }
  contentLayer.add(next);
}

export function clearGuides(contentLayer: Konva.Layer): void {
  const group = contentLayer.findOne<Konva.Group>(`#guides`);
  if (group) group.destroy();
}

/** Manual guides: solid blue line with small square endpoints, distinct from the red dashed drag guides */
export function drawCustomGuides(
  contentLayer: Konva.Layer,
  guides: { id: string; axis: 'x' | 'y'; position: number }[],
  size: { width: number; height: number },
): void {
  const existing = contentLayer.findOne<Konva.Group>(`#customGuides`);
  if (existing) existing.destroy();
  if (guides.length === 0) return;
  const scale = Math.max(0.1, contentLayer.scaleX());
  const width = 1 / scale;
  const next = new Konva.Group({ id: 'customGuides', listening: false });
  for (const guide of guides) {
    const points =
      guide.axis === 'x'
        ? [guide.position, 0, guide.position, size.height]
        : [0, guide.position, size.width, guide.position];
    next.add(
      new Konva.Line({
        points,
        stroke: '#0EA5E9',
        strokeWidth: width,
        dash: [6 / scale, 4 / scale],
        listening: false,
      }),
    );
  }
  contentLayer.add(next);
}

/** Marquee rect (stage coordinates) */
export function createMarquee(overlayLayer: Konva.Layer): Konva.Rect {
  const rect = new Konva.Rect({
    fill: 'rgba(37, 99, 235, 0.12)',
    stroke: '#2563EB',
    strokeWidth: 1,
    dash: [4, 4],
    visible: false,
    listening: false,
  });
  overlayLayer.add(rect);
  return rect;
}

export function updateMarquee(
  rect: Konva.Rect,
  box: { x: number; y: number; width: number; height: number } | null,
): void {
  if (!box) {
    rect.visible(false);
    return;
  }
  rect.setAttrs({ ...box, visible: true });
}
