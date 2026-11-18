import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Ribbon } from '@/core/components/ribbon/Ribbon';
import type { RibbonTab } from '@/core/components/ribbon/types';
import type { PdfEditorDoc } from '../model/types';
import { EmptyState } from './EmptyState';
import { StatusBar } from './StatusBar';

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
  headerRight,
  statusBar,
  activeTabId,
  onTabChange,
}: PdfEditorViewProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3" data-tool-root>
      {doc ? (
        <Ribbon
          ariaLabel={t('tools.pdfEditor.ribbonLabel')}
          tabs={tabs}
          accent="red"
          defaultTabId="home"
          activeTabId={activeTabId}
          onActiveTabChange={onTabChange}
          headerRight={headerRight}
          collapseLabel={t('tools.pdfEditor.ribbonCollapse')}
          expandLabel={t('tools.pdfEditor.ribbonExpand')}
          testId="pdf-ribbon"
        />
      ) : null}

      {doc && banner ? (
        <p
          role="alert"
          data-testid="pdf-banner"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          {banner}
        </p>
      ) : null}

      <div className="flex min-h-[55vh] flex-col">
        {doc ? (
          <div className="flex min-h-[55vh] flex-1 gap-3">
            {leftPanel}
            <div className="flex min-w-0 flex-1 flex-col">
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
