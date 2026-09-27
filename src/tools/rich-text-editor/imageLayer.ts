import { Extension } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';

/**
 * 图片层级（对标 Word 的「环绕方式」）：
 * - inline：嵌入型，图片在文字流里，占位并参与分页（默认）
 * - front ：浮于文字上方，脱离文字流，可拖动定位
 * - behind：衬于文字下方，脱离文字流，绘制在正文之下，可拖动定位
 *
 * 浮动层用绝对定位实现（偏移量相对内容区左上角，px），因此不影响文字排版与分页，
 * 与 Word 的浮动对象行为一致；偏移量写进节点属性，导入导出、撤销重做都走同一套数据。
 */

export const IMAGE_LAYERS = ['inline', 'front', 'behind'] as const;
export type ImageLayer = (typeof IMAGE_LAYERS)[number];

export const imageLayerKey = new PluginKey('imageLayer');

/** 归一化层级取值（DOM 属性 / 历史数据都可能是任意字符串） */
export function normalizeImageLayer(value: string | null | undefined): ImageLayer {
  return IMAGE_LAYERS.includes(value as ImageLayer) ? (value as ImageLayer) : 'inline';
}

/** 是否为浮动层（浮于文字上方 / 衬于文字下方） */
export function isFloatingImageLayer(
  layer: string | null | undefined,
): layer is 'front' | 'behind' {
  return layer === 'front' || layer === 'behind';
}

/** DOM 上的浮动图片判定（分页测量需跳过：浮动图片脱离文字流，不影响分页） */
export function isFloatingImageElement(el: Element | null | undefined): boolean {
  return Boolean(el && el.tagName === 'IMG' && isFloatingImageLayer(el.getAttribute('data-layer')));
}

/** px → EMU（OOXML 长度单位，1px = 9525EMU） */
export function pxToEmu(px: number): number {
  return Math.round(px * 9525);
}

/**
 * 找到「当前操作目标」的图片节点：
 * 1) 图片被选中（NodeSelection，块级图片点击后的常态）；
 * 2) 光标所在段落内部的行内图片（含图片前/后）。
 * 注意不能只看 `$from.parent.descendants`——图片是块级节点时父节点是 doc，永远找不到。
 */
export function findSelectedImage(state: EditorState): { pos: number; node: PMNode } | null {
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
    return { pos: selection.from, node: selection.node };
  }
  const { $from } = selection;
  if ($from.depth < 1) return null;
  const parent = $from.parent;
  const base = $from.before($from.depth);
  let found: { pos: number; node: PMNode } | null = null;
  parent.descendants((child, offset) => {
    if (found || child.type.name !== 'image') return undefined;
    found = { pos: base + offset + 1, node: child };
    return false;
  });
  return found;
}

/**
 * 读取元素所在的缩放系数（编辑器支持 CSS zoom）。
 * getBoundingClientRect 返回的是缩放后的屏幕尺寸，换算布局像素（= 文档里存的尺寸）时必须还原。
 */
export function readZoom(el: HTMLElement | null): number {
  const zoomEl = el?.closest('[data-rte-zoom]');
  const zoom = Number(zoomEl?.getAttribute('data-rte-zoom') ?? 1);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

/** 图片相对内容区左上角的偏移（布局像素，已还原缩放） */
function measureOffset(view: EditorView, dom: HTMLElement): { x: number; y: number } {
  const content = view.dom as HTMLElement;
  const rect = dom.getBoundingClientRect();
  const contentRect = content.getBoundingClientRect();
  const zoom = readZoom(dom);
  return {
    x: Math.round((rect.left - contentRect.left) / zoom),
    y: Math.round((rect.top - contentRect.top) / zoom),
  };
}

/** 拖动浮动图片：拖动过程不写历史，松手后合成一步可撤销的改动 */
function startImageDrag(
  view: EditorView,
  event: MouseEvent,
  pos: number,
  dom: HTMLElement,
  node: PMNode,
): void {
  const startX = event.clientX;
  const startY = event.clientY;
  const baseX = Number(node.attrs.offsetX ?? 0);
  const baseY = Number(node.attrs.offsetY ?? 0);
  const zoom = readZoom(dom);
  event.preventDefault();

  const applyOffset = (x: number, y: number, history: boolean): void => {
    const current = view.state.doc.nodeAt(pos);
    if (!current) return;
    const tr = view.state.tr.setNodeMarkup(pos, undefined, {
      ...current.attrs,
      // 不允许拖出内容区左上角（否则图片会跑到不可见位置）
      offsetX: Math.max(0, Math.round(x)),
      offsetY: Math.max(0, Math.round(y)),
    });
    if (!history) tr.setMeta('addToHistory', false);
    view.dispatch(tr);
  };

  const onMove = (moveEvent: MouseEvent): void => {
    applyOffset(
      baseX + (moveEvent.clientX - startX) / zoom,
      baseY + (moveEvent.clientY - startY) / zoom,
      false,
    );
  };

  const onUp = (): void => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    const current = view.state.doc.nodeAt(pos);
    if (!current) return;
    const finalX = Number(current.attrs.offsetX ?? 0);
    const finalY = Number(current.attrs.offsetY ?? 0);
    if (finalX === baseX && finalY === baseY) return;
    // 先静默回到拖动前，再以可撤销事务落到终值 → 整个拖动只占一步撤销
    applyOffset(baseX, baseY, false);
    applyOffset(finalX, finalY, true);
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

/** 选中图片节点（浮动图片点击即选中，便于继续用工具栏调整） */
function selectImage(view: EditorView, pos: number): void {
  const { selection } = view.state;
  if (selection instanceof NodeSelection && selection.from === pos) return;
  const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos));
  tr.setMeta('addToHistory', false);
  view.dispatch(tr);
}

/**
 * 按坐标命中浮动图片。
 * 「衬于文字下方」的图片绘制在正文之下，DOM 事件会被上层段落截获，
 * 因此这里按矩形做命中判定（与 Word 一致：点在被图片覆盖的区域内即选中图片）。
 */
function findFloatingImageAtPoint(
  view: EditorView,
  clientX: number,
  clientY: number,
): { pos: number; node: PMNode; dom: HTMLElement } | null {
  const images = Array.from(view.dom.querySelectorAll('img[data-layer]')) as HTMLElement[];
  for (const dom of images) {
    const rect = dom.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right) continue;
    if (clientY < rect.top || clientY > rect.bottom) continue;
    const pos = view.posAtDOM(dom, 0);
    const node = view.state.doc.nodeAt(pos);
    if (!node || node.type.name !== 'image') continue;
    return { pos, node, dom };
  }
  return null;
}

/**
 * 浮动图片 mousedown 处理：命中则选中并开始拖动。
 *
 * 除了编辑器的 handleDOMEvents，工作台容器（.rte-editor-viewport）也要兜底调用它：
 * 浮动图片是绝对定位元素，可以绘制到内容盒子之外（如纸张下沿的工作台区域），
 * 这类位置的 mousedown 不会进入编辑器 DOM，只靠编辑器插件会「点不到、拖不动」。
 */
export function handleFloatingImagePointerDown(view: EditorView, event: MouseEvent): boolean {
  if (event.button !== 0 || event.defaultPrevented) return false;
  const target = event.target as HTMLElement | null;
  const direct = target?.closest?.('img[data-layer]') as HTMLElement | null;
  const hit = direct
    ? (() => {
        const pos = view.posAtDOM(direct, 0);
        const node = view.state.doc.nodeAt(pos);
        return node && node.type.name === 'image' ? { pos, node, dom: direct } : null;
      })()
    : findFloatingImageAtPoint(view, event.clientX, event.clientY);
  if (!hit) return false;
  selectImage(view, hit.pos);
  startImageDrag(view, event, hit.pos, hit.dom, hit.node);
  return true;
}

/** 浮动图片拖动插件（仅对浮动层生效，嵌入型保持 ProseMirror 默认拖拽行为） */
export const ImageLayerDrag = new Plugin({
  key: imageLayerKey,
  props: {
    handleDOMEvents: {
      mousedown(view, domEvent) {
        return handleFloatingImagePointerDown(view, domEvent as MouseEvent);
      },
    },
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageLayer: {
      /** 切换图片层级（改成浮动层时按当前位置初始化偏移，避免图片跳动） */
      setImageLayer: (layer: ImageLayer) => ReturnType;
    };
  }
}

export const ImageLayerCommands = Extension.create({
  name: 'imageLayerCommands',
  addCommands() {
    return {
      setImageLayer:
        (layer: ImageLayer) =>
        // 注意：必须写回 TipTap 传入的 tr，自行 view.dispatch 会让链式事务与最新状态错位
        ({ state, tr, view }) => {
          const found = findSelectedImage(state);
          if (!found) return false;
          const { pos, node } = found;
          const attrs: Record<string, unknown> = { ...node.attrs, layer };
          if (isFloatingImageLayer(layer)) {
            const dom = view.nodeDOM(pos) as HTMLElement | null;
            const offset = dom ? measureOffset(view, dom) : { x: 0, y: 0 };
            // 仅在该轴尚未定位时初始化，重复切换不会重置用户拖好的位置
            attrs.offsetX = node.attrs.offsetX ?? offset.x;
            attrs.offsetY = node.attrs.offsetY ?? offset.y;
          } else {
            attrs.offsetX = null;
            attrs.offsetY = null;
          }
          tr.setNodeMarkup(pos, undefined, attrs);
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    return [ImageLayerDrag];
  },
});
