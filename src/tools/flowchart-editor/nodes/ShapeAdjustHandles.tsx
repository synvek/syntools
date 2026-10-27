import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store';
import {
  adjustsFor,
  paramValue,
  projectAdjust,
  type ShapeAdjustDef,
  type ShapeDef,
} from '../model/shapes';
import type { FlowNodeStyle } from '../model/types';

/**
 * Adjustable shape parameter handles (draw.io-style yellow adjustment vertices).
 *
 * Rendered only for a single selected shape; one handle per parameter, with position and drag projection derived from `ShapeDef.adjust`,
 * so new shapes need no change here. A drag coalesces into one undo step (commit on pointerdown).
 */
export function ShapeAdjustHandles({
  nodeId,
  def,
  style,
  w,
  h,
  containerRef,
}: {
  nodeId: string;
  def: ShapeDef;
  style: FlowNodeStyle;
  w: number;
  h: number;
  /** Node root ref: converts pointer screen coordinates back to node-local coordinates (handling zoom and parent offsets) */
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const adjusts = adjustsFor(def);
  const dragging = useRef<{
    adj: ShapeAdjustDef;
    rect: DOMRect;
    w: number;
    h: number;
  } | null>(null);

  if (adjusts.length === 0) return null;

  const valueOf = (adj: ShapeAdjustDef) => paramValue(def, style, adj.key, w, h);

  const onDown = (adj: ShapeAdjustDef) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    const el = containerRef.current;
    if (!el) return;
    e.stopPropagation();
    e.preventDefault();
    // Commit history once at the start of the gesture; pointermove does not push again (matching NodeResizer)
    useFlowStore.getState().commit();
    dragging.current = { adj, rect: el.getBoundingClientRect(), w, h };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragging.current;
    if (!d) return;
    e.stopPropagation();
    const { rect, adj } = d;
    if (rect.width <= 0 || rect.height <= 0) return;
    const localX = ((e.clientX - rect.left) / rect.width) * d.w;
    const localY = ((e.clientY - rect.top) / rect.height) * d.h;
    const value = projectAdjust(adj, localX, localY, d.w, d.h);
    useFlowStore
      .getState()
      .setNodeParams([nodeId], { [adj.key]: Math.round(value * 1000) / 1000 }, false);
  };

  const onUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    dragging.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <>
      {adjusts.map((adj) => {
        const pos = adj.anchor(w, h, valueOf(adj));
        const label = t(`tools.flowchart.shapeParam.${adj.labelKey}`);
        return (
          <button
            key={adj.key}
            type="button"
            data-testid={`flowchart-adjust-${adj.key}`}
            aria-label={label}
            title={`${label}${t('tools.flowchart.shapeParamHint')}`}
            className="shape-adjust nodrag nopan"
            style={{ left: pos.x, top: pos.y }}
            onPointerDown={onDown(adj)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onDoubleClick={(e) => {
              e.stopPropagation();
              useFlowStore.getState().clearNodeParam([nodeId], adj.key);
            }}
          >
            <span className="shape-adjust__dot" />
          </button>
        );
      })}
    </>
  );
}
