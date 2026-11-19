import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PdfSource } from '../model/types';
import { parsePageRange, readPdfFile } from '../io/pageImport';

interface InsertPagesDialogProps {
  open: boolean;
  onClose(): void;
  /** Pages are inserted after the current page by the controller */
  onInsert(source: PdfSource, indices: number[]): void;
}

/**
 * Pick a foreign PDF, choose a page range, insert after the current page.
 *
 * Deliberately not a second open-pipeline: imported pages keep their own `PdfSource` in the document
 * attachments, so they never touch the editor's history or the opened file's bytes.
 */
export function InsertPagesDialog({ open, onClose, onInsert }: InsertPagesDialogProps) {
  const { t } = useTranslation();
  const [source, setSource] = useState<PdfSource | null>(null);
  const [fileName, setFileName] = useState('');
  const [range, setRange] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-opening the dialog must not resurrect the previous file
  useEffect(() => {
    if (open) return;
    setSource(null);
    setFileName('');
    setRange('');
    setError(null);
    setBusy(false);
  }, [open]);

  if (!open) return null;

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const result = await readPdfFile(file);
    setBusy(false);

    if (!result.ok) {
      setSource(null);
      setError(
        result.error === 'NEED_PASSWORD'
          ? t('tools.pdfEditor.insertPagesEncrypted')
          : result.error === 'TOO_LARGE'
            ? t('tools.pdfEditor.insertPagesTooLarge')
            : result.error === 'NOT_PDF'
              ? t('tools.pdfEditor.err.NOT_PDF')
              : t('tools.pdfEditor.err.LOAD_FAILED'),
      );
      return;
    }

    setSource(result.value);
    setFileName(`${file.name} · ${result.value.pageCount}`);
    setRange(`1-${result.value.pageCount}`);
  };

  const confirm = () => {
    if (!source) return;
    const indices = parsePageRange(range, source.pageCount);
    if (indices.length === 0) {
      setError(t('tools.pdfEditor.insertPagesInvalid'));
      return;
    }
    onInsert(source, indices);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.pdfEditor.insertPagesTitle')}
      data-testid="pdf-insert-pages-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg bg-white p-4 text-xs shadow-xl dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.pdfEditor.insertPagesTitle')}
        </h3>

        <label className="flex flex-col gap-1 text-gray-600 dark:text-gray-300">
          {t('tools.pdfEditor.insertPagesFile')}
          <input
            type="file"
            accept=".pdf,application/pdf"
            data-testid="pdf-insert-pages-file"
            onChange={(event) => void pickFile(event.target.files?.[0])}
            className="rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-0.5 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:file:bg-gray-700"
          />
        </label>

        {fileName ? (
          <p
            className="text-[11px] text-gray-500 dark:text-gray-400"
            data-testid="pdf-insert-pages-name"
          >
            {fileName}
          </p>
        ) : null}

        <label className="flex flex-col gap-1 text-gray-600 dark:text-gray-300">
          {t('tools.pdfEditor.insertPagesRange')}
          <input
            type="text"
            value={range}
            placeholder="1-3,5"
            data-testid="pdf-insert-pages-range"
            onChange={(event) => setRange(event.target.value)}
            className="rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] text-gray-800 outline-none focus:border-[#b3261e] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {t('tools.pdfEditor.insertPagesRangeHint')}
          </span>
        </label>

        {error ? (
          <p
            role="alert"
            data-testid="pdf-insert-pages-error"
            className="text-[11px] text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            data-testid="pdf-insert-pages-cancel"
            onClick={onClose}
            className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.pdfEditor.insertPagesCancel')}
          </button>
          <button
            type="button"
            data-testid="pdf-insert-pages-confirm"
            disabled={!source || busy}
            onClick={confirm}
            className="rounded bg-[#b3261e] px-2 py-1 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('tools.pdfEditor.insertPagesConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
