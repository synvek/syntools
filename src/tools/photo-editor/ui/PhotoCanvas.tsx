import { useEffect, useRef } from 'react';
import { computeFitScale } from '../core';
import { attachPointer } from '../interaction/pointer';
import { openTextEditor, type TextEditorHandle } from '../render/textEditor';
import { createStage, type StageHandle } from '../render/stage';
import { refreshLayerNode } from '../render/sync';
import { usePhotoStore } from '../store';

/**
 * 画布宿主：命令式托管 Konva Stage。
 *
 * 三条约定（与 slide-editor 的 SlideCanvas 一致）：
 * 1. Stage 延后一拍创建，规避 React 18 StrictMode 双挂载；
 * 2. 容器原生事件负责交互（Konva 节点 listening: false），统一做「屏幕 → 文档」坐标换算；
 * 3. 双击文字图层 → 叠一个 DOM textarea 做就地编辑。
 */
export function PhotoCanvas({
  onRuntimeFailure,
  onCursorMove,
}: {
  onRuntimeFailure: () => void;
  onCursorMove: (point: { x: number; y: number } | null) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<StageHandle | null>(null);
  const editorRef = useRef<TextEditorHandle | null>(null);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });

  const doc = usePhotoStore((s) => s.doc);
  const scale = usePhotoStore((s) => s.viewport.scale);
  const selection = usePhotoStore((s) => s.selection);
  const cropRect = usePhotoStore((s) => s.cropRect);

  // 父组件每次渲染都会传入新函数：用 ref 承接，避免它进入副作用依赖导致 Stage 反复重建
  const onRuntimeFailureRef = useRef(onRuntimeFailure);
  onRuntimeFailureRef.current = onRuntimeFailure;
  const onCursorMoveRef = useRef(onCursorMove);
  onCursorMoveRef.current = onCursorMove;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    const applyTransform = () => {
      const handle = handleRef.current;
      const host = canvasRef.current;
      if (!handle || !host) return;
      const state = usePhotoStore.getState();
      const fitted = computeFitScale(
        state.doc,
        { width: host.clientWidth, height: host.clientHeight },
        28,
      );
      // scale === 0 表示「尚未适配」：算一次 fit 并写回 store，工具栏即可显示真实比例
      const nextScale = state.viewport.scale > 0 ? state.viewport.scale : fitted;
      if (state.viewport.scale <= 0) state.setScale(nextScale);
      const x =
        state.viewport.x || Math.max(0, (host.clientWidth - state.doc.width * nextScale) / 2);
      const y =
        state.viewport.y || Math.max(0, (host.clientHeight - state.doc.height * nextScale) / 2);
      transformRef.current = { scale: nextScale, x, y };
      handle.setTransform({ scale: nextScale, x, y });
    };

    const syncNow = () => {
      const handle = handleRef.current;
      if (!handle) return;
      const state = usePhotoStore.getState();
      handle.renderBackground(state.doc);
      handle.sync(state.doc);
    };

    const closeEditor = () => {
      editorRef.current?.destroy();
      editorRef.current = null;
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
          fontSize: layer.fontSize,
          fontFamily: layer.fontFamily,
          fill: layer.fill,
          align: layer.align,
          bold: layer.bold,
          italic: layer.italic,
          lineHeight: layer.lineHeight,
        },
        {
          host: wrapper,
          transform: transformRef.current,
          onCommit: (layerId, text) => {
            usePhotoStore.getState().patchLayer(layerId, { text }, true);
            closeEditor();
            syncNow();
          },
        },
      );
    };

    const cleanupRefs: (() => void)[] = [];

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
      applyTransform();
      syncNow();

      const detach = attachPointer(canvas, handle, {
        getTransform: () => transformRef.current,
        onRequestTextEdit: (id) => startEditing(id),
        onSurfaceChange: () => {
          const current = handleRef.current;
          if (!current) return;
          const layer = usePhotoStore
            .getState()
            .doc.layers.find((item) => item.id === usePhotoStore.getState().doc.activeLayerId);
          if (layer) refreshLayerNode(current.contentLayer, layer);
          else current.contentLayer.batchDraw();
        },
      });
      cleanupRefs.push(detach);
    }, 0);

    const onPointerMoveForCursor = (event: PointerEvent) => {
      const host = canvasRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const transform = transformRef.current;
      const x = Math.round((event.clientX - rect.left - transform.x) / (transform.scale || 1));
      const y = Math.round((event.clientY - rect.top - transform.y) / (transform.scale || 1));
      onCursorMoveRef.current({ x, y });
    };
    const onPointerLeave = () => onCursorMoveRef.current(null);
    canvas.addEventListener('pointermove', onPointerMoveForCursor);
    canvas.addEventListener('pointerleave', onPointerLeave);

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        const host = canvasRef.current;
        const handle = handleRef.current;
        if (!handle || !host) return;
        handle.setSize(host.clientWidth, host.clientHeight);
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
  }, []);

  // 画布尺寸 / 缩放变化：只重设变换与背景，不重建节点
  useEffect(() => {
    const handle = handleRef.current;
    const host = canvasRef.current;
    if (!handle || !host) return;
    const state = usePhotoStore.getState();
    const fitted = computeFitScale(
      state.doc,
      { width: host.clientWidth, height: host.clientHeight },
      28,
    );
    const nextScale = state.viewport.scale > 0 ? state.viewport.scale : fitted;
    const x = state.viewport.x || Math.max(0, (host.clientWidth - state.doc.width * nextScale) / 2);
    const y =
      state.viewport.y || Math.max(0, (host.clientHeight - state.doc.height * nextScale) / 2);
    transformRef.current = { scale: nextScale, x, y };
    handle.setTransform({ scale: nextScale, x, y });
    handle.renderBackground(state.doc);
  }, [doc.width, doc.height, doc.background, scale]);

  // 文档变化（增删改图层 / 调整参数）：增量同步节点
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const state = usePhotoStore.getState();
    handle.sync(state.doc);
  }, [doc]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.setSelection(selection, transformRef.current.scale);
  }, [selection]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.setCropRect(cropRect, usePhotoStore.getState().doc, transformRef.current.scale);
  }, [cropRect]);

  return (
    <div
      ref={wrapperRef}
      className="photo-canvas-wrapper relative flex-1 overflow-hidden rounded-xl border border-gray-200 bg-[#0B1220] dark:border-gray-800"
    >
      <div ref={canvasRef} className="photo-stage" aria-label="photo canvas" />
    </div>
  );
}
