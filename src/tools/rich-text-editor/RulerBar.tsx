import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import type { ViewMode } from './draft';
import { MM_TO_PX, type PageMargins, type PageMetrics } from './pageSetup';

/**
 * Ruler (modeled on Word): a horizontal ruler at the top and a vertical one on the left, showing
 * millimeter ticks for the current paper size / margins / zoom. In page view the margins are drawn as
 * gray bands and a thin line marks the caret, which helps align things while typesetting.
 *
 * Coordinate system: both rulers are rendered inside the scroll container (`.rte-editor-viewport`).
 * - The horizontal ruler is sticky at the top (vertical scrolling doesn't move it);
 * - The vertical ruler is absolutely pinned to the container (its containing block is the container's
 *   padding box, so scrolling doesn't move it), while the tick layer is translated by the measured
 *   content top, so the numbers follow the text while scrolling.
 * Positions and sizes all come from measured screen rects, so CSS `zoom`, horizontal / vertical
 * scrolling and column switches are followed automatically.
 */

interface RulerBarProps {
  editor: Editor | null;
  viewportRef: RefObject<HTMLDivElement | null>;
  viewMode: ViewMode;
  zoom: number;
  metrics: PageMetrics;
  margin: PageMargins;
}

interface RulerGeometry {
  /** Left offset and total width of the sheet / body column relative to the scroll container (screen px) */
  offsetLeft: number;
  width: number;
  /** Left/right margin widths (0 in flow view) */
  padLeft: number;
  padRight: number;
  /** Screen x of the content area's left edge: maps the caret position onto the ticks */
  contentScreenLeft: number;
  /** Offset of the content area's top from the scroll container's top (changes with scrolling) */
  offsetTop: number;
  /** Content area height (screen px) */
  contentHeight: number;
  /** Top/bottom margin heights (0 in flow view) */
  padTop: number;
  padBottom: number;
  /** Screen y of the content area's top */
  contentScreenTop: number;
  /** Current vertical scroll offset: absolute elements inside the container move with the content and need inverse compensation */
  scrollTop: number;
}

/** Horizontal padding (matching `.rte-surface`'s `px-8`) and vertical padding (`py-8`) in flow view */
const FLOW_PADDING_PX = 32;
/** Below these sizes, drawing ticks isn't worth it (very narrow window or squashed content area) */
const MIN_RULER_WIDTH_PX = 140;
const MIN_RULER_HEIGHT_PX = 120;

export function RulerBar({ editor, viewportRef, viewMode, zoom, metrics, margin }: RulerBarProps) {
  const [geo, setGeo] = useState<RulerGeometry | null>(null);
  const [caret, setCaret] = useState<{ x: number; y: number } | null>(null);
  const geoRef = useRef<RulerGeometry | null>(null);
  const frameRef = useRef<number | null>(null);
  geoRef.current = geo;

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const surface = viewport?.querySelector<HTMLElement>('.rte-surface');
    if (!viewport || !surface) {
      setGeo(null);
      return;
    }
    const viewportRect = viewport.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    // Screen px = CSS px × zoom; rects are measured after zooming, so scale is only used for margin conversion
    const scale = MM_TO_PX * zoom;
    const paged = viewMode === 'paged';
    const padLeft = paged ? margin.left * scale : FLOW_PADDING_PX * zoom;
    const padRight = paged ? margin.right * scale : FLOW_PADDING_PX * zoom;
    const padTop = paged ? margin.top * scale : FLOW_PADDING_PX * zoom;
    const padBottom = paged ? margin.bottom * scale : FLOW_PADDING_PX * zoom;
    const width = paged ? surfaceRect.width : surfaceRect.width - padLeft - padRight;
    const contentHeight = paged ? surfaceRect.height - padTop - padBottom : surfaceRect.height;
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(contentHeight) ||
      width < MIN_RULER_WIDTH_PX ||
      contentHeight < MIN_RULER_HEIGHT_PX
    ) {
      setGeo(null);
      return;
    }
    setGeo({
      offsetLeft: surfaceRect.left - viewportRect.left + (paged ? 0 : padLeft),
      width,
      padLeft: paged ? padLeft : 0,
      padRight: paged ? padRight : 0,
      contentScreenLeft: surfaceRect.left + padLeft,
      offsetTop: surfaceRect.top - viewportRect.top + padTop,
      contentHeight,
      padTop: paged ? padTop : 0,
      padBottom: paged ? padBottom : 0,
      contentScreenTop: surfaceRect.top + padTop,
      scrollTop: viewport.scrollTop,
    });
  }, [margin.bottom, margin.left, margin.right, margin.top, viewMode, viewportRef, zoom]);

  /**
   * The horizontal ruler only mounts after the first measure (once geo is set), so an effect can't
   * observe it via `viewport.querySelector('.rte-ruler')` (it isn't there yet, and the vertical ruler
   * ticks would keep using stale geometry assuming a ruler height of 0, misaligned by ~20px).
   * A callback ref is used instead: observation starts as soon as the node mounts.
   */
  const measureRef = useRef(measure);
  measureRef.current = measure;
  const rulerObserverRef = useRef<ResizeObserver | null>(null);
  const attachRuler = useCallback((node: HTMLDivElement | null) => {
    rulerObserverRef.current?.disconnect();
    rulerObserverRef.current = null;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measureRef.current());
    observer.observe(node);
    rulerObserverRef.current = observer;
  }, []);

  /** Caret position -> offsets on both rulers (relative to the content area's left / top edge) */
  const syncCaret = useCallback(() => {
    const geometry = geoRef.current;
    if (!editor || !geometry) {
      setCaret(null);
      return;
    }
    const { from } = editor.state.selection;
    const coords = editor.view.coordsAtPos(from);
    setCaret({
      x: Math.round(coords.left - geometry.contentScreenLeft),
      y: Math.round(coords.top - geometry.contentScreenTop),
    });
  }, [editor]);

  useEffect(() => {
    measure();
    // Layout (especially the horizontal ruler's height) often settles only after the first frame,
    // so measure again on the next frame; otherwise the vertical ticks misalign with the text
    // (vOffset off by up to ~20px).
    requestAnimationFrame(() => measure());
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    observer?.observe(viewport);
    const surface = viewport.querySelector<HTMLElement>('.rte-surface');
    if (surface) observer?.observe(surface);
    // A height change in the horizontal ruler pushes the whole body area down while the surface size
    // stays the same, so the ruler needs its own observation; attachRuler takes that over on mount.
    // Scroll events don't bubble, so use the capture phase to also catch inner horizontal scrolling (.rte-page-area)
    const onScroll = () => measure();
    viewport.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      observer?.disconnect();
      viewport.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [measure, viewportRef, metrics, viewMode]);

  useEffect(() => {
    syncCaret();
  }, [geo, syncCaret]);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        syncCaret();
      });
    };
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [editor, syncCaret]);

  if (!geo) return null;

  const mmPx = MM_TO_PX * zoom;
  const cmPx = mmPx * 10;
  const contentWidth = geo.width - geo.padLeft - geo.padRight;
  const contentHeight = geo.contentHeight;
  // One numeric label per centimeter (Word's ruler numbers are centimeters)
  const labels: number[] = [];
  for (let cm = 1; cm * cmPx <= contentWidth - 6; cm += 1) labels.push(cm);
  const vLabels: number[] = [];
  for (let cm = 1; cm * cmPx <= contentHeight - 6; cm += 1) vLabels.push(cm);
  const caretVisible =
    caret !== null &&
    caret.x >= 0 &&
    caret.x <= contentWidth &&
    caret.y >= 0 &&
    caret.y <= contentHeight;

  return (
    <>
      {/* Top-left corner */}
      <span className="rte-ruler-corner" aria-hidden="true" />
      {/* Horizontal ruler */}
      <div ref={attachRuler} className="rte-ruler" data-testid="rich-text-ruler" aria-hidden="true">
        <div
          className="rte-ruler-track"
          style={{ left: `${geo.offsetLeft}px`, width: `${geo.width}px` }}
        >
          {geo.padLeft > 0 ? (
            <span className="rte-ruler-pad" style={{ width: `${geo.padLeft}px` }} />
          ) : null}
          <span className="rte-ruler-content" style={{ width: `${contentWidth}px` }}>
            <span
              className="rte-ruler-ticks rte-ruler-ticks--minor"
              style={{ backgroundSize: `${mmPx}px 100%` }}
            />
            <span
              className="rte-ruler-ticks rte-ruler-ticks--half"
              style={{ backgroundSize: `${mmPx * 5}px 100%` }}
            />
            <span
              className="rte-ruler-ticks rte-ruler-ticks--major"
              style={{ backgroundSize: `${cmPx}px 100%` }}
            />
            {labels.map((cm) => (
              <span key={cm} className="rte-ruler-label" style={{ left: `${cm * cmPx}px` }}>
                {cm}
              </span>
            ))}
            {caretVisible ? (
              <span className="rte-ruler-caret" style={{ left: `${caret.x}px` }} />
            ) : null}
          </span>
          {geo.padRight > 0 ? (
            <span className="rte-ruler-pad" style={{ width: `${geo.padRight}px` }} />
          ) : null}
        </div>
      </div>
      {/* Vertical ruler */}
      <div
        className="rte-ruler-v"
        data-testid="rich-text-ruler-v"
        aria-hidden="true"
        // Absolute elements inside the scroll container move up with the content, so shift them back
        // to pin the ruler in place; the tick layer then aligns to the content top via offsetTop,
        // letting the numbers follow the text while scrolling.
        style={{ transform: `translateY(${geo.scrollTop}px)` }}
      >
        <div
          className="rte-ruler-track rte-ruler-track--v"
          style={{
            top: `${geo.offsetTop}px`,
            height: `${geo.padTop + contentHeight + geo.padBottom}px`,
          }}
        >
          {geo.padTop > 0 ? (
            <span className="rte-ruler-pad" style={{ height: `${geo.padTop}px` }} />
          ) : null}
          <span
            className="rte-ruler-content rte-ruler-content--v"
            style={{ height: `${contentHeight}px` }}
          >
            <span
              className="rte-ruler-ticks rte-ruler-ticks--minor rte-ruler-ticks--v"
              style={{ backgroundSize: `100% ${mmPx}px` }}
            />
            <span
              className="rte-ruler-ticks rte-ruler-ticks--half rte-ruler-ticks--v"
              style={{ backgroundSize: `100% ${mmPx * 5}px` }}
            />
            <span
              className="rte-ruler-ticks rte-ruler-ticks--major rte-ruler-ticks--v"
              style={{ backgroundSize: `100% ${cmPx}px` }}
            />
            {vLabels.map((cm) => (
              <span
                key={cm}
                className="rte-ruler-label rte-ruler-label--v"
                style={{ top: `${cm * cmPx}px` }}
              >
                {cm}
              </span>
            ))}
            {caretVisible ? (
              <span
                className="rte-ruler-caret rte-ruler-caret--v"
                style={{ top: `${caret.y}px` }}
              />
            ) : null}
          </span>
          {geo.padBottom > 0 ? (
            <span className="rte-ruler-pad" style={{ height: `${geo.padBottom}px` }} />
          ) : null}
        </div>
      </div>
    </>
  );
}
