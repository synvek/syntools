import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parsePageRange } from '../io/pageImport';
import type { DocxExportMode } from '../io/exportDocx';

export interface ExportDocxDialogResult {
  mode: DocxExportMode;
  /** 1-based page numbers in document order */
  pages: number[];
  headerFooter: boolean;
}

interface ExportDocxDialogProps {
  open: boolean;
  pageCount: number;
  busy: boolean;
  onClose(): void;
  onExport(options: ExportDocxDialogResult): void;
}

const MODES: Array<{ id: DocxExportMode; labelKey: string; hintKey: string }> = [
  { id: 'mixed', labelKey: 'exportModeMixed', hintKey: 'exportModeMixedHint' },
  { id: 'text', labelKey: 'exportModeText', hintKey: 'exportModeTextHint' },
  { id: 'raster', labelKey: 'exportModeRaster', hintKey: 'exportModeRasterHint' },
];

/**
 * Word export options (M4-3).
 *
 * Defaults are the safe ones: mixed mode (nothing is silently lost), all pages, no header/footer.
 * The dialog never starts the export itself — the controller owns busy state and the fidelity report.
 */
export function ExportDocxDialog({
  open,
  pageCount,
  busy,
  onClose,
  onExport,
}: ExportDocxDialogProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<DocxExportMode>('mixed');
  const [range, setRange] = useState('');
  const [headerFooter, setHeaderFooter] = useState(false);

  // Reopening starts from the defaults again
  useEffect(() => {
    if (!open) return;
    setMode('mixed');
    setRange('');
    setHeaderFooter(false);
  }, [open]);

  if (!open) return null;

  const pages = parsePageRange(range, pageCount).map((index) => index + 1);
  const invalid = range.trim().length > 0 && pages.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.pdfEditor.exportDocxTitle')}
      data-testid="pdf-export-docx-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div className="flex w-full max-w-lg flex-col gap-3 rounded-lg bg-white p-4 text-xs shadow-xl dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.pdfEditor.exportDocxTitle')}
        </h3>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-gray-500 dark:text-gray-400">
            {t('tools.pdfEditor.exportMode')}
          </legend>
          {MODES.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer gap-2 rounded border px-2 py-1.5 ${
                mode === option.id
                  ? 'border-[#b3261e] bg-[#b3261e]/5'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <input
                type="radio"
                name="docx-mode"
                value={option.id}
                checked={mode === option.id}
                onChange={() => setMode(option.id)}
                data-testid={`pdf-export-mode-${option.id}`}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium text-gray-800 dark:text-gray-100">
                  {t(`tools.pdfEditor.${option.labelKey}`)}
                </span>
                <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                  {t(`tools.pdfEditor.${option.hintKey}`)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="text-gray-600 dark:text-gray-300">
            {t('tools.pdfEditor.exportPages')}
          </span>
          <input
            value={range}
            onChange={(event) => setRange(event.target.value)}
            placeholder={`1-${pageCount}`}
            data-testid="pdf-export-pages"
            className="rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {t('tools.pdfEditor.exportPagesHint')}
          </span>
        </label>

        <label className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={headerFooter}
            onChange={(event) => setHeaderFooter(event.target.checked)}
            data-testid="pdf-export-header-footer"
          />
          {t('tools.pdfEditor.exportHeaderFooter')}
        </label>

        {invalid ? (
          <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
            {t('tools.pdfEditor.exportRangeInvalid')}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            data-testid="pdf-export-cancel"
            className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.pdfEditor.exportCancel')}
          </button>
          <button
            type="button"
            disabled={busy || invalid || pageCount === 0}
            data-testid="pdf-export-confirm"
            onClick={() => onExport({ mode, pages, headerFooter })}
            className="rounded bg-[#b3261e] px-2 py-1 text-white hover:bg-[#8d1d17] disabled:opacity-50"
          >
            {busy ? t('tools.pdfEditor.exportBusy') : t('tools.pdfEditor.exportConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
