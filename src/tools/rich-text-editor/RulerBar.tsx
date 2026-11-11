import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { Editor } from '@tiptap/react';
import type { ViewMode } from './draft';
import { MM_TO_PX, type PageMargins, type PageMetrics } from './pageSetup';
import { normalizeTabStops, removeTabStop, setTabStop, type TabStop } from './tabStops';

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

/** Indents of the caret paragraph, in CSS px (the unit `setParagraphIndent` stores) */
interface RulerIndent {
  left: number;
  right: number;
  /** Hanging indent (> 0 means the first line marker drives `hanging` instead of `textIndent`) */
  hanging: number;
  firstLine: number;
  /** P1-4 制表位 of the caret paragraph (px from the text edge, like Word's `w:tabs`) */
  tabStops: TabStop[];
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
  const [indent, setIndent] = useState<RulerIndent | null>(null);
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

  /**
   * Caret position -> offsets on both rulers, plus the indents of the paragraph the caret sits in
   * (P1-4: the markers follow the text, not a separate selection model).
   */
  const syncCaret = useCallback(() => {
    const geometry = geoRef.current;
    if (!editor || !geometry) {
      setCaret(null);
      setIndent(null);
      return;
    }
    const block = editor.state.selection.$from.parent;
    if (block.type.name === 'paragraph') {
      const attrs = editor.getAttributes('paragraph');
      setIndent({
        left: Number(attrs.indentLeft ?? 0),
        right: Number(attrs.indentRight ?? 0),
        hanging: Number(attrs.hangingIndent ?? 0),
        firstLine: Number(attrs.textIndent ?? 0),
        tabStops: normalizeTabStops(attrs.tabStops),
      });
    } else {
      setIndent(null);
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

  /**
   * Pointer drag on a ruler marker. The editor is the single source of truth: every 4px step dispatches
   * one transaction, so the paragraph, the markers and the page view all move together.
   * Keyboard users get the same commands from the ribbon (增加/减少缩进), which is why the handles
   * themselves stay out of the tab order and inside the ruler's `aria-hidden` subtree.
   */
  const dragRef = useRef<{
    kind: 'left' | 'right' | 'first';
    startX: number;
    start: number;
    last: number;
  } | null>(null);

  const beginDrag =
    (kind: 'left' | 'right' | 'first') => (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!editor || !indent) return;
      event.preventDefault();
      // Pointer capture keeps the drag alive once the pointer leaves the small handle
      event.currentTarget.setPointerCapture(event.pointerId);
      const start =
        kind === 'left'
          ? indent.left
          : kind === 'right'
            ? indent.right
            : indent.hanging > 0
              ? indent.hanging
              : indent.firstLine;
      dragRef.current = { kind, startX: event.clientX, start, last: start };
    };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || !editor || !indent) return;
    // Screen -> CSS px: the sheet is scaled by `zoom`
    const delta = (event.clientX - drag.startX) / (zoom || 1);
    const raw = drag.kind === 'right' ? drag.start - delta : drag.start + delta;
    const next = Math.max(0, Math.min(480, Math.round(raw / 4) * 4));
    if (next === drag.last) return;
    drag.last = next;
    if (drag.kind === 'left') editor.chain().setParagraphIndent({ left: next }).run();
    else if (drag.kind === 'right') editor.chain().setParagraphIndent({ right: next }).run();
    else if (indent.hanging > 0) editor.chain().setParagraphIndent({ hanging: next }).run();
    else
      editor
        .chain()
        .indentParagraph(next - indent.firstLine)
        .run();
  };

  const endDrag = () => {
    dragRef.current = null;
  };

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
  /** Document CSS px -> ruler screen px (the ruler sits outside the `zoom` layer) */
  const zoomPx = (value: number) => value * (zoom || 1);

  /**
   * Click on the tick strip sets a left tab stop exactly where the user clicked (snapped to the
   * 4px grid the indent drag uses). Clicking an existing marker removes it — Word hides that behind
   * a dialog, but the ruler is the direct manipulation surface here (`TabStops` honours the stops
   * in the editor; `.docx` export writes them as `w:tabs`).
   */
  const addTabStop = (event: ReactMouseEvent<HTMLSpanElement>) => {
    if (!editor || !indent) return;
    const target = event.target as HTMLElement;
    // Markers and indent handles have their own handlers
    if (target.closest('.rte-ruler-handle, .rte-ruler-tabstop')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / (zoom || 1);
    if (x < 4 || x > contentWidth / (zoom || 1) - 4) return;
    const pos = Math.round(x / 4) * 4;
    editor
      .chain()
      .setParagraphTabStops(setTabStop(indent.tabStops, { pos, align: 'left' }))
      .run();
  };

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
          <span
            className="rte-ruler-content"
            style={{ width: `${contentWidth}px` }}
            // Keep the caret in the editor: clicking the ruler must not blur it (Word behaves the same)
            onMouseDown={(event) => event.preventDefault()}
            onClick={addTabStop}
          >
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
            {/* Word's three indent markers: first line (top), left (bottom), right (bottom, from
                the content edge). They follow the caret paragraph and drag live. */}
            {indent ? (
              <>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  data-testid="rte-ruler-handle-first"
                  data-value={indent.hanging > 0 ? indent.hanging : indent.firstLine}
                  className="rte-ruler-handle rte-ruler-handle--first"
                  style={{
                    left: `${zoomPx(indent.hanging > 0 ? Math.max(0, indent.left - indent.hanging) : indent.firstLine)}px`,
                  }}
                  onPointerDown={beginDrag('first')}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  data-testid="rte-ruler-handle-left"
                  data-value={indent.left}
                  className="rte-ruler-handle rte-ruler-handle--left"
                  style={{ left: `${zoomPx(indent.left)}px` }}
                  onPointerDown={beginDrag('left')}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  data-testid="rte-ruler-handle-right"
                  data-value={indent.right}
                  className="rte-ruler-handle rte-ruler-handle--right"
                  // Keep the whole handle inside the track: it is clipped at the content edge, and a
                  // half-clipped handle cannot be grabbed
                  style={{ left: `${Math.max(6, contentWidth - zoomPx(indent.right) - 6)}px` }}
                  onPointerDown={beginDrag('right')}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
                {/* P1-4 制表位: markers of the caret paragraph. Click adds one on the tick strip,
                    clicking a marker removes it again. */}
                {indent.tabStops.map((stop) => (
                  <button
                    key={`${stop.align}-${stop.pos}`}
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    data-testid="rte-ruler-tabstop"
                    data-pos={stop.pos}
                    data-align={stop.align}
                    className="rte-ruler-tabstop"
                    style={{ left: `${zoomPx(stop.pos)}px` }}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!editor) return;
                      editor
                        .chain()
                        .setParagraphTabStops(removeTabStop(indent.tabStops, stop.pos))
                        .run();
                    }}
                  />
                ))}
              </>
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
