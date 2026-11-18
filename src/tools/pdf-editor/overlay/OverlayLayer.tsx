import { useLayoutEffect, useRef, useState } from 'react';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { clampNormRect } from '../model/coords';
import type { NormRect, PdfObject, PdfPageState } from '../model/types';
import {
  angleFromCenter,
  handlePoint,
  resizeRect,
  RESIZE_HANDLES,
  rotateDelta,
  snapAngle,
  type ResizeHandle,
} from './handles';
import { objectsInRect, type NormPoint } from './hitTest';
import { ObjectView, type PagePixelSize } from './objectViews';
import { textCss } from './textStyle';

interface OverlayLayerProps {
  /** Objects anchored to this page (all z orders; painted ascending) */
  objects: PdfObject[];
  /** `PdfPageState.id` of the page this layer covers */
  page: string;
  /** CSS px per PDF point, so a 11 pt text box looks 11 pt at any zoom */
  scale: number;
  selectedIds: string[];
  editingId: string | null;
  onSelect(ids: string[]): void;
  onStartEdit(id: string): void;
  onEndEdit(): void;
  /** Create an object for a double-click; returns the new id so it can enter edit mode */
  onCreate(rect: NormRect): string | null;
  onTextChange(id: string, text: string): void;
  /** Move every selected object; one call per pointermove so the controller can merge history */
  onMove(updates: Array<{ id: string; rect: NormRect }>): void;
  onResize(id: string, rect: NormRect): void;
  onRotate(id: string, rotation: number): void;
}

/** Default box: two text lines wide enough to type into without resizing first */
const NEW_BOX_WIDTH = 0.36;

/** Distance from the frame to the rotate handle, in CSS px */
const ROTATE_HANDLE_OFFSET = 24;

const HANDLE_CURSOR: Record<ResizeHandle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

type Gesture =
  | {
      mode: 'move';
      start: NormPoint;
      rects: Array<{ id: string; rect: NormRect }>;
    }
  | {
      mode: 'resize';
      object: PdfObject;
      handle: ResizeHandle;
      start: NormPoint;
      aspect: number;
      preserve: boolean;
    }
  | {
      mode: 'rotate';
      object: PdfObject;
      center: NormPoint;
      startAngle: number;
      startRotation: number;
      aspect: number;
    }
  | { mode: 'marquee'; start: NormPoint };

/**
 * Interactive layer above the rendered page.
 *
 * Every object kind is rendered through `ObjectView`; the wrapper owns geometry (normalized rect →
 * `%`), rotation, opacity, selection and dragging. Text additionally switches to a textarea while
 * `editingId` matches.
 *
 * Gestures start on the root (event delegation via `data-object-id` / `data-handle`), so a pointer
 * capture on the root keeps resize/rotate/marquee tracking even when the pointer leaves the page.
 * Empty-area pointerdown still bubbles to the scroll container for panning unless Shift starts a
 * marquee.
 */
export function OverlayLayer({
  objects,
  page,
  scale,
  selectedIds,
  editingId,
  onSelect,
  onStartEdit,
  onEndEdit,
  onCreate,
  onTextChange,
  onMove,
  onResize,
  onRotate,
}: OverlayLayerProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState<PagePixelSize>({ width: 0, height: 0 });
  const gestureRef = useRef<Gesture | null>(null);
  const [marquee, setMarquee] = useState<NormRect | null>(null);

  // SVG geometry needs the page box in CSS px; measured so stroke widths stay 1:1 with save output
  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const measure = () =>
      setPageSize((previous) => {
        const next = { width: element.clientWidth, height: element.clientHeight };
        return previous.width === next.width && previous.height === next.height ? previous : next;
      });

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const visible = objects.filter((object) => object.page === page).sort((a, b) => a.z - b.z);
  const selected = visible.filter((object) => selectedIds.includes(object.id));
  const pageAspect =
    pageSize.width > 0 && pageSize.height > 0 ? pageSize.width / pageSize.height : 1;

  const pointFromEvent = (clientX: number, clientY: number): NormPoint | null => {
    const element = rootRef.current;
    if (!element) return null;
    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return null;
    return {
      x: Math.min(1, Math.max(0, (clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (clientY - box.top) / box.height)),
    };
  };

  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const element = rootRef.current;
    if (!element) return;
    // Only a double-click on the page itself creates a box, not on an existing one
    if (event.target !== element) return;

    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;

    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    const heightPt = box.height / scale;
    const h = Math.min(0.25, Math.max(0.02, (11 * 1.35 * 2) / heightPt));

    const id = onCreate(clampNormRect({ x: x - NEW_BOX_WIDTH / 2, y, w: NEW_BOX_WIDTH, h }));
    if (id) onStartEdit(id);
  };

  const capture = (event: ReactPointerEvent<HTMLElement>) => {
    rootRef.current?.setPointerCapture?.(event.pointerId);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const point = pointFromEvent(event.clientX, event.clientY);
    if (!point) return;

    if (event.button !== 0) {
      // Secondary click still selects an object, but never starts a gesture
      const owner = target.closest<HTMLElement>('[data-object-id]');
      if (owner?.dataset.objectId) onSelect([owner.dataset.objectId]);
      return;
    }

    const handleElement = target.closest<HTMLElement>('[data-handle]');
    if (handleElement && selected.length === 1 && !editingId) {
      const object = selected[0];
      if (object.locked) return;
      event.stopPropagation();
      event.preventDefault();
      capture(event);

      const handle = handleElement.dataset.handle as ResizeHandle | 'rotate';
      const center = { x: object.rect.x + object.rect.w / 2, y: object.rect.y + object.rect.h / 2 };

      gestureRef.current =
        handle === 'rotate'
          ? {
              mode: 'rotate',
              object,
              center,
              startAngle: angleFromCenter(center, point, pageAspect),
              startRotation: object.rotation,
              aspect: pageAspect,
            }
          : {
              mode: 'resize',
              object,
              handle,
              start: point,
              aspect: pageAspect,
              preserve: event.shiftKey,
            };
      return;
    }

    const owner = target.closest<HTMLElement>('[data-object-id]');
    if (owner?.dataset.objectId) {
      const id = owner.dataset.objectId;
      const object = visible.find((candidate) => candidate.id === id);
      if (!object) return;

      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      const nextSelection = additive
        ? selectedIds.includes(id)
          ? selectedIds.filter((candidate) => candidate !== id)
          : [...selectedIds, id]
        : selectedIds.includes(id)
          ? selectedIds
          : [id];
      onSelect(nextSelection);

      // Selecting through a textarea would steal the caret; editing ends via blur instead
      if (editingId === id) return;

      event.stopPropagation();
      if (object.locked) return;
      capture(event);

      const moveIds = nextSelection.includes(id) ? nextSelection : [id];
      gestureRef.current = {
        mode: 'move',
        start: point,
        rects: visible
          .filter((candidate) => moveIds.includes(candidate.id) && !candidate.locked)
          .map((candidate) => ({ id: candidate.id, rect: candidate.rect })),
      };
      return;
    }

    // Empty space: Shift starts a marquee, a plain press clears the selection
    if (event.shiftKey) {
      event.stopPropagation();
      capture(event);
      gestureRef.current = { mode: 'marquee', start: point };
      setMarquee({ x: point.x, y: point.y, w: 0, h: 0 });
      return;
    }
    onSelect([]);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const point = pointFromEvent(event.clientX, event.clientY);
    if (!point) return;

    if (gesture.mode === 'marquee') {
      setMarquee(
        clampNormRect({
          x: Math.min(gesture.start.x, point.x),
          y: Math.min(gesture.start.y, point.y),
          w: Math.abs(point.x - gesture.start.x),
          h: Math.abs(point.y - gesture.start.y),
        }),
      );
      return;
    }

    if (gesture.mode === 'move') {
      const dx = point.x - gesture.start.x;
      const dy = point.y - gesture.start.y;
      onMove(
        gesture.rects.map(({ id, rect }) => ({
          id,
          rect: clampNormRect({ ...rect, x: rect.x + dx, y: rect.y + dy }),
        })),
      );
      return;
    }

    if (gesture.mode === 'resize') {
      const rawDx = point.x - gesture.start.x;
      const rawDy = point.y - gesture.start.y;
      const { dx, dy } = rotateDelta(rawDx, rawDy, gesture.object.rotation, gesture.aspect);
      onResize(
        gesture.object.id,
        resizeRect(gesture.object.rect, gesture.handle, dx, dy, {
          preserveAspect: gesture.preserve || event.shiftKey,
        }),
      );
      return;
    }

    const angle = angleFromCenter(gesture.center, point, gesture.aspect);
    const rotation = (((gesture.startRotation + (angle - gesture.startAngle)) % 360) + 360) % 360;
    onRotate(gesture.object.id, event.shiftKey ? snapAngle(rotation) : rotation);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    gestureRef.current = null;

    if (gesture?.mode === 'marquee' && marquee) {
      const hits = objectsInRect(marquee, visible);
      onSelect(hits.map((object) => object.id));
      setMarquee(null);
    }

    rootRef.current?.releasePointerCapture?.(event.pointerId);
  };

  const single = selected.length === 1 ? selected[0] : null;
  const showFrame = single !== null && !editingId && single.locked !== true;

  return (
    <div
      ref={rootRef}
      data-testid="pdf-overlay"
      data-page-id={page}
      className="absolute inset-0"
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {visible.map((object) => {
        const isSelected = selectedIds.includes(object.id);
        const editing = object.kind === 'text' && object.id === editingId;
        const style: CSSProperties = {
          left: `${object.rect.x * 100}%`,
          top: `${object.rect.y * 100}%`,
          width: `${object.rect.w * 100}%`,
          height: `${object.rect.h * 100}%`,
          opacity: object.opacity,
          transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
        };

        return (
          <div
            key={object.id}
            data-object-id={object.id}
            data-testid={object.kind === 'text' ? 'pdf-text-object' : 'pdf-object'}
            data-kind={object.kind}
            data-locked={object.locked ? 'true' : 'false'}
            data-selected={isSelected ? 'true' : 'false'}
            data-editing={editing ? 'true' : 'false'}
            style={style}
            className={`absolute ${isSelected ? 'ring-1 ring-[#b3261e]' : ''} ${
              editing || object.locked ? '' : 'cursor-move'
            }`}
          >
            {editing && object.kind === 'text' ? (
              <textarea
                autoFocus
                aria-label={t('tools.pdfEditor.textObjectAria')}
                data-testid="pdf-text-input"
                value={object.text}
                style={textCss(object, scale)}
                className="h-full w-full resize-none border-0 bg-white/80 p-0 outline-none ring-1 ring-[#b3261e]"
                onChange={(event) => onTextChange(object.id, event.target.value)}
                onBlur={onEndEdit}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  // Delete/Backspace edit the text here, not the object
                  event.stopPropagation();
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    onEndEdit();
                  }
                }}
              />
            ) : (
              <ObjectView object={object} scale={scale} pageSize={pageSize} />
            )}
          </div>
        );
      })}

      {showFrame && single ? <SelectionFrame object={single} /> : null}

      {marquee ? (
        <div
          data-testid="pdf-marquee"
          className="pointer-events-none absolute border border-dashed border-[#b3261e] bg-[#b3261e]/5"
          style={{
            left: `${marquee.x * 100}%`,
            top: `${marquee.y * 100}%`,
            width: `${marquee.w * 100}%`,
            height: `${marquee.h * 100}%`,
          }}
        />
      ) : null}
    </div>
  );
}

/** Eight resize handles plus one rotate handle, positioned in page-normalized percentages */
function SelectionFrame({ object }: { object: PdfObject }) {
  const rect = object.rect;

  return (
    <div
      data-testid="pdf-selection-frame"
      className="pointer-events-none absolute"
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.w * 100}%`,
        height: `${rect.h * 100}%`,
        transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
      }}
    >
      {RESIZE_HANDLES.map((handle) => {
        const point = handlePoint(rect, handle);
        // Relative to the object frame
        const left = ((point.x - rect.x) / Math.max(rect.w, 1e-6)) * 100;
        const top = ((point.y - rect.y) / Math.max(rect.h, 1e-6)) * 100;
        return (
          <div
            key={handle}
            role="presentation"
            data-handle={handle}
            aria-hidden="true"
            className="pointer-events-auto absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-[#b3261e] bg-white"
            style={{ left: `${left}%`, top: `${top}%`, cursor: HANDLE_CURSOR[handle] }}
          />
        );
      })}
      <div
        role="presentation"
        data-handle="rotate"
        aria-hidden="true"
        title="rotate"
        className="pointer-events-auto absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#b3261e] bg-white"
        style={{
          left: '50%',
          // Negative offset in px keeps the handle at a constant screen distance at any zoom
          top: `-${ROTATE_HANDLE_OFFSET}px`,
          cursor: 'grab',
        }}
      />
    </div>
  );
}

/** Small helper so the page view can pass the layer through a render prop without importing types */
export type OverlayRenderer = (page: PdfPageState, scale: number) => ReactNode;
