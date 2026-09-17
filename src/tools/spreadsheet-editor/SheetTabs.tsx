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
}

/**
 * 工作表标签栏：切换 / 新增 / 重命名 / 复制 / 删除。
 * 与 Univer 内部状态保持单向同步——本组件是唯一的工作表操作入口
 * （Univer 的 footer 已被关闭，避免两套标签栏并存）。
 */
export function SheetTabs({
  sheets,
  activeId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onDuplicate,
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

  return (
    <div className="relative flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800/50">
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
