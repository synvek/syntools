import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { rulerTicks, screenToDoc } from '../core';
import type { ViewOverlay } from '../model/types';

/**
 * Canvas helper views: rulers / grid / guides (pure DOM overlay, does not touch the Konva pipeline).
 *
 * Key point: this component is absolutely positioned over the canvas host (inset:0) and shares `viewport`'s
 * coordinates exactly, so hit-testing and coordinate mapping are unchanged; all off by default to avoid breaking existing interactions and tests.
 */

const RULER = 20;
const HIT = 7;
const GUIDE_COLOR = 'rgba(34,211,238,0.9)';

export interface CanvasTransform {
  scale: number;
  x: number;
  y: number;
}

export function CanvasOverlay({
  width,
  height,
  transform,
  viewRotation = 0,
  overlay,
  patchOverlay,
}: {
  width: number;
  height: number;
  transform: CanvasTransform;
  /** View rotation angle: the grid and guides rotate with it (otherwise they would misalign with the canvas content) */
  viewRotation?: number;
  overlay: ViewOverlay;
  patchOverlay: (patch: Partial<ViewOverlay>) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [pending, setPending] = useState<{ axis: 'h' | 'v'; screen: number } | null>(null);
  const scale = transform.scale > 0 ? transform.scale : 1;

  const localFrom = (clientX: number, clientY: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  /** Screen component → document component (a full inverse transform under rotation, no longer per-axis linear math) */
  const toDocAxis = (axis: 'h' | 'v', screen: number) =>
    Math.round(
      screenToDoc(
        axis === 'v' ? { x: screen, y: height / 2 } : { x: width / 2, y: screen },
        transform,
        { width, height },
        viewRotation,
      )[axis === 'v' ? 'x' : 'y'],
    );

  /** Drag a guide out of the ruler */
  const startCreate = (axis: 'h' | 'v') => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const guides = overlay.guides;
    const point = localFrom(event.clientX, event.clientY);
    setPending({ axis, screen: axis === 'v' ? point.x : point.y });
    const onMove = (move: PointerEvent) => {
      const p = localFrom(move.clientX, move.clientY);
      setPending({ axis, screen: axis === 'v' ? p.x : p.y });
    };
    const onUp = (up: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setPending(null);
      const p = localFrom(up.clientX, up.clientY);
      if (p.x < 0 || p.y < 0 || p.x > width || p.y > height) return;
      const pos = toDocAxis(axis, axis === 'v' ? p.x : p.y);
      patchOverlay({ guides: [...guides, { axis, pos }] });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /** Drag an existing guide; dropping it back on the ruler strip deletes it */
  const startMove = (index: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const guide = overlay.guides[index];
    if (!guide) return;
    const guides = overlay.guides;
    const onMove = (move: PointerEvent) => {
      const p = localFrom(move.clientX, move.clientY);
      const pos = toDocAxis(guide.axis, guide.axis === 'v' ? p.x : p.y);
      patchOverlay({ guides: guides.map((item, i) => (i === index ? { ...item, pos } : item)) });
    };
    const onUp = (up: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const p = localFrom(up.clientX, up.clientY);
      const overRuler = guide.axis === 'v' ? p.x <= RULER : p.y <= RULER;
      if (overRuler) patchOverlay({ guides: guides.filter((_, i) => i !== index) });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {/*
        The grid and guides are plain DOM drawing and cannot follow Konva's layer rotation,
        so they are wrapped in a "rotate about the viewport center" container — the anchor matches `stagePosition` exactly.
      */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={
          viewRotation
            ? { transform: `rotate(${viewRotation}deg)`, transformOrigin: '50% 50%' }
            : undefined
        }
      >
        {overlay.grid ? (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(148,163,184,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.35) 1px, transparent 1px)',
              backgroundSize: `${Math.max(4, overlay.gridSize * scale)}px ${Math.max(
                4,
                overlay.gridSize * scale,
              )}px`,
              backgroundPosition: `${transform.x}px ${transform.y}px`,
            }}
          />
        ) : null}

        {overlay.guides.map((guide, index) => {
          const screen =
            guide.axis === 'v' ? transform.x + guide.pos * scale : transform.y + guide.pos * scale;
          const box: CSSProperties =
            guide.axis === 'v'
              ? { left: screen - HIT / 2, top: 0, width: HIT, height: '100%' }
              : { top: screen - HIT / 2, left: 0, height: HIT, width: '100%' };
          const line: CSSProperties =
            guide.axis === 'v'
              ? { left: HIT / 2 - 0.5, top: 0, width: 1, height: '100%', background: GUIDE_COLOR }
              : { top: HIT / 2 - 0.5, left: 0, height: 1, width: '100%', background: GUIDE_COLOR };
          return (
            <div
              key={`${guide.axis}-${index}-${guide.pos}`}
              data-testid={`guide-${guide.axis}-${index}`}
              onPointerDown={startMove(index)}
              onDoubleClick={() =>
                patchOverlay({ guides: overlay.guides.filter((_, i) => i !== index) })
              }
              className={`pointer-events-auto absolute ${
                guide.axis === 'v' ? 'cursor-col-resize' : 'cursor-row-resize'
              }`}
              style={box}
            >
              <span className="pointer-events-none absolute" style={line} />
            </div>
          );
        })}
      </div>

      {pending ? (
        <span
          aria-hidden
          className="absolute"
          style={
            pending.axis === 'v'
              ? { left: pending.screen, top: 0, width: 1, height: '100%', background: GUIDE_COLOR }
              : { top: pending.screen, left: 0, height: 1, width: '100%', background: GUIDE_COLOR }
          }
        />
      ) : null}

      {/* Ruler ticks align with screen coordinates and would point the wrong way once rotated, so the ruler hides while rotating */}
      {overlay.rulers && !viewRotation ? (
        <>
          <div
            data-testid="ruler-h"
            onPointerDown={startCreate('h')}
            className="pointer-events-auto absolute left-0 top-0 h-5 w-full cursor-row-resize select-none border-b border-gray-300 bg-gray-100/95 text-[9px] text-gray-500 dark:border-gray-700 dark:bg-gray-800/95 dark:text-gray-400"
          >
            {rulerTicks(scale, transform.x, width).map((tick) => (
              <span
                key={tick.doc}
                className="absolute top-0 h-full border-l border-gray-300 pl-0.5 leading-5 dark:border-gray-600"
                style={{ left: tick.screen }}
              >
                {tick.label}
              </span>
            ))}
          </div>
          <div
            data-testid="ruler-v"
            onPointerDown={startCreate('v')}
            className="pointer-events-auto absolute left-0 top-0 h-full w-5 cursor-col-resize select-none border-r border-gray-300 bg-gray-100/95 dark:border-gray-700 dark:bg-gray-800/95"
          >
            {rulerTicks(scale, transform.y, height).map((tick) => (
              <span
                key={tick.doc}
                className="absolute left-0 w-full border-t border-gray-300 dark:border-gray-600"
                style={{ top: tick.screen }}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
