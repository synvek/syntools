import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/core/components/Icon';
import type { ToolId } from '../model/types';

export interface ToolFlyoutItem {
  id: ToolId;
  icon: string;
  label: string;
  shortcut: string;
}

/**
 * 工具组浮层：**再次点击已选中的工具按钮**时弹出（Photoshop / Photopea 的组选择器）。
 *
 * 与「角标按钮」的区别：工具箱按钮右下角的小三角只是「这一行还有同族工具」的图标，
 * 不是可点的第二颗按钮；打开浮层的唯一入口是重复点击当前工具按钮本身。
 *
 * 浮层走 portal + fixed 定位：工具箱自己会滚动（`overflow-y-auto`），
 * 就地 absolute 会被裁剪；打开期间滚动 / 缩放 / 点外部 / Esc 都会关闭。
 */
export function ToolFlyout({
  anchor,
  label,
  items,
  activeId,
  prefer = 'right',
  onPick,
  onClose,
}: {
  /** 浮层的定位锚点（当前工具按钮） */
  anchor: HTMLElement;
  label: string;
  items: ToolFlyoutItem[];
  /** 当前工具：在列表里高亮，并在打开时获得焦点 */
  activeId: ToolId;
  /** 竖排工具箱放右侧，窄屏横向工具箱放下方 */
  prefer?: 'right' | 'bottom';
  onPick: (id: ToolId) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const rect = anchor.getBoundingClientRect();
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const available = document.documentElement.clientWidth;
      const maxLeft = Math.max(8, available - width - 8);
      let left: number;
      let top: number;
      if (prefer === 'bottom') {
        // 横向工具箱：贴在按钮下方并水平钳制，避免盖住同一行其它按钮
        left = Math.min(Math.max(8, rect.left), maxLeft);
        top = rect.bottom + 8;
      } else {
        // 竖排工具箱：贴在按钮右侧；右侧放不下就翻到左侧
        left = rect.right + 8;
        if (left > maxLeft) left = Math.max(8, rect.left - width - 8);
        top = rect.top;
      }
      top = Math.min(Math.max(8, top), Math.max(8, window.innerHeight - height - 8));
      setPosition((prev) =>
        prev && prev.top === top && prev.left === left ? prev : { top, left },
      );
    };
    place();
    // 首帧量不到尺寸：下一帧校正，位置算好前面板不可见
    const raf = requestAnimationFrame(place);

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      // 锚点按钮自己负责「再点关闭」，这里不能抢先关掉再让按钮重新打开
      if (anchor.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', place);
    // 滚动会让 fixed 坐标失效，直接关闭比留着错位菜单更好
    window.addEventListener('scroll', onClose, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [anchor, onClose, prefer]);

  // 首帧面板还是 hidden（位置未算出），此时 focus() 不会生效；等位置就绪再聚焦当前工具
  useEffect(() => {
    if (!position) return;
    activeRef.current?.focus({ preventScroll: true });
  }, [position]);

  /** ↑↓ / Home / End 在选项间移动焦点（菜单的标准键盘行为） */
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(
      panelRef.current?.querySelectorAll<HTMLButtonElement>('[data-tool]') ?? [],
    );
    if (buttons.length === 0) return;
    event.preventDefault();
    const index = buttons.findIndex((button) => button === document.activeElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : event.key === 'ArrowDown'
            ? (index + 1 + buttons.length) % buttons.length
            : (index - 1 + buttons.length) % buttons.length;
    buttons[next].focus();
  };

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label={label}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        // 位置算好前先隐藏（layout effect 会在绘制前补上，看不到中间态）
        visibility: position ? 'visible' : 'hidden',
        maxHeight: 'calc(100vh - 1rem)',
      }}
      className="z-[60] min-w-40 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            ref={active ? activeRef : undefined}
            type="button"
            role="menuitem"
            data-tool={item.id}
            aria-label={item.label}
            onClick={() => {
              onPick(item.id);
              onClose();
            }}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] outline-none transition-colors ${
              active
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'text-gray-700 hover:bg-gray-100 focus-visible:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 dark:focus-visible:bg-gray-800'
            }`}
          >
            <Icon name={item.icon} className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
            <span className="ml-auto shrink-0 font-mono text-[10px] text-gray-400 dark:text-gray-500">
              {item.shortcut}
            </span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
