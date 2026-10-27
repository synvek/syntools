import { Extension } from '@tiptap/core';
import {
  NodeSelection,
  Plugin,
  PluginKey,
  type EditorState,
  type Transaction,
} from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';

/**
 * Image wrapping modes (modeled on Word):
 * - inline    : in line with text, flows with the text and affects pagination (default)
 * - wrap-left : square, image floats left, text wraps on the right and below
 * - wrap-right: square, image floats right, text wraps on the left and below
 * - top-bottom: top and bottom, image takes a full line, text appears only above and below
 * - front     : in front of text, out of the text flow, draggable
 * - behind    : behind text, out of the text flow, painted under the body text, draggable
 *
 * front / behind use absolute positioning (offsets relative to the content area's top-left corner, px)
 * and don't affect text layout or pagination; wrap-* / top-bottom use CSS floats and block layout and
 * stay in the document flow. All values live in node attributes, so import/export and undo/redo share
 * the same data.
 */

export const IMAGE_LAYERS = [
  'inline',
  'wrap-left',
  'wrap-right',
  'top-bottom',
  'front',
  'behind',
] as const;
export type ImageLayer = (typeof IMAGE_LAYERS)[number];

export const imageLayerKey = new PluginKey('imageLayer');

/** Normalize the layer value (DOM attributes / legacy data may hold arbitrary strings) */
export function normalizeImageLayer(value: string | null | undefined): ImageLayer {
  return IMAGE_LAYERS.includes(value as ImageLayer) ? (value as ImageLayer) : 'inline';
}

/** Whether this is an absolutely positioned floating layer (in front of / behind text) */
export function isFloatingImageLayer(
  layer: string | null | undefined,
): layer is 'front' | 'behind' {
  return layer === 'front' || layer === 'behind';
}

/** Square wrapping: the image floats to one side and text wraps on the other (still in the document flow) */
export function isWrappedImageLayer(
  layer: string | null | undefined,
): layer is 'wrap-left' | 'wrap-right' {
  return layer === 'wrap-left' || layer === 'wrap-right';
}

/** Wrap modes that need an explicit data-layer attribute (inline is the default and writes none) */
export function hasImageLayerAttr(layer: string | null | undefined): layer is ImageLayer {
  return Boolean(layer) && layer !== 'inline';
}

/** Floating-image check on the DOM (pagination measurement skips these: out of the text flow, no effect on pages) */
export function isFloatingImageElement(el: Element | null | undefined): boolean {
  return Boolean(el && el.tagName === 'IMG' && isFloatingImageLayer(el.getAttribute('data-layer')));
}

/** px -> EMU (OOXML length unit, 1px = 9525 EMU) */
export function pxToEmu(px: number): number {
  return Math.round(px * 9525);
}

/**
 * Find the image node the current action targets:
 * 1) the image is selected (NodeSelection, the usual state after clicking a block image);
 * 2) an inline image inside the paragraph holding the cursor (before or after the image).
 * Don't rely on `$from.parent.descendants` alone — for block-level images the parent is doc, so it never matches.
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
 * Re-select the image after changing its attributes.
 *
 * Inline images degrade from NodeSelection to a cursor when the transaction is mapped — ProseMirror
 * only keeps node selection for block-level atoms. Without re-selecting, the toolbar's image controls
 * vanish right after a width / alignment change and the user can't keep adjusting (e.g. set the width,
 * then pick a wrap mode).
 */
export function keepImageSelected(tr: Transaction, pos: number): void {
  const node = tr.doc.nodeAt(pos);
  if (!node || node.type.name !== 'image') return;
  tr.setSelection(NodeSelection.create(tr.doc, pos));
}

/**
 * Read the zoom factor applying to the element (the editor supports CSS zoom).
 * getBoundingClientRect returns zoomed screen sizes, which must be scaled back when converting to
 * layout pixels (= the sizes stored in the document).
 */
export function readZoom(el: HTMLElement | null): number {
  const zoomEl = el?.closest('[data-rte-zoom]');
  const zoom = Number(zoomEl?.getAttribute('data-rte-zoom') ?? 1);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

/** Offset of the image from the content area's top-left corner (layout pixels, zoom undone) */
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

/** Drag a floating image: no history during the drag, one undoable step once released */
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
      // Don't allow dragging past the content area's top-left corner (the image would become invisible)
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
    // First silently revert to the pre-drag state, then commit the final value in an undoable transaction -> one undo step per drag
    applyOffset(baseX, baseY, false);
    applyOffset(finalX, finalY, true);
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

/** Select the image node (clicking a floating image selects it so the toolbar can keep adjusting it) */
function selectImage(view: EditorView, pos: number): void {
  const { selection } = view.state;
  if (selection instanceof NodeSelection && selection.from === pos) return;
  const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos));
  tr.setMeta('addToHistory', false);
  view.dispatch(tr);
}

/**
 * Hit-test floating images by coordinates.
 * "Behind text" images are painted below the body text, so DOM events are captured by the paragraphs
 * above; hence the rectangle hit test (matching Word: clicking inside the area an image covers selects it).
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
 * Floating image mousedown handling: on hit, select and start dragging.
 *
 * Besides the editor's handleDOMEvents, the workbench container (.rte-editor-viewport) must also call
 * this as a fallback: floating images are absolutely positioned and can be painted outside the content
 * box (e.g. the workbench area below the sheet), where mousedown never reaches the editor DOM — with the
 * editor plugin alone they can't be clicked or dragged.
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

/** Floating image drag plugin (floating layers only; inline images keep ProseMirror's default drag behavior) */
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
      /** Switch the image layer (initializing offsets from the current position when switching to floating, so the image doesn't jump) */
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
        // Note: always write back to the tr TipTap passes in; dispatching via view.dispatch desyncs the chained transaction from the latest state
        ({ state, tr, view }) => {
          const found = findSelectedImage(state);
          if (!found) return false;
          const { pos, node } = found;
          const attrs: Record<string, unknown> = { ...node.attrs, layer };
          if (isFloatingImageLayer(layer)) {
            const dom = view.nodeDOM(pos) as HTMLElement | null;
            const offset = dom ? measureOffset(view, dom) : { x: 0, y: 0 };
            // Initialize only when that axis has no offset yet, so repeat switches don't reset the user's position
            attrs.offsetX = node.attrs.offsetX ?? offset.x;
            attrs.offsetY = node.attrs.offsetY ?? offset.y;
          } else {
            attrs.offsetX = null;
            attrs.offsetY = null;
          }
          tr.setNodeMarkup(pos, undefined, attrs);
          // Keep the selection after switching layers: otherwise inline images' node selection degrades to a cursor and adjustments stop
          keepImageSelected(tr, pos);
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    return [ImageLayerDrag];
  },
});
