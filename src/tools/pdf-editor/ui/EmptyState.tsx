import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { Icon } from '@/core/components/Icon';
// Leaf module, not the `@/core/pdf` barrel: the barrel pulls pdfjs into this chunk
import { PDF_MAX_BYTES } from '@/core/pdf/types';

interface EmptyStateProps {
  onFile: (file: File) => void;
  /** Hard error, e.g. a non-PDF was picked */
  error?: string | null;
  /** Neutral status, e.g. "opening lands in the next milestone" */
  note?: string | null;
  /** Draft restore card, rendered above the drop zone */
  draftPrompt?: ReactNode;
}

/** First screen: what the tool is, the drop zone, and the privacy promise */
export function EmptyState({ onFile, error, note, draftPrompt }: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <Icon name="pdfEdit" className="h-10 w-10 text-gray-400 dark:text-gray-500" />
        <p className="text-base font-medium text-gray-800 dark:text-gray-100">
          {t('tools.pdfEditor.emptyTitle')}
        </p>
      </div>

      {draftPrompt}

      <FileDropZone
        accept=".pdf,.pdfproj,application/pdf"
        maxBytes={PDF_MAX_BYTES}
        onFile={onFile}
        hint={t('tools.pdfEditor.emptyHint')}
        formats={t('tools.pdfEditor.emptyFormats')}
      />

      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="text-xs text-gray-500 dark:text-gray-400">
          {note}
        </p>
      ) : null}

      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        {t('tools.pdfEditor.privacy')}
      </p>
    </div>
  );
}
