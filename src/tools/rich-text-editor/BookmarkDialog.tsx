import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useModalBehavior } from '@/core/hooks/useOverlayStack';
import type { Editor } from '@tiptap/react';
import {
  collectBookmarks,
  findSelectedBookmark,
  normalizeBookmarkName,
  uniqueBookmarkName,
  type BookmarkEntry,
} from './bookmarks';

interface BookmarkDialogProps {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}

/**
 * 书签对话框（对应 Word 的「插入 → 书签」）。
 *
 * 一个面板同时承担插入 / 重命名 / 删除 / 定位，而不拆成四个入口：
 * 零宽锚点在画布上几乎点不到，所有管理动作都必须在这里完成，分散反而更难用。
 */
export function BookmarkDialog({ editor, open, onClose }: BookmarkDialogProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<BookmarkEntry[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(() => {
    if (!editor) return;
    setItems(collectBookmarks(editor.state.doc));
  }, [editor]);

  // 打开时重建列表，并预选光标旁的书签（此时"插入"自动变成"重命名"）
  useEffect(() => {
    if (!open || !editor) return;
    refresh();
    const selected = findSelectedBookmark(editor.state);
    setSelectedName(selected?.name ?? null);
    setDraft(selected?.name ?? '');
    setError(null);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open, editor, refresh]);

  // 文档改动（撤销、删段、跨面板编辑）都要反映到列表上，否则会列出已经不存在的书签
  useEffect(() => {
    if (!open || !editor) return;
    const onUpdate = () => refresh();
    editor.on('update', onUpdate);
    return () => {
      editor.off('update', onUpdate);
    };
  }, [open, editor, refresh]);

  // P0-4: topmost-only Escape, Tab trap and focus restore instead of a private window listener
  useModalBehavior(open, onClose);

  if (!open || !editor) return null;

  const names = items.map((item) => item.name);
  const selected = items.find((item) => item.name === selectedName) ?? null;
  const suggested = uniqueBookmarkName(t('tools.richText.bookmarkDefault'), names);

  const submit = () => {
    // 输入框留空时用建议名，避免"点了插入却什么都没发生"
    const raw = draft.trim() || (selected ? selected.name : suggested);
    const normalized = normalizeBookmarkName(raw);
    if (!normalized) {
      setError(t('tools.richText.bookmarkInvalid'));
      return;
    }
    if (bookmarkDuplicated(normalized, names, selected?.name ?? null)) {
      setError(t('tools.richText.bookmarkDuplicate'));
      return;
    }
    const ok = selected
      ? editor.chain().focus().updateBookmark(selected.pos, normalized).run()
      : editor.chain().focus().insertBookmark(normalized).run();
    if (!ok) {
      setError(t('tools.richText.bookmarkDuplicate'));
      return;
    }
    setError(null);
    setDraft(normalized);
    setSelectedName(normalized);
    refresh();
  };

  const remove = () => {
    if (!selected) return;
    editor.chain().focus().removeBookmark(selected.pos).run();
    setSelectedName(null);
    setDraft('');
    setError(null);
    refresh();
  };

  const goto = (entry: BookmarkEntry) => {
    setSelectedName(entry.name);
    setDraft(entry.name);
    editor.chain().focus().setNodeSelection(entry.pos).scrollIntoView().run();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rte-bookmark-dialog-title"
        aria-describedby="rte-bookmark-dialog-desc"
        data-testid="rich-text-bookmark-dialog"
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="rte-bookmark-dialog-title"
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          {t('tools.richText.bookmark')}
        </h2>
        <p id="rte-bookmark-dialog-desc" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('tools.richText.bookmarkHint')}
        </p>

        <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">
          {t('tools.richText.bookmarkName')}
          <input
            ref={inputRef}
            type="text"
            value={draft}
            maxLength={40}
            placeholder={suggested}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>

        {error ? (
          <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <div className="mt-3 max-h-56 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
          {items.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
              {t('tools.richText.bookmarkEmpty')}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((entry) => (
                <li key={`${entry.name}-${entry.pos}`}>
                  <button
                    type="button"
                    onClick={() => goto(entry)}
                    aria-pressed={entry.name === selectedName}
                    className={`block w-full truncate px-3 py-1.5 text-left text-sm transition-colors ${
                      entry.name === selectedName
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
                    }`}
                  >
                    {entry.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          {selected ? (
            <button
              type="button"
              onClick={remove}
              className="mr-auto rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              {t('tools.richText.bookmarkDelete')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.richText.bookmarkClose')}
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {selected ? t('tools.richText.bookmarkRename') : t('tools.richText.bookmarkInsert')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 重命名时允许沿用自己当前的名称，只有与**别的**书签重名才算冲突 */
function bookmarkDuplicated(
  name: string,
  names: readonly string[],
  current: string | null,
): boolean {
  return names.some((candidate) => candidate === name && candidate !== current);
}
