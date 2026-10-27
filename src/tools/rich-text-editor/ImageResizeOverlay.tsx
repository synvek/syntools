import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { findSelectedImage, keepImageSelected, readZoom } from './imageLayer';

/**
 * Image resize handles: selecting an image shows 8 handles (4 corners + 4 edge midpoints) for proportional dragging.
 *
 * Uses a React overlay instead of a ProseMirror NodeView:
 * - No need to reimplement image DOM rendering (export, layering styles, and pagination all rely on the native <img>);
 * - The overlay is a child of the scroll container, positioned in content coordinates, so it follows scrolling for free.
 */

/** Handle position: 4 corners + 4 edge midpoints */
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type HandleDirection = (typeof HANDLES)[number];

const MIN_WIDTH = 24;
const MAX_WIDTH = 4000;

interface ImageBox {
  /** Document position of the image node */
  pos: number;
  /** Overlay box (in the scroll container's content coordinate space) */
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ImageResizeOverlayProps {
  editor: Editor | null;
  /** Editing workspace (the scroll container) the overlay is mounted into */
  viewportRef: RefObject<HTMLDivElement | null>;
}

/** Compute the overlay box of the selected image; null when no image is selected */
function measure(editor: Editor, viewport: HTMLElement): ImageBox | null {
  const found = findSelectedImage(editor.state);
  if (!found) return null;
  const dom = editor.view.nodeDOM(found.pos) as HTMLElement | null;
  if (!dom || dom.nodeType !== 1) return null;
  const rect = dom.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const viewportRect = viewport.getBoundingClientRect();
  // The overlay sits outside the zoom layer, so position and size must be mapped from screen px back to layout px
  const zoom = readZoom(dom);
  return {
    pos: found.pos,
    left: (rect.left - viewportRect.left) / zoom + viewport.scrollLeft,
    top: (rect.top - viewportRect.top) / zoom + viewport.scrollTop,
    width: rect.width / zoom,
    height: rect.height / zoom,
  };
}

/** Drag direction → width/height delta (proportional, driven by width) */
function nextWidth(
  direction: HandleDirection,
  dx: number,
  dy: number,
  start: number,
  ratio: number,
) {
  switch (direction) {
    case 'e':
    case 'ne':
    case 'se':
      return start + dx;
    case 'w':
    case 'nw':
    case 'sw':
      return start - dx;
    case 's':
      // Top/bottom midpoints: convert vertical movement to a width delta via the aspect ratio
      return start + dy / ratio;
    case 'n':
      return start - dy / ratio;
    default:
      return start;
  }
}

export function ImageResizeOverlay({ editor, viewportRef }: ImageResizeOverlayProps) {
  const [box, setBox] = useState<ImageBox | null>(null);

  const refresh = useCallback(() => {
    const viewport = viewportRef.current;
    if (!editor || !viewport) {
      setBox(null);
      return;
    }
    setBox(measure(editor, viewport));
  }, [editor, viewportRef]);

  useEffect(() => {
    if (!editor) return;
    refresh();
    // Recompute on selection/doc changes, image load, and window resize
    editor.on('transaction', refresh);
    editor.on('selectionUpdate', refresh);
    window.addEventListener('resize', refresh);
    const viewport = viewportRef.current;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refresh);
    if (observer && viewport) observer.observe(viewport);
    if (observer) observer.observe(editor.view.dom);
    editor.view.dom.addEventListener('load', refresh, true);
    return () => {
      editor.off('transaction', refresh);
      editor.off('selectionUpdate', refresh);
      window.removeEventListener('resize', refresh);
      observer?.disconnect();
      editor.view.dom.removeEventListener('load', refresh, true);
    };
  }, [editor, refresh, viewportRef]);

  const startResize = (event: React.MouseEvent, direction: HandleDirection) => {
    if (!editor || !box) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = box.width;
    const ratio = box.height > 0 ? box.height / box.width : 1;
    // Screen delta → layout px; capped at the body content width (matching the toolbar's 100% preset)
    const zoom = readZoom(editor.view.dom);
    const maxWidth = Math.min(MAX_WIDTH, Math.max(editor.view.dom.clientWidth || 1, MIN_WIDTH * 2));
    const pos = box.pos;
    let current = startWidth;

    const apply = (width: number, history: boolean): void => {
      const node = editor.state.doc.nodeAt(pos);
      if (!node || node.type.name !== 'image') return;
      const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        width: Math.round(width),
      });
      if (!history) tr.setMeta('addToHistory', false);
      // An inline image's node selection degrades to a cursor after mapping: restore it or the handles jump to the first image in the paragraph
      keepImageSelected(tr, pos);
      editor.view.dispatch(tr);
    };

    const onMove = (moveEvent: MouseEvent): void => {
      const raw = nextWidth(
        direction,
        (moveEvent.clientX - startX) / zoom,
        (moveEvent.clientY - startY) / zoom,
        startWidth,
        ratio,
      );
      current = Math.min(maxWidth, Math.max(MIN_WIDTH, raw));
      apply(current, false);
    };

    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (Math.round(current) === Math.round(startWidth)) return;
      // Dragging does not enter history; on release it becomes a single undoable step
      apply(startWidth, false);
      apply(current, true);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (!box) return null;

  return (
    <div
      className="rte-image-frame"
      style={{
        top: `${box.top}px`,
        left: `${box.left}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      }}
      aria-hidden="true"
    >
      {HANDLES.map((direction) => (
        <span
          key={direction}
          data-handle={direction}
          className={`rte-image-handle rte-image-handle--${direction}`}
          onMouseDown={(event) => startResize(event, direction)}
        />
      ))}
    </div>
  );
}
