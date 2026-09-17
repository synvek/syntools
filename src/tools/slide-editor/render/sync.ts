import Konva from 'konva';
import type { SlideElement } from '../model/types';
import { createElementNode, patchElementNode, sameKind, type RenderContext } from './nodes';

/**
 * keyed diff 同步：以 element.id 为键复用 Konva 节点。
 * 只有「元素类型变化」或「子节点结构变化」时才重建，其余走属性快路径，
 * 避免拖拽过程中整页重绘。
 */
export function syncElements(
  layer: Konva.Layer,
  elements: SlideElement[],
  ctx: RenderContext,
): void {
  const existing = new Map<string, Konva.Group>();
  for (const child of layer.getChildren()) {
    if (child.name() !== 'element') continue; // Transformer 等非元素节点不参与 diff
    const id = child.id();
    if (id && child instanceof Konva.Group) existing.set(id, child);
  }

  elements.forEach((element, index) => {
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

  // 未被命中的旧节点即已从文档中删除
  for (const stale of existing.values()) stale.destroy();
  layer.batchDraw();
}

/**
 * 元素是否可走属性快路径。
 * 文本/形状/表格的内部子节点由内容决定，属性更新可能漏掉结构差异，
 * 这类元素每次重建以保证与模型一致（元素数量可控，代价可接受）。
 */
function isUpdatable(element: SlideElement): boolean {
  return element.type === 'image' || element.type === 'line' || element.type === 'group';
}

/** 依据布局/母版占位符渲染「不可选中」的底层提示层 */
export function renderInherited(
  layer: Konva.Layer,
  elements: SlideElement[],
  ctx: RenderContext,
): void {
  syncElements(layer, elements, ctx);
  layer.listening(false);
  layer.opacity(0.35);
}
