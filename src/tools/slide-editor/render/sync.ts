import Konva from 'konva';
import type { SlideElement } from '../model/types';
import { createElementNode, patchElementNode, sameKind, type RenderContext } from './nodes';

/**
 * Keyed diff sync: reuse Konva nodes keyed by element.id.
 * Rebuild only when "the element type changed" or "the child structure changed"; everything else takes the fast
 * property path, avoiding a full-page redraw while dragging.
 */
export function syncElements(
  layer: Konva.Layer,
  elements: SlideElement[],
  ctx: RenderContext,
): void {
  const existing = new Map<string, Konva.Group>();
  for (const child of layer.getChildren()) {
    if (child.name() !== 'element') continue; // Non-element nodes such as the Transformer don't take part in the diff
    const id = child.id();
    if (id && child instanceof Konva.Group) existing.set(id, child);
  }

  // Hidden elements get no node: canvas, thumbnail and export all filter them, keeping "hidden" consistent
  const visible = elements.filter((element) => element.visible !== false);

  visible.forEach((element, index) => {
    const current = existing.get(element.id);
    if (current && sameKind(current, element) && isUpdatable(element)) {
      patchElementNode(current, element, ctx);
      current.zIndex(index);
      existing.delete(element.id);
      return;
    }
    if (current) current.destroy();
    const node = createElementNode(element, ctx);
    layer.add(node);
    node.zIndex(index);
    existing.delete(element.id);
  });

  // Old nodes that weren't matched have been removed from the document
  for (const stale of existing.values()) stale.destroy();
  layer.batchDraw();
}

/**
 * Whether an element can take the fast property path.
 * Text/shape/table child nodes are content-driven, so a property update could miss structural differences;
 * these elements are rebuilt every time to stay in sync with the model (the element count is bounded, so the cost is fine).
 */
function isUpdatable(element: SlideElement): boolean {
  // Glow is a duplicate node behind the shape, which the fast path knows nothing about: adding or
  // removing it would leave a stale halo (or none at all), so those elements always rebuild.
  if (element.glow) return false;
  // Soft edge caches the node (a blurred raster at the current size): the fast path would leave the
  // stale cache behind after a resize, so these elements rebuild too
  if (element.softEdge) return false;
  // A group's children change after group/ungroup and the fast path doesn't update children, so rebuild those too
  return element.type === 'image' || element.type === 'line';
}

/** Render the non-selectable backdrop hints from layout/master placeholders */
export function renderInherited(
  layer: Konva.Layer,
  elements: SlideElement[],
  ctx: RenderContext,
): void {
  syncElements(layer, elements, ctx);
  layer.listening(false);
  layer.opacity(0.35);
}
