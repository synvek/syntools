/**
 * 指针交互：把 PointerEvent 翻译成 Scene 里的 Op。
 *
 * 绘制期间**不改 React 状态**、也不整幅重绘：落笔时把当前画布像素
 * 拍一张快照，之后每次移动都「恢复快照 + 重画当前这一笔」，
 * 因此每帧成本只与当前操作相关，且与最终落笔结果逐像素一致。
 *
 * 覆盖三类交互：
 * - 拖拽型：画笔 / 荧光笔 / 橡皮 / 直线 / 箭头 / 矩形 / 椭圆 / 整体移动
 * - 取色型：吸管（点击即取色，并自动切回上一个工具）
 * - 点击序列型：自由多边形（点击加顶点，点回起点 / 回车 / 右键闭合）
 *
 * 鼠标右键统一使用工具栏的「背景色」落笔（经典画板语义）。
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
/** 判定「右键」：仅鼠标有意义，触控 / 触控笔一律按左键处理 */
function isSecondaryButton(e: { pointerType?: string; button?: number }): boolean {
  return e.pointerType === 'mouse' && e.button === 2;
}

function currentDpr(): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(DPR_MAX, Math.max(1, window.devicePixelRatio || 1));
}

/** 直线按 Shift 吸附到 45° 步进 */
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

  /** 一个屏幕像素对应多少画布单位（多边形闭合判定用） */
  const sceneUnitsPerPx = useCallback((): number => {
    const canvas = canvasRef.current;
    const { scene } = useBoardStore.getState();
    const rect = canvas?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 1;
    return scene.width / rect.width;
  }, [canvasRef]);

  /** 落笔瞬间备份像素：之后的每次移动都基于它重画 */
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
   * 依据「快照 + 当前进行中的操作」重绘舞台：
   * 移动整体时平移快照，绘制时叠加当前一笔，多边形则叠加折线预览。
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

  /** 多边形落点：首点建草稿，点回起点（或点数达标）则闭合 */
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
      // 与上一点过近：忽略，避免抖动产生重复顶点
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

  /** 吸管：把画布像素合成到背景色之上，得到肉眼所见颜色，然后切回上一个工具 */
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
      // 位移过小会被 store 忽略（scene 不变 → 不会重绘），这里手动恢复快照
      if (Math.abs(dx) < MOVE_MIN_DELTA && Math.abs(dy) < MOVE_MIN_DELTA) repaint();
      return;
    }
    if (isTrivial(pending.op)) {
      // 误触产生的空操作不入历史：回到落笔前的像素
      repaint();
      return;
    }
    useBoardStore.getState().addOp(pending.op);
  }, [repaint]);

  // 多边形的键盘操作：回车闭合 / Esc 取消 / Backspace 退点
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
        // 文字不走 pointer 绘制：由 BoardCanvas 的覆盖层输入框接管
        if (state.tool === 'text') return;

        if (state.tool === 'polygon') {
          // 右键用于闭合，交给 onContextMenu 处理，避免误加顶点
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
          // 右键闭合多边形（点数不足则丢弃）
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

/** 判定“没有实际内容”的操作：尺寸过小的图形 / 直线会丢弃，笔画连一个点也算数 */
function isTrivial(op: Op): boolean {
  if (op.kind === 'stroke') return false;
  if (op.kind === 'polygon') return op.points.length < 3;
  if (op.kind === 'line' || op.kind === 'arrow') {
    return Math.hypot(op.to.x - op.from.x, op.to.y - op.from.y) < 2;
  }
  if (op.kind === 'rect' || op.kind === 'ellipse') return op.w < 2 || op.h < 2;
  return false;
}
