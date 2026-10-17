import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { MenuBarMenu, MenuEntry } from './menuModel';

/**
 * 顶部菜单栏：把散落在各处的功能收拢成一份「功能地图」。
 *
 * 布局（左 → 右）：菜单区 → actions（紧邻菜单，如保存状态 / 清空）→ center（画布标题）
 * → right（新建 / 放映等图标按钮）。center 用 flex-1 居中，使标题与左右两组的间距相等。
 *
 * 交互约定：
 * - 顶层入口用 `role="menuitem"`（而非 button），避免与画布/面板里的同名按钮抢
 *   Playwright 的 `getByRole('button', ...)` 选择器；下拉面板用 `role="menu"`，仅在展开时渲染。
 * - 展开后鼠标划过其它顶层入口即切换菜单（贴近桌面端）。
 * - 点击外部 / 按 Esc 关闭。
 */
export function MenuBar({
  menus,
  ariaLabel,
  actions,
  center,
  right,
}: {
  menus: MenuBarMenu[];
  ariaLabel: string;
  /** 菜单区右侧、紧邻末尾菜单的操作 */
  actions?: ReactNode;
  /** 中部插槽：画布标题输入框 */
  center?: ReactNode;
  /** 右侧操作：新建 / 放映等图标按钮 */
  right?: ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpenId(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [openId]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div
        ref={rootRef}
        role="menubar"
        aria-label={ariaLabel}
        className="flex shrink-0 flex-wrap items-center gap-0.5"
      >
        {menus.map((menu) => {
          const open = openId === menu.id;
          return (
            <div key={menu.id} className="relative">
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={open}
                data-testid={`menubar-${menu.id}`}
                onClick={() => setOpenId(open ? null : menu.id)}
                onMouseEnter={() => {
                  if (openId) setOpenId(menu.id);
                }}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  open
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {menu.label}
              </button>
              {open ? (
                <div
                  role="menu"
                  aria-label={menu.label}
                  className="absolute left-0 top-full z-40 mt-0.5 flex min-w-[200px] flex-col rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900"
                >
                  {menu.entries.map((entry, index) => (
                    <MenuEntryView
                      key={entry.type === 'item' ? entry.id : `separator-${index}`}
                      entry={entry}
                      onClose={() => setOpenId(null)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-0.5">{actions}</div> : null}

      {center ? (
        <div className="flex min-w-0 flex-1 items-center justify-center px-2">{center}</div>
      ) : null}

      {right ? <div className="flex shrink-0 items-center gap-0.5">{right}</div> : null}
    </div>
  );
}

function MenuEntryView({ entry, onClose }: { entry: MenuEntry; onClose: () => void }) {
  if (entry.type === 'separator') {
    return <div role="separator" className="my-1 h-px bg-gray-200 dark:bg-gray-700" />;
  }
  return (
    <button
      type="button"
      role="menuitem"
      disabled={entry.disabled}
      onClick={() => {
        onClose();
        entry.onSelect();
      }}
      className={`flex h-8 items-center gap-3 rounded-md px-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        entry.danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
      {entry.shortcut ? (
        <span className="shrink-0 font-mono text-[10px] text-gray-400 dark:text-gray-500">
          {entry.shortcut}
        </span>
      ) : null}
    </button>
  );
}
