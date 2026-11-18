import { useRef } from 'react';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { clampNormRect } from '../model/coords';
import type { NormRect, PdfObject, PdfTextObject } from '../model/types';

interface OverlayLayerProps {
  /** Objects anchored to this page (all z orders; painted ascending) */
  objects: PdfObject[];
  /** `PdfPageState.sourceIndex` of the page this layer covers */
  page: number;
  /** CSS px per PDF point, so a 11 pt text box looks 11 pt at any zoom */
  scale: number;
  selectedId: string | null;
  editingId: string | null;
  onSelect(id: string | null): void;
  onStartEdit(id: string): void;
  onEndEdit(): void;
  /** Create an object for a double-click; returns the new id so it can enter edit mode */
  onCreate(rect: NormRect): string | null;
  onTextChange(id: string, text: string): void;
  onMove(id: string, rect: NormRect): void;
}

/** Default box: two text lines wide enough to type into without resizing first */
const NEW_BOX_WIDTH = 0.36;

function textStyle(object: PdfTextObject, scale: number): CSSProperties {
  return {
    color: object.color,
    fontSize: `${Math.max(1, object.fontSize * scale)}px`,
    lineHeight: object.lineHeight,
    textAlign: object.align,
    opacity: object.opacity,
    background: object.bg,
    border: object.border ? `1px solid ${object.border}` : undefined,
  };
}

/**
 * Interactive layer above the rendered page.
 *
 * M1 scope is deliberately one object type: double-click creates a text box, typing edits it, drag
 * moves it, Delete removes it (handled by the controller). Coordinates are stored normalized (0–1,
 * top-left of the visual page) so zooming never rewrites the model.
 *
 * The layer does receive pointer events (that is how an empty double-click is detected), but it
 * never consumes them: pointerdown only clears the selection and the event keeps bubbling to the
 * scroll container, so panning and scrolling still work.
 */
export function OverlayLayer({
  objects,
  page,
  scale,
  selectedId,
  editingId,
  onSelect,
  onStartEdit,
  onEndEdit,
  onCreate,
  onTextChange,
  onMove,
}: OverlayLayerProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; rect: NormRect } | null>(
    null,
  );

  const texts = objects
    .filter((object): object is PdfTextObject => object.kind === 'text' && object.page === page)
    .sort((a, b) => a.z - b.z);

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

  const onBoxPointerDown = (event: ReactPointerEvent<HTMLDivElement>, object: PdfTextObject) => {
    // Selecting must not depend on the primary button: a secondary click or a synthetic event
    // without `button` should still select, and the container's "click empty space" handler must
    // not clear the selection underneath.
    event.stopPropagation();
    onSelect(object.id);
    if (event.button !== 0 || editingId === object.id) return;

    const element = rootRef.current;
    if (!element) return;
    dragRef.current = {
      id: object.id,
      startX: event.clientX,
      startY: event.clientY,
      rect: object.rect,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onBoxPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const element = rootRef.current;
    if (!drag || !element) return;

    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;

    const dx = (event.clientX - drag.startX) / box.width;
    const dy = (event.clientY - drag.startY) / box.height;
    const rect = clampNormRect({ ...drag.rect, x: drag.rect.x + dx, y: drag.rect.y + dy });
    onMove(drag.id, rect);
  };

  const onBoxPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div
      ref={rootRef}
      data-testid="pdf-overlay"
      data-page={page}
      className="absolute inset-0"
      onDoubleClick={onDoubleClick}
      onPointerDown={() => onSelect(null)}
    >
      {texts.map((object) => {
        const selected = object.id === selectedId;
        const editing = object.id === editingId;
        const style: CSSProperties = {
          left: `${object.rect.x * 100}%`,
          top: `${object.rect.y * 100}%`,
          width: `${object.rect.w * 100}%`,
          height: `${object.rect.h * 100}%`,
        };

        return (
          <div
            key={object.id}
            data-testid="pdf-text-object"
            data-selected={selected ? 'true' : 'false'}
            data-editing={editing ? 'true' : 'false'}
            style={style}
            className={`absolute ${
              selected ? 'ring-1 ring-blue-500' : ''
            } ${editing ? '' : 'cursor-move'}`}
            onPointerDown={(event) => onBoxPointerDown(event, object)}
            onPointerMove={onBoxPointerMove}
            onPointerUp={onBoxPointerUp}
            onPointerCancel={onBoxPointerUp}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onStartEdit(object.id);
            }}
          >
            {editing ? (
              <textarea
                autoFocus
                aria-label={t('tools.pdfEditor.textObjectAria')}
                data-testid="pdf-text-input"
                value={object.text}
                style={textStyle(object, scale)}
                className="h-full w-full resize-none border-0 bg-white/80 p-0 outline-none ring-1 ring-blue-500"
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
              <div
                style={textStyle(object, scale)}
                className="h-full w-full overflow-hidden whitespace-pre-wrap break-words"
              >
                {object.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Small helper so the page view can pass the layer through a render prop without importing types */
export type OverlayRenderer = (page: number, scale: number) => ReactNode;
