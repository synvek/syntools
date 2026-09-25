import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { GRID_SIZE } from '../core';
import { useBoardPointer } from '../interaction';
import { TEXT_FONT_FAMILY, clearStage, drawOps } from '../render';
import { useBoardStore } from '../store';

/**
 * 画布舞台：CSS 背景层 + 内容 canvas + 文字输入覆盖层。
 *
 * 背景（纯色 / 网格 / 透明棋盘格）完全交给 CSS：既省一层画布，
 * 又让画布自身保持透明 —— 橡皮因此可以用 `destination-out` 做真正的擦除。
 * 内容缩放只改变 stage 的 CSS 尺寸，canvas 的像素分辨率保持不变，
 * 指针坐标通过 `getBoundingClientRect` 换算，因此任意缩放下落笔都精准。
 */
export default function BoardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const pointer = useBoardPointer(canvasRef);

  const scene = useBoardStore((s) => s.scene);
  const tool = useBoardStore((s) => s.tool);
  const textSize = useBoardStore((s) => s.textSize);
  const brushColor = useBoardStore((s) => s.brush.color);
  const zoom = useBoardStore((s) => s.zoom);
  const collapsed = useBoardStore((s) => s.collapsed);
  const details = useBoardStore((s) => s.details);
  const applyFitSize = useBoardStore((s) => s.applyFitSize);
  const setViewScale = useBoardStore((s) => s.setViewScale);

  const [available, setAvailable] = useState(0);
  const [editor, setEditor] = useState<{ x: number; y: number; value: string } | null>(null);

  // `fit` 跟随容器宽度（不放大，避免小画布被拉伸）；数值缩放则固定倍率
  const scale = available > 0 ? (zoom === 'fit' ? Math.min(1, available / scene.width) : zoom) : 0;
  const overflowing = available > 0 && scene.width * scale > available + 1;

  // 工具栏越精简，画布允许越高：收起细条 / 关闭更多设置时把空间还给画布
  const stageHeightClass = collapsed ? 'max-h-[88vh]' : details ? 'max-h-[64vh]' : 'max-h-[78vh]';

  // 缩放控件在工具栏里，倍率由此处测算后回填
  useEffect(() => {
    if (scale > 0) setViewScale(scale);
  }, [scale, setViewScale]);

  /** 整幅重绘：尺寸 / DPR / 历史变化时调用 */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const current = useBoardStore.getState().scene;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(current.width * dpr));
    canvas.height = Math.max(1, Math.round(current.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    clearStage(ctx);
    drawOps(ctx, current);
  }, []);

  useEffect(() => {
    const node = measureRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (width > 0) setAvailable(width);
    });
    observer.observe(node);
    if (node.clientWidth > 0) setAvailable(Math.floor(node.clientWidth));
    return () => observer.disconnect();
  }, []);

  // 自适应预设：按可用宽度同步画布尺寸（不写历史）
  useEffect(() => {
    if (available > 0) applyFitSize(available);
  }, [available, applyFitSize]);

  // scene 身份变化 = 落笔 / 撤销 / 重做 / 清空 / 改尺寸 / 整体移动：整幅重绘，
  // 保证「屏幕上看到的」与「导出的」严格一致（落笔过程中只在快照上增量预览）。
  useEffect(() => {
    if (scale > 0) render();
  }, [scene, scale, render]);

  const backgroundStyle = useMemo(() => {
    const { kind, color } = scene.background;
    if (kind === 'grid') {
      const size = Math.max(6, GRID_SIZE * scale);
      return {
        backgroundColor: color,
        backgroundImage:
          'linear-gradient(to right, rgba(100, 116, 139, 0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(100, 116, 139, 0.28) 1px, transparent 1px)',
        backgroundSize: `${size}px ${size}px`,
      };
    }
    if (kind === 'transparent') {
      return {
        backgroundColor: '#ffffff',
        backgroundImage:
          'linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%), linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 8px 8px',
      };
    }
    return { backgroundColor: color };
  }, [scene.background, scale]);

  const cancelledRef = useRef(false);

  const commitText = () => {
    if (!editor) return;
    const { x, y, value } = editor;
    setEditor(null);
    // Esc 取消：置位标记后关闭输入框，避免随后的 blur 又把内容提交上去
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const text = value.trim();
    if (!text) return;
    const state = useBoardStore.getState();
    state.addOp({
      kind: 'text',
      x,
      y,
      text,
      size: state.textSize,
      color: state.brush.color,
      opacity: state.brush.opacity,
    });
    // addOp 不触发舞台重绘（一笔一画的中间状态不重绘），这里主动补一次
    render();
  };

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (useBoardStore.getState().tool !== 'text') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const current = useBoardStore.getState().scene;
    cancelledRef.current = false;
    setEditor({
      x: ((e.clientX - rect.left) / rect.width) * current.width,
      y: ((e.clientY - rect.top) / rect.height) * current.height,
      value: '',
    });
  };

  const cursorClass =
    tool === 'text'
      ? 'cursor-text'
      : tool === 'move'
        ? 'cursor-move'
        : tool === 'picker'
          ? 'cursor-copy'
          : 'cursor-crosshair';

  return (
    <div className="overflow-hidden rounded-xl border border-gray-300 bg-slate-100 transition-colors duration-150 dark:border-gray-700 dark:bg-gray-950">
      <div className={`${stageHeightClass} overflow-auto`}>
        <div
          ref={measureRef}
          className={`flex w-full items-center p-2 ${overflowing ? 'justify-start' : 'justify-center'}`}
        >
          {/* 尺寸不做过渡：绘制过程中尺寸动画会让指针坐标与画布错位 */}
          <div
            className="relative ring-1 ring-black/5 dark:ring-white/10"
            style={{ ...backgroundStyle, width: scene.width * scale, height: scene.height * scale }}
          >
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 h-full w-full touch-none select-none ${cursorClass}`}
              onClick={handleClick}
              {...pointer}
            />
            {editor ? (
              <textarea
                autoFocus
                rows={1}
                value={editor.value}
                onChange={(e) => setEditor({ ...editor, value: e.target.value })}
                onBlur={commitText}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelledRef.current = true;
                    setEditor(null);
                  } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    commitText();
                  }
                }}
                className="absolute z-10 resize-none overflow-hidden rounded border border-blue-400 bg-white/70 p-0 outline-none transition-colors duration-150 dark:bg-gray-900/70"
                style={{
                  left: editor.x * scale,
                  top: editor.y * scale,
                  width: '14em',
                  height: 1.25 * textSize * scale,
                  fontSize: textSize * scale,
                  lineHeight: 1.25,
                  color: brushColor,
                  fontFamily: TEXT_FONT_FAMILY,
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
