import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildPrintPages,
  DEFAULT_PRINT_OPTIONS,
  PAPER_SIZES,
  type Orientation,
  type PaperSize,
  type PrintOptions,
  type SlidesPerPage,
} from '../io/print';
import { Field, SelectInput, ToggleGroup } from './controls';

/**
 * Print setup: paper / orientation / margins / slides per sheet / page numbers.
 * Everything is derived from the pure layout function, so the page count shown in the
 * dialog always matches what gets printed or exported.
 */
export function PrintDialog({
  slideCount,
  aspect,
  onCancel,
  onPrint,
  onExportPdf,
  busy = false,
}: {
  slideCount: number;
  /** Slide width/height ratio, so previews stay faithful to the deck */
  aspect: number;
  onCancel: () => void;
  onPrint: (options: PrintOptions) => void;
  onExportPdf: (options: PrintOptions) => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS);

  const patch = (next: Partial<PrintOptions>) => setOptions((current) => ({ ...current, ...next }));

  const pageCount = useMemo(
    () => buildPrintPages(slideCount, options, aspect).length,
    [slideCount, options, aspect],
  );

  const paperOptions = Object.keys(PAPER_SIZES) as PaperSize[];
  const marginOptions = ['0', '18', '36', '54'];
  const marginLabels = ['0', '6', '12', '18'];
  const perPageOptions: SlidesPerPage[] = [1, 2, 4, 6];
  const disabled = busy || slideCount === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.slide.printSettings')}
    >
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.slide.printSettings')}
        </h2>

        <div className="mt-3 flex flex-col gap-2">
          <Field label={t('tools.slide.paperSize')}>
            <SelectInput
              value={options.paper}
              options={paperOptions}
              onChange={(value) => patch({ paper: value as PaperSize })}
              ariaLabel={t('tools.slide.paperSize')}
            />
          </Field>
          <Field label={t('tools.slide.orientation')}>
            <ToggleGroup<Orientation>
              value={options.orientation}
              ariaLabel={t('tools.slide.orientation')}
              options={[
                { value: 'portrait', label: t('tools.slide.portrait') },
                { value: 'landscape', label: t('tools.slide.landscape') },
              ]}
              onChange={(value) => patch({ orientation: value })}
            />
          </Field>
          <Field label={t('tools.slide.slidesPerPage')}>
            <ToggleGroup<SlidesPerPage>
              value={options.perPage}
              ariaLabel={t('tools.slide.slidesPerPage')}
              options={perPageOptions.map((value) => ({ value, label: String(value) }))}
              onChange={(value) => patch({ perPage: value })}
            />
          </Field>
          <Field label={t('tools.slide.margin')}>
            <SelectInput
              value={String(options.margin)}
              options={marginOptions}
              labels={marginLabels.map((label) => `${label} mm`)}
              onChange={(value) => patch({ margin: Number(value) })}
              ariaLabel={t('tools.slide.margin')}
            />
          </Field>
          <label className="flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={options.pageNumbers}
              onChange={(event) => patch({ pageNumbers: event.target.checked })}
            />
            {t('tools.slide.pageNumbers')}
          </label>
        </div>

        <p className="mt-3 text-[12px] text-gray-500 dark:text-gray-400">
          {t('tools.slide.printPagesInfo', { count: pageCount })}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px] text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.slide.printCancel')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onExportPdf(options)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px] text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.slide.exportPdf')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPrint(options)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
          >
            {t('tools.slide.print')}
          </button>
        </div>
      </div>
    </div>
  );
}
