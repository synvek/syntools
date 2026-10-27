import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type Konva from 'konva';
import { fitScale, GRID_SIZE } from '../core';
import type { StageCallbacks, TransformChange } from '../interaction/pointer';
import { createStage, type StageHandle } from '../render/stage';
import { openTextEditor, type TextEditorHandle } from '../render/textEditor';
import { containerElements, useSlideStore } from '../store';
import type { SlideElement } from '../model/types';
import { Rulers } from './Rulers';
import { SlideContextMenu, type SlideContextTarget } from './SlideContextMenu';

/**
 * Canvas host: imperatively manages the Konva Stage.
 *
 * Three rules:
 * 1. The Stage is created one tick late to dodge React 18 StrictMode double mounting (same as the Univer host);
 * 2. No store writes during drag/resize → a full-page rebuild would destroy the node being dragged;
 * 3. Double-clicking a text element mounts a DOM textarea overlay for inline editing;
 *    the overlay must be transparent (or it would cover elements above), and the textarea renders the text alone.
 */
export function SlideCanvas({ onRuntimeFailure }: { onRuntimeFailure: () => void }) {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<StageHandle | null>(null);
  const editorRef = useRef<TextEditorHandle | null>(null);
  /** Id of the element being edited inline: its static text is hidden while editing */
  const editingIdRef = useRef<string | null>(null);
  const draggingRef = useRef(false);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  /** Context menu: hitting an element gives the element menu, hitting blank space the canvas menu */
  const [menu, setMenu] = useState<SlideContextTarget | null>(null);

  // onRuntimeFailure is a new function on every parent render, so it's held in a ref to keep it out of
  // effect dependencies; otherwise every render would destroy and rebuild the whole Konva Stage (killing dragged elements).
  const onRuntimeFailureRef = useRef(onRuntimeFailure);
  onRuntimeFailureRef.current = onRuntimeFailure;

  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const selection = useSlideStore((s) => s.selection);
  const scale = useSlideStore((s) => s.viewport.scale);
  const panX = useSlideStore((s) => s.viewport.panX);
  const panY = useSlideStore((s) => s.viewport.panY);
  const showPlaceholders = useSlideStore((s) => s.showPlaceholders);
  const viewMode = useSlideStore((s) => s.viewMode);
  const masterKind = useSlideStore((s) => s.masterKind);
  const masterIndex = useSlideStore((s) => s.masterIndex);
  // Guides/rulers are store state, so a subscription is needed to trigger a redraw
  const showRulers = useSlideStore((s) => s.showRulers);
  const guides = useSlideStore((s) => s.guides);

  const applyTransform = useCallback(() => {
    const canvas = canvasRef.current;
    const handle = handleRef.current;
    if (!canvas || !handle) return;
    const state = useSlideStore.getState();
    // scale === 0 means "not fitted yet": compute the fit once from the container size and write it back so the toolbar shows a real ratio
    const fitted = fitScale(
      state.doc,
      { width: canvas.clientWidth, height: canvas.clientHeight },
      24,
    );
    const nextScale = state.viewport.scale > 0 ? state.viewport.scale : fitted;
    if (state.viewport.scale <= 0) state.setScale(nextScale);
    // The page is centered by default, then the user's pan offset is added
    const x =
      Math.max(0, (canvas.clientWidth - state.doc.width * nextScale) / 2) +
      (state.viewport.panX ?? 0);
    const y =
      Math.max(0, (canvas.clientHeight - state.doc.height * nextScale) / 2) +
      (state.viewport.panY ?? 0);
    transformRef.current = { scale: nextScale, x, y };
    handle.setTransform({ scale: nextScale, x, y });
  }, []);

  const syncNow = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const state = useSlideStore.getState();
    if (state.viewMode === 'master') {
      // Master view: edit master/layout elements directly without the inherited layer (or it would double up)
      handle.renderBackground(state.doc, []);
      handle.sync(containerElements(state), state.doc);
      handle.renderCustomGuides(state.showRulers ? state.guides : [], {
        width: state.doc.width,
        height: state.doc.height,
      });
      handle.setSelection(state.selection);
      return;
    }
    const slide = state.doc.slides[state.slideIndex];
    if (!slide) return;
    const layout = state.doc.layouts.find((item) => item.id === slide.layoutId);
    const master = layout
      ? state.doc.masters.find((item) => item.id === layout.masterId)
      : undefined;
    // Master/layout only serve as geometry reference: PowerPoint's normal view shows no placeholder captions, so drop the text too
    const inherited = state.showPlaceholders
      ? [...(master?.elements ?? []), ...(layout?.elements ?? [])].map(stripPlaceholderText)
      : [];
    handle.renderBackground(state.doc, inherited);
    handle.sync(slide.elements, state.doc);
    // Manual guides are drawn above the content layer and always follow the document size
    handle.renderCustomGuides(state.showRulers ? state.guides : [], {
      width: state.doc.width,
      height: state.doc.height,
    });
    // The sync rebuilds text/shape/table nodes by id (these types bypass the fast property path), and the
    // Transformer still points at the destroyed old nodes, so it must be reattached to the current selection;
    // otherwise rotation handles end up misplaced and resize handles disappear after dragging.
    handle.setSelection(state.selection);
  }, []);

  /**
   * Wheel: ⌘/Ctrl + wheel = zoom anchored at the pointer, plain wheel = pan the canvas.
   * Zooming keeps "the page point under the pointer" fixed, matching the feel of PowerPoint / WPS.
   */
  const handleWheel = useCallback((event: WheelEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    const state = useSlideStore.getState();
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const current = transformRef.current.scale;

    if (event.ctrlKey || event.metaKey) {
      const next = Math.min(
        3,
        Math.max(0.1, Math.round((current - event.deltaY * 0.002) * 100) / 100),
      );
      if (next === current) return;
      const { x, y } = transformRef.current;
      const pageX = (px - x) / current;
      const pageY = (py - y) / current;
      const centerX = Math.max(0, (canvas.clientWidth - state.doc.width * next) / 2);
      const centerY = Math.max(0, (canvas.clientHeight - state.doc.height * next) / 2);
      state.setViewport({
        scale: next,
        panX: px - pageX * next - centerX,
        panY: py - pageY * next - centerY,
      });
      return;
    }
    state.setViewport({
      panX: (state.viewport.panX ?? 0) - event.deltaX,
      panY: (state.viewport.panY ?? 0) - event.deltaY,
    });
  }, []);

  /**
   * Hide / restore an element's static text during inline editing.
   *
   * The editing overlay is transparent DOM and the textarea renders the text alone; if the canvas kept drawing it, it would double.
   * Mutating nodes imperatively (bypassing the store) is deliberate: opening the editor shouldn't count as a document change,
   * otherwise a full sync would misplace the textarea that was just mounted.
   */
  const setStaticTextVisible = useCallback((id: string, visible: boolean) => {
    const layer = handleRef.current?.contentLayer;
    const text = layer?.findOne<Konva.Group>(`#${id}`)?.findOne<Konva.Group>('.text');
    if (!layer || !text) return;
    text.visible(visible);
    layer.batchDraw();
  }, []);

  /**
   * Wrap up: restore the static text and destroy the overlay.
   * Idempotent and reentrant — the editor itself calls back in on destroy (Esc / blur),
   * so the ref is cleared before destroy and repeated calls short-circuit.
   */
  const closeEditor = useCallback(() => {
    const editingId = editingIdRef.current;
    editingIdRef.current = null;
    if (editingId) setStaticTextVisible(editingId, true);
    const editor = editorRef.current;
    editorRef.current = null;
    editor?.destroy();
  }, [setStaticTextVisible]);

  const startEditing = useCallback(
    (id: string) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const state = useSlideStore.getState();
      const element = containerElements(state).find((item) => item.id === id);
      const body =
        element?.type === 'text'
          ? element.body
          : element?.type === 'shape'
            ? element.body
            : undefined;
      if (!element || !body) return;
      closeEditor();
      // Static text steps aside for the textarea (otherwise it doubles the same text on the canvas)
      editingIdRef.current = element.id;
      setStaticTextVisible(element.id, false);
      editorRef.current = openTextEditor(
        {
          id: element.id,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          body,
        },
        {
          host: wrapper,
          transform: transformRef.current,
          labels: {
            bold: t('tools.slide.bold'),
            italic: t('tools.slide.italic'),
            underline: t('tools.slide.underline'),
            strike: t('tools.slide.strike'),
          },
          onCommit: (elementId, nextBody) => {
            useSlideStore.getState().patchElement(elementId, { body: nextBody } as never);
            closeEditor();
            syncNow();
          },
          // Esc cancel / blur without changes never reach onCommit, but the static text still has to be restored
          onClose: closeEditor,
        },
      );
    },
    [closeEditor, setStaticTextVisible, syncNow, t],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    const callbacks: StageCallbacks = {
      onSelect: (ids, additive) => useSlideStore.getState().select(ids, additive),
      onDragStart: () => {
        draggingRef.current = true;
        useSlideStore.getState().commit();
      },
      onDragMove: (id, x, y) => useSlideStore.getState().patchElement(id, { x, y }, false),
      onDragEnd: (id, x, y) => {
        useSlideStore.getState().patchElement(id, { x, y }, false);
        draggingRef.current = false;
        syncNow();
      },
      onTransformEnd: (changes: TransformChange[]) => {
        const state = useSlideStore.getState();
        draggingRef.current = false;
        if (changes.length === 0) return;
        // No store writes during the transform: push one history snapshot here instead, so a multi-select transform is one undo step
        state.commit();
        for (const change of changes) {
          const { id, ...patch } = change;
          state.patchElement(id, patch as never, false);
        }
        syncNow();
      },
      onBackgroundClick: () => {
        closeEditor();
        useSlideStore.getState().select([]);
      },
      onTextEdit: (id) => startEditing(id),
      onContextMenu: ({ x, y, elementId }) =>
        setMenu({ kind: elementId ? 'element' : 'canvas', x, y, elementId }),
      onCellSelect: (cell) => useSlideStore.getState().setActiveCell(cell),
      onPan: (dx, dy) => {
        const state = useSlideStore.getState();
        state.setViewport({
          panX: (state.viewport.panX ?? 0) + dx,
          panY: (state.viewport.panY ?? 0) + dy,
        });
      },
      getSnapContext: () => {
        const state = useSlideStore.getState();
        // Snap targets come from the "current editing container": in master view, snap to master elements rather than slide elements
        const others = containerElements(state)
          .filter((element) => !state.selection.includes(element.id))
          .map((element) => ({
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
          }));
        return {
          page: { width: state.doc.width, height: state.doc.height },
          others,
          extraX: state.guides.filter((g) => g.axis === 'x').map((g) => g.position),
          extraY: state.guides.filter((g) => g.axis === 'y').map((g) => g.position),
          grid: state.gridSnap ? GRID_SIZE : 0,
        };
      },
      getSelection: () => useSlideStore.getState().selection,
    };

    // Instantiate one tick later: under StrictMode the effect mounts → unmounts → remounts
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const handle = createStage(canvas, callbacks);
        handleRef.current = handle;
        handle.setSize(canvas.clientWidth || 800, canvas.clientHeight || 450);
        applyTransform();
        syncNow();
      } catch {
        onRuntimeFailureRef.current();
      }
    }, 0);

    // passive:false is required, otherwise preventDefault has no effect and the page scrolls along
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        const currentCanvas = canvasRef.current;
        const handle = handleRef.current;
        if (!handle || !currentCanvas) return;
        handle.setSize(currentCanvas.clientWidth, currentCanvas.clientHeight);
        useSlideStore
          .getState()
          .setViewport({ width: currentCanvas.clientWidth, height: currentCanvas.clientHeight });
        applyTransform();
      });
      observer.observe(canvas);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      canvas.removeEventListener('wheel', handleWheel);
      observer?.disconnect();
      closeEditor();
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [applyTransform, closeEditor, handleWheel, startEditing, syncNow]);

  useEffect(() => {
    applyTransform();
  }, [applyTransform, doc.width, doc.height, scale, panX, panY]);

  useEffect(() => {
    if (draggingRef.current) return;
    syncNow();
  }, [
    doc,
    guides,
    showPlaceholders,
    showRulers,
    slideIndex,
    viewMode,
    masterKind,
    masterIndex,
    syncNow,
  ]);

  useEffect(() => {
    handleRef.current?.setSelection(selection);
  }, [selection]);

  // Close the menu after the document changes via keyboard edits / undo / menu actions, so it doesn't linger on a stale target.
  // slideIndex is deliberately not watched: right-clicking a thumbnail switches slides before the menu opens, which would close it at once.
  useEffect(() => {
    setMenu(null);
  }, [doc, viewMode, masterKind, masterIndex]);

  return (
    <div ref={wrapperRef} className="relative min-h-[360px] flex-1 overflow-hidden">
      <div ref={canvasRef} className="slide-stage" aria-label="slide canvas" />
      <Rulers containerRef={canvasRef} />
      <SlideContextMenu target={menu} onClose={() => setMenu(null)} onEditText={startEditing} />
    </div>
  );
}

/** Strip the hint text from placeholder elements, keeping only geometry and fill (so master captions don't clutter the canvas) */
function stripPlaceholderText(element: SlideElement): SlideElement {
  if (element.type === 'text') {
    return { ...element, body: { ...element.body, paragraphs: [] } };
  }
  if (element.type === 'shape' && element.body) {
    const copy: SlideElement = { ...element };
    delete (copy as { body?: unknown }).body;
    return copy;
  }
  return element;
}
