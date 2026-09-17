import { useCallback, useEffect, useRef } from 'react';
import { fitScale } from '../core';
import type { StageCallbacks, TransformChange } from '../interaction/pointer';
import { createStage, type StageHandle } from '../render/stage';
import { openTextEditor, type TextEditorHandle } from '../render/textEditor';
import { useSlideStore } from '../store';
import type { SlideElement } from '../model/types';

/**
 * 画布宿主：命令式托管 Konva Stage。
 *
 * 三条约定：
 * 1. Stage 延后一拍创建，规避 React 18 StrictMode 双挂载（与 Univer 宿主一致）；
 * 2. 拖拽 / 缩放过程中禁止回写 store → 避免整页重建把正在拖的节点销毁；
 * 3. 双击文本元素 → 挂载 DOM textarea 叠加层做行内编辑。
 */
export function SlideCanvas({ onRuntimeFailure }: { onRuntimeFailure: () => void }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<StageHandle | null>(null);
  const editorRef = useRef<TextEditorHandle | null>(null);
  const draggingRef = useRef(false);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });

  // onRuntimeFailure 由父组件每次渲染传入新函数，用 ref 承接，避免它进入副作用依赖，
  // 否则每次渲染都会销毁并重建整个 Konva Stage（正在拖拽的元素会被一并销毁）。
  const onRuntimeFailureRef = useRef(onRuntimeFailure);
  onRuntimeFailureRef.current = onRuntimeFailure;

  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const selection = useSlideStore((s) => s.selection);
  const scale = useSlideStore((s) => s.viewport.scale);
  const showPlaceholders = useSlideStore((s) => s.showPlaceholders);

  const applyTransform = useCallback(() => {
    const canvas = canvasRef.current;
    const handle = handleRef.current;
    if (!canvas || !handle) return;
    const state = useSlideStore.getState();
    // scale === 0 表示「尚未适配」：按容器尺寸算一次 fit 并写回 store，工具栏即可显示真实比例
    const fitted = fitScale(
      state.doc,
      { width: canvas.clientWidth, height: canvas.clientHeight },
      24,
    );
    const nextScale = state.viewport.scale > 0 ? state.viewport.scale : fitted;
    if (state.viewport.scale <= 0) state.setScale(nextScale);
    const x = Math.max(0, (canvas.clientWidth - state.doc.width * nextScale) / 2);
    const y = Math.max(0, (canvas.clientHeight - state.doc.height * nextScale) / 2);
    transformRef.current = { scale: nextScale, x, y };
    handle.setTransform({ scale: nextScale, x, y });
  }, []);

  const syncNow = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const state = useSlideStore.getState();
    const slide = state.doc.slides[state.slideIndex];
    if (!slide) return;
    const layout = state.doc.layouts.find((item) => item.id === slide.layoutId);
    const master = layout
      ? state.doc.masters.find((item) => item.id === layout.masterId)
      : undefined;
    // 母版/版式只作几何参考：PowerPoint 普通视图不会显示占位符的提示文案，这里同样去掉文字
    const inherited = state.showPlaceholders
      ? [...(master?.elements ?? []), ...(layout?.elements ?? [])].map(stripPlaceholderText)
      : [];
    handle.renderBackground(state.doc, inherited);
    handle.sync(slide.elements, state.doc);
    // 同步会按 id 重建文本/形状/表格节点（这些类型不走属性快路径），
    // Transformer 仍指向被销毁的旧节点，需按当前选中集合重新挂载，否则拖拽后
    // 旋转手柄错位、放缩手柄消失。
    handle.setSelection(state.selection);
  }, []);

  const closeEditor = useCallback(() => {
    editorRef.current?.destroy();
    editorRef.current = null;
  }, []);

  const startEditing = useCallback(
    (id: string) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const state = useSlideStore.getState();
      const element = state.doc.slides[state.slideIndex]?.elements.find((item) => item.id === id);
      const body =
        element?.type === 'text'
          ? element.body
          : element?.type === 'shape'
            ? element.body
            : undefined;
      if (!element || !body) return;
      closeEditor();
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
          onCommit: (elementId, nextBody) => {
            useSlideStore.getState().patchElement(elementId, { body: nextBody } as never);
            closeEditor();
            syncNow();
          },
        },
      );
    },
    [closeEditor, syncNow],
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
      onTransformEnd: (change: TransformChange) => {
        const state = useSlideStore.getState();
        const target = state.selection[state.selection.length - 1];
        draggingRef.current = false;
        if (target) state.patchElement(target, change as never, false);
        syncNow();
      },
      onBackgroundClick: () => {
        closeEditor();
        useSlideStore.getState().select([]);
      },
      onTextEdit: (id) => startEditing(id),
      getSnapContext: () => {
        const state = useSlideStore.getState();
        const slide = state.doc.slides[state.slideIndex];
        const others = (slide?.elements ?? [])
          .filter((element) => !state.selection.includes(element.id))
          .map((element) => ({
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
          }));
        return { page: { width: state.doc.width, height: state.doc.height }, others };
      },
      getSelection: () => useSlideStore.getState().selection,
    };

    // 延后一拍实例化：StrictMode 下 effect 会挂载→卸载→再挂载
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
      observer?.disconnect();
      closeEditor();
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [applyTransform, closeEditor, startEditing, syncNow]);

  useEffect(() => {
    applyTransform();
  }, [applyTransform, doc.width, doc.height, scale]);

  useEffect(() => {
    if (draggingRef.current) return;
    syncNow();
  }, [doc, slideIndex, showPlaceholders, syncNow]);

  useEffect(() => {
    handleRef.current?.setSelection(selection);
  }, [selection]);

  return (
    <div ref={wrapperRef} className="relative min-h-[360px] flex-1 overflow-hidden">
      <div ref={canvasRef} className="slide-stage" aria-label="slide canvas" />
    </div>
  );
}

/** 去掉占位符元素上的提示文字，仅保留几何与填充（避免母版提示语干扰画布） */
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
