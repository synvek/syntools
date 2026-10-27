import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store';
import { angleFromCenter, normalizeRotation, snapRotation } from '../core';
import { ROTATION_FINE_STEP, ROTATION_SNAP_STEP, type FlowNodeStyle } from '../model/types';

/**
 * Distance from the handle to the node's top edge (px).
 * It must clear both the top-center resize handle and the "up" quick-connect arrow (18×18, centered 18px above the top edge):
 * 40 puts the handle's bottom edge (-31) above the arrow's top edge (-27), otherwise the handle steals the arrow's pointer events.
 */
const HANDLE_OFFSET = 40;

/**
 * Node rotate handle (Figma / draw.io style rotation vertex).
 *
 * - Dragging rotates by the pointer's bearing relative to the node center, coalesced into one undo step;
 * - snaps to 15° by default, 45° steps while holding Shift, free angle while holding Alt;
 * - an angle readout shows while dragging, and a double-click resets to 0°.
 *
 * The handle renders on the **unrotated** outer container (like the resize handles and edge anchors),
 * so its position stays predictable and hittable after rotation.
 */
export function ShapeRotateHandle({
  nodeId,
  style,
  containerRef,
}: {
  nodeId: string;
  style: FlowNodeStyle;
  /** Node root ref: converts pointer screen coordinates back to node-local coordinates (handling zoom and parent offsets) */
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const [reading, setReading] = useState<number | null>(null);
  const dragging = useRef<{
    rect: DOMRect;
    /** Pointer bearing at pointer-down (degrees) */
    startAngle: number;
    /** Node angle at pointer-down (degrees) */
    startRotation: number;
  } | null>(null);

  const rotation = normalizeRotation(style.rotation ?? 0);
  const label = t('tools.flowchart.rotation');

  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const el = containerRef.current;
    if (!el) return;
    e.stopPropagation();
    e.preventDefault();
    // Commit history once at the start of the gesture; pointermove does not push again (matching the shape adjust handles)
    useFlowStore.getState().commit();
    const rect = el.getBoundingClientRect();
    dragging.current = {
      rect,
      startAngle: angleFromCenter(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        e.clientX,
        e.clientY,
      ),
      startRotation: rotation,
    };
    setReading(rotation);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragging.current;
    if (!d) return;
    e.stopPropagation();
    const { rect } = d;
    if (rect.width <= 0 || rect.height <= 0) return;
    const angle = angleFromCenter(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      e.clientX,
      e.clientY,
    );
    // Use the relative displacement rather than the absolute bearing, so the shape does not jump to the pointer direction on press
    const raw = d.startRotation + (angle - d.startAngle);
    const next = e.altKey
      ? normalizeRotation(raw)
      : snapRotation(raw, e.shiftKey ? ROTATION_FINE_STEP : ROTATION_SNAP_STEP);
    setReading(next);
    useFlowStore.getState().setNodeTransform([nodeId], { rotation: next }, false);
  };

  const onUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    dragging.current = null;
    setReading(null);
    useFlowStore.getState().commit();
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <button
      type="button"
      data-testid="flowchart-rotate-handle"
      aria-label={label}
      title={`${label} · ${t('tools.flowchart.rotateHint')}`}
      className="shape-rotate nodrag nopan"
      style={{ top: -HANDLE_OFFSET }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={(e) => {
        e.stopPropagation();
        useFlowStore.getState().setNodeTransform([nodeId], { rotation: undefined });
      }}
    >
      <span className="shape-rotate__dot" />
      {reading !== null ? (
        <span className="shape-rotate__readout" data-testid="flowchart-rotate-readout">
          {Math.round(reading)}°
        </span>
      ) : null}
    </button>
  );
}
