import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../core/components/Icon';
import {
  clampScale,
  needsCloneSource,
  rotatedDocBounds,
  screenToDoc,
  stagePosition,
  transformOverlayFor,
  clampViewport,
  computeFitScale,
  viewportFromScroll,
  zoomAtPoint,
} from '../core';
import { attachPointer, type PickedColor } from '../interaction/pointer';
import { createCanvasElement, getCanvas } from '../model/assets';
import { openTextEditor, type TextEditorHandle } from '../render/textEditor';
import { createStage, type OverlayState, type StageHandle } from '../render/stage';
import { onBakeReady } from '../render/bakeQueue';
import { channelViewCanvas } from '../render/channels';
import { putBakeResult } from '../render/filters';
import { bakeKeyOf, LAYER_ID_ATTR } from '../render/nodes';
import { refreshLayerNode } from '../render/sync';
import { usePhotoStore } from '../store';
import { CanvasOverlay } from './CanvasOverlay';
import { CanvasScrollbars } from './CanvasScrollbars';

/**
 * Canvas host: imperatively owns the Konva Stage.
 *
 * Three conventions (same as the slide editor's SlideCanvas):
 * 1. The Stage is created one tick late, dodging React 18 StrictMode's double mount;
 * 2. Native container events drive interaction (Konva nodes listening: false), with one screen → document map;
 * 3. Double-clicking a text layer overlays a DOM textarea for in-place editing.
 */
/** Mirror the viewport transform onto DOM attributes, so e2e can assert zoom / pan */
function markTransform(
  host: HTMLElement,
  transform: { scale: number; x: number; y: number; rotation?: number },
) {
  host.dataset.transform = `${transform.scale.toFixed(4)},${Math.round(transform.x)},${Math.round(transform.y)}`;
  // Rotation gets its own attribute: existing e2e assertions depend on the `data-transform` format
  if (transform.rotation) host.dataset.viewRotation = String(transform.rotation);
  else delete host.dataset.viewRotation;
}

/**
 * Hide the layer being edited inline: the transparent textarea shows the text itself, and a vertical flow
 * would otherwise be drawn underneath the horizontal editor box and look garbled.
 */
function hideEditingLayer(handle: StageHandle, id: string) {
  const node = handle.contentLayer
    .getChildren()
    .find((child) => child.getAttr(LAYER_ID_ATTR) === id);
  if (!node) return;
  if (node.visible()) node.visible(false);
  handle.contentLayer.batchDraw();
}

/** Padding left around the canvas when fitting */
const FIT_PADDING = 28;
/** Wheel scroll displacement factor (aligned with React Flow's panOnScrollSpeed) */
const SCROLL_SPEED = 0.9;

/** Container size (0 before layout completes; the guards handle that) */
function hostSize(host: HTMLElement | null): { width: number; height: number } {
  return { width: host?.clientWidth ?? 0, height: host?.clientHeight ?? 0 };
}

/** Mac detection, used to branch Shift+wheel / ⌘+wheel handling */
function isMacLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}
/** A container smaller than this counts as "not laid out yet" and is skipped by fit calculations */
const MIN_HOST_SIZE = 64;

/**
 * Assemble all the state one overlay draw needs.
 *
 * It is module-level because both the React effect and the "coalesced redraw after pixel changes" path
 * (the brush rewriting the quick mask) must redraw the overlay; two copies would inevitably drift apart.
 */
function buildOverlayState(scale: number): OverlayState {
  const state = usePhotoStore.getState();
  const active = state.doc.layers.find((item) => item.id === state.doc.activeLayerId);
  // The transform box and mesh points derive from "layer + transform mode"; interaction uses the same helper
  const overlay =
    state.tool === 'transform' && active
      ? transformOverlayFor(active, state.transformMode)
      : { transformBox: null, meshGrid: null };
  return {
    doc: state.doc,
    scale,
    selection: state.selection,
    cropRect: state.cropRect,
    samples: state.samples,
    quickMask: state.quickMask ? (getCanvas(state.quickMask.assetId) ?? null) : null,
    transformBox: overlay.transformBox,
    meshGrid: overlay.meshGrid,
    // The sample-source marker only shows for sample-related tools, so it doesn't hog the canvas
    cloneSource: needsCloneSource(state.tool) ? state.cloneSource : null,
    snapGuides: state.snapGuides,
    // The gradient preview is overridden on demand by interaction (this component only clears it)
    gradient: null,
  };
}

export function PhotoCanvas({
  onRuntimeFailure,
  onCursorMove,
  onContextMenu,
  onPickColor,
  defaultText,
}: {
  onRuntimeFailure: () => void;
  onCursorMove: (point: { x: number; y: number } | null) => void;
  onContextMenu: (position: { x: number; y: number }) => void;
  onPickColor: (picked: PickedColor | null) => void;
  /** Default content for a new text layer (active locale) */
  defaultText: string;
}) {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<StageHandle | null>(null);
  const editorRef = useRef<TextEditorHandle | null>(null);
  /** Layer hidden while its inline editor is open (kept in a ref so any sync can re-hide it) */
  const editingIdRef = useRef<string | null>(null);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  /** Viewport pixel size: scrollbar geometry depends on it; kept in sync by the ResizeObserver */
  const [hostRect, setHostRect] = useState({ width: 0, height: 0 });

  const doc = usePhotoStore((s) => s.doc);
  const tool = usePhotoStore((s) => s.tool);
  const scale = usePhotoStore((s) => s.viewport.scale);
  const viewport = usePhotoStore((s) => s.viewport);
  const selection = usePhotoStore((s) => s.selection);
  const cropRect = usePhotoStore((s) => s.cropRect);
  const overlay = usePhotoStore((s) => s.overlay);
  const patchOverlay = usePhotoStore((s) => s.patchOverlay);
  const samples = usePhotoStore((s) => s.samples);
  const channelView = usePhotoStore((s) => s.channelView);
  const quickMask = usePhotoStore((s) => s.quickMask);
  const snapGuides = usePhotoStore((s) => s.snapGuides);
  const viewRotation = usePhotoStore((s) => s.viewRotation);

  // The parent passes a new function each render: hold it in a ref so effects don't rebuild the Stage
  const onRuntimeFailureRef = useRef(onRuntimeFailure);
  onRuntimeFailureRef.current = onRuntimeFailure;
  const onCursorMoveRef = useRef(onCursorMove);
  onCursorMoveRef.current = onCursorMove;
  const onContextMenuRef = useRef(onContextMenu);
  onContextMenuRef.current = onContextMenu;
  const onPickColorRef = useRef(onPickColor);
  onPickColorRef.current = onPickColor;
  const defaultTextRef = useRef(defaultText);
  defaultTextRef.current = defaultText;

  /** Apply the unrotated viewport: the layer position is rotated while `transformRef` keeps the unrotated values */
  const pushTransform = useCallback((rotation: number) => {
    const handle = handleRef.current;
    const host = canvasRef.current;
    if (!handle || !host) return;
    const size = { width: host.clientWidth, height: host.clientHeight };
    const positioned = stagePosition(transformRef.current, size, rotation);
    handle.setTransform({ ...positioned, scale: transformRef.current.scale, rotation });
    markTransform(host, { ...transformRef.current, rotation });
  }, []);

  /**
   * Apply the viewport transform (one code path for mount, container resize and user zoom).
   * - `scale === 0` is the "needs fit" sentinel: fit to the container **and write back to the store**, so the
   *   toolbar shows the real ratio; when the container isn't laid out yet (width or height too small), bail
   *   out and wait for the next ResizeObserver callback instead of freezing a tiny ratio computed at size 0.
   */
  const applyTransform = useCallback(() => {
    const handle = handleRef.current;
    const host = canvasRef.current;
    if (!handle || !host) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width < MIN_HOST_SIZE || height < MIN_HOST_SIZE) return;

    const state = usePhotoStore.getState();
    const rotation = state.viewRotation;
    const prev = transformRef.current;
    let nextScale = state.viewport.scale;
    let x = state.viewport.x;
    let y = state.viewport.y;

    if (nextScale <= 0) {
      // Needs fit: compute the ratio and center, writing back once (x / y become authoritative from then on)
      nextScale = computeFitScale(state.doc, { width, height }, FIT_PADDING, rotation);
      // Centering uses the rotated bounds, or a rotated view pushes the canvas off the viewport
      const bounds = rotatedDocBounds(state.doc, rotation);
      x = Math.max(0, (width - bounds.width * nextScale) / 2);
      y = Math.max(0, (height - bounds.height * nextScale) / 2);
      state.setScale(nextScale);
      state.setViewport({ x, y });
    } else if (prev.scale > 0 && Math.abs(prev.scale - nextScale) > 0.0005) {
      // User zoom: keep the document point at the viewport center fixed (or it drifts to the top-left)
      const centerX = (width / 2 - prev.x) / prev.scale;
      const centerY = (height / 2 - prev.y) / prev.scale;
      x = width / 2 - centerX * nextScale;
      y = height / 2 - centerY * nextScale;
      state.setViewport({ x, y });
    }

    // Clamp into the scrollable world so the scrollbar thumb always matches the canvas content
    const bounded = clampViewport(
      { x, y, scale: nextScale },
      state.doc,
      { width, height },
      undefined,
      rotation,
    );
    transformRef.current = { scale: nextScale, ...bounded };
    pushTransform(rotation);
  }, [pushTransform]);

  /** Hand pan: write the transform to the canvas directly, without waiting for React (panning is continuous) */
  const applyPan = useCallback(
    (x: number, y: number) => {
      transformRef.current = { ...transformRef.current, x, y };
      pushTransform(usePhotoStore.getState().viewRotation);
    },
    [pushTransform],
  );

  /** Apply the viewport (pan + zoom): update the canvas now and write back to the store so scrollbars follow */
  const applyViewport = useCallback(
    (next: { scale: number; x: number; y: number }) => {
      const host = canvasRef.current;
      const state = usePhotoStore.getState();
      const scale = clampScale(next.scale);
      const bounded = clampViewport(
        { x: next.x, y: next.y, scale },
        state.doc,
        hostSize(host),
        undefined,
        state.viewRotation,
      );
      if (state.viewport.scale !== scale) state.setScale(scale);
      state.setViewport(bounded);
      transformRef.current = { scale, ...bounded };
      pushTransform(state.viewRotation);
    },
    [pushTransform],
  );

  /** Scrollbar drag / track click: world coordinates → viewport pan */
  const scrollTo = useCallback(
    (left: number, top: number) => {
      const state = usePhotoStore.getState();
      const scale = state.viewport.scale > 0 ? state.viewport.scale : 1;
      applyViewport({ scale, ...viewportFromScroll(left, top, scale) });
    },
    [applyViewport],
  );

  /**
   * Wheel (matching the flowchart editor's behavior):
   * - plain wheel = vertical / horizontal scroll (Shift + wheel turns horizontal off Mac);
   * - Ctrl / ⌘ + wheel = zoom anchored at the cursor.
   */
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      const state = usePhotoStore.getState();
      const host = canvasRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const scale = state.viewport.scale > 0 ? state.viewport.scale : 1;
      const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        // Exponential step: one notch (about 100px) ≈ 15%, capped at 2× per event so one notch can't max out
        const exponent = Math.max(
          -1,
          Math.min(1, -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002)),
        );
        applyViewport(
          zoomAtPoint(
            { x: state.viewport.x, y: state.viewport.y, scale },
            scale * Math.pow(2, exponent),
            pointer,
            { width: host.clientWidth, height: host.clientHeight },
            state.viewRotation,
          ),
        );
        return;
      }

      event.preventDefault();
      const step = event.deltaMode === 1 ? 20 : 1;
      let dx = event.deltaX * step;
      let dy = event.deltaY * step;
      if (event.shiftKey && !isMacLike()) {
        dx = dy;
        dy = 0;
      }
      applyViewport({
        scale,
        x: state.viewport.x - dx * SCROLL_SPEED,
        y: state.viewport.y - dy * SCROLL_SPEED,
      });
    },
    [applyViewport],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    const syncNow = () => {
      const handle = handleRef.current;
      if (!handle) return;
      const state = usePhotoStore.getState();
      handle.renderBackground(state.doc);
      handle.sync(state.doc);
      // The layer is hidden while editing, and sync would otherwise make it visible again
      if (editingIdRef.current) hideEditingLayer(handle, editingIdRef.current);
    };

    /** Restore the layer hidden under the editor (also used when editing is cancelled with Esc) */
    const endEditing = () => {
      if (!editingIdRef.current) return;
      editingIdRef.current = null;
      syncNow();
    };

    const closeEditor = () => {
      editorRef.current?.destroy();
      editorRef.current = null;
      endEditing();
    };

    const startEditing = (id: string) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const state = usePhotoStore.getState();
      const layer = state.doc.layers.find((item) => item.id === id);
      if (!layer || layer.kind !== 'text') return;
      closeEditor();
      editorRef.current = openTextEditor(
        {
          id: layer.id,
          text: layer.text,
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height,
          fontSize: layer.fontSize,
          fontFamily: layer.fontFamily,
          fill: layer.fill,
          align: layer.align,
          bold: layer.bold,
          italic: layer.italic,
          lineHeight: layer.lineHeight,
          direction: layer.direction,
        },
        {
          host: wrapper,
          transform: transformRef.current,
          viewSize: { width: wrapper.clientWidth, height: wrapper.clientHeight },
          viewRotation: usePhotoStore.getState().viewRotation,
          onCommit: (layerId, text, size) => {
            // A manually resized editor box becomes the text box (horizontal → wrap width, vertical → column length)
            const patch = {
              text,
              ...(size?.width !== undefined ? { width: size.width } : {}),
              ...(size?.height !== undefined ? { height: size.height } : {}),
            };
            usePhotoStore.getState().patchLayer(layerId, patch as never, true);
            closeEditor();
            syncNow();
          },
          onCancel: endEditing,
        },
      );
      // Hide the layer under the editor: the textarea draws the text, and for vertical flow the two would overlap
      editingIdRef.current = id;
      const handle = handleRef.current;
      if (handle) hideEditingLayer(handle, id);
    };

    const cleanupRefs: (() => void)[] = [];

    /**
     * Redraw after pixel changes: coalesce into one rAF frame.
     * While painting, pointermove can fire several times per frame, and rebaking each time (convolution
     * filters included) would drop frames; once per frame keeps live feedback at one bake per frame.
     */
    let surfaceFrame: number | null = null;
    const flushSurface = () => {
      surfaceFrame = null;
      const current = handleRef.current;
      if (!current) return;
      const state = usePhotoStore.getState();
      const layer = state.doc.layers.find((item) => item.id === state.doc.activeLayerId);
      if (layer) refreshLayerNode(current.contentLayer, layer, true);
      else current.contentLayer.batchDraw();
      // The brush can also rewrite non-layer content (the quick mask), so fold the overlay into the same frame
      current.renderOverlay(buildOverlayState(transformRef.current.scale));
    };
    const onSurfaceChange = () => {
      if (surfaceFrame !== null) return;
      surfaceFrame = requestAnimationFrame(flushSurface);
    };
    cleanupRefs.push(() => {
      if (surfaceFrame !== null) cancelAnimationFrame(surfaceFrame);
      surfaceFrame = null;
    });

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      let handle: StageHandle;
      try {
        handle = createStage(canvas);
      } catch {
        onRuntimeFailureRef.current();
        return;
      }
      handleRef.current = handle;
      handle.setSize(canvas.clientWidth || 800, canvas.clientHeight || 480);
      setHostRect({ width: canvas.clientWidth, height: canvas.clientHeight });
      applyTransform();
      syncNow();

      const detach = attachPointer(canvas, handle, {
        getTransform: () => transformRef.current,
        onRequestTextEdit: (id) => startEditing(id),
        onSurfaceChange,
        onPan: (x, y) => {
          const state = usePhotoStore.getState();
          const bounded = clampViewport(
            { x, y, scale: transformRef.current.scale },
            state.doc,
            hostSize(canvasRef.current),
            undefined,
            state.viewRotation,
          );
          state.setViewport(bounded);
          applyPan(bounded.x, bounded.y);
        },
        onContextMenu: (position) => onContextMenuRef.current(position),
        onPickColor: (picked) => onPickColorRef.current(picked),
        defaultText: defaultTextRef.current,
      });
      cleanupRefs.push(detach);
    }, 0);

    const onPointerMoveForCursor = (event: PointerEvent) => {
      const host = canvasRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const point = screenToDoc(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        transformRef.current,
        { width: host.clientWidth, height: host.clientHeight },
        usePhotoStore.getState().viewRotation,
      );
      onCursorMoveRef.current({ x: Math.round(point.x), y: Math.round(point.y) });
    };
    const onPointerLeave = () => onCursorMoveRef.current(null);
    canvas.addEventListener('pointermove', onPointerMoveForCursor);
    canvas.addEventListener('pointerleave', onPointerLeave);
    // passive: false — preventDefault is needed to stop the browser from scrolling / zooming the page
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    cleanupRefs.push(() => canvas.removeEventListener('wheel', handleWheel));

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        const host = canvasRef.current;
        const handle = handleRef.current;
        if (!handle || !host) return;
        handle.setSize(host.clientWidth, host.clientHeight);
        setHostRect({ width: host.clientWidth, height: host.clientHeight });
        applyTransform();
      });
      observer.observe(canvas);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer?.disconnect();
      canvas.removeEventListener('pointermove', onPointerMoveForCursor);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      cleanupRefs.forEach((fn) => fn());
      editorRef.current?.destroy();
      editorRef.current = null;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [applyTransform, applyPan, handleWheel]);

  // The cursor follows the tool (CSS matches on data-tool), giving the active tool feedback on the canvas
  useEffect(() => {
    const host = canvasRef.current;
    if (host) host.dataset.tool = tool;
  }, [tool]);

  // Canvas size / background / zoom changed: reset transform and background only, never rebuild nodes
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    applyTransform();
    handle.renderBackground(usePhotoStore.getState().doc);
  }, [doc.width, doc.height, doc.background, scale, viewRotation, applyTransform]);

  // Document changed (layers added / removed / edited, parameters adjusted): sync nodes incrementally
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const state = usePhotoStore.getState();
    handle.sync(state.doc);
    // Editing hides the layer; a doc update (e.g. a colour change) must not pop it back under the editor
    if (editingIdRef.current) hideEditingLayer(handle, editingIdRef.current);
  }, [doc]);

  /**
   * An async full-resolution bake finished: write the result into the bake cache and redraw.
   *
   * Accept it only if the current document still wants that signature: prewarm tasks are debounced, and
   * meanwhile the user may have undone / changed parameters / painted, so caching a stale signature would
   * later (e.g. after undoing back to the same rev) hand out pixels that don't match the signature.
   */
  useEffect(() => {
    return onBakeReady((signature, bitmap) => {
      const state = usePhotoStore.getState();
      const needed = state.doc.layers.some(
        (layer) => layer.kind === 'raster' && bakeKeyOf(layer) === signature,
      );
      if (!needed) {
        bitmap.close();
        return;
      }
      const canvas = createCanvasElement(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        return;
      }
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      putBakeResult(signature, canvas);
      handleRef.current?.sync(usePhotoStore.getState().doc);
    });
  }, []);

  /**
   * Channel isolation view (display state): composite the isolated channel over the canvas and hide the stack;
   * switching back to `rgb` restores it. Display only, never the document, so it stays out of history.
   */
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    if (channelView === 'rgb') {
      handle.setChannelView(null);
      return;
    }
    handle.setChannelView(channelViewCanvas(doc, channelView));
  }, [channelView, doc]);

  // Overlay (selection / crop box / transform box): all three redraw in one pass so they don't wipe each other
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.renderOverlay(buildOverlayState(transformRef.current.scale));
  }, [doc, selection, cropRect, tool, samples, quickMask, snapGuides]);

  return (
    <div
      ref={wrapperRef}
      className="photo-canvas-wrapper relative flex-1 overflow-hidden rounded-xl border border-gray-200 bg-[#0B1220] dark:border-gray-800"
    >
      <div
        ref={canvasRef}
        className="photo-stage"
        data-testid="photo-canvas"
        aria-label={t('tools.photo.canvasAria')}
      />
      {viewRotation ? (
        <button
          type="button"
          data-testid="view-rotation-badge"
          onClick={() => usePhotoStore.getState().resetViewRotation()}
          title={t('tools.photo.rotateReset')}
          className="absolute right-2 top-2 z-10 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white shadow"
        >
          {t('tools.photo.viewRotated', { deg: viewRotation })}
        </button>
      ) : null}
      {quickMask ? (
        <div
          data-testid="quick-mask-badge"
          className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-1.5 rounded-md bg-[#EF4444] px-2 py-1 text-[11px] font-medium text-white shadow"
        >
          <Icon name="quickMask" className="h-3.5 w-3.5" />
          {t('tools.photo.quickMask')}
        </div>
      ) : null}
      <CanvasOverlay
        width={hostRect.width}
        height={hostRect.height}
        transform={viewport}
        viewRotation={viewRotation}
        overlay={overlay}
        patchOverlay={patchOverlay}
      />
      <CanvasScrollbars width={hostRect.width} height={hostRect.height} onScrollTo={scrollTo} />
    </div>
  );
}
