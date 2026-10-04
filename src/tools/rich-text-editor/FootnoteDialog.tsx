import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface FootnoteDialogProps {
  /** null 表示未打开；insert 为新建，edit 为编辑已有脚注 */
  mode: 'insert' | 'edit' | null;
  initialNote: string;
  onCancel: () => void;
  onConfirm: (note: string) => void;
  /** 编辑模式下的删除回调（新建模式不显示删除） */
  onRemove?: () => void;
}

/**
 * 脚注内容编辑弹窗：与 PDF 模式弹窗同一套视觉语言。
 * Enter（不带 Shift）提交，Esc 取消。
 */
export function FootnoteDialog({
  mode,
  initialNote,
  onCancel,
  onConfirm,
  onRemove,
}: FootnoteDialogProps) {
  const { t } = useTranslation();
  const [note, setNote] = useState(initialNote);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!mode) return;
    setNote(initialNote);
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [mode, initialNote]);

  useEffect(() => {
    if (!mode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, onCancel]);

  if (!mode) return null;

  const submit = () => onConfirm(note.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rte-footnote-dialog-title"
        data-testid="rich-text-footnote-dialog"
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="rte-footnote-dialog-title"
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          {mode === 'insert'
            ? t('tools.richText.footnoteInsert')
            : t('tools.richText.footnoteEdit')}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('tools.richText.footnoteDialogDesc')}
        </p>

        <textarea
          ref={textareaRef}
          rows={4}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={t('tools.richText.footnotePlaceholder')}
          className="mt-3 w-full resize-y rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          {mode === 'edit' && onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="mr-auto rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              {t('tools.richText.footnoteRemove')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.richText.footnoteCancel')}
          </button>
          <button
            type="button"
            disabled={!note.trim()}
            onClick={submit}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('tools.richText.footnoteSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}
