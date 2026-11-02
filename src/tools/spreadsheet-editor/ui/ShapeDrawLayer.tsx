import { useEffect, useState, type RefObject } from 'react';
import {
  pxToAnchor,
  screenDeltaToContent,
  screenPointToContent,
  type SheetLayout,
  type SheetShapeConfig,
  type SheetViewport,
} from '../shapes';

interface ShapeDrawLayerProps {
  /** 正在绘制的预设；null = 未进入绘制模式 */
  prst: string | null;
  layout: SheetLayout;
  viewport: SheetViewport;
  surfaceRef: RefObject<HTMLDivElement | null>;
  /** 松开鼠标：把锚点与尺寸（内容像素）交给上层建形状 */
  onCreate: (from: SheetShapeConfig['from'], width: number, height: number) => void;
  onCancel: () => void;
  hint: string;
}

const MIN_SIZE = 24;
const CLICK_SLOP = 4;

/**
 * 表格的拖拽绘制层（对应 Excel「插入 → 形状 → 在工作表上拖拽」）。
 *
 * 形状锚点是单元格 + 偏移，所以绘制结果必须换算成**内容坐标**再取锚点；
 * 直接把屏幕坐标当尺寸写进模型的话，滚动一下或换个缩放比，形状就跑到别处去了。
 */
export function ShapeDrawLayer({
  prst,
  layout,
  viewport,
  surfaceRef,
  onCreate,
  onCancel,
  hint,
}: ShapeDrawLayerProps) {
  const [preview, setPreview] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!prst || !surface) return;

    const previousCursor = surface.style.cursor;
    surface.style.cursor = 'crosshair';
    let startX = 0;
    let startY = 0;
    let dragging = false;

    const cleanup = () => {
      dragging = false;
      setPreview(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKeyDown);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cleanup();
      onCancel();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      dragging = true;
      const box = surface.getBoundingClientRect();
      startX = event.clientX - box.left;
      startY = event.clientY - box.top;
      setPreview({ left: startX, top: startY, width: 0, height: 0 });
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      const box = surface.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      setPreview({
        left: Math.min(startX, x),
        top: Math.min(startY, y),
        width: Math.abs(x - startX),
        height: Math.abs(y - startY),
      });
    };

    const onUp = (event: PointerEvent) => {
      if (!dragging) return;
      const box = surface.getBoundingClientRect();
      const delta = screenDeltaToContent(
        event.clientX - box.left - startX,
        event.clientY - box.top - startY,
        viewport,
      );
      const click = Math.abs(delta.x) < CLICK_SLOP && Math.abs(delta.y) < CLICK_SLOP;
      const start = screenPointToContent(startX, startY, viewport);

      cleanup();
      // delta 已经是内容像素（屏幕位移 / zoom），不要再乘一次 zoom
      onCreate(
        pxToAnchor(Math.max(0, Math.round(start.x)), Math.max(0, Math.round(start.y)), layout),
        click ? 180 : Math.max(MIN_SIZE, Math.round(Math.abs(delta.x))),
        click ? 100 : Math.max(MIN_SIZE, Math.round(Math.abs(delta.y))),
      );
    };

    surface.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      surface.style.cursor = previousCursor;
      surface.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [prst, layout, viewport, surfaceRef, onCreate, onCancel]);

  if (!prst) return null;

  return (
    <>
      {preview ? (
        <div
          data-testid="sheet-shape-draw-preview"
          className="pointer-events-none absolute z-50 border-2 border-dashed border-blue-500 bg-blue-500/10"
          style={{
            left: `${preview.left}px`,
            top: `${preview.top}px`,
            width: `${preview.width}px`,
            height: `${preview.height}px`,
          }}
        />
      ) : (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900/90 px-3 py-1 text-[11px] text-white shadow-lg">
          {hint}
        </div>
      )}
    </>
  );
}
