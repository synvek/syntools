import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { readZoom } from './imageLayer';
import { DEFAULT_SHAPE_SIZE } from './shapeNode';
import { drawRect, isClickGesture, toCanvasPx } from './shapeDraw';
import { hasOverlay } from '@/core/hooks/useOverlayStack';

interface ShapeDrawLayerProps {
  editor: Editor | null;
  /** 正在绘制的预设；null = 未进入绘制模式 */
  prst: string | null;
  /** 结束绘制模式（插入成功、按 Esc、点到画布外） */
  onDone: () => void;
  /** 拖拽预览落点提示（可选，用于显示"松开即插入"这类文案） */
  hint?: string;
}

interface Preview {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 拖拽绘制层（P3-1.7）：选中一个预设后，在纸面上按住并拉出矩形即可创建该尺寸的形状。
 *
 * 为什么不把指针事件挂到 ProseMirror 插件里：绘制期间文档并没有变化，只是需要一个覆盖层，
 * 组件卸载即彻底退出，不会留下挂在 view 上、忘记清理的监听器。
 *
 * 坐标只做一次换算：屏幕位移 / zoom = 画布像素；落点交给 `view.posAtCoords` 找回文档位置 ——
 * 形状是 inline 流的一部分，能精确到"哪个块之后"，不能精确到"第几像素"。
 */
export function ShapeDrawLayer({ editor, prst, onDone, hint }: ShapeDrawLayerProps) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const hintRef = useRef<string | undefined>(hint);
  hintRef.current = hint;

  useEffect(() => {
    if (!editor || !prst) return;
    const surface = editor.view.dom.closest('.rte-surface') as HTMLElement | null;
    if (!surface) return;

    let startX = 0;
    let startY = 0;
    let active = false;

    surface.classList.add('rte-shape-draw-mode');

    const cleanup = () => {
      active = false;
      setPreview(null);
      surface.classList.remove('rte-shape-draw-mode');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKeyDown);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // P0-4: a dialog / menu above owns Escape; drawing must not be cancelled underneath it
      if (hasOverlay()) return;
      event.preventDefault();
      cleanup();
      onDone();
    };

    const onPointerDown = (event: PointerEvent) => {
      // 只认主键；绘制期间不要触发文本选择或覆盖层拖拽
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      active = true;
      startX = event.clientX;
      startY = event.clientY;
      setPreview({ left: startX, top: startY, width: 0, height: 0 });
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    const onMove = (event: PointerEvent) => {
      if (!active) return;
      const rect = drawRect(startX, startY, event.clientX, event.clientY, 0);
      setPreview({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };

    const onUp = (event: PointerEvent) => {
      if (!active) return;
      const zoom = readZoom(surface);
      const dx = toCanvasPx(event.clientX - startX, zoom);
      const dy = toCanvasPx(event.clientY - startY, zoom);
      const coords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
      const pos = coords?.pos ?? editor.state.selection.from;
      const click = isClickGesture(dx, dy);

      cleanup();
      editor
        .chain()
        .focus()
        .insertDocShapeAt({
          prst,
          pos,
          width: click ? DEFAULT_SHAPE_SIZE.width : Math.round(Math.abs(dx)),
          height: click ? DEFAULT_SHAPE_SIZE.height : Math.round(Math.abs(dy)),
        })
        .run();
      onDone();
    };

    surface.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      surface.removeEventListener('pointerdown', onPointerDown, true);
      surface.classList.remove('rte-shape-draw-mode');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [editor, prst, onDone]);

  if (!prst) return null;

  return (
    <>
      {preview ? (
        <div
          data-testid="rich-text-shape-draw-preview"
          className="pointer-events-none fixed z-50 border-2 border-dashed border-blue-500 bg-blue-500/10"
          style={{
            left: `${preview.left}px`,
            top: `${preview.top}px`,
            width: `${preview.width}px`,
            height: `${preview.height}px`,
          }}
        />
      ) : null}
      {hintRef.current ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900/90 px-3 py-1.5 text-xs text-white shadow-lg">
          {hintRef.current}
        </div>
      ) : null}
    </>
  );
}
