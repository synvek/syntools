import Konva from 'konva';
import { adjustmentBaseIndex, compositeBelowAdjustments } from './composite';
import type { Layer, PhotoDoc } from '../model/types';
import {
  BAKE_KEY_ATTR,
  createLayerNode,
  LAYER_ID_ATTR,
  LAYER_KIND_ATTR,
  updateLayerNode,
} from './nodes';
import { layerNeedsComposite } from './paint';

/**
 * Incremental document → Konva node sync (same strategy as slide-editor's `syncElements`):
 * diff keyed by layer id; if the type is unchanged, update properties in place + adjust zIndex, then one `batchDraw()`.
 *
 * Two kinds of layers get **no node**:
 * - pass-through groups (children build their own nodes in the layer stack; the group only means "container");
 * - adjustment layers (they act on the composite below, handled by the composite pipeline, not drawn directly).
 * So zIndex counts built nodes rather than using the document index, so a hole in the indexes is not collapsed by Konva.
 */
export function syncLayers(layer: Konva.Layer, doc: PhotoDoc): void {
  const existing = new Map<string, Konva.Node>();
  for (const child of layer.getChildren()) {
    const id = child.getAttr(LAYER_ID_ATTR);
    if (typeof id === 'string' && id) existing.set(id, child);
  }

  // With adjustment layers: everything below (inclusive) is composited into one base node; layers above keep their own (text stays crisp)
  const baseIndex = adjustmentBaseIndex(doc);
  let z = 0;
  if (baseIndex >= 0) {
    const base = compositeBelowAdjustments(doc);
    if (base) {
      let node = existing.get(ADJUST_BASE_ID) as Konva.Image | undefined;
      if (!(node instanceof Konva.Image)) {
        existing.get(ADJUST_BASE_ID)?.destroy();
        node = new Konva.Image({
          image: base,
          x: 0,
          y: 0,
          width: base.width,
          height: base.height,
          listening: false,
          perfectDrawEnabled: false,
        });
        node.setAttr(LAYER_ID_ATTR, ADJUST_BASE_ID);
        node.setAttr(LAYER_KIND_ATTR, 'adjust-base');
        layer.add(node);
      } else {
        node.image(base);
        node.size({ width: base.width, height: base.height });
      }
      node.zIndex(z);
      existing.delete(ADJUST_BASE_ID);
      z += 1;
    }
  } else {
    existing.get(ADJUST_BASE_ID)?.destroy();
    existing.delete(ADJUST_BASE_ID);
  }

  doc.layers.forEach((item: Layer, index: number) => {
    const current = existing.get(item.id);
    // Layers already baked into the base image no longer get their own node
    if (baseIndex >= 0 && index <= baseIndex) {
      current?.destroy();
      existing.delete(item.id);
      return;
    }
    if (isContainerOnly(item)) {
      current?.destroy();
      existing.delete(item.id);
      return;
    }

    if (current && sameKind(current, item)) {
      updateLayerNode(current, item, false, doc);
      current.zIndex(z);
      existing.delete(item.id);
    } else {
      current?.destroy();
      const node = createLayerNode(item, doc);
      layer.add(node);
      node.zIndex(z);
      existing.delete(item.id);
    }
    z += 1;
  });

  for (const stale of existing.values()) stale.destroy();
  layer.batchDraw();
}

/** Layers that only act as containers / effects and paint no pixels themselves */
function isContainerOnly(layer: Layer): boolean {
  if (layer.kind === 'group') return layer.passThrough;
  return layer.kind === 'adjustment';
}

function sameKind(node: Konva.Node, layer: Layer): boolean {
  // A layer with a mask / layer style is a "composited result" image node, shaped unlike a plain node, so it cannot be updated in place
  const expected = layerNeedsComposite(layer)
    ? `composed:${layer.kind}`
    : layer.kind === 'shape'
      ? `shape:${layer.shape}`
      : layer.kind;
  return node.getAttr(LAYER_KIND_ATTR) === expected;
}

/**
 * Sync one layer (after a stroke only this layer needs refreshing, not the whole tree).
 * `live = true` means pixels are being rewritten: the bake cache must be bypassed to read the latest pixels.
 */
export function refreshLayerNode(
  layer: Konva.Layer,
  item: Layer,
  live = false,
  doc?: PhotoDoc,
): void {
  const node = layer.getChildren().find((child) => child.getAttr(LAYER_ID_ATTR) === item.id);
  if (!node) {
    layer.batchDraw();
    return;
  }
  updateLayerNode(node, item, live, doc);
  layer.batchDraw();
}

/** Fixed id of the adjustment base-image node (not backed by any real layer) */
export const ADJUST_BASE_ID = '__adjust-base__';

export { BAKE_KEY_ATTR };
