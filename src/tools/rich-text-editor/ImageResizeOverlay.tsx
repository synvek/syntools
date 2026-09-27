import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { findSelectedImage, readZoom } from './imageLayer';

/**
 * 图片缩放手柄：选中图片后，四角 + 四边中点共 8 个手柄，拖动等比调整尺寸。
 *
 * 采用「React 覆盖层」而非 ProseMirror NodeView：
 * - 不需要重写图片的 DOM 渲染（导出、层级样式、分页测量都依赖原生 <img> 结构）；
 * - 覆盖层是滚动容器的子元素，坐标按「内容坐标系」计算，滚动时自动跟随，无需监听滚动。
 */

/** 手柄方位：四角 + 四边中点 */
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type HandleDirection = (typeof HANDLES)[number];

const MIN_WIDTH = 24;
const MAX_WIDTH = 4000;

interface ImageBox {
  /** 图片节点在文档中的位置 */
  pos: number;
  /** 覆盖层坐标（滚动容器内容坐标系） */
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ImageResizeOverlayProps {
  editor: Editor | null;
  /** 编辑工作区（滚动容器），覆盖层挂在它下面 */
  viewportRef: RefObject<HTMLDivElement | null>;
}

/** 计算选中图片的覆盖层坐标；未选中图片时返回 null */
function measure(editor: Editor, viewport: HTMLElement): ImageBox | null {
  const found = findSelectedImage(editor.state);
  if (!found) return null;
  const dom = editor.view.nodeDOM(found.pos) as HTMLElement | null;
  if (!dom || dom.nodeType !== 1) return null;
  const rect = dom.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const viewportRect = viewport.getBoundingClientRect();
  // 覆盖层在缩放层之外，坐标与尺寸都要从「屏幕像素」还原为「布局像素」
  const zoom = readZoom(dom);
  return {
    pos: found.pos,
    left: (rect.left - viewportRect.left) / zoom + viewport.scrollLeft,
    top: (rect.top - viewportRect.top) / zoom + viewport.scrollTop,
    width: rect.width / zoom,
    height: rect.height / zoom,
  };
}

/** 拖动方向 → 宽高增量（等比缩放，以宽度为基准） */
function nextWidth(
  direction: HandleDirection,
  dx: number,
  dy: number,
  start: number,
  ratio: number,
) {
  switch (direction) {
    case 'e':
    case 'ne':
    case 'se':
      return start + dx;
    case 'w':
    case 'nw':
    case 'sw':
      return start - dx;
    case 's':
      // 上下边中点：竖向位移按宽高比换算成宽度增量
      return start + dy / ratio;
    case 'n':
      return start - dy / ratio;
    default:
      return start;
  }
}

export function ImageResizeOverlay({ editor, viewportRef }: ImageResizeOverlayProps) {
  const [box, setBox] = useState<ImageBox | null>(null);

  const refresh = useCallback(() => {
    const viewport = viewportRef.current;
    if (!editor || !viewport) {
      setBox(null);
      return;
    }
    setBox(measure(editor, viewport));
  }, [editor, viewportRef]);

  useEffect(() => {
    if (!editor) return;
    refresh();
    // 选区/文档变化、图片加载完成、窗口尺寸变化都要重算
    editor.on('transaction', refresh);
    editor.on('selectionUpdate', refresh);
    window.addEventListener('resize', refresh);
    const viewport = viewportRef.current;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refresh);
    if (observer && viewport) observer.observe(viewport);
    if (observer) observer.observe(editor.view.dom);
    editor.view.dom.addEventListener('load', refresh, true);
    return () => {
      editor.off('transaction', refresh);
      editor.off('selectionUpdate', refresh);
      window.removeEventListener('resize', refresh);
      observer?.disconnect();
      editor.view.dom.removeEventListener('load', refresh, true);
    };
  }, [editor, refresh, viewportRef]);

  const startResize = (event: React.MouseEvent, direction: HandleDirection) => {
    if (!editor || !box) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = box.width;
    const ratio = box.height > 0 ? box.height / box.width : 1;
    // 屏幕位移 → 布局像素；上限取正文内容宽度（与工具栏 100% 预设一致）
    const zoom = readZoom(editor.view.dom);
    const maxWidth = Math.min(MAX_WIDTH, Math.max(editor.view.dom.clientWidth || 1, MIN_WIDTH * 2));
    const pos = box.pos;
    let current = startWidth;

    const apply = (width: number, history: boolean): void => {
      const node = editor.state.doc.nodeAt(pos);
      if (!node || node.type.name !== 'image') return;
      const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        width: Math.round(width),
      });
      if (!history) tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    };

    const onMove = (moveEvent: MouseEvent): void => {
      const raw = nextWidth(
        direction,
        (moveEvent.clientX - startX) / zoom,
        (moveEvent.clientY - startY) / zoom,
        startWidth,
        ratio,
      );
      current = Math.min(maxWidth, Math.max(MIN_WIDTH, raw));
      apply(current, false);
    };

    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (Math.round(current) === Math.round(startWidth)) return;
      // 拖动过程不进历史，松手时合并为一步可撤销操作
      apply(startWidth, false);
      apply(current, true);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (!box) return null;

  return (
    <div
      className="rte-image-frame"
      style={{
        top: `${box.top}px`,
        left: `${box.left}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      }}
      aria-hidden="true"
    >
      {HANDLES.map((direction) => (
        <span
          key={direction}
          data-handle={direction}
          className={`rte-image-handle rte-image-handle--${direction}`}
          onMouseDown={(event) => startResize(event, direction)}
        />
      ))}
    </div>
  );
}
