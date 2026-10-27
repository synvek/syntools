import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';

/**
 * Full-screen "present" layer shared by document editors (first built for slides, extracted here).
 *
 * Conventions:
 * - Dark full-screen backdrop with centered content; content sets its own background (white A4, white sheet);
 * - `Esc` exits, and a close button sits in the top-right corner;
 * - Content may be produced asynchronously (screenshots / compositing); `loading` and `failed` cover those states;
 * - The bottom `footer` holds tool-specific actions (paging, switching sheets);
 * - Zoom: top-right "out / percentage / in / fit", plus `+` `-` `0` shortcuts
 *   and Ctrl / ⌘ + wheel; `zoom = 1` means "fit", with content filling the viewport by default.
 *   Zoom is anchored: the wheel uses the cursor, buttons / shortcuts use the viewport center
 *   (the viewport top for top-aligned content); scroll offset is compensated so the anchor stays put.
 *   Zoom-in uses two layers: a layout box that creates the scroll area, plus scaled content,
 *   so fixed-size content such as text or tables really grows instead of exposing blank space.
 */

export interface PresentOverlayProps {
  /** Top-left title (usually the document name) */
  title: string;
  onClose: () => void;
  /** Close button label (includes the Esc hint) */
  exitLabel: string;
  /** Message shown while content is generated */
  loadingLabel?: string;
  /** Message shown when generation fails */
  failedLabel?: string;
  /** Extra failure note (e.g. suggest a smaller canvas) */
  failedHint?: string;
  loading?: boolean;
  failed?: boolean;
  /** Content alignment: top reads like a page for documents, center like a projection for graphics; center by default */
  align?: 'center' | 'top';
  /** Bottom action area */
  footer?: ReactNode;
  children?: ReactNode;
}

/** Zoom range (1 = fit) */
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 6;
/** Step ratio for buttons / shortcuts */
const ZOOM_STEP = 1.25;
/** Ctrl / ⌘ + wheel step: finer so one notch does not overshoot */
const ZOOM_WHEEL_STEP = 1.02;

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

/** Anchor recorded before zooming: pins the same content point to its old screen position */
interface ZoomAnchor {
  /** Anchor position inside the stage, fractional (may fall outside the content, so no 0–1 clamp) */
  fx: number;
  fy: number;
  /** Anchor screen coordinates (viewport space) */
  clientX: number;
  clientY: number;
}

export function PresentOverlay({
  title,
  onClose,
  exitLabel,
  loadingLabel,
  failedLabel,
  failedHint,
  loading = false,
  failed = false,
  align = 'center',
  footer,
  children,
}: PresentOverlayProps) {
  const { t } = useTranslation();
  /** Zoom relative to "fit"; 1 means the content exactly fills the viewport */
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pendingAnchorRef = useRef<ZoomAnchor | null>(null);

  /**
   * Apply a new zoom. The default anchor follows content alignment: top-aligned content anchors
   * to the viewport top, centered content to the viewport center; the wheel passes cursor coordinates.
   * The content under the anchor then stays in place instead of drifting with the page.
   */
  const applyZoom = useCallback(
    (next: number, anchor?: { clientX: number; clientY: number }) => {
      const value = clampZoom(next);
      if (value === zoomRef.current) return;

      const stage = stageRef.current;
      const host = scrollRef.current;
      if (stage && host) {
        const rect = stage.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const hostRect = host.getBoundingClientRect();
          const clientX = anchor?.clientX ?? hostRect.left + hostRect.width / 2;
          const clientY =
            anchor?.clientY ??
            (align === 'top' ? hostRect.top : hostRect.top + hostRect.height / 2);
          pendingAnchorRef.current = {
            fx: (clientX - rect.left) / rect.width,
            fy: (clientY - rect.top) / rect.height,
            clientX,
            clientY,
          };
        }
      }

      zoomRef.current = value;
      setZoom(value);
    },
    [align],
  );

  const zoomIn = useCallback(() => applyZoom(zoomRef.current * ZOOM_STEP), [applyZoom]);
  const zoomOut = useCallback(() => applyZoom(zoomRef.current / ZOOM_STEP), [applyZoom]);
  const fitToWindow = useCallback(() => {
    pendingAnchorRef.current = null;
    zoomRef.current = 1;
    setZoom(1);
  }, []);

  // After zoom lands (DOM updated, before paint) compensate scroll so the anchor returns to its position.
  // useLayoutEffect runs before paint, avoiding a visible jump-then-settle flicker.
  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    pendingAnchorRef.current = null;
    const stage = stageRef.current;
    const host = scrollRef.current;
    if (!anchor || !stage || !host) return;
    const rect = stage.getBoundingClientRect();
    const dx = rect.left + anchor.fx * rect.width - anchor.clientX;
    const dy = rect.top + anchor.fy * rect.height - anchor.clientY;
    if (dx === 0 && dy === 0) return;
    host.scrollLeft += dx;
    host.scrollTop += dy;
  }, [zoom]);

  // Ctrl / ⌘ + wheel zoom: the browser zooms the page by default, and React's onWheel is passive
  // (so preventDefault fails), hence a manually bound non-passive native listener.
  useEffect(() => {
    const host = scrollRef.current;
    if (!host) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const step = event.deltaY < 0 ? ZOOM_WHEEL_STEP : 1 / ZOOM_WHEEL_STEP;
      applyZoom(zoomRef.current * step, { clientX: event.clientX, clientY: event.clientY });
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      // Zoom shortcuts: `+` / `=` in, `-` / `_` out, `0` fit
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomIn();
        return;
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        zoomOut();
        return;
      }
      if (event.key === '0') {
        event.preventDefault();
        fitToWindow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fitToWindow, onClose, zoomIn, zoomOut]);

  const ready = !loading && !failed;
  const percent = Math.round(zoom * 100);

  return (
    <div
      data-testid="present-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-[#0b1220]"
    >
      <header className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-gray-300">
        <span className="truncate">{title}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {ready ? (
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label={t('common.present.zoomFit')}
            >
              <button
                type="button"
                data-testid="present-zoom-out"
                aria-label={t('common.present.zoomOut')}
                title={t('common.present.zoomOut')}
                disabled={zoom <= ZOOM_MIN}
                onClick={zoomOut}
                className="rounded-md border border-gray-600 p-1 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="zoomOut" className="h-4 w-4" />
              </button>
              <span
                data-testid="present-zoom-level"
                className="min-w-[46px] text-center text-[12px] tabular-nums text-gray-400"
              >
                {percent}%
              </span>
              <button
                type="button"
                data-testid="present-zoom-in"
                aria-label={t('common.present.zoomIn')}
                title={t('common.present.zoomIn')}
                disabled={zoom >= ZOOM_MAX}
                onClick={zoomIn}
                className="rounded-md border border-gray-600 p-1 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="zoomIn" className="h-4 w-4" />
              </button>
              <button
                type="button"
                data-testid="present-zoom-fit"
                aria-label={t('common.present.zoomFit')}
                title={t('common.present.zoomFit')}
                onClick={fitToWindow}
                className="rounded-md border border-gray-600 p-1 transition-colors hover:bg-gray-800"
              >
                <Icon name="fitScreen" className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            data-testid="present-exit"
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-600 px-2.5 py-1 text-[12px] transition-colors hover:bg-gray-800"
          >
            <Icon name="close" className="h-4 w-4" />
            {exitLabel}
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        data-testid="present-scroll"
        className="flex min-h-0 flex-1 overflow-auto px-6 pb-6"
        style={{
          // `safe` keeps zoomed-in content aligned to the start edge so centering does not clip its beginning
          justifyContent: 'safe center',
          alignItems: align === 'top' ? 'flex-start' : 'safe center',
        }}
      >
        {loading ? <p className="text-sm text-gray-400">{loadingLabel}</p> : null}
        {failed ? (
          <div className="max-w-md text-center text-sm text-gray-400">
            <p>{failedLabel}</p>
            {failedHint ? <p className="mt-1 text-xs text-gray-500">{failedHint}</p> : null}
          </div>
        ) : null}
        {ready ? (
          // Zoom stage: the outer box takes the scaled layout size for scrolling, the inner keeps its size and scales,
          // so fixed-size content such as text or tables truly grows instead of leaving blank space.
          <div
            ref={stageRef}
            data-testid="present-stage"
            className="shrink-0"
            style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
          >
            <div
              className="flex justify-center"
              style={{
                // Inner = stage size / ratio (the original viewport size), scaled from the top-left to fill the stage
                width: `${100 / zoom}%`,
                height: `${100 / zoom}%`,
                alignItems: align === 'top' ? 'flex-start' : 'center',
                transform: `scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
              {children}
            </div>
          </div>
        ) : null}
      </div>

      {footer ? (
        <footer className="flex items-center justify-center gap-3 pb-4 text-[12px] text-gray-400">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
