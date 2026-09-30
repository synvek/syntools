import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/core/components/Icon';

/**
 * 工具栏下拉菜单按钮。
 *
 * 存在原因：形状库有 6 种、对齐有 6 种、翻转有 2 种，全部平铺会让工具栏
 * 又宽又杂（也是「同组里有的按钮有文字、有的没有」的根源）。
 * 收成下拉后，插入/排列两组内部都能保持统一的按钮形态。
 *
 * 菜单用 portal 挂到 body：工具栏每一行都是独立的层叠上下文（slide-glass 的毛玻璃），
 * 如果就地 absolute 定位，展开的菜单会被下一行工具栏盖住并拦截点击。
 */

export interface MenuItem {
  key: string;
  label: string;
  /** 可选的前置图形（如形状缩略图） */
  glyph?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export function MenuButton({
  label,
  icon,
  glyph,
  items = [],
  panel,
  triggerContent,
  disabled,
  /** 触发器尺寸：与所在行保持一致 */
  size = 'sm',
  /**
   * 是否显示文字标签。工具栏以图标为主（文字走 tooltip），只有少数「分类入口」类下拉
   * （形状 / 对齐 / 分布 / 翻转）显示文字更易懂，其余保持图标 + 箭头。
   */
  showLabel = false,
  className = '',
  panelClassName = 'min-w-max p-1',
}: {
  label: string;
  /** 共享 Icon 集里的图标名 */
  icon?: string;
  /** 自定义图形（优先于 icon），用于工具专属图标 */
  glyph?: ReactNode;
  items?: MenuItem[];
  /**
   * 自定义面板内容。给出时替代 `items` 列表渲染（色板这类非菜单结构用），
   * 定位、外部点击关闭、Esc 关闭等行为与菜单完全一致。
   *
   * 传函数时会把 `close` 交给调用方 —— 面板内的点击不会触发「点击外部关闭」，
   * 因此色板这类「选完即收」的交互必须自己调用。
   */
  panel?: ReactNode | ((close: () => void) => ReactNode);
  /** 自定义触发器内容（优先于 icon/glyph/label），用于色块这类非文字触发器 */
  triggerContent?: ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
  /** 面板容器类名（色板需要自定内边距与宽度） */
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 打开时按触发器位置定位（fixed，跟随视口而非父容器）
  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({ top: rect.bottom + 4, left: rect.left });
    };
    place();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      // 菜单已移到 body，触发器与菜单内部的点击都不能算「外部」
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    // 滚动 / 缩放会让 fixed 坐标失效，直接关闭比留着错位菜单更好
    window.addEventListener('resize', place);
    window.addEventListener('scroll', () => setOpen(false), true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  const trigger = size === 'md' ? 'h-8 gap-1 px-2 text-[12px]' : 'h-7 gap-1 px-2 text-[11px]';

  const close = () => setOpen(false);

  /** 面板内容与菜单项二选一：`panel` 优先（色板这类非菜单结构） */
  const content =
    typeof panel === 'function'
      ? panel(close)
      : (panel ??
        items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              close();
              item.onClick();
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {item.glyph ? <span className="shrink-0">{item.glyph}</span> : null}
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        )));

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup={panel ? 'dialog' : 'menu'}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center justify-center rounded-md border text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 ${
          triggerContent ? 'gap-0.5 border-transparent' : 'border-gray-300'
        } ${trigger}`}
      >
        {triggerContent ?? (
          <>
            {glyph ?? (icon ? <Icon name={icon} className="h-4 w-4" /> : null)}
            {showLabel ? <span className="whitespace-nowrap">{label}</span> : null}
          </>
        )}
        <Icon name="chevron" className="h-3 w-3 opacity-60" />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              role={panel ? 'dialog' : 'menu'}
              aria-label={label}
              style={{ position: 'fixed', top: position.top, left: position.left }}
              className={`z-[60] rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 ${panelClassName}`}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
