import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IMAGE_DPI_OPTIONS, type ImageDpi, type ImageFormat } from '../io/exportImages';
import { parsePageRange } from '../io/pageImport';

export interface ExportImagesDialogResult {
  format: ImageFormat;
  dpi: ImageDpi;
  /** 1-based page numbers in document order */
  pages: number[];
}

interface ExportImagesDialogProps {
  open: boolean;
  pageCount: number;
  busy: boolean;
  onClose(): void;
  onExport(options: ExportImagesDialogResult): void;
}

/**
 * Image export options (M4-4).
 *
 * PNG 150 DPI by default: lossless enough for screenshots, small enough to email. The DPI options
 * are the three values users actually ask for (screen / print / print-ready).
 */
export function ExportImagesDialog({
  open,
  pageCount,
  busy,
  onClose,
  onExport,
}: ExportImagesDialogProps) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ImageFormat>('png');
  const [dpi, setDpi] = useState<ImageDpi>(150);
  const [range, setRange] = useState('');

  useEffect(() => {
    if (!open) return;
    setFormat('png');
    setDpi(150);
    setRange('');
  }, [open]);

  if (!open) return null;

  const pages = parsePageRange(range, pageCount).map((index) => index + 1);
  const invalid = range.trim().length > 0 && pages.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.pdfEditor.exportImagesTitle')}
      data-testid="pdf-export-images-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div className="flex w-full max-w-md flex-col gap-3 rounded-lg bg-white p-4 text-xs shadow-xl dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.pdfEditor.exportImagesTitle')}
        </h3>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-gray-500 dark:text-gray-400">
            {t('tools.pdfEditor.exportFormat')}
          </legend>
          {(['png', 'jpeg'] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
              <input
                type="radio"
                name="image-format"
                checked={format === value}
                onChange={() => setFormat(value)}
                data-testid={`pdf-image-format-${value}`}
              />
              {t(`tools.pdfEditor.${value === 'png' ? 'exportFormatPng' : 'exportFormatJpeg'}`)}
            </label>
          ))}
        </fieldset>

        <label className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-300">
          {t('tools.pdfEditor.exportDpi')}
          <select
            value={dpi}
            data-testid="pdf-image-dpi"
            onChange={(event) => setDpi(Number(event.target.value) as ImageDpi)}
            className="rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            {IMAGE_DPI_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value} DPI
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-gray-600 dark:text-gray-300">
            {t('tools.pdfEditor.exportPages')}
          </span>
          <input
            value={range}
            onChange={(event) => setRange(event.target.value)}
            placeholder={`1-${pageCount}`}
            data-testid="pdf-image-pages"
            className="rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {t('tools.pdfEditor.exportImagesHint')}
          </span>
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
            data-testid="pdf-image-cancel"
            className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.pdfEditor.exportCancel')}
          </button>
          <button
            type="button"
            disabled={busy || invalid || pageCount === 0}
            data-testid="pdf-image-confirm"
            onClick={() => onExport({ format, dpi, pages })}
            className="rounded bg-[#b3261e] px-2 py-1 text-white hover:bg-[#8d1d17] disabled:opacity-50"
          >
            {busy ? t('tools.pdfEditor.exportBusy') : t('tools.pdfEditor.exportConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
