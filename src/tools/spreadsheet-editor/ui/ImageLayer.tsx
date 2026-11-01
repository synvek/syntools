import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { SheetImageConfig } from '../sheetImages';
import {
  BOX_HANDLES,
  anchorToPx,
  dragBoxAnchor,
  resizeBoxPatch,
  screenDeltaToContent,
  shapeLayerClip,
  shapeScreenRect,
  viewportZoom,
  type BoxHandle,
  type SheetLayout,
  type SheetViewport,
} from '../shapes';

/**
 * Floating pictures on a sheet (SHEET-02 剩余).
 *
 * 与形状同一套交互契约：几何来自单元格锚点（`anchorToPx` / `pxToAnchor`），拖动与缩放都走
 * `shapes.ts` 里的纯函数，因此图片和形状不会各算一套、也不会在列宽变化后漂移。
 * 渲染差别只是 `<img>` 替掉 SVG path，另外没有旋转与文本编辑。
 *
 * 层级：图片层压在形状层下面（导出时也先写 pic 后写 sp），所以点得到形状、图片不会盖住它。
 */

const MIN_SIZE = 24;

const HANDLE_STYLE: Record<BoxHandle, string> = {
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
  n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
  ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
  e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
  se: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
  s: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
  sw: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
};

export interface ImageLayerProps {
  images: SheetImageConfig[];
  layout: SheetLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<SheetImageConfig>) => void;
  onRemove: (id: string) => void;
  onBringFront: (id: string) => void;
  onSendBack: (id: string) => void;
  /** Size of the container the overlay covers (CSS px); drags clamp inside it */
  bounds: { width: number; height: number };
  /** Grid → container projection: origin / scroll / zoom of the active sheet */
  viewport: SheetViewport;
}

export function ImageLayer({
  images,
  layout,
  selectedId,
  onSelect,
  onChange,
  onRemove,
  onBringFront,
  onSendBack,
  bounds,
  viewport,
}: ImageLayerProps) {
  if (images.length === 0) return null;

  return (
    <div
      data-testid="sheet-image-layer"
      className="pointer-events-none absolute inset-0 z-30"
      style={{ clipPath: shapeLayerClip(viewport, bounds) ?? undefined }}
    >
      {images.map((image) => {
        const box = shapeScreenRect(image, layout, viewport);
        if (box.left > bounds.width || box.top > bounds.height) return null;
        if (box.left + box.width < 0 || box.top + box.height < 0) return null;
        return (
          <ImageNode
            key={image.id}
            image={image}
            layout={layout}
            left={box.left}
            top={box.top}
            width={box.width}
            height={box.height}
            selected={image.id === selectedId}
            bounds={bounds}
            viewport={viewport}
            onSelect={() => onSelect(image.id)}
            onChange={(patch) => onChange(image.id, patch)}
            onRemove={() => onRemove(image.id)}
            onBringFront={() => onBringFront(image.id)}
            onSendBack={() => onSendBack(image.id)}
          />
        );
      })}
    </div>
  );
}

interface ImageNodeProps {
  image: SheetImageConfig;
  layout: SheetLayout;
  left: number;
  top: number;
  width: number;
  height: number;
  selected: boolean;
  bounds: { width: number; height: number };
  viewport: SheetViewport;
  onSelect: () => void;
  onChange: (patch: Partial<SheetImageConfig>) => void;
  onRemove: () => void;
  onBringFront: () => void;
  onSendBack: () => void;
}

function ImageNode({
  image,
  layout,
  left,
  top,
  width,
  height,
  selected,
  bounds,
  viewport,
  onSelect,
  onChange,
  onRemove,
  onBringFront,
  onSendBack,
}: ImageNodeProps) {
  const { t } = useTranslation();
  const latest = useRef({ image, layout, viewport, bounds, onChange });
  latest.current = { image, layout, viewport, bounds, onChange };
  const zoom = viewportZoom(viewport);

  /**
   * 与形状同样的手势循环：几何在按下时固定，位移累计——每帧不重复读取元素尺寸，
   * 自动化环境里也不会因为 pointer capture 丢事件。
   */
  const beginGesture = (
    event: React.PointerEvent<HTMLElement>,
    compute: (
      total: { x: number; y: number },
      origin: { left: number; top: number },
    ) => Partial<SheetImageConfig>,
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    const current = latest.current;
    const rect = anchorToPx(current.image.from, current.layout);
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { left: rect.x, top: rect.y };
    const onMove = (move: PointerEvent): void => {
      const total = { x: move.clientX - startX, y: move.clientY - startY };
      latest.current.onChange(compute(total, origin));
    };
    const onEnd = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    if ((event.target as HTMLElement).closest('button')) return;
    beginGesture(event, (total, origin) => {
      const current = latest.current;
      const delta = screenDeltaToContent(total.x, total.y, current.viewport);
      const from = dragBoxAnchor(
        current.image,
        origin.left + delta.x,
        origin.top + delta.y,
        current.layout,
        current.viewport,
        current.bounds,
      );
      return { from };
    });
  };

  const startResize =
    (handle: BoxHandle) =>
    (event: React.PointerEvent<HTMLDivElement>): void => {
      beginGesture(event, (total, origin) => {
        const current = latest.current;
        const delta = screenDeltaToContent(total.x, total.y, current.viewport);
        return resizeBoxPatch(
          current.image,
          handle,
          origin.left,
          origin.top,
          delta,
          current.layout,
          MIN_SIZE,
        );
      });
    };

  return (
    <div
      data-image-id={image.id}
      data-testid="sheet-image"
      role="button"
      tabIndex={0}
      aria-label={image.name}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerDownCapture={(event) => event.stopPropagation()}
      className={`pointer-events-auto absolute select-none ${
        selected ? 'outline outline-2 outline-blue-500' : ''
      }`}
      style={{ left, top, width, height }}
    >
      <img
        src={image.src}
        alt={image.name}
        draggable={false}
        onPointerDown={startDrag}
        className="h-full w-full object-fill"
      />
      {selected ? (
        <>
          {BOX_HANDLES.map((handle) => (
            <div
              key={handle}
              data-handle={handle}
              onPointerDown={startResize(handle)}
              className={`absolute h-2 w-2 rounded-sm border border-white bg-blue-500 ${HANDLE_STYLE[handle]}`}
              style={{ transform: `scale(${1 / zoom})` }}
            />
          ))}
          <div className="absolute -top-7 right-0 flex gap-1">
            <button
              type="button"
              title={t('tools.sheet.imageBringFront')}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onBringFront}
              className="rounded bg-white/90 px-1 text-[11px] leading-5 text-gray-700 shadow"
            >
              ↑
            </button>
            <button
              type="button"
              title={t('tools.sheet.imageSendBack')}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onSendBack}
              className="rounded bg-white/90 px-1 text-[11px] leading-5 text-gray-700 shadow"
            >
              ↓
            </button>
            <button
              type="button"
              title={t('tools.sheet.imageRemove')}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onRemove}
              className="rounded bg-white/90 px-1 text-[11px] leading-5 text-red-600 shadow"
            >
              ×
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
