import { useState } from 'react';
import type { CommentThread } from '../comments/model';

/**
 * Comment thread list shared by the three editors (P1-2).
 *
 * Purely presentational: threads and all copy come from the host tool, so each editor keeps its
 * own document storage and i18n namespace while the interaction model stays identical.
 */
export interface CommentLabels {
  empty: string;
  replyPlaceholder: string;
  reply: string;
  resolve: string;
  reopen: string;
  delete: string;
  resolved: string;
  orphaned: string;
  authorPlaceholder: string;
  anonymous: string;
}

export interface CommentThreadPanelProps {
  threads: CommentThread[];
  labels: CommentLabels;
  /** Current author name; empty falls back to the anonymous label */
  author?: string;
  onAuthorChange?: (value: string) => void;
  activeId?: string | null;
  onSelect?: (id: string) => void;
  onReply: (threadId: string, body: string) => void;
  onToggleResolved: (threadId: string, resolved: boolean) => void;
  onDeleteThread: (threadId: string) => void;
  /** Custom timestamp rendering (tests pass a fixed formatter) */
  formatTime?: (createdAt: number) => string;
}

const timeFormatter = (createdAt: number): string =>
  new Date(createdAt).toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export function CommentThreadPanel({
  threads,
  labels,
  author = '',
  onAuthorChange,
  activeId = null,
  onSelect,
  onReply,
  onToggleResolved,
  onDeleteThread,
  formatTime = timeFormatter,
}: CommentThreadPanelProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const displayAuthor = (name: string): string => name.trim() || labels.anonymous;
  const setDraft = (id: string, value: string) =>
    setDrafts((current) => ({ ...current, [id]: value }));
  const submitReply = (id: string) => {
    const body = (drafts[id] ?? '').trim();
    if (!body) return;
    onReply(id, body);
    setDraft(id, '');
  };

  return (
    <div className="flex flex-col gap-2" data-testid="comment-thread-panel">
      {onAuthorChange ? (
        <input
          className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
          value={author}
          placeholder={labels.authorPlaceholder}
          aria-label={labels.authorPlaceholder}
          onChange={(event) => onAuthorChange(event.target.value)}
        />
      ) : null}

      {threads.length === 0 ? (
        <p className="px-1 py-3 text-xs text-gray-500 dark:text-gray-400">{labels.empty}</p>
      ) : null}

      {threads.map((thread, index) => {
        const opener = thread.comments[0];
        const rest = thread.comments.slice(1);
        const active = thread.id === activeId;
        const value = drafts[thread.id] ?? '';
        return (
          <article
            key={thread.id}
            data-testid="comment-thread"
            data-resolved={thread.resolved ? 'true' : 'false'}
            className={`rounded-lg border p-2 text-xs transition-colors ${
              active
                ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40'
                : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
            }`}
            onClick={() => onSelect?.(thread.id)}
          >
            <header className="mb-1 flex items-center gap-1.5">
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                {index + 1}
              </span>
              <span className="truncate font-medium text-gray-800 dark:text-gray-100">
                {displayAuthor(opener?.author ?? '')}
              </span>
              <span className="ml-auto shrink-0 text-[10px] text-gray-500 dark:text-gray-400">
                {opener ? formatTime(opener.createdAt) : ''}
              </span>
            </header>

            <p className="whitespace-pre-wrap break-words leading-relaxed text-gray-700 dark:text-gray-200">
              {opener?.body}
            </p>

            {rest.map((entry) => (
              <div
                key={entry.id}
                className="mt-1.5 border-l-2 border-gray-200 pl-2 dark:border-gray-700"
              >
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                  <span className="truncate font-medium">{displayAuthor(entry.author)}</span>
                  <span className="ml-auto shrink-0">{formatTime(entry.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words leading-relaxed text-gray-700 dark:text-gray-200">
                  {entry.body}
                </p>
              </div>
            ))}

            <footer className="mt-1.5 flex items-center gap-1">
              {thread.resolved ? (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {labels.resolved}
                </span>
              ) : null}
              {thread.orphaned ? (
                <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {labels.orphaned}
                </span>
              ) : null}
              <button
                type="button"
                className="ml-auto rounded px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleResolved(thread.id, !thread.resolved);
                }}
              >
                {thread.resolved ? labels.reopen : labels.resolve}
              </button>
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteThread(thread.id);
                }}
              >
                {labels.delete}
              </button>
            </footer>

            <div className="mt-1.5 flex items-end gap-1">
              <textarea
                className="min-h-7 flex-1 resize-none rounded-md border border-gray-200 bg-white px-1.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
                rows={1}
                value={value}
                aria-label={labels.replyPlaceholder}
                placeholder={labels.replyPlaceholder}
                onChange={(event) => setDraft(thread.id, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.shiftKey) return;
                  event.preventDefault();
                  submitReply(thread.id);
                }}
              />
              <button
                type="button"
                className="h-7 shrink-0 rounded-md bg-blue-600 px-2 text-[10px] font-medium text-white disabled:opacity-40"
                disabled={!value.trim()}
                onClick={() => submitReply(thread.id)}
              >
                {labels.reply}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
