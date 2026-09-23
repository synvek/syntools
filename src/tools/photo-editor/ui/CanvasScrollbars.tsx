import { useMemo, useRef } from 'react';
import { scrollMetrics } from '../core';
import { usePhotoStore } from '../store';

/**
 * 画布滚动条（与流程图编辑器同一套交互与公式）：
 * - 轨道长度 = 视口尺寸，滑块长度 = 视口 / 世界（最小 28px）；
 * - 拖滑块 / 点轨道都会换算成「视口左上角在世界中的位置」，再写回 store；
 * - 内容未超出视口时整体隐藏（`range <= 0.5`）。
 */

const THICKNESS = 6;
const MIN_THUMB = 28;
/** 滑块可停留的额外留白，避免滑块端点贴住轨道端点 */
const EDGE_GAP = 4;

interface DragState {
  axis: 'x' | 'y';
  start: number;
  startT: number;
  trackPx: number;
  worldLeft: number;
  worldTop: number;
  range: number;
  /** 另一轴的视口位置保持不变 */
  fixedLeft: number;
  fixedTop: number;
}

export function CanvasScrollbars({
  width,
  height,
  onScrollTo,
}: {
  width: number;
  height: number;
  onScrollTo: (left: number, top: number) => void;
}) {
  const doc = usePhotoStore((s) => s.doc);
  const viewport = usePhotoStore((s) => s.viewport);
  const drag = useRef<DragState | null>(null);

  const metrics = useMemo(
    () =>
      scrollMetrics(doc, {
        width,
        height,
        scale: viewport.scale > 0 ? viewport.scale : 1,
        x: viewport.x,
        y: viewport.y,
      }),
    [doc, viewport, width, height],
  );

  // 只有「内容装不下」时才显示滚动条：整幅画布都看得见时不打扰视觉，
  // 但越界余量依然允许抓手/滚轮小幅平移。
  const horizontal = metrics.rangeX > 0.5 && doc.width > metrics.viewW + 0.5;
  const vertical = metrics.rangeY > 0.5 && doc.height > metrics.viewH + 0.5;

  const hTrack = Math.max(0, width - EDGE_GAP * 2);
  const vTrack = Math.max(0, height - EDGE_GAP * 2);

  const hThumb = horizontal
    ? Math.max(MIN_THUMB, Math.min(1, metrics.viewW / metrics.worldW) * hTrack)
    : 0;
  const vThumb = vertical
    ? Math.max(MIN_THUMB, Math.min(1, metrics.viewH / metrics.worldH) * vTrack)
    : 0;

  const hT = metrics.rangeX > 0 ? (metrics.left - metrics.worldLeft) / metrics.rangeX : 0;
  const vT = metrics.rangeY > 0 ? (metrics.top - metrics.worldTop) / metrics.rangeY : 0;

  const hLeft = Math.max(0, Math.min(1, hT)) * Math.max(0, hTrack - hThumb);
  const vTop = Math.max(0, Math.min(1, vT)) * Math.max(0, vTrack - vThumb);

  const startDrag = (axis: 'x' | 'y', event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const trackPx = Math.max(1, axis === 'x' ? hTrack - hThumb : vTrack - vThumb);
    drag.current = {
      axis,
      start: axis === 'x' ? event.clientX : event.clientY,
      startT: axis === 'x' ? hLeft / trackPx : vTop / trackPx,
      trackPx,
      worldLeft: metrics.worldLeft,
      worldTop: metrics.worldTop,
      range: axis === 'x' ? metrics.rangeX : metrics.rangeY,
      fixedLeft: metrics.left,
      fixedTop: metrics.top,
    };

    const onMove = (moveEvent: PointerEvent) => {
      const current = drag.current;
      if (!current) return;
      const delta = (current.axis === 'x' ? moveEvent.clientX : moveEvent.clientY) - current.start;
      const t = Math.max(0, Math.min(1, current.startT + delta / current.trackPx));
      if (current.axis === 'x') {
        onScrollTo(current.worldLeft + t * current.range, current.fixedTop);
      } else {
        onScrollTo(current.fixedLeft, current.worldTop + t * current.range);
      }
    };
    const onUp = () => {
      drag.current = null;
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  /** 点击轨道：把滑块中心移到点击处 */
  const pageTo = (axis: 'x' | 'y', event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const thumbLen = axis === 'x' ? hThumb : vThumb;
    const trackLen = axis === 'x' ? rect.width : rect.height;
    const usable = Math.max(1, trackLen - thumbLen);
    const pos =
      (axis === 'x' ? event.clientX - rect.left : event.clientY - rect.top) - thumbLen / 2;
    const t = Math.max(0, Math.min(1, pos / usable));
    if (axis === 'x') {
      onScrollTo(metrics.worldLeft + t * metrics.rangeX, metrics.top);
    } else {
      onScrollTo(metrics.left, metrics.worldTop + t * metrics.rangeY);
    }
  };

  if (!horizontal && !vertical) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {horizontal ? (
        <div
          data-testid="canvas-scrollbar-x"
          onMouseDown={(event) => pageTo('x', event)}
          className="pointer-events-auto absolute cursor-pointer rounded-full bg-gray-900/10 transition-colors hover:bg-gray-900/20 dark:bg-white/10 dark:hover:bg-white/20"
          style={{ left: EDGE_GAP, right: EDGE_GAP, bottom: 2, height: THICKNESS }}
        >
          <div
            onPointerDown={(event) => startDrag('x', event)}
            className="absolute cursor-grab rounded-full bg-gray-500/70 transition-colors hover:bg-blue-500 active:cursor-grabbing dark:bg-gray-300/60 dark:hover:bg-blue-400"
            style={{ left: hLeft, top: 0, height: THICKNESS, width: hThumb }}
          />
        </div>
      ) : null}

      {vertical ? (
        <div
          data-testid="canvas-scrollbar-y"
          onMouseDown={(event) => pageTo('y', event)}
          className="pointer-events-auto absolute cursor-pointer rounded-full bg-gray-900/10 transition-colors hover:bg-gray-900/20 dark:bg-white/10 dark:hover:bg-white/20"
          style={{ top: EDGE_GAP, bottom: EDGE_GAP, right: 2, width: THICKNESS }}
        >
          <div
            onPointerDown={(event) => startDrag('y', event)}
            className="absolute cursor-grab rounded-full bg-gray-500/70 transition-colors hover:bg-blue-500 active:cursor-grabbing dark:bg-gray-300/60 dark:hover:bg-blue-400"
            style={{ top: vTop, left: 0, width: THICKNESS, height: vThumb }}
          />
        </div>
      ) : null}
    </div>
  );
}
