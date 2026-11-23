import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Ribbon } from '@/core/components/ribbon/Ribbon';
import type { RibbonTab } from '@/core/components/ribbon/types';
import { useViewportFill } from '@/core/hooks/useViewportFill';
import type { PdfEditorDoc } from '../model/types';
import { EmptyState } from './EmptyState';
import { StatusBar } from './StatusBar';

/** Smallest workspace worth showing; a shorter first screen lets the page scroll instead of squashing it */
const MIN_WORK_HEIGHT = 360;

interface PdfEditorViewProps {
  /** `null` until a file is open — the ribbon stays hidden, like the other PDF tools */
  doc: PdfEditorDoc | null;
  tabs: RibbonTab[];
  onFile: (file: File) => void;
  /** Rendered under the drop zone while no document is open (password prompt, hints) */
  emptyExtra?: ReactNode;
  /** Draft restore card, shown above the drop zone */
  draftPrompt?: ReactNode;
  /** Rendered instead of the empty state once a document exists (page viewport) */
  pageArea?: ReactNode;
  /** Optional rails either side of the page area (thumbnails / outline / properties) */
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  error?: string | null;
  note?: string | null;
  /** Inline message above the page area while a document is open (save failure, raster notice) */
  banner?: string | null;
  /**
   * Clear the banner.
   *
   * Restore notices ("draft restored" / "project opened") stay until dismissed: they explain why the
   * page already has content, so they must not be a transient toast, but they must be closable.
   */
  onDismissBanner?(): void;
  /** Quick-access cluster (undo/redo + ⋯ file menu) left of the tabs */
  quickAccess?: ReactNode;
  /** Doc chrome (save state / file name) inside the ribbon header */
  headerRight?: ReactNode;
  /** Status bar override; defaults to the page counter without size details */
  statusBar?: ReactNode;
  /** Controlled ribbon tab: contextual tabs switch themselves when an object is selected */
  activeTabId?: string;
  onTabChange?(tabId: string): void;
}

/**
 * Presentational shell: ribbon on top, page area, status bar.
 *
 * Kept separate from `PdfEditorTool` so the layout can be rendered in tests without a real PDF, and
 * so the controller owns all open/save/view state in one place.
 */
export function PdfEditorView({
  doc,
  tabs,
  onFile,
  emptyExtra,
  draftPrompt,
  pageArea,
  leftPanel,
  rightPanel,
  error,
  note,
  banner,
  onDismissBanner,
  quickAccess,
  headerRight,
  statusBar,
  activeTabId,
  onTabChange,
}: PdfEditorViewProps) {
  const { t } = useTranslation();

  /**
   * Workspace height (rails + page viewport) = the first screen's leftover space below the ribbon.
   *
   * The row used to rely on `min-h-[55vh]` only, so N page canvases stretched it and the real scroll
   * container was the window: scrolling a long document also scrolled the tool title away and left the
   * sticky ribbon offset wrong. With a measured height `PageScrollView` is the only scroller again —
   * the same approach as the other editors. The row mounts only once a document is open, which is why
   * the doc presence is the recompute signature.
   */
  const workRowRef = useRef<HTMLDivElement | null>(null);
  const workHeight = useViewportFill(workRowRef, {
    min: MIN_WORK_HEIGHT,
    signature: doc ? 'doc' : 'empty',
  });

  return (
    <div className="flex flex-col gap-3" data-tool-root>
      {doc ? (
        // Sticky at the top of the app's content scroller (which already sits below the header, h-14), so a
        // scroll through a 300-page document never hides save / export / undo. z-20 stays under the header's z-30.
        <div
          className="sticky top-0 z-20 -mx-1 bg-gray-50/95 px-1 pb-1 backdrop-blur-sm dark:bg-gray-950/95"
          data-testid="pdf-ribbon-sticky"
        >
          <Ribbon
            ariaLabel={t('tools.pdfEditor.ribbonLabel')}
            tabs={tabs}
            accent="red"
            defaultTabId="home"
            activeTabId={activeTabId}
            onActiveTabChange={onTabChange}
            quickAccess={quickAccess}
            headerRight={headerRight}
            collapseLabel={t('tools.pdfEditor.ribbonCollapse')}
            expandLabel={t('tools.pdfEditor.ribbonExpand')}
            testId="pdf-ribbon"
          />
        </div>
      ) : null}

      {doc && banner ? (
        <div
          role="alert"
          data-testid="pdf-banner"
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <span className="min-w-0 flex-1">{banner}</span>
          {onDismissBanner ? (
            <button
              type="button"
              data-testid="pdf-banner-dismiss"
              onClick={onDismissBanner}
              aria-label={t('tools.pdfEditor.bannerDismiss')}
              title={t('tools.pdfEditor.bannerDismiss')}
              className="-my-0.5 -mr-1 rounded p-1 text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none dark:text-amber-300 dark:hover:bg-amber-900/50 dark:hover:text-amber-100"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col">
        {doc ? (
          <div
            ref={workRowRef}
            data-testid="pdf-work-area"
            className="flex gap-3"
            style={{ height: workHeight ?? undefined, minHeight: MIN_WORK_HEIGHT }}
          >
            {leftPanel}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {pageArea ?? (
                <div
                  className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-300 p-10 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
                  data-testid="pdf-canvas-placeholder"
                >
                  {t('tools.pdfEditor.stubBody')}
                </div>
              )}
            </div>
            {rightPanel}
          </div>
        ) : (
          <>
            <EmptyState onFile={onFile} error={error} note={note} draftPrompt={draftPrompt} />
            {emptyExtra}
          </>
        )}
      </div>

      {statusBar ?? <StatusBar doc={doc} />}
    </div>
  );
}
