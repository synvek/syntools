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
import { bakeKeyOf } from '../render/nodes';
import { refreshLayerNode } from '../render/sync';
import { usePhotoStore } from '../store';
import { CanvasOverlay } from './CanvasOverlay';
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
function markTransform(
  host: HTMLElement,
  transform: { scale: number; x: number; y: number; rotation?: number },
) {
  host.dataset.transform = `${transform.scale.toFixed(4)},${Math.round(transform.x)},${Math.round(transform.y)}`;
  // 旋转单独放一个属性：`data-transform` 的格式被既有 e2e 断言依赖，不能改
  if (transform.rotation) host.dataset.viewRotation = String(transform.rotation);
  else delete host.dataset.viewRotation;
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

/**
 * 组装一次覆盖层绘制所需的全部状态。
 *
 * 抽成模块级函数的原因：React 副作用与「像素变化后的合帧刷新」（画笔改写快速蒙版）两条路径
 * 都要重画覆盖层，两处若各写一份，很容易出现「加了新覆盖物只更新了一边」的漏改。
 */
function buildOverlayState(scale: number): OverlayState {
  const state = usePhotoStore.getState();
  const active = state.doc.layers.find((item) => item.id === state.doc.activeLayerId);
  // 变换框与网格控制点由「图层 + 变换模式」决定，交互层用同一函数算，两边不会出现不一致
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
    // 取样源标记只在与「取样点」相关的工具下显示，避免长期占据画面
    cloneSource: needsCloneSource(state.tool) ? state.cloneSource : null,
    snapGuides: state.snapGuides,
    // 渐变示意由交互层按需覆盖（本组件只负责「清干净」）
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
  /** 新建文字图层的默认内容（当前语言） */
  defaultText: string;
}) {
  const { t } = useTranslation();
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

  /** 把「未旋转的视口」写到画布上：图层位置经旋转换算，`transformRef` 始终保留未旋转值 */
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
    const rotation = state.viewRotation;
    const prev = transformRef.current;
    let nextScale = state.viewport.scale;
    let x = state.viewport.x;
    let y = state.viewport.y;

    if (nextScale <= 0) {
      // 待适配：算出比例并居中，一次写回 store（此后 x / y 就是权威值，不再用「0 即未设置」的隐式约定）
      nextScale = computeFitScale(state.doc, { width, height }, FIT_PADDING, rotation);
      // 居中要按「旋转后的外接框」算，否则旋转视图下画布会偏出视口
      const bounds = rotatedDocBounds(state.doc, rotation);
      x = Math.max(0, (width - bounds.width * nextScale) / 2);
      y = Math.max(0, (height - bounds.height * nextScale) / 2);
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

  /** 抓手平移：直接把变换写进画布，不等 React 渲染（平移是高频连续操作） */
  const applyPan = useCallback(
    (x: number, y: number) => {
      transformRef.current = { ...transformRef.current, x, y };
      pushTransform(usePhotoStore.getState().viewRotation);
    },
    [pushTransform],
  );

  /** 应用视口（平移 + 缩放）：立即落画布并写回 store，滚动条随之更新 */
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
          viewSize: { width: wrapper.clientWidth, height: wrapper.clientHeight },
          viewRotation: usePhotoStore.getState().viewRotation,
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
      // 画笔也可能改写「快速蒙版」这类非图层内容，这里顺带把覆盖层合到同一帧（节点数很少）
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
  }, [doc.width, doc.height, doc.background, scale, viewRotation, applyTransform]);

  // 文档变化（增删改图层 / 调整参数）：增量同步节点
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const state = usePhotoStore.getState();
    handle.sync(state.doc);
  }, [doc]);

  /**
   * 异步全分辨率烘焙完成：把结果写回烘焙缓存并重绘。
   *
   * 只在「当前文档确实还需要这个签名」时才接受 —— 预热任务是防抖后触发的，
   * 期间用户可能已经撤销 / 改参数 / 落笔改像素，旧签名的结果写进缓存会让
   * 之后（例如撤销回同一 rev）取到与签名不符的像素。
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
   * 通道隔离视图（显示态）：合成分离通道图覆盖到画布，并隐藏图层栈；
   * 回到 `rgb` 时恢复。只改显示、不动文档，因此不进历史。
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

  // 覆盖层（选区 / 裁剪框 / 自由变换框）：三者在同一次绘制里重画，避免互相清空
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
