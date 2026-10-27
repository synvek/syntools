/**
 * Pointer interaction: translate PointerEvents into Ops on the Scene.
 *
 * Drawing **never touches React state** and never repaints the whole board: the canvas pixels are
 * snapshotted on pointer-down, then each move restores the snapshot and redraws only the current
 * op. Per-frame cost therefore depends only on the active operation, and the result matches the
 * committed stroke pixel for pixel.
 *
 * Three interaction families:
 * - Drag: pen / marker / eraser / line / arrow / rectangle / ellipse / pan
 * - Pick: eyedropper (a click samples a colour and switches back to the previous tool)
 * - Click sequence: free-form polygon (clicks add vertices; close by clicking the start, Enter or right-click)
 *
 * Right-click always inks with the toolbar's "background colour" (classic drawing-app semantics).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import {
  MOVE_MIN_DELTA,
  POLYGON_CLOSE_PX,
  backdropOf,
  compositeOver,
  distance,
  normalizeRect,
  pressureFactor,
  shouldSample,
  type LineOp,
  type Op,
  type Point,
  type PolygonOp,
  type ShapeOp,
  type StrokeOp,
} from './core';
import { clearStage, drawOp, drawPolygonPreview } from './render';
import { useBoardStore } from './store';

type Pending =
  { kind: 'draw'; start: Point; op: Op } | { kind: 'move'; start: Point; dx: number; dy: number };

interface PolygonDraft {
  points: Point[];
  hover: Point | null;
}

export interface BoardPointer {
  onPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onContextMenu: (e: ReactMouseEvent<HTMLCanvasElement>) => void;
}

const DPR_MAX = 2;
/** Right-click detection: only meaningful for a mouse; touch / stylus always count as primary */
function isSecondaryButton(e: { pointerType?: string; button?: number }): boolean {
  return e.pointerType === 'mouse' && e.button === 2;
}

function currentDpr(): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(DPR_MAX, Math.max(1, window.devicePixelRatio || 1));
}

/** With Shift, snap lines to 45° steps */
function snapAngle(from: Point, to: Point): Point {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const step = Math.PI / 4;
  const snapped = Math.round(angle / step) * step;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return {
    x: from.x + Math.cos(snapped) * length,
    y: from.y + Math.sin(snapped) * length,
    p: to.p,
  };
}

export function useBoardPointer(canvasRef: RefObject<HTMLCanvasElement | null>): BoardPointer {
  const pendingRef = useRef<Pending | null>(null);
  const polygonRef = useRef<PolygonDraft | null>(null);
  const snapshotRef = useRef<HTMLCanvasElement | null>(null);

  const pointAt = useCallback(
    (e: { clientX: number; clientY: number; pressure?: number; pointerType?: string }): Point => {
      const canvas = canvasRef.current;
      const { scene, brush } = useBoardStore.getState();
      if (!canvas) return { x: 0, y: 0, p: 1 };
      const rect = canvas.getBoundingClientRect();
      const x = rect.width ? ((e.clientX - rect.left) / rect.width) * scene.width : 0;
      const y = rect.height ? ((e.clientY - rect.top) / rect.height) * scene.height : 0;
      return { x, y, p: brush.pressure ? pressureFactor(e) : 1 };
    },
    [canvasRef],
  );

  /** Canvas units per screen pixel (used for the polygon closing threshold) */
  const sceneUnitsPerPx = useCallback((): number => {
    const canvas = canvasRef.current;
    const { scene } = useBoardStore.getState();
    const rect = canvas?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 1;
    return scene.width / rect.width;
  }, [canvasRef]);

  /** Snapshot pixels on pointer-down: every later move redraws on top of it */
  const captureSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = useBoardStore.getState().scene;
    const dpr = currentDpr();
    const snapshot = snapshotRef.current ?? document.createElement('canvas');
    snapshot.width = Math.max(1, Math.round(width * dpr));
    snapshot.height = Math.max(1, Math.round(height * dpr));
    const ctx = snapshot.getContext('2d');
    ctx?.setTransform(1, 0, 0, 1, 0, 0);
    ctx?.clearRect(0, 0, snapshot.width, snapshot.height);
    ctx?.drawImage(canvas, 0, 0);
    snapshotRef.current = snapshot;
  }, [canvasRef]);

  /**
   * Redraw the stage from "snapshot + operation in progress": panning offsets the snapshot,
   * drawing overlays the current op, and polygons overlay a polyline preview.
   */
  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const scene = useBoardStore.getState().scene;
    ctx.setTransform(currentDpr(), 0, 0, currentDpr(), 0, 0);
    clearStage(ctx);
    const snapshot = snapshotRef.current;
    if (!snapshot) return;

    const pending = pendingRef.current;
    if (pending?.kind === 'move') {
      ctx.save();
      ctx.translate(pending.dx, pending.dy);
      ctx.drawImage(snapshot, 0, 0, scene.width, scene.height);
      ctx.restore();
      return;
    }

    ctx.drawImage(snapshot, 0, 0, scene.width, scene.height);
    if (pending) drawOp(ctx, pending.op);

    const polygon = polygonRef.current;
    if (polygon && polygon.points.length > 0) {
      const { color, width, opacity } = useBoardStore.getState().brush;
      drawPolygonPreview(ctx, polygon.points, polygon.hover, color, width, opacity);
    }
  }, [canvasRef]);

  /** Polygon click: the first point starts a draft; clicking the start point closes it */
  const addPolygonPoint = useCallback(
    (point: Point) => {
      const draft = polygonRef.current;
      if (!draft) {
        captureSnapshot();
        polygonRef.current = { points: [point], hover: point };
        repaint();
        return;
      }
      const threshold = POLYGON_CLOSE_PX * sceneUnitsPerPx();
      if (draft.points.length >= 3 && distance(point, draft.points[0]) <= threshold) {
        pendingRef.current = null;
        polygonRef.current = null;
        const state = useBoardStore.getState();
        const op: PolygonOp = {
          kind: 'polygon',
          points: draft.points,
          color: state.brush.color,
          width: state.brush.width,
          opacity: state.brush.opacity,
          fill: state.fill,
          fillColor: state.secondary,
        };
        state.addOp(op);
        return;
      }
      // Too close to the previous point: ignore it so jitter cannot create duplicate vertices
      const last = draft.points[draft.points.length - 1];
      if (distance(point, last) <= threshold * 0.5) return;
      polygonRef.current = { points: [...draft.points, point], hover: point };
      repaint();
    },
    [captureSnapshot, repaint, sceneUnitsPerPx],
  );

  const cancelPolygon = useCallback(() => {
    if (!polygonRef.current) return;
    polygonRef.current = null;
    repaint();
  }, [repaint]);

  const dropLastVertex = useCallback(() => {
    const draft = polygonRef.current;
    if (!draft) return;
    const points = draft.points.slice(0, -1);
    if (points.length === 0) {
      polygonRef.current = null;
      repaint();
      return;
    }
    polygonRef.current = { points, hover: draft.hover };
    repaint();
  }, [repaint]);

  /** Eyedropper: composite the pixel over the background to get the perceived colour, then restore the previous tool */
  const pickAt = useCallback(
    (point: Point) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const { scene, lastTool, setPrimaryColor, setTool } = useBoardStore.getState();
      const ratio = canvas.width / Math.max(1, scene.width);
      const x = Math.floor(point.x * ratio);
      const y = Math.floor(point.y * ratio);
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
      let pixel: Uint8ClampedArray;
      try {
        pixel = ctx.getImageData(x, y, 1, 1).data;
      } catch {
        return;
      }
      const hex = compositeOver(
        { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] },
        backdropOf(scene.background.kind, scene.background.color),
      );
      setPrimaryColor(hex);
      setTool(lastTool);
    },
    [canvasRef],
  );

  const finish = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    if (pending.kind === 'move') {
      const { dx, dy } = pending;
      useBoardStore.getState().translateScene(dx, dy);
      // A tiny pan is ignored by the store (scene unchanged → no repaint), so restore the snapshot here
      if (Math.abs(dx) < MOVE_MIN_DELTA && Math.abs(dy) < MOVE_MIN_DELTA) repaint();
      return;
    }
    if (isTrivial(pending.op)) {
      // Accidental no-op actions never enter history: revert to the pre-stroke pixels
      repaint();
      return;
    }
    useBoardStore.getState().addOp(pending.op);
  }, [repaint]);

  // Polygon keyboard controls: Enter closes / Esc cancels / Backspace removes the last vertex
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!polygonRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        const draft = polygonRef.current;
        if (draft && draft.points.length >= 3) {
          pendingRef.current = null;
          polygonRef.current = null;
          const state = useBoardStore.getState();
          state.addOp({
            kind: 'polygon',
            points: draft.points,
            color: state.brush.color,
            width: state.brush.width,
            opacity: state.brush.opacity,
            fill: state.fill,
            fillColor: state.secondary,
          });
        } else {
          cancelPolygon();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelPolygon();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        dropLastVertex();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancelPolygon, dropLastVertex]);

  return useMemo<BoardPointer>(
    () => ({
      onPointerDown: (e) => {
        const state = useBoardStore.getState();
        const secondary = isSecondaryButton(e);
        if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
        // Text is not drawn via pointer events: the overlay input in BoardCanvas handles it
        if (state.tool === 'text') return;

        if (state.tool === 'polygon') {
          // Right-click closes the polygon via onContextMenu, so it must not add a vertex
          if (secondary) return;
          canvasRef.current?.setPointerCapture(e.pointerId);
          addPolygonPoint(pointAt(e));
          return;
        }
        if (state.tool === 'picker') {
          if (secondary) return;
          pickAt(pointAt(e));
          return;
        }

        canvasRef.current?.setPointerCapture(e.pointerId);
        const start = pointAt(e);

        if (state.tool === 'move') {
          captureSnapshot();
          pendingRef.current = { kind: 'move', start, dx: 0, dy: 0 };
          return;
        }

        const { width, opacity } = state.brush;
        const color = secondary ? state.secondary : state.brush.color;
        const base = { color, width, opacity };
        let op: Op | null = null;
        if (state.tool === 'pen' || state.tool === 'marker' || state.tool === 'eraser') {
          op = { kind: 'stroke', mode: state.tool, ...base, points: [start] } satisfies StrokeOp;
        } else if (state.tool === 'line' || state.tool === 'arrow') {
          op = { kind: state.tool, from: start, to: start, ...base } satisfies LineOp;
        } else if (state.tool === 'rect' || state.tool === 'ellipse') {
          op = {
            kind: state.tool,
            x: start.x,
            y: start.y,
            w: 0,
            h: 0,
            ...base,
            fill: state.fill,
            fillColor: state.secondary,
          } satisfies ShapeOp;
        }
        if (!op) return;
        captureSnapshot();
        pendingRef.current = { kind: 'draw', start, op };
        repaint();
      },

      onPointerMove: (e) => {
        const polygon = polygonRef.current;
        if (polygon) {
          polygonRef.current = { points: polygon.points, hover: pointAt(e) };
          repaint();
          return;
        }
        const pending = pendingRef.current;
        if (!pending) return;
        const current = pointAt(e);
        if (pending.kind === 'move') {
          pending.dx = current.x - pending.start.x;
          pending.dy = current.y - pending.start.y;
          repaint();
          return;
        }
        const op = pending.op;
        if (op.kind === 'stroke') {
          const last = op.points[op.points.length - 1];
          if (!last || !shouldSample(last, current)) return;
          pending.op = { ...op, points: [...op.points, current] };
        } else if (op.kind === 'line' || op.kind === 'arrow') {
          const to = e.shiftKey ? snapAngle(pending.start, current) : current;
          pending.op = { ...op, to };
        } else if (op.kind === 'rect' || op.kind === 'ellipse') {
          const box = normalizeRect(
            pending.start.x,
            pending.start.y,
            current.x,
            current.y,
            e.shiftKey,
          );
          pending.op = { ...op, ...box };
        }
        repaint();
      },

      onPointerUp: (e) => {
        if (pendingRef.current) {
          canvasRef.current?.releasePointerCapture(e.pointerId);
          finish();
        }
      },

      onPointerCancel: () => {
        if (!pendingRef.current) return;
        pendingRef.current = null;
        repaint();
      },

      onContextMenu: (e) => {
        e.preventDefault();
        const polygon = polygonRef.current;
        if (polygon) {
          // Right-click closes the polygon (discarded when there are too few vertices)
          if (polygon.points.length >= 3) {
            const state = useBoardStore.getState();
            state.addOp({
              kind: 'polygon',
              points: polygon.points,
              color: state.brush.color,
              width: state.brush.width,
              opacity: state.brush.opacity,
              fill: state.fill,
              fillColor: state.secondary,
            });
          }
          polygonRef.current = null;
        }
      },
    }),
    [addPolygonPoint, canvasRef, captureSnapshot, finish, pickAt, pointAt, repaint],
  );
}

/** Detect "empty" operations: tiny shapes / lines are dropped, while a stroke counts even with one point */
function isTrivial(op: Op): boolean {
  if (op.kind === 'stroke') return false;
  if (op.kind === 'polygon') return op.points.length < 3;
  if (op.kind === 'line' || op.kind === 'arrow') {
    return Math.hypot(op.to.x - op.from.x, op.to.y - op.from.y) < 2;
  }
  if (op.kind === 'rect' || op.kind === 'ellipse') return op.w < 2 || op.h < 2;
  return false;
}
