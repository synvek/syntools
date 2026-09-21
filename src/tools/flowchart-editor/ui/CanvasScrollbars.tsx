import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useReactFlow, useStore, useViewport } from '@xyflow/react';
import { useFlowStore } from '../store';
import { absoluteRectOf } from '../core';

/** 内容四周外扩（画布坐标），允许滚到内容之外一些 */
const PAD = 140;
/** 滚动条厚度（细窄样式） */
const THICKNESS = 6;
/** 滑块最小像素长度 */
const MIN_THUMB = 28;
/** 右下角缩略图占位（避免滚动条与其重叠） */
const MINIMAP_RESERVE_X = 156;
const MINIMAP_RESERVE_Y = 108;
/** 左下角缩放控件占位 */
const CONTROLS_RESERVE_X = 48;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

interface DragState {
  axis: 'x' | 'y';
  start: number;
  startT: number;
  trackPx: number;
  spanStart: number;
  range: number;
  zoom: number;
  fixedX: number;
  fixedY: number;
}

/**
 * 画布滚动条：以「内容包围盒 + 外扩」作为文档范围，
 * 用可视区域在其中的位置渲染滑块，拖动滑块即平移视口。
 * 内容未超出视口时自动隐藏。
 */
export function CanvasScrollbars() {
  const { x, y, zoom } = useViewport();
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const { setViewport } = useReactFlow();
  const nodes = useFlowStore((s) => s.nodes);
  const dragRef = useRef<DragState | null>(null);

  // 内容包围盒（仅随节点变化重算）
  const bounds = useMemo(() => {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    for (const n of nodes) {
      if (n.hidden) continue;
      const r = absoluteRectOf(n, byId);
      left = Math.min(left, r.x);
      top = Math.min(top, r.y);
      right = Math.max(right, r.x + r.width);
      bottom = Math.max(bottom, r.y + r.height);
    }
    if (!Number.isFinite(left)) return null;
    return { left: left - PAD, top: top - PAD, right: right + PAD, bottom: bottom + PAD };
  }, [nodes]);

  const viewLeft = -x / zoom;
  const viewTop = -y / zoom;
  const viewW = width / zoom;
  const viewH = height / zoom;

  const hTrack = Math.max(0, width - CONTROLS_RESERVE_X - MINIMAP_RESERVE_X - THICKNESS - 4);
  const vTrack = Math.max(0, height - MINIMAP_RESERVE_Y - THICKNESS - 4);

  let hThumb: { left: number; len: number; range: number; spanStart: number } | null = null;
  let vThumb: { top: number; len: number; range: number; spanStart: number } | null = null;

  if (bounds && width > 0 && height > 0) {
    const spanX = bounds.right - bounds.left;
    if (hTrack > 0 && spanX > viewW) {
      const len = Math.max(MIN_THUMB, clamp(viewW / spanX, 0.06, 1) * hTrack);
      const range = spanX - viewW;
      const t = clamp((viewLeft - bounds.left) / range, 0, 1);
      hThumb = { left: t * (hTrack - len), len, range, spanStart: bounds.left };
    }
    const spanY = bounds.bottom - bounds.top;
    if (vTrack > 0 && spanY > viewH) {
      const len = Math.max(MIN_THUMB, clamp(viewH / spanY, 0.06, 1) * vTrack);
      const range = spanY - viewH;
      const t = clamp((viewTop - bounds.top) / range, 0, 1);
      vThumb = { top: t * (vTrack - len), len, range, spanStart: bounds.top };
    }
  }

  // 拖动滑块平移视口
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const delta = (d.axis === 'x' ? e.clientX : e.clientY) - d.start;
      const t = clamp(d.startT + delta / d.trackPx, 0, 1);
      if (d.axis === 'x') {
        const left = d.spanStart + t * d.range;
        setViewport({ x: -left * d.zoom, y: d.fixedY, zoom: d.zoom });
      } else {
        const top = d.spanStart + t * d.range;
        setViewport({ x: d.fixedX, y: -top * d.zoom, zoom: d.zoom });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [setViewport]);

  const startThumbDrag = useCallback(
    (
      axis: 'x' | 'y',
      thumb: { left?: number; top?: number; len: number; range: number; spanStart: number },
      trackPx: number,
    ) =>
      (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (trackPx <= 0) return;
        dragRef.current = {
          axis,
          start: axis === 'x' ? e.clientX : e.clientY,
          startT: (axis === 'x' ? (thumb.left ?? 0) : (thumb.top ?? 0)) / trackPx,
          trackPx,
          spanStart: thumb.spanStart,
          range: thumb.range,
          zoom,
          fixedX: x,
          fixedY: y,
        };
        document.body.style.userSelect = 'none';
      },
    [x, y, zoom],
  );

  const pageTo = useCallback(
    (axis: 'x' | 'y', thumbLen: number, range: number, spanStart: number) =>
      (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const trackLen = axis === 'x' ? rect.width : rect.height;
        const usable = trackLen - thumbLen;
        if (usable <= 0) return;
        const pos = (axis === 'x' ? e.clientX - rect.left : e.clientY - rect.top) - thumbLen / 2;
        const t = clamp(pos / usable, 0, 1);
        if (axis === 'x') setViewport({ x: -(spanStart + t * range) * zoom, y, zoom });
        else setViewport({ x, y: -(spanStart + t * range) * zoom, zoom });
      },
    [x, y, zoom, setViewport],
  );

  if (!hThumb && !vThumb) return null;

  const thumbCls =
    'pointer-events-auto absolute rounded-full bg-gray-400/70 transition-colors hover:bg-gray-500 dark:bg-gray-500/70 dark:hover:bg-gray-400';
  const trackCls = 'pointer-events-auto absolute rounded-full bg-gray-900/5 dark:bg-white/5';

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {hThumb ? (
        <div
          data-testid="canvas-scrollbar-x"
          className={trackCls}
          style={{ left: CONTROLS_RESERVE_X, bottom: 2, height: THICKNESS, width: hTrack }}
          onPointerDown={pageTo('x', hThumb.len, hThumb.range, hThumb.spanStart)}
        >
          <div
            className={thumbCls}
            style={{
              left: hThumb.left,
              top: 0,
              height: THICKNESS,
              width: hThumb.len,
              cursor: 'grab',
            }}
            onPointerDown={startThumbDrag('x', hThumb, hTrack - hThumb.len)}
          />
        </div>
      ) : null}

      {vThumb ? (
        <div
          data-testid="canvas-scrollbar-y"
          className={trackCls}
          style={{ right: 2, top: 2, width: THICKNESS, height: vTrack }}
          onPointerDown={pageTo('y', vThumb.len, vThumb.range, vThumb.spanStart)}
        >
          <div
            className={thumbCls}
            style={{
              top: vThumb.top,
              left: 0,
              width: THICKNESS,
              height: vThumb.len,
              cursor: 'grab',
            }}
            onPointerDown={startThumbDrag('y', vThumb, vTrack - vThumb.len)}
          />
        </div>
      ) : null}
    </div>
  );
}
