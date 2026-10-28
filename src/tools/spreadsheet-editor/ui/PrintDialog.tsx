import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildSheetPrintModel,
  DEFAULT_SHEET_PRINT_OPTIONS,
  PAPER_SIZES,
  paginateSheet,
  resolvePrintRange,
  type CellRange,
  type Orientation,
  type PaperSize,
  type PrintAreaMode,
  type SheetPrintOptions,
} from '../print';
import type { WorkbookSnapshot } from '../xlsx-io';

/**
 * Print setup for a spreadsheet: area, paper, orientation, scaling, repeated header and gridlines.
 * The page count is computed with the same pure pagination used by printing / PDF export, so the
 * number shown always matches what comes out.
 */
export function PrintDialog({
  snapshot,
  sheetId,
  selection,
  busy = false,
  onCancel,
  onPrint,
  onExportPdf,
}: {
  snapshot: WorkbookSnapshot;
  sheetId: string | null;
  /** Current selection (0-based inclusive); enables the "current selection" area option */
  selection: CellRange | null;
  busy?: boolean;
  onCancel: () => void;
  onPrint: (options: SheetPrintOptions, range: CellRange | null) => void;
  onExportPdf: (options: SheetPrintOptions, range: CellRange | null) => void;
}) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<SheetPrintOptions>(DEFAULT_SHEET_PRINT_OPTIONS);
  const [areaMode, setAreaMode] = useState<PrintAreaMode>(selection ? 'selection' : 'used');

  const patch = (next: Partial<SheetPrintOptions>) =>
    setOptions((current) => ({ ...current, ...next }));

  const { pageCount, range } = useMemo(() => {
    const sheet = sheetId ? snapshot.sheets?.[sheetId] : undefined;
    if (!sheet) return { pageCount: 0, range: null };
    const resolved = resolvePrintRange(sheet, areaMode, selection);
    const model = buildSheetPrintModel(snapshot, sheetId, resolved);
    if (!model) return { pageCount: 0, range: null };
    return { pageCount: paginateSheet(model, options).length, range: resolved };
  }, [snapshot, sheetId, areaMode, selection, options]);

  const paperOptions = Object.keys(PAPER_SIZES) as PaperSize[];
  const areaOptions: { value: PrintAreaMode; label: string; disabled?: boolean }[] = [
    { value: 'selection', label: t('tools.sheet.printAreaSelection'), disabled: !selection },
    { value: 'used', label: t('tools.sheet.printAreaUsed') },
    { value: 'sheet', label: t('tools.sheet.printAreaSheet') },
  ];
  const disabled = busy || pageCount === 0;

  const selectClass =
    'h-7 rounded-md border border-gray-300 bg-white px-2 text-[12px] text-gray-800 outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.sheet.printSettings')}
    >
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.sheet.printSettings')}
        </h2>

        <div className="mt-3 flex flex-col gap-2 text-[12px] text-gray-600 dark:text-gray-300">
          <label className="flex items-center justify-between gap-2">
            <span>{t('tools.sheet.printArea')}</span>
            <select
              aria-label={t('tools.sheet.printArea')}
              value={areaMode}
              onChange={(event) => setAreaMode(event.target.value as PrintAreaMode)}
              className={selectClass}
            >
              {areaOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between gap-2">
            <span>{t('tools.sheet.paperSize')}</span>
            <select
              aria-label={t('tools.sheet.paperSize')}
              value={options.paper}
              onChange={(event) => patch({ paper: event.target.value as PaperSize })}
              className={selectClass}
            >
              {paperOptions.map((paper) => (
                <option key={paper} value={paper}>
                  {paper}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between gap-2">
            <span>{t('tools.sheet.orientation')}</span>
            <select
              aria-label={t('tools.sheet.orientation')}
              value={options.orientation}
              onChange={(event) => patch({ orientation: event.target.value as Orientation })}
              className={selectClass}
            >
              <option value="portrait">{t('tools.sheet.portrait')}</option>
              <option value="landscape">{t('tools.sheet.landscape')}</option>
            </select>
          </label>

          <label className="flex items-center justify-between gap-2">
            <span>{t('tools.sheet.scale')}</span>
            <select
              aria-label={t('tools.sheet.scale')}
              value={options.scale}
              onChange={(event) =>
                patch({ scale: event.target.value as SheetPrintOptions['scale'] })
              }
              className={selectClass}
            >
              <option value="fit">{t('tools.sheet.scaleFit')}</option>
              <option value="actual">{t('tools.sheet.scaleActual')}</option>
            </select>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.repeatHeaderRow}
              onChange={(event) => patch({ repeatHeaderRow: event.target.checked })}
            />
            {t('tools.sheet.repeatHeaderRow')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.gridlines}
              onChange={(event) => patch({ gridlines: event.target.checked })}
            />
            {t('tools.sheet.gridlines')}
          </label>
        </div>

        <p className="mt-3 text-[12px] text-gray-500 dark:text-gray-400">
          {pageCount === 0
            ? t('tools.sheet.printEmpty')
            : t('tools.sheet.printPagesInfo', { count: pageCount })}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px] text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.sheet.printCancel')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onExportPdf(options, range)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px] text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.sheet.exportPdf')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPrint(options, range)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
          >
            {t('tools.sheet.print')}
          </button>
        </div>
      </div>
    </div>
  );
}
