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

/**
 * 文档 → Konva 节点的增量同步（与 slide-editor 的 `syncElements` 同一策略）：
 * 以图层 id 为键做 diff，类型未变则就地更新属性 + 调整 zIndex，最后统一 `batchDraw()`。
 *
 * 两类图层**不建节点**：
 * - 穿透模式的编组（子图层各自在层栈里单独建节点，编组只是容器语义）；
 * - 调整图层（作用于下方合成结果，由 composite 管线处理，不直接呈现）。
 * 因此 zIndex 用「已建节点计数」而非文档下标，避免下标出现空洞时被 Konva 截断重排。
 */
export function syncLayers(layer: Konva.Layer, doc: PhotoDoc): void {
  const existing = new Map<string, Konva.Node>();
  for (const child of layer.getChildren()) {
    const id = child.getAttr(LAYER_ID_ATTR);
    if (typeof id === 'string' && id) existing.set(id, child);
  }

  // 存在调整图层时：其下方（含它）整体合成为一张底图节点，上方图层仍用各自的节点（文字依旧清晰）
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
    // 已被烘焙进底图的图层不再单独建节点
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

/** 只作为容器 / 作用语义存在、本身不呈现像素的图层 */
function isContainerOnly(layer: Layer): boolean {
  if (layer.kind === 'group') return layer.passThrough;
  return layer.kind === 'adjustment';
}

function sameKind(node: Konva.Node, layer: Layer): boolean {
  // 带蒙版的图层是一张「合成结果」图片节点，形态与普通节点不同，不能就地更新
  const expected = layer.mask?.enabled
    ? `masked:${layer.kind}`
    : layer.kind === 'shape'
      ? `shape:${layer.shape}`
      : layer.kind;
  return node.getAttr(LAYER_KIND_ATTR) === expected;
}

/**
 * 同步单个图层（落笔后只需刷新这一层，避免整树重算）。
 * `live = true` 表示像素正在被改写：必须绕过 bake 缓存取最新像素。
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

/** 调整图层底图节点的固定 id（不对应任何真实图层） */
export const ADJUST_BASE_ID = '__adjust-base__';

export { BAKE_KEY_ATTR };
