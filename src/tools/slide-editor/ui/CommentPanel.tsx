import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CommentThreadPanel,
  type CommentLabels,
} from '../../../core/components/CommentThreadPanel';
import { sortThreads, threadsForSlide } from '../../../core/comments/model';
import { findElementDeep } from '../model/tree';
import { useSlideStore } from '../store';

/**
 * Slide comment panel (P1-2).
 *
 * Threads live on `SlideDoc.comments`; this panel only handles the current slide, adds new threads
 * anchored to the selection (or the page centre) and renders the shared thread list.
 */
export function CommentPanel() {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const viewMode = useSlideStore((s) => s.viewMode);
  const selection = useSlideStore((s) => s.selection);
  const author = useSlideStore((s) => s.commentAuthor);
  const setAuthor = useSlideStore((s) => s.setCommentAuthor);
  const activeThreadId = useSlideStore((s) => s.activeThreadId);
  const setActiveThread = useSlideStore((s) => s.setActiveThread);
  const addComment = useSlideStore((s) => s.addComment);
  const replyComment = useSlideStore((s) => s.replyComment);
  const setCommentResolved = useSlideStore((s) => s.setCommentResolved);
  const deleteCommentThread = useSlideStore((s) => s.deleteCommentThread);

  const [body, setBody] = useState('');
  const [showResolved, setShowResolved] = useState(true);

  const slide = doc.slides[slideIndex];
  const threads = useMemo(
    () => (slide ? sortThreads(threadsForSlide(doc.comments ?? [], slide.id)) : []),
    [doc.comments, slide],
  );

  // Orphan state is derived, never persisted: deleting the anchor element shouldn't rewrite the doc
  const orphanedIds = useMemo(() => {
    if (!slide) return new Set<string>();
    const ids = new Set<string>();
    for (const thread of threads) {
      if (thread.anchor.kind !== 'element') continue;
      if (!findElementDeep(slide.elements, thread.anchor.elementId)) ids.add(thread.id);
    }
    return ids;
  }, [threads, slide]);

  const visible = useMemo(
    () =>
      threads
        .filter((thread) => showResolved || !thread.resolved)
        .map((thread) => (orphanedIds.has(thread.id) ? { ...thread, orphaned: true } : thread)),
    [threads, showResolved, orphanedIds],
  );

  const labels: CommentLabels = {
    empty: t('tools.slide.commentEmpty'),
    replyPlaceholder: t('tools.slide.commentReplyPlaceholder'),
    reply: t('tools.slide.commentReply'),
    resolve: t('tools.slide.commentResolve'),
    reopen: t('tools.slide.commentReopen'),
    delete: t('tools.slide.commentDelete'),
    resolved: t('tools.slide.commentResolved'),
    orphaned: t('tools.slide.commentOrphaned'),
    authorPlaceholder: t('tools.slide.commentAuthor'),
    anonymous: t('tools.slide.commentAnonymous'),
  };

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    addComment(text, author.trim() || labels.anonymous);
    setBody('');
  };

  return (
    <div className="flex flex-col gap-2" data-testid="slide-comment-panel">
      <p className="px-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        {selection.length === 1
          ? t('tools.slide.commentOnSelection')
          : t('tools.slide.commentOnPage')}
      </p>

      <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
        <textarea
          className="min-h-14 w-full resize-none rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs dark:border-gray-700"
          value={body}
          placeholder={t('tools.slide.commentPlaceholder')}
          aria-label={t('tools.slide.commentPlaceholder')}
          disabled={viewMode !== 'normal'}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            submit();
          }}
        />
        <div className="mt-1 flex items-center gap-1">
          <span className="ml-auto text-[10px] text-gray-400">{body.length}</span>
          <button
            type="button"
            className="h-7 rounded-md bg-blue-600 px-2 text-[11px] font-medium text-white disabled:opacity-40"
            disabled={!body.trim() || viewMode !== 'normal'}
            onClick={submit}
          >
            {t('tools.slide.commentAdd')}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-1.5 px-1 text-[11px] text-gray-500 dark:text-gray-400">
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(event) => setShowResolved(event.target.checked)}
        />
        {t('tools.slide.commentShowResolved')}
      </label>

      <CommentThreadPanel
        threads={visible}
        labels={labels}
        author={author}
        onAuthorChange={setAuthor}
        activeId={activeThreadId}
        onSelect={(id) => setActiveThread(id === activeThreadId ? null : id)}
        onReply={(threadId, text) =>
          replyComment(threadId, text, author.trim() || labels.anonymous)
        }
        onToggleResolved={setCommentResolved}
        onDeleteThread={deleteCommentThread}
      />
    </div>
  );
}
