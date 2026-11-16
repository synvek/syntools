import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface SheetInfo {
  id: string;
  name: string;
  hidden: boolean;
  tabColor?: string;
}

interface SheetTabsProps {
  sheets: SheetInfo[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  /** 隐藏 / 取消隐藏（P2-7）：隐藏表在标签栏留下但置灰，用户能找回来 */
  onToggleHidden: (id: string, hidden: boolean) => void;
}

/**
 * Sheet tab bar: switch / add / rename / duplicate / delete.
 * One-way synced with Univer's internal state — this component is the only entry point for sheet
 * operations (Univer's own footer is disabled so two tab bars never coexist).
 */
export function SheetTabs({
  sheets,
  activeId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onDuplicate,
  onToggleHidden,
}: SheetTabsProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [menu]);

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setDraftName(name);
    setMenu(null);
  };

  const commitRename = () => {
    if (!editingId) return;
    const name = draftName.trim();
    if (name) onRename(editingId, name);
    setEditingId(null);
  };

  const canDelete = sheets.length > 1;
  /** Excel 的规矩：至少留一张可见工作表（Univer 同样会拒绝） */
  const canHide = sheets.filter((sheet) => !sheet.hidden).length > 1;
  const menuSheet = menu ? sheets.find((sheet) => sheet.id === menu.id) : undefined;

  return (
    <div className="relative flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800/50">
      {/*
       * The tab strip is a real tablist (P0-6): without it a screen reader reads five unrelated
       * buttons and never says which sheet is active. The "+" button deliberately stays *outside*
       * the tablist so the list only contains tabs.
       */}
      <div
        role="tablist"
        aria-label={t('tools.sheet.sheets')}
        data-testid="sheet-tabs"
        className="flex items-center gap-1"
      >
        {sheets.map((sheet) => {
          const active = sheet.id === activeId;
          return (
            <div key={sheet.id} className="flex shrink-0 items-center">
              {editingId === sheet.id ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="w-28 rounded border border-blue-500 bg-white px-2 py-1 text-sm focus:outline-none dark:bg-gray-900"
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSelect(sheet.id)}
                  onDoubleClick={() => startRename(sheet.id, sheet.name)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ id: sheet.id, x: e.clientX, y: e.clientY });
                  }}
                  title={
                    sheet.hidden ? `${sheet.name} (${t('tools.sheet.hiddenSheet')})` : sheet.name
                  }
                  className={[
                    'flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors',
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700',
                    // 隐藏表不再"看不见"：留在标签栏里置灰，右键就能取消隐藏
                    !active && sheet.hidden ? 'italic opacity-60' : '',
                  ].join(' ')}
                  style={
                    active || !sheet.tabColor
                      ? undefined
                      : { boxShadow: `inset 3px 0 0 ${sheet.tabColor}` }
                  }
                >
                  {sheet.tabColor && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: sheet.tabColor }}
                    />
                  )}
                  <span className="max-w-[120px] truncate">{sheet.name}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAdd}
        title={t('tools.sheet.addSheet')}
        className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-lg leading-none text-gray-600 transition-colors hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        +
      </button>

      {menu && (
        <div
          className="fixed z-50 min-w-[140px] overflow-hidden rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            onClick={() => {
              const sheet = sheets.find((item) => item.id === menu.id);
              if (sheet) startRename(sheet.id, sheet.name);
            }}
          >
            {t('tools.sheet.rename')}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            onClick={() => {
              onDuplicate(menu.id);
              setMenu(null);
            }}
          >
            {t('tools.sheet.duplicate')}
          </button>
          <button
            type="button"
            disabled={!menuSheet?.hidden && !canHide}
            title={!menuSheet?.hidden && !canHide ? t('tools.sheet.lastVisibleSheet') : undefined}
            className="block w-full px-3 py-1.5 text-left text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-700"
            onClick={() => {
              if (menuSheet) onToggleHidden(menuSheet.id, !menuSheet.hidden);
              setMenu(null);
            }}
          >
            {menuSheet?.hidden ? t('tools.sheet.showSheet') : t('tools.sheet.hideSheet')}
          </button>
          <button
            type="button"
            disabled={!canDelete}
            className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-700"
            onClick={() => {
              onDelete(menu.id);
              setMenu(null);
            }}
          >
            {t('tools.sheet.delete')}
          </button>
        </div>
      )}
    </div>
  );
}
