import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import { collectBookmarks, type BookmarkEntry } from './bookmarks';
import { collectXrefs, type XrefEntry, type XrefMode } from './xrefs';

interface XrefDialogProps {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}

/**
 * 交叉引用对话框（对应 Word 的「插入 → 交叉引用」）。
 *
 * 目标只能是书签：书签是文档里唯一"可由用户命名并稳定指向"的位置，
 * 标题虽然也能算，但那已经是目录（TOC）的职责，两套入口会让人分不清该用哪个。
 */
export function XrefDialog({ editor, open, onClose }: XrefDialogProps) {
  const { t } = useTranslation();
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [refs, setRefs] = useState<XrefEntry[]>([]);
  const [target, setTarget] = useState('');
  const [mode, setMode] = useState<XrefMode>('text');

  const refresh = useCallback(() => {
    if (!editor) return;
    const items = collectBookmarks(editor.state.doc);
    setBookmarks(items);
    setRefs(collectXrefs(editor.state.doc));
    // 目标被删掉后不要把对话框留在"空目标"状态，自动落到第一个书签
    setTarget((current) =>
      items.some((item) => item.name === current) ? current : (items[0]?.name ?? ''),
    );
  }, [editor]);

  useEffect(() => {
    if (!open || !editor) return;
    refresh();
    setMode('text');
  }, [open, editor, refresh]);

  useEffect(() => {
    if (!open || !editor) return;
    const onUpdate = () => refresh();
    editor.on('update', onUpdate);
    return () => {
      editor.off('update', onUpdate);
    };
  }, [open, editor, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !editor) return null;

  const names = new Set(bookmarks.map((item) => item.name));

  const insert = () => {
    if (!target) return;
    editor.chain().focus().insertCrossReference(target, mode).run();
    refresh();
  };

  const jump = (name: string) => {
    const entry = collectBookmarks(editor.state.doc).find((item) => item.name === name);
    if (!entry) return;
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
        aria-labelledby="rte-xref-dialog-title"
        data-testid="rich-text-xref-dialog"
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="rte-xref-dialog-title"
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          {t('tools.richText.xref')}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('tools.richText.xrefTextHint')}
        </p>

        {bookmarks.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
            {t('tools.richText.xrefNoBookmarks')}
          </p>
        ) : (
          <>
            <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {t('tools.richText.xrefMode')}
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value === 'page' ? 'page' : 'text')}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="text">{t('tools.richText.xrefModeText')}</option>
                <option value="page">{t('tools.richText.xrefModePage')}</option>
              </select>
            </label>

            <div className="mt-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {t('tools.richText.xrefTarget')}
              </p>
              <div className="mt-1 max-h-40 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {bookmarks.map((entry) => (
                    <li key={`${entry.name}-${entry.pos}`}>
                      <button
                        type="button"
                        onClick={() => setTarget(entry.name)}
                        aria-pressed={entry.name === target}
                        className={`block w-full truncate px-3 py-1.5 text-left text-sm transition-colors ${
                          entry.name === target
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
                        }`}
                      >
                        {entry.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}

        {refs.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {t('tools.richText.xrefExisting')}
            </p>
            <ul className="mt-1 max-h-32 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
              {refs.map((entry) => {
                const broken = !names.has(entry.target);
                return (
                  <li
                    key={`${entry.target}-${entry.mode}-${entry.pos}`}
                    className="flex items-center gap-2 border-b border-gray-100 px-2 py-1 last:border-b-0 dark:border-gray-800"
                  >
                    <button
                      type="button"
                      onClick={() => jump(entry.target)}
                      disabled={broken}
                      title={broken ? t('tools.richText.xrefMismatch') : entry.target}
                      className={`flex-1 truncate text-left text-sm ${
                        broken
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-700 hover:underline dark:text-gray-200'
                      }`}
                    >
                      {entry.target} ·{' '}
                      {entry.mode === 'page'
                        ? t('tools.richText.xrefModePage')
                        : t('tools.richText.xrefModeText')}
                      {broken ? ` · ${t('tools.richText.xrefMissing')}` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        editor.chain().focus().removeCrossReference(entry.pos).run();
                        refresh();
                      }}
                      className="rounded px-1.5 py-0.5 text-xs text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      {t('tools.richText.xrefDelete')}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.richText.xrefClose')}
          </button>
          <button
            type="button"
            disabled={!target}
            onClick={insert}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('tools.richText.xrefInsert')}
          </button>
        </div>
      </div>
    </div>
  );
}
