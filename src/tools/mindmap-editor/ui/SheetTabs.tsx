import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMindStore } from '../store';

export function SheetTabs() {
  const { t } = useTranslation();
  const sheetOrder = useMindStore((s) => s.sheetOrder);
  const activeSheetId = useMindStore((s) => s.activeSheetId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-t border-gray-200 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900">
      {sheetOrder.map((sheet, index) => {
        const active = sheet.id === activeSheetId;
        return (
          <div
            key={sheet.id}
            className={`flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-[12px] transition-colors ${
              active
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            {editingId === sheet.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  useMindStore.getState().renameSheet(sheet.id, draft);
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    useMindStore.getState().renameSheet(sheet.id, draft);
                    setEditingId(null);
                  }
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="w-20 rounded border border-blue-400 bg-white px-1 text-[12px] outline-none dark:bg-gray-900"
              />
            ) : (
              <button
                type="button"
                onClick={() => useMindStore.getState().switchSheet(sheet.id)}
                onDoubleClick={() => {
                  setEditingId(sheet.id);
                  setDraft(sheet.name);
                }}
                title={t('tools.mindmap.renameHint')}
                className="max-w-[120px] truncate"
              >
                {sheet.name}
              </button>
            )}

            <button
              type="button"
              disabled={index === 0}
              onClick={() => useMindStore.getState().moveSheet(sheet.id, -1)}
              className="rounded px-0.5 text-[11px] text-gray-400 transition-colors hover:text-gray-700 disabled:opacity-30 dark:hover:text-gray-200"
              aria-label="move left"
            >
              ‹
            </button>
            <button
              type="button"
              disabled={index === sheetOrder.length - 1}
              onClick={() => useMindStore.getState().moveSheet(sheet.id, 1)}
              className="rounded px-0.5 text-[11px] text-gray-400 transition-colors hover:text-gray-700 disabled:opacity-30 dark:hover:text-gray-200"
              aria-label="move right"
            >
              ›
            </button>
            {sheetOrder.length > 1 ? (
              <button
                type="button"
                onClick={() => useMindStore.getState().removeSheet(sheet.id)}
                className="rounded px-0.5 text-[11px] text-gray-400 transition-colors hover:text-red-500"
                aria-label="close sheet"
              >
                ✕
              </button>
            ) : null}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => useMindStore.getState().addSheet()}
        title={t('tools.mindmap.addSheet')}
        aria-label={t('tools.mindmap.addSheet')}
        className="shrink-0 rounded-md px-2 py-1 text-[13px] text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        ＋
      </button>
    </div>
  );
}
