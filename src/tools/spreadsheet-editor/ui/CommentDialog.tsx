import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CommentThreadPanel,
  type CommentLabels,
} from '../../../core/components/CommentThreadPanel';
import { sortThreads, type CommentThread } from '../../../core/comments/model';
import { cellLabel } from '../comments';

/**
 * Cell comment dialog (P1-2).
 *
 * Threads are anchored to the active cell when the dialog opens; each new comment is one thread
 * and replies are appended to it. Storage lives in the snapshot (`syntoolsComments`), so the
 * dialog only deals with the current sheet's list.
 */
export interface CommentDialogProps {
  /** Anchor for a new thread (0-based); null when the sheet has no selection */
  cell: { row: number; col: number } | null;
  threads: CommentThread[];
  author: string;
  onAuthorChange: (value: string) => void;
  onAdd: (body: string) => void;
  onReply: (threadId: string, body: string) => void;
  onToggleResolved: (threadId: string, resolved: boolean) => void;
  onDeleteThread: (threadId: string) => void;
  /** Re-read the current selection as the anchor for the next thread */
  onUseCurrentCell: () => void;
  onClose: () => void;
}

export function CommentDialog({
  cell,
  threads,
  author,
  onAuthorChange,
  onAdd,
  onReply,
  onToggleResolved,
  onDeleteThread,
  onUseCurrentCell,
  onClose,
}: CommentDialogProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');

  const labels: CommentLabels = {
    empty: t('tools.sheet.commentEmpty'),
    replyPlaceholder: t('tools.sheet.commentReplyPlaceholder'),
    reply: t('tools.sheet.commentReply'),
    resolve: t('tools.sheet.commentResolve'),
    reopen: t('tools.sheet.commentReopen'),
    delete: t('tools.sheet.commentDelete'),
    resolved: t('tools.sheet.commentResolved'),
    orphaned: t('tools.sheet.commentOrphaned'),
    authorPlaceholder: t('tools.sheet.commentAuthor'),
    anonymous: t('tools.sheet.commentAnonymous'),
  };

  const visible = sortThreads(threads);
  const anchorLabel = cell ? cellLabel(cell.row, cell.col) : null;

  const submit = () => {
    const text = body.trim();
    if (!text || !cell) return;
    onAdd(text);
    setBody('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.sheet.comments')}
      data-testid="sheet-comment-dialog"
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('tools.sheet.comments')}
          </h2>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {anchorLabel
              ? t('tools.sheet.commentAnchor', { cell: anchorLabel })
              : t('tools.sheet.commentNoCell')}
          </span>
          <button
            type="button"
            className="ml-auto rounded px-2 py-0.5 text-[12px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            onClick={onUseCurrentCell}
          >
            {t('tools.sheet.commentUseCell')}
          </button>
          <button
            type="button"
            className="rounded px-2 py-0.5 text-[12px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            onClick={onClose}
            aria-label={t('tools.sheet.commentClose')}
          >
            ✕
          </button>
        </div>

        <div className="mt-2 flex flex-col gap-1">
          <textarea
            className="min-h-16 w-full resize-none rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs dark:border-gray-700"
            value={body}
            placeholder={t('tools.sheet.commentPlaceholder')}
            aria-label={t('tools.sheet.commentPlaceholder')}
            disabled={!cell}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey) return;
              event.preventDefault();
              submit();
            }}
          />
          <div className="flex items-center gap-1">
            <input
              className="h-7 min-w-0 flex-1 rounded-md border border-gray-200 bg-transparent px-2 text-[11px] dark:border-gray-700"
              value={author}
              placeholder={labels.authorPlaceholder}
              aria-label={labels.authorPlaceholder}
              onChange={(event) => onAuthorChange(event.target.value)}
            />
            <button
              type="button"
              className="h-7 rounded-md bg-blue-600 px-2 text-[11px] font-medium text-white disabled:opacity-40"
              disabled={!body.trim() || !cell}
              onClick={submit}
            >
              {t('tools.sheet.commentAdd')}
            </button>
          </div>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto">
          <CommentThreadPanel
            threads={visible}
            labels={labels}
            activeId={null}
            onReply={(threadId, text) => onReply(threadId, text)}
            onToggleResolved={onToggleResolved}
            onDeleteThread={onDeleteThread}
            author={author}
            // The dialog owns the author field above, so the panel hides its own
            onAuthorChange={undefined}
          />
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-gray-400">
          {t('tools.sheet.commentSidecarNote')}
        </p>
      </div>
    </div>
  );
}
