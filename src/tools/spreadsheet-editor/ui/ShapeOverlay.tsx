import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  anchorToPx,
  contentVisibleBox,
  pxToAnchor,
  screenDeltaToContent,
  shapeLayerClip,
  shapePath,
  shapeScreenRect,
  viewportZoom,
  SHEET_SHAPE_PRESETS,
  type SheetLayout,
  type SheetShapeConfig,
  type SheetViewport,
} from '../shapes';

/**
 * Floating shapes on a sheet (P4-SH1).
 *
 * The model persists a **cell anchor**; everything here works in pixels derived from the sheet's real
 * column widths / row heights, so a shape stays glued to its cell when the user resizes a column and
 * the export (which writes the same anchor) never disagrees with what was on screen.
 *
 * Gestures follow the chart overlay: window listeners instead of pointer capture (capture drops
 * events in automation and some browsers), and every move is computed from "geometry at gesture
 * start + accumulated delta" so per-frame reads cannot compound.
 */

const MIN_SIZE = 24;
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = (typeof HANDLES)[number];

interface DragOrigin {
  x: number;
  y: number;
  shape: SheetShapeConfig;
  left: number;
  top: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

const HANDLE_STYLE: Record<Handle, string> = {
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
  n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
  ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
  e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
  se: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
  s: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
  sw: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
};

export interface ShapeLayerProps {
  shapes: SheetShapeConfig[];
  layout: SheetLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<SheetShapeConfig>) => void;
  onRemove: (id: string) => void;
  onBringFront: (id: string) => void;
  onSendBack: (id: string) => void;
  /** Size of the container the overlay covers (CSS px); drags clamp inside it */
  bounds: { width: number; height: number };
  /** Grid → container projection: origin / scroll / zoom of the active sheet */
  viewport: SheetViewport;
}

/** All shapes of the active sheet, positioned in overlay coordinates */
export function ShapeLayer({
  shapes,
  layout,
  selectedId,
  onSelect,
  onChange,
  onRemove,
  onBringFront,
  onSendBack,
  bounds,
  viewport,
}: ShapeLayerProps) {
  const { t } = useTranslation();

  if (shapes.length === 0) return null;

  return (
    // pointer-events-none: the layer must not swallow clicks meant for the grid
    <div
      data-testid="sheet-shape-layer"
      className="pointer-events-none absolute inset-0 z-40"
      // Scrolled shapes scroll *out* of the grid, not over the ribbon / formula bar
      style={{ clipPath: shapeLayerClip(viewport, bounds) ?? undefined }}
    >
      {shapes.map((shape) => {
        const box = shapeScreenRect(shape, layout, viewport);
        // Outside the visible area: skip rendering instead of drawing at a clipped coordinate
        if (box.left > bounds.width || box.top > bounds.height) return null;
        if (box.left + box.width < 0 || box.top + box.height < 0) return null;
        return (
          <ShapeNode
            key={shape.id}
            shape={shape}
            layout={layout}
            left={box.left}
            top={box.top}
            width={box.width}
            height={box.height}
            selected={shape.id === selectedId}
            bounds={bounds}
            viewport={viewport}
            onSelect={() => onSelect(shape.id)}
            onChange={(patch) => onChange(shape.id, patch)}
            onRemove={() => onRemove(shape.id)}
            onBringFront={() => onBringFront(shape.id)}
            onSendBack={() => onSendBack(shape.id)}
            label={t('tools.sheet.shapeDragHint')}
            textLabel={t('tools.sheet.shapeText')}
          />
        );
      })}
    </div>
  );
}

interface ShapeNodeProps {
  shape: SheetShapeConfig;
  layout: SheetLayout;
  left: number;
  top: number;
  width: number;
  height: number;
  selected: boolean;
  bounds: { width: number; height: number };
  viewport: SheetViewport;
  onSelect: () => void;
  onChange: (patch: Partial<SheetShapeConfig>) => void;
  onRemove: () => void;
  onBringFront: () => void;
  onSendBack: () => void;
  label: string;
  textLabel: string;
}

function ShapeNode({
  shape,
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
  label,
  textLabel,
}: ShapeNodeProps) {
  const { t } = useTranslation();
  const latest = useRef({ shape, layout, viewport, bounds, onChange });
  latest.current = { shape, layout, viewport, bounds, onChange };
  const zoom = viewportZoom(viewport);

  /** Window-level drag loop: geometry is fixed at gesture start, the delta is accumulated */
  const beginGesture = (
    event: React.PointerEvent<HTMLElement>,
    compute: (
      total: { x: number; y: number },
      origin: DragOrigin,
    ) => Partial<SheetShapeConfig> | null,
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    const current = latest.current;
    const rect = anchorToPx(current.shape.from, current.layout);
    const origin: DragOrigin = {
      x: event.clientX,
      y: event.clientY,
      shape: current.shape,
      left: rect.x,
      top: rect.y,
    };
    const onMove = (move: PointerEvent) => {
      const total = { x: move.clientX - origin.x, y: move.clientY - origin.y };
      const patch = compute(total, origin);
      if (patch) latest.current.onChange(patch);
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

  const moveTo = (
    targetLeft: number,
    targetTop: number,
    origin: DragOrigin,
  ): Partial<SheetShapeConfig> => {
    const current = latest.current;
    // Clamp inside the *visible* content area so the shape can never be dragged out of reach
    const visible = contentVisibleBox(current.viewport, current.bounds);
    const minX = Math.max(0, visible.minX);
    const minY = Math.max(0, visible.minY);
    const maxX = Math.max(minX, visible.maxX - origin.shape.width);
    const maxY = Math.max(minY, visible.maxY - origin.shape.height);
    const x = clamp(targetLeft, minX, maxX);
    const y = clamp(targetTop, minY, maxY);
    return { from: pxToAnchor(Math.round(x), Math.round(y), current.layout) };
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    if ((event.target as HTMLElement).closest('button, input')) return;
    // Pointer deltas are screen px; the anchor lives in content px, so both are divided by zoom
    beginGesture(event, (total, origin) => {
      const delta = screenDeltaToContent(total.x, total.y, latest.current.viewport);
      return moveTo(origin.left + delta.x, origin.top + delta.y, origin);
    });
  };

  const startResize =
    (handle: Handle) =>
    (event: React.PointerEvent<HTMLDivElement>): void => {
      beginGesture(event, (total, origin) => {
        const start = origin.shape;
        const delta = screenDeltaToContent(total.x, total.y, latest.current.viewport);
        const west = handle.includes('w');
        const east = handle.includes('e');
        const north = handle.includes('n');
        const south = handle.includes('s');

        const width = east
          ? Math.max(MIN_SIZE, Math.round(start.width + delta.x))
          : west
            ? Math.max(MIN_SIZE, Math.round(start.width - delta.x))
            : start.width;
        const height = south
          ? Math.max(MIN_SIZE, Math.round(start.height + delta.y))
          : north
            ? Math.max(MIN_SIZE, Math.round(start.height - delta.y))
            : start.height;

        // Dragging a west/north handle moves the top-left corner: re-anchor from the new content origin
        const nextLeft = west ? origin.left + (start.width - width) : origin.left;
        const nextTop = north ? origin.top + (start.height - height) : origin.top;
        const from =
          west || north
            ? pxToAnchor(
                Math.max(0, Math.round(nextLeft)),
                Math.max(0, Math.round(nextTop)),
                latest.current.layout,
              )
            : start.from;
        return { width, height, from };
      });
    };

  const startRotate = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    const current = latest.current;
    // `event.currentTarget` is nulled once the handler returns, so it has to be captured now
    const host = (event.currentTarget as HTMLElement).closest(
      '[data-shape-id]',
    ) as HTMLElement | null;
    const rect = anchorToPx(current.shape.from, current.layout);
    const zoomNow = viewportZoom(current.viewport);
    const centerX =
      current.viewport.originX +
      (rect.x + current.shape.width / 2 - current.viewport.scrollX) * zoomNow;
    const centerY =
      current.viewport.originY +
      (rect.y + current.shape.height / 2 - current.viewport.scrollY) * zoomNow;
    const onMove = (move: PointerEvent): void => {
      const box = host?.getBoundingClientRect();
      const cx = box ? box.left + box.width / 2 : centerX;
      const cy = box ? box.top + box.height / 2 : centerY;
      let angle = (Math.atan2(move.clientY - cy, move.clientX - cx) * 180) / Math.PI + 90;
      if (move.shiftKey) angle = Math.round(angle / 15) * 15;
      const normalized = Math.round(((angle % 360) + 360) % 360);
      latest.current.onChange({ rotation: normalized });
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

  const path = shapePath(shape);
  const rotation = shape.rotation ?? 0;

  return (
    <div
      data-shape-id={shape.id}
      data-testid="sheet-shape"
      role="button"
      tabIndex={0}
      aria-label={t('tools.sheet.insertShape')}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      className={`pointer-events-auto absolute ${selected ? 'outline outline-2 outline-blue-500' : ''}`}
      style={{
        left,
        top,
        width,
        height,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
      }}
    >
      <div
        onPointerDown={startDrag}
        title={label}
        className="h-full w-full cursor-move"
        style={{ padding: 1 }}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${shape.width} ${shape.height}`}
          className="block h-full w-full"
          aria-hidden="true"
        >
          <path
            d={path}
            fill={shape.fill || 'none'}
            stroke={shape.strokeWidth > 0 ? shape.stroke || 'none' : 'none'}
            strokeWidth={shape.strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {shape.text ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-2 text-center"
          style={{ fontSize: 14 * zoom, color: '#ffffff', lineHeight: 1.25 }}
        >
          <span className="line-clamp-3">{shape.text}</span>
        </div>
      ) : null}

      {selected ? (
        <>
          {HANDLES.map((handle) => (
            <div
              key={handle}
              data-shape-handle={handle}
              onPointerDown={startResize(handle)}
              className={`absolute h-2.5 w-2.5 rounded-sm border border-blue-600 bg-white ${HANDLE_STYLE[handle]}`}
            />
          ))}
          <div
            data-shape-handle="rotate"
            onPointerDown={startRotate}
            title={t('tools.sheet.shapeRotate')}
            className="absolute -top-7 left-1/2 h-5 w-5 -translate-x-1/2 cursor-grab rounded-full border border-blue-600 bg-white text-center text-[10px] leading-5 text-blue-600"
          >
            ↻
          </div>
          {/* Floating inspector: kept inside the shape's own box so it follows rotation */}
          <div
            className="absolute -bottom-9 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-md border border-gray-300 bg-white px-1 py-0.5 shadow dark:border-gray-600 dark:bg-gray-900"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <input
              type="text"
              aria-label={textLabel}
              value={shape.text ?? ''}
              onChange={(event) => onChange({ text: event.target.value })}
              className="h-6 w-24 rounded border border-gray-300 px-1 text-xs dark:border-gray-600 dark:bg-gray-800"
            />
            <input
              type="color"
              aria-label={t('tools.sheet.shapeFill')}
              value={shape.fill || '#4472c4'}
              onChange={(event) => onChange({ fill: event.target.value })}
              className="h-6 w-6 rounded border border-gray-300 bg-transparent dark:border-gray-600"
            />
            <input
              type="color"
              aria-label={t('tools.sheet.shapeStroke')}
              value={shape.stroke || '#2f5597'}
              onChange={(event) => onChange({ stroke: event.target.value })}
              className="h-6 w-6 rounded border border-gray-300 bg-transparent dark:border-gray-600"
            />
            <button
              type="button"
              aria-label={t('tools.sheet.shapeBringFront')}
              onClick={onBringFront}
              className="h-6 w-6 rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              ⤒
            </button>
            <button
              type="button"
              aria-label={t('tools.sheet.shapeSendBack')}
              onClick={onSendBack}
              className="h-6 w-6 rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              ⤓
            </button>
            <button
              type="button"
              aria-label={t('tools.sheet.shapeRemove')}
              onClick={onRemove}
              className="h-6 w-6 rounded text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              ✕
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Insert palette: 23 presets in four groups, rendered as SVG previews */
export function ShapePalette({
  onPick,
  onClose,
}: {
  onPick: (prst: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="sheet-shape-palette"
      className="absolute right-3 top-3 z-50 w-[264px] rounded-lg border border-gray-300 bg-white p-2 shadow-xl dark:border-gray-600 dark:bg-gray-900"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {t('tools.sheet.insertShape')}
        </span>
        <button
          type="button"
          aria-label={t('tools.sheet.shapeClose')}
          onClick={onClose}
          className="h-5 w-5 rounded text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          ✕
        </button>
      </div>
      <div className="space-y-1">
        {SHEET_SHAPE_PRESETS.map((group, index) => (
          <div key={index} className="flex flex-wrap gap-1">
            {group.map((preset) => (
              <button
                key={preset.prst}
                type="button"
                data-shape-preset={preset.prst}
                title={t(`tools.sheet.${preset.labelKey}`)}
                aria-label={t(`tools.sheet.${preset.labelKey}`)}
                onClick={() => onPick(preset.prst)}
                className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 hover:border-blue-500 hover:bg-blue-50 dark:border-gray-700 dark:hover:bg-blue-950"
              >
                <svg width={20} height={16} viewBox="0 0 20 16" aria-hidden="true">
                  <path
                    d={shapePath({ prst: preset.prst, width: 20, height: 16 })}
                    fill="#4472c4"
                    stroke="#2f5597"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
