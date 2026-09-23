import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clampScale,
  clampViewport,
  computeFitScale,
  viewportFromScroll,
  zoomAtPoint,
} from '../core';
import { attachPointer, type PickedColor } from '../interaction/pointer';
import { openTextEditor, type TextEditorHandle } from '../render/textEditor';
import { createStage, type StageHandle } from '../render/stage';
import { refreshLayerNode } from '../render/sync';
import { usePhotoStore } from '../store';
import { CanvasScrollbars } from './CanvasScrollbars';

/**
 * 画布宿主：命令式托管 Konva Stage。
 *
 * 三条约定（与 slide-editor 的 SlideCanvas 一致）：
 * 1. Stage 延后一拍创建，规避 React 18 StrictMode 双挂载；
 * 2. 容器原生事件负责交互（Konva 节点 listening: false），统一做「屏幕 → 文档」坐标换算；
 * 3. 双击文字图层 → 叠一个 DOM textarea 做就地编辑。
 */
/** 视口变换落到 DOM 属性上：便于 e2e 断言缩放 / 平移 */
function markTransform(host: HTMLElement, transform: { scale: number; x: number; y: number }) {
  host.dataset.transform = `${transform.scale.toFixed(4)},${Math.round(transform.x)},${Math.round(transform.y)}`;
}

/** 适配时四周留白 */
const FIT_PADDING = 28;
/** 滚轮滚动的位移系数（与 React Flow 的 panOnScrollSpeed 对齐） */
const SCROLL_SPEED = 0.9;

/** 容器尺寸（未布局完成时回退为 0，交由守卫处理） */
function hostSize(host: HTMLElement | null): { width: number; height: number } {
  return { width: host?.clientWidth ?? 0, height: host?.clientHeight ?? 0 };
}

/** 判定类 Mac 平台：用于 Shift+滚轮 / ⌘+滚轮 的差异化处理 */
function isMacLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}
/** 容器小于此尺寸视为「尚未完成布局」，不参与适配计算 */
const MIN_HOST_SIZE = 64;

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
  /** 新建文字图层的默认内容（当前语言） */
  defaultText: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<StageHandle | null>(null);
  const editorRef = useRef<TextEditorHandle | null>(null);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  /** 视口像素尺寸：滚动条几何依赖它，由 ResizeObserver 同步 */
  const [hostRect, setHostRect] = useState({ width: 0, height: 0 });

  const doc = usePhotoStore((s) => s.doc);
  const tool = usePhotoStore((s) => s.tool);
  const scale = usePhotoStore((s) => s.viewport.scale);
  const selection = usePhotoStore((s) => s.selection);
  const cropRect = usePhotoStore((s) => s.cropRect);

  // 父组件每次渲染都会传入新函数：用 ref 承接，避免它进入副作用依赖导致 Stage 反复重建
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

  /**
   * 应用视口变换（挂载、容器尺寸变化、用户缩放共用同一份逻辑）。
   * - `scale === 0` 是「待适配」哨兵值：按容器算一次 fit **并写回 store**，工具栏才显示真实比例；
   * - 容器尚未完成布局（宽或高过小）时直接放弃，等 ResizeObserver 下一次回调再算，
   *   避免把「0 尺寸下算出的极小比例」当成用户缩放固定下来。
   */
  const applyTransform = useCallback(() => {
    const handle = handleRef.current;
    const host = canvasRef.current;
    if (!handle || !host) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width < MIN_HOST_SIZE || height < MIN_HOST_SIZE) return;

    const state = usePhotoStore.getState();
    const prev = transformRef.current;
    let nextScale = state.viewport.scale;
    let x = state.viewport.x;
    let y = state.viewport.y;

    if (nextScale <= 0) {
      // 待适配：算出比例并居中，一次写回 store（此后 x / y 就是权威值，不再用「0 即未设置」的隐式约定）
      nextScale = computeFitScale(state.doc, { width, height }, FIT_PADDING);
      x = Math.max(0, (width - state.doc.width * nextScale) / 2);
      y = Math.max(0, (height - state.doc.height * nextScale) / 2);
      state.setScale(nextScale);
      state.setViewport({ x, y });
    } else if (prev.scale > 0 && Math.abs(prev.scale - nextScale) > 0.0005) {
      // 用户缩放：保持视口中心对应的文档坐标不变（否则每次缩放都会往左上角跑）
      const centerX = (width / 2 - prev.x) / prev.scale;
      const centerY = (height / 2 - prev.y) / prev.scale;
      x = width / 2 - centerX * nextScale;
      y = height / 2 - centerY * nextScale;
      state.setViewport({ x, y });
    }

    // 统一钳制进可滚动世界：滚动条滑块位置与画布内容才始终对得上
    const bounded = clampViewport({ x, y, scale: nextScale }, state.doc, { width, height });
    transformRef.current = { scale: nextScale, ...bounded };
    handle.setTransform(transformRef.current);
    markTransform(host, transformRef.current);
  }, []);

  /** 抓手平移：直接把变换写进画布，不等 React 渲染（平移是高频连续操作） */
  const applyPan = useCallback((x: number, y: number) => {
    const handle = handleRef.current;
    const host = canvasRef.current;
    if (!handle) return;
    transformRef.current = { ...transformRef.current, x, y };
    handle.setTransform(transformRef.current);
    if (host) markTransform(host, transformRef.current);
  }, []);

  /** 应用视口（平移 + 缩放）：立即落画布并写回 store，滚动条随之更新 */
  const applyViewport = useCallback((next: { scale: number; x: number; y: number }) => {
    const handle = handleRef.current;
    const host = canvasRef.current;
    const state = usePhotoStore.getState();
    const scale = clampScale(next.scale);
    const bounded = clampViewport({ x: next.x, y: next.y, scale }, state.doc, hostSize(host));
    if (state.viewport.scale !== scale) state.setScale(scale);
    state.setViewport(bounded);
    transformRef.current = { scale, ...bounded };
    handle?.setTransform(transformRef.current);
    if (host) markTransform(host, transformRef.current);
  }, []);

  /** 滚动条拖动 / 点轨道：世界坐标 → 视口平移 */
  const scrollTo = useCallback(
    (left: number, top: number) => {
      const state = usePhotoStore.getState();
      const scale = state.viewport.scale > 0 ? state.viewport.scale : 1;
      applyViewport({ scale, ...viewportFromScroll(left, top, scale) });
    },
    [applyViewport],
  );

  /**
   * 滚轮（对齐流程图编辑器的行为）：
   * - 普通滚轮 = 上下/左右滚动（Shift + 滚轮在非 Mac 上转成横向）；
   * - Ctrl / ⌘ + 滚轮 = 以光标为锚点缩放。
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
        // 指数步进：一格滚轮（约 100px）≈ 15%，单次最多 2 倍，避免一档就顶到上限
        const exponent = Math.max(
          -1,
          Math.min(1, -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002)),
        );
        applyViewport(
          zoomAtPoint(
            { x: state.viewport.x, y: state.viewport.y, scale },
            scale * Math.pow(2, exponent),
            pointer,
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

    /**
     * 像素变化后的重绘：用 rAF 合帧。
     * 落笔时 pointermove 可能一帧来好几次，逐次重烘焙（含卷积滤镜）会掉帧；
     * 合到每帧一次既保证「边画边显示」，又把成本压在 1 次烘焙 / 帧。
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
      const transform = transformRef.current;
      const x = Math.round((event.clientX - rect.left - transform.x) / (transform.scale || 1));
      const y = Math.round((event.clientY - rect.top - transform.y) / (transform.scale || 1));
      onCursorMoveRef.current({ x, y });
    };
    const onPointerLeave = () => onCursorMoveRef.current(null);
    canvas.addEventListener('pointermove', onPointerMoveForCursor);
    canvas.addEventListener('pointerleave', onPointerLeave);
    // passive: false —— 需要 preventDefault 阻止浏览器整页滚动 / 缩放
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

  // 光标随工具变化（CSS 里按 data-tool 匹配），让「当前工具」在画布上也有反馈
  useEffect(() => {
    const host = canvasRef.current;
    if (host) host.dataset.tool = tool;
  }, [tool]);

  // 画布尺寸 / 背景 / 缩放变化：只重设变换与背景，不重建节点
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    applyTransform();
    handle.renderBackground(usePhotoStore.getState().doc);
  }, [doc.width, doc.height, doc.background, scale, applyTransform]);

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
      <CanvasScrollbars width={hostRect.width} height={hostRect.height} onScrollTo={scrollTo} />
    </div>
  );
}
