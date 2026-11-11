import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { startPointerDrag } from './pointerDrag';
import { shapeAdjustValues, shapeAdjustments } from '../../core/drawing/shapeDefs';
import { readZoom } from './imageLayer';
import { findSelectedShape, keepShapeSelected, shapeSpec, type DocShapeAttrs } from './shapeNode';

/**
 * Shape interaction overlay (P3-1.2): selection frame, 8 resize handles, a rotation handle and the
 * yellow adjustment handles of the current preset.
 *
 * Same design as `ImageResizeOverlay`: a React overlay in content coordinates rather than a
 * NodeView, so rendering stays inside the node's HTML (drafts / print / PDF all agree) and the
 * overlay follows scrolling for free. Drags never enter the undo history; releasing commits a
 * single undoable step.
 */

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type HandleDirection = (typeof HANDLES)[number];

const MIN_SIZE = 20;
const MAX_SIZE = 4000;

interface ShapeBox {
  pos: number;
  /** Overlay box in the scroll container's content coordinates */
  top: number;
  left: number;
  width: number;
  height: number;
  /** Unrotated layout size (what resize drags actually change) */
  layoutWidth: number;
  layoutHeight: number;
  rotation: number;
  /** Current view zoom: the overlay lives outside the zoom layer, so screen sizes need it */
  zoom: number;
  attrs: DocShapeAttrs;
}

interface ShapeOverlayProps {
  editor: Editor | null;
  viewportRef: RefObject<HTMLDivElement | null>;
}

function measure(editor: Editor, viewport: HTMLElement): ShapeBox | null {
  const found = findSelectedShape(editor.state);
  if (!found) return null;
  const dom = editor.view.nodeDOM(found.pos) as HTMLElement | null;
  if (!dom || dom.nodeType !== 1) return null;
  const rect = dom.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const viewportRect = viewport.getBoundingClientRect();
  const zoom = readZoom(dom);
  const attrs = shapeSpec(found.node.attrs);
  // The overlay sits OUTSIDE the zoom layer, so its coordinates and sizes stay in screen pixels:
  // dividing by the zoom factor would draw the frame larger than the shape at any zoom below 100%.
  return {
    pos: found.pos,
    left: rect.left - viewportRect.left + viewport.scrollLeft,
    top: rect.top - viewportRect.top + viewport.scrollTop,
    width: rect.width,
    height: rect.height,
    layoutWidth: attrs.width,
    layoutHeight: attrs.height,
    rotation: attrs.rotation,
    zoom,
    attrs,
  };
}

/** Resize delta → new box size per handle direction (free resize, not proportional) */
function nextSize(
  direction: HandleDirection,
  dx: number,
  dy: number,
  start: { width: number; height: number },
) {
  const horizontal = direction.includes('e') ? 1 : direction.includes('w') ? -1 : 0;
  const vertical = direction.includes('s') ? 1 : direction.includes('n') ? -1 : 0;
  return {
    width: start.width + horizontal * dx,
    height: start.height + vertical * dy,
  };
}

export function ShapeOverlay({ editor, viewportRef }: ShapeOverlayProps) {
  const [box, setBox] = useState<ShapeBox | null>(null);
  /** Inline text editing: double-click the shape and type, like Word's shape text */
  const [editing, setEditing] = useState(false);
  const editableRef = useRef<HTMLDivElement | null>(null);

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
    editor.on('transaction', refresh);
    editor.on('selectionUpdate', refresh);
    window.addEventListener('resize', refresh);
    const viewport = viewportRef.current;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refresh);
    if (observer && viewport) observer.observe(viewport);
    if (observer) observer.observe(editor.view.dom);
    return () => {
      editor.off('transaction', refresh);
      editor.off('selectionUpdate', refresh);
      window.removeEventListener('resize', refresh);
      observer?.disconnect();
    };
  }, [editor, refresh, viewportRef]);

  const pos = box?.pos ?? null;

  // Leaving the shape (or the editor) must not leave a dangling caret box
  useEffect(() => {
    if (!box) setEditing(false);
  }, [box]);

  // Double-click on the selected shape enters text editing, matching Word / PowerPoint
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onDoubleClick = (event: MouseEvent) => {
      const found = findSelectedShape(editor.state);
      if (!found) return;
      const node = editor.view.nodeDOM(found.pos) as HTMLElement | null;
      if (!node || !node.contains(event.target as Node)) return;
      event.preventDefault();
      setEditing(true);
    };
    dom.addEventListener('dblclick', onDoubleClick);
    return () => dom.removeEventListener('dblclick', onDoubleClick);
  }, [editor]);

  // Hide the node's own text while the overlay holds the caret (otherwise it shows through)
  useEffect(() => {
    if (!editing || !editor || pos === null) return;
    const node = editor.view.nodeDOM(pos) as HTMLElement | null;
    node?.classList.add('rte-shape-editing');
    return () => node?.classList.remove('rte-shape-editing');
  }, [editing, editor, pos]);

  // Seed the editable with the current text and put the caret at its end
  useEffect(() => {
    if (!editing) return;
    const div = editableRef.current;
    if (!div) return;
    div.textContent = box?.attrs.text ?? '';
    div.focus();
    const range = document.createRange();
    range.selectNodeContents(div);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    // Only on entering edit mode: re-seeding on every render would fight the caret
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  if (!editor || !box || pos === null) return null;

  const apply = (attrs: Partial<DocShapeAttrs>, history: boolean): void => {
    const node = editor.state.doc.nodeAt(pos);
    if (!node || node.type.name !== 'docShape') return;
    const tr = editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
    if (!history) tr.setMeta('addToHistory', false);
    keepShapeSelected(tr, pos);
    editor.view.dispatch(tr);
  };

  /**
   * Ends inline editing. One undoable step per editing session: typing inside the overlay does not
   * touch the document, only the commit does.
   */
  const finishEditing = (commit: boolean): void => {
    const div = editableRef.current;
    const next = commit && div ? (div.textContent ?? '') : box.attrs.text;
    setEditing(false);
    if (next !== box.attrs.text) apply({ text: next }, true);
  };

  const dragResize = (event: React.PointerEvent<HTMLElement>, direction: HandleDirection) => {
    const startX = event.clientX;
    const startY = event.clientY;
    const zoom = readZoom(editor.view.dom);
    const start = { width: box.layoutWidth, height: box.layoutHeight };
    let current = start;

    const onMove = (moveEvent: MouseEvent): void => {
      const size = nextSize(
        direction,
        (moveEvent.clientX - startX) / zoom,
        (moveEvent.clientY - startY) / zoom,
        start,
      );
      current = {
        width: Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, size.width))),
        height: Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, size.height))),
      };
      apply(current, false);
    };
    const onUp = (): void => {
      if (current.width === start.width && current.height === start.height) return;
      apply(start, false);
      apply(current, true);
    };
    startPointerDrag(event, { move: onMove, end: onUp });
  };

  const dragRotate = (event: React.PointerEvent<HTMLElement>) => {
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    if (!dom) return;
    const rect = dom.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startAngle = box.rotation;
    let current = startAngle;

    const angleOf = (clientX: number, clientY: number): number => {
      // 0° = handle pointing up, clockwise positive (matching `a:xfrm@rot`)
      const radians = Math.atan2(clientY - cy, clientX - cx);
      return (radians * 180) / Math.PI + 90;
    };

    const onMove = (moveEvent: PointerEvent): void => {
      const raw = angleOf(moveEvent.clientX, moveEvent.clientY);
      // Snap to whole degrees, and to 15° steps while Shift is held
      const step = moveEvent.shiftKey ? 15 : 1;
      current = Math.round(raw / step) * step;
      apply({ rotation: current }, false);
    };
    const onUp = (): void => {
      if (current === startAngle) return;
      apply({ rotation: startAngle }, false);
      apply({ rotation: current }, true);
    };
    startPointerDrag(event, { move: onMove, end: onUp });
  };

  const dragAdjust = (
    event: React.PointerEvent<HTMLElement>,
    id: string,
    from: (p: { x: number; y: number }) => number,
    min: number,
    max: number,
  ) => {
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    if (!dom) return;
    const rect = dom.getBoundingClientRect();
    const base = box.attrs.adj ?? {};
    let current = base;

    const onMove = (moveEvent: PointerEvent): void => {
      if (rect.width <= 0 || rect.height <= 0) return;
      const point = {
        x: (moveEvent.clientX - rect.left) / rect.width,
        y: (moveEvent.clientY - rect.top) / rect.height,
      };
      const raw = from(point);
      const value = Math.min(max, Math.max(min, Number.isFinite(raw) ? raw : min));
      current = { ...base, [id]: Math.round(value * 1000) / 1000 };
      apply({ adj: current }, false);
    };
    const onUp = (): void => {
      if (JSON.stringify(current) === JSON.stringify(base)) return;
      apply({ adj: base }, false);
      apply({ adj: current }, true);
    };
    startPointerDrag(event, { move: onMove, end: onUp });
  };

  const values = shapeAdjustValues({ prst: box.attrs.prst, adj: box.attrs.adj ?? undefined });
  const adjusts = shapeAdjustments(box.attrs.prst);

  // Text editing supersedes the handle frame: the caret box takes the shape's place
  if (editing) {
    return (
      <div
        data-testid="rich-text-shape-text-editor"
        className="rte-shape-text-editor"
        style={{
          top: `${box.top}px`,
          left: `${box.left}px`,
          width: `${box.width}px`,
          height: `${box.height}px`,
          transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
        }}
      >
        <div
          ref={editableRef}
          className="rte-shape-text-editor__body"
          role="textbox"
          aria-multiline="true"
          aria-label={box.attrs.text ? box.attrs.text : 'shape text'}
          contentEditable
          suppressContentEditableWarning
          style={{
            fontSize: `${Math.round(box.attrs.textSize * box.zoom)}px`,
            color: box.attrs.textColor,
            textAlign: box.attrs.textAlign,
            fontWeight: box.attrs.textBold ? 700 : 400,
            fontStyle: box.attrs.textItalic ? 'italic' : 'normal',
            textDecoration: box.attrs.textUnderline ? 'underline' : 'none',
          }}
          onBlur={() => finishEditing(true)}
          onKeyDown={(event) => {
            // Esc discards nothing (the overlay is the only caret), it just leaves the mode
            if (event.key === 'Escape') {
              event.preventDefault();
              finishEditing(true);
              return;
            }
            // Enter inserts a line break like Word; Cmd/Ctrl+Enter commits
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              finishEditing(true);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="rte-image-frame"
      data-testid="rich-text-shape-frame"
      style={{
        top: `${box.top}px`,
        left: `${box.left}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      }}
      aria-hidden="true"
    >
      {adjusts.map((spec, index) => {
        const point = spec.at(values[spec.id]);
        return (
          <span
            key={spec.id}
            data-shape-adjust={spec.id}
            className="rte-shape-adjust"
            title={String(index + 1)}
            style={{ left: `${point.x * box.width}px`, top: `${point.y * box.height}px` }}
            onPointerDown={(event) => dragAdjust(event, spec.id, spec.from, spec.min, spec.max)}
          />
        );
      })}
      <span data-shape-handle="rotate" className="rte-shape-rotate" onPointerDown={dragRotate} />
      {HANDLES.map((direction) => (
        <span
          key={direction}
          data-handle={direction}
          className={`rte-image-handle rte-image-handle--${direction}`}
          onPointerDown={(event) => dragResize(event, direction)}
        />
      ))}
    </div>
  );
}
