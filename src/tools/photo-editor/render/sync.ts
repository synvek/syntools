import Konva from 'konva';
import type { Layer, PhotoDoc } from '../model/types';
import {
  BAKE_KEY_ATTR,
  createLayerNode,
  LAYER_ID_ATTR,
  LAYER_KIND_ATTR,
  updateLayerNode,
} from './nodes';

/**
 * 文档 → Konva 节点的增量同步（与 slide-editor 的 `syncElements` 同一策略）：
 * 以图层 id 为键做 diff，类型未变则就地更新属性 + 调整 zIndex，最后统一 `batchDraw()`。
 */
export function syncLayers(layer: Konva.Layer, doc: PhotoDoc): void {
  const existing = new Map<string, Konva.Node>();
  for (const child of layer.getChildren()) {
    const id = child.getAttr(LAYER_ID_ATTR);
    if (typeof id === 'string' && id) existing.set(id, child);
  }

  doc.layers.forEach((item: Layer, index) => {
    const current = existing.get(item.id);
    if (current && sameKind(current, item)) {
      updateLayerNode(current, item);
      current.zIndex(index);
      existing.delete(item.id);
      return;
    }
    current?.destroy();
    const node = createLayerNode(item);
    layer.add(node);
    node.zIndex(index);
    existing.delete(item.id);
  });

  for (const stale of existing.values()) stale.destroy();
  layer.batchDraw();
}

function sameKind(node: Konva.Node, layer: Layer): boolean {
  return (
    node.getAttr(LAYER_KIND_ATTR) === (layer.kind === 'shape' ? `shape:${layer.shape}` : layer.kind)
  );
}

/**
 * 同步单个图层（落笔后只需刷新这一层，避免整树重算）。
 * `live = true` 表示像素正在被改写：必须绕过 bake 缓存取最新像素。
 */
export function refreshLayerNode(layer: Konva.Layer, item: Layer, live = false): void {
  const node = layer.getChildren().find((child) => child.getAttr(LAYER_ID_ATTR) === item.id);
  if (!node) {
    layer.batchDraw();
    return;
  }
  updateLayerNode(node, item, live);
  layer.batchDraw();
}

export { BAKE_KEY_ATTR };
