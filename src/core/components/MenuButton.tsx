import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/core/components/Icon';

/**
 * 通用下拉菜单按钮（触发器 + 下拉面板），两种形态：
 *
 * - `variant="toolbar"`（默认）：编辑器工具栏里的紧凑按钮，以图标为主、文字走 tooltip。
 *   存在原因：形状库有 6 种、对齐有 6 种，全部平铺会让工具栏又宽又杂。
 * - `variant="header"`：文档头（`DocumentHeader` 的 io 插槽）里的「图标 + 文字」按钮，
 *   导入 / 导出这类主次动作收进下拉后，既能一眼看懂，也省下一整排按钮的空间。
 *
 * 菜单用 portal 挂到 body：工具栏每一行、文档头都可能处在自己的层叠上下文里
 * （毛玻璃、sticky 等），就地 absolute 定位会被相邻层盖住并拦截点击。
 */

export interface MenuItem {
  key: string;
  label: string;
  /** 可选的前置图形（如格式图标、形状缩略图） */
  glyph?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface MenuButtonProps {
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
  /** 触发器尺寸（toolbar 形态生效）：与所在行保持一致 */
  size?: 'sm' | 'md';
  /** 是否显示文字标签（toolbar 形态生效）：工具栏以图标为主，只有分类入口显示文字 */
  showLabel?: boolean;
  /** 外观形态：工具栏紧凑按钮 / 文档头「图标 + 文字」按钮 */
  variant?: 'toolbar' | 'header';
  /** 文档头形态的主次关系：primary 为蓝底主按钮（导出），default 为描边次按钮（导入） */
  tone?: 'default' | 'primary';
  className?: string;
  /** 面板容器类名（色板需要自定内边距与宽度） */
  panelClassName?: string;
  /** 触发器附加类名：用于「非胶囊按钮」形态（如工具箱角标），会覆盖尺寸与边框 */
  triggerClassName?: string;
  /** 不渲染内置的下拉箭头：触发内容本身就是箭头时避免重复 */
  hideChevron?: boolean;
}

/**
 * 垂直定位：默认贴在触发器下方，**下方放不下就翻到上方**，都放不下则钳制在视口内。
 *
 * 工具箱的工具组浮层必须翻：最后一组就在工作区底部，菜单只往下开会溢出视口下缘。
 */
function verticalPlacement(rect: DOMRect, menuHeight: number): number {
  const viewport = window.innerHeight;
  const below = rect.bottom + 4;
  if (menuHeight <= 0) return below;
  if (below + menuHeight <= viewport - 8) return below;
  const above = rect.top - menuHeight - 4;
  if (above >= 8) return above;
  return Math.max(8, viewport - menuHeight - 8);
}

export function MenuButton({
  label,
  icon,
  glyph,
  items = [],
  panel,
  triggerContent,
  disabled,
  size = 'sm',
  showLabel = false,
  variant = 'toolbar',
  tone = 'default',
  className = '',
  panelClassName,
  triggerClassName = '',
  hideChevron = false,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 打开时按触发器位置定位（fixed，跟随视口而非父容器）
  // 用 layout effect：在浏览器绘制前就把位置算好，否则会先看到菜单从触发器左边缘溢出、下一帧才回弹
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      // 可用宽度取 documentElement（window.innerWidth 含纵向滚动条，会让菜单右侧被滚动条压住）
      const available = document.documentElement.clientWidth;
      const width = menuRef.current?.offsetWidth ?? 0;
      const height = menuRef.current?.offsetHeight ?? 0;
      if (width <= 0) {
        // 首帧还没量到宽度：先按触发器左边缘占位（此时面板不可见），下一帧再校正
        setPosition({ top: rect.bottom + 4, left: rect.left });
        return;
      }
      // 文档头的按钮靠右：像 Office 的格式下拉那样右对齐触发器，向左展开
      const anchor = variant === 'header' ? rect.right - width : rect.left;
      const left = Math.max(8, Math.min(anchor, available - width - 8));
      const top = verticalPlacement(rect, height);
      setPosition((prev) =>
        prev && prev.top === top && prev.left === left ? prev : { top, left },
      );
    };
    place();
    const raf = requestAnimationFrame(place);
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
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', place);
    // 滚动 / 缩放会让 fixed 坐标失效，直接关闭比留着错位菜单更好
    window.addEventListener('scroll', onScroll, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, variant]);

  const headerTrigger =
    tone === 'primary'
      ? 'h-8 gap-1.5 rounded-md border border-transparent bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
      : 'h-8 gap-1.5 rounded-md border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';

  const toolbarTrigger = `disabled:opacity-40 rounded-md border text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 ${
    triggerContent ? 'gap-0.5 border-transparent' : 'border-gray-300'
  } ${size === 'md' ? 'h-8 gap-1 px-2 text-[12px]' : 'h-7 gap-1 px-2 text-[11px]'}`;

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
            className="flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {item.glyph ? <span className="shrink-0">{item.glyph}</span> : null}
            {/* 极端窄窗口下面板会被视口宽度限制，文字此时省略而不是溢出到窗口外 */}
            <span className="truncate">{item.label}</span>
          </button>
        )));

  return (
    // 外层不写 `relative`：调用方可能要让触发器绝对定位到别的锚点（如工具箱角标落在外层按钮的角上），
    // 硬留一个 relative 会把它变成定位上下文，且 `relative` 与调用方传入的 `absolute` 谁生效取决于样式表顺序
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup={panel ? 'dialog' : 'menu'}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center justify-center transition-colors disabled:cursor-not-allowed ${
          variant === 'header' ? headerTrigger : toolbarTrigger
        } ${triggerClassName}`}
      >
        {triggerContent ?? (
          <>
            {glyph ?? (icon ? <Icon name={icon} className="h-4 w-4" /> : null)}
            {showLabel || variant === 'header' ? (
              <span className="whitespace-nowrap">{label}</span>
            ) : null}
          </>
        )}
        {hideChevron ? null : (
          <Icon
            name="chevron"
            className={variant === 'header' ? 'h-3.5 w-3.5 opacity-60' : 'h-3 w-3 opacity-60'}
          />
        )}
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              role={panel ? 'dialog' : 'menu'}
              aria-label={label}
              style={{
                position: 'fixed',
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                // 位置算好前先隐藏（layout effect 会在绘制前补上，用户看不到中间态）
                visibility: position ? 'visible' : 'hidden',
                maxWidth: 'calc(100vw - 1rem)',
                // 比视口还高的面板（理论上不会出现）内部滚动，而不是溢出到屏幕外
                maxHeight: 'calc(100vh - 1rem)',
                overflowY: 'auto',
              }}
              className={`z-[60] rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 ${
                panelClassName ?? (variant === 'header' ? 'min-w-44 p-1' : 'min-w-max p-1')
              }`}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
