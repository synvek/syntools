import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createDecoration,
  DEFAULT_FOOTER,
  DEFAULT_HEADER,
  DEFAULT_PAGE_NUMBERS,
  DEFAULT_WATERMARK,
  hasDecoration,
  normalizeDecoration,
} from '../model/decorations';
import type {
  PdfDecoration,
  PdfDecorationAlign,
  PdfDecorationPosition,
  PdfLineDecoration,
  PdfPageNumberRule,
  PdfWatermarkDecoration,
} from '../model/types';

export interface PageDecorationDialogProps {
  open: boolean;
  /** Current decoration; `null`/`undefined` starts from the defaults */
  initial?: PdfDecoration | null;
  onClose(): void;
  /** `undefined` clears the decoration (the "clear" button and an emptied dialog) */
  onApply(decoration: PdfDecoration | undefined): void;
}

const POSITIONS: PdfDecorationPosition[] = [
  'top-center',
  'bottom-center',
  'bottom-left',
  'bottom-right',
];

const ALIGNS: PdfDecorationAlign[] = ['left', 'center', 'right'];

const inputClass =
  'rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';
const labelClass = 'flex items-center justify-between gap-2 text-gray-600 dark:text-gray-300';
const sectionClass = 'flex flex-col gap-2 rounded border border-gray-200 p-2 dark:border-gray-800';

/**
 * Page decoration dialog (P1-A).
 *
 * Page numbers, header, footer and watermark live in one dialog because they share one destination
 * (every page, written on save) — four separate single-purpose dialogs is exactly the fragmentation
 * the editor exists to remove. Empty text is treated as "off", so no section needs its own enable
 * switch apart from page numbers, whose format box is non-empty by default.
 */
export function PageDecorationDialog({
  open,
  initial,
  onClose,
  onApply,
}: PageDecorationDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<PdfDecoration>(createDecoration);

  useEffect(() => {
    if (!open) return;
    setDraft(normalizeDecoration({ ...createDecoration(), ...(initial ?? {}) }));
  }, [open, initial]);

  if (!open) return null;

  const numbers = draft.numbers ?? DEFAULT_PAGE_NUMBERS;
  const header = draft.header ?? DEFAULT_HEADER;
  const footer = draft.footer ?? DEFAULT_FOOTER;
  const watermark = draft.watermark ?? DEFAULT_WATERMARK;

  const setNumbers = (patch: Partial<PdfPageNumberRule>) =>
    setDraft((current) => ({ ...current, numbers: { ...numbers, ...patch } }));
  const setHeader = (patch: Partial<PdfLineDecoration>) =>
    setDraft((current) => ({ ...current, header: { ...header, ...patch } }));
  const setFooter = (patch: Partial<PdfLineDecoration>) =>
    setDraft((current) => ({ ...current, footer: { ...footer, ...patch } }));
  const setWatermark = (patch: Partial<PdfWatermarkDecoration>) =>
    setDraft((current) => ({ ...current, watermark: { ...watermark, ...patch } }));

  // An emptied input keeps the previous value instead of snapping to 0 / the minimum
  const number = (value: string, fallback: number) => {
    if (value.trim() === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.pdfEditor.decorateTitle')}
      data-testid="pdf-decoration-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg bg-white p-4 text-xs shadow-xl dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.pdfEditor.decorateTitle')}
        </h3>
        <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">
          {t('tools.pdfEditor.decorateHint')}
        </p>

        <fieldset className={sectionClass}>
          <legend className="px-1 text-gray-700 dark:text-gray-200">
            {t('tools.pdfEditor.decorateNumbers')}
          </legend>
          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={numbers.enabled}
              data-testid="pdf-decoration-numbers"
              onChange={(event) => setNumbers({ enabled: event.target.checked })}
            />
            {t('tools.pdfEditor.decorateNumbers')}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-600 dark:text-gray-300">
              {t('tools.pdfEditor.decorateNumberFormat')}
            </span>
            <input
              value={numbers.format}
              data-testid="pdf-decoration-number-format"
              onChange={(event) => setNumbers({ format: event.target.value })}
              className={inputClass}
            />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {t('tools.pdfEditor.decorateNumberFormatHint')}
            </span>
          </label>
          <label className={labelClass}>
            {t('tools.pdfEditor.decoratePosition')}
            <select
              value={numbers.position}
              data-testid="pdf-decoration-number-position"
              onChange={(event) =>
                setNumbers({ position: event.target.value as PdfDecorationPosition })
              }
              className={inputClass}
            >
              {POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {t(
                    `tools.pdfEditor.decoratePos${
                      position === 'top-center'
                        ? 'TopCenter'
                        : position === 'bottom-center'
                          ? 'BottomCenter'
                          : position === 'bottom-left'
                            ? 'BottomLeft'
                            : 'BottomRight'
                    }`,
                  )}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={labelClass}>
              {t('tools.pdfEditor.decorateFontSize')}
              <input
                type="number"
                min={6}
                max={36}
                value={numbers.fontSize}
                data-testid="pdf-decoration-number-size"
                onChange={(event) =>
                  setNumbers({ fontSize: number(event.target.value, numbers.fontSize) })
                }
                className={`${inputClass} w-16`}
              />
            </label>
            <label className={labelClass}>
              {t('tools.pdfEditor.decorateStartFrom')}
              <input
                type="number"
                min={1}
                value={numbers.startFrom}
                data-testid="pdf-decoration-number-start"
                onChange={(event) =>
                  setNumbers({ startFrom: number(event.target.value, numbers.startFrom) })
                }
                className={`${inputClass} w-16`}
              />
            </label>
            <label className={labelClass}>
              {t('tools.pdfEditor.decorateMargin')}
              <input
                type="number"
                min={8}
                max={120}
                value={numbers.margin}
                data-testid="pdf-decoration-number-margin"
                onChange={(event) =>
                  setNumbers({ margin: number(event.target.value, numbers.margin) })
                }
                className={`${inputClass} w-16`}
              />
            </label>
            <label className={labelClass}>
              {t('tools.pdfEditor.decorateColor')}
              <input
                type="color"
                value={numbers.color}
                data-testid="pdf-decoration-number-color"
                onChange={(event) => setNumbers({ color: event.target.value })}
                className="h-7 w-10 rounded border border-gray-300 dark:border-gray-700"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className={sectionClass}>
          <legend className="px-1 text-gray-700 dark:text-gray-200">
            {t('tools.pdfEditor.decorateHeader')} / {t('tools.pdfEditor.decorateFooter')}
          </legend>
          {(
            [
              { key: 'header', value: header, update: setHeader },
              { key: 'footer', value: footer, update: setFooter },
            ] as const
          ).map(({ key, value, update }) => (
            <div key={key} className="flex flex-col gap-1">
              <input
                value={value.text}
                placeholder={t(
                  `tools.pdfEditor.${key === 'header' ? 'decorateHeader' : 'decorateFooter'}`,
                )}
                aria-label={t(
                  `tools.pdfEditor.${key === 'header' ? 'decorateHeader' : 'decorateFooter'}`,
                )}
                data-testid={`pdf-decoration-${key}`}
                onChange={(event) => update({ text: event.target.value })}
                className={inputClass}
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={value.align}
                  aria-label={`${t('tools.pdfEditor.decorateAlign')} ${key}`}
                  data-testid={`pdf-decoration-${key}-align`}
                  onChange={(event) => update({ align: event.target.value as PdfDecorationAlign })}
                  className={inputClass}
                >
                  {ALIGNS.map((align) => (
                    <option key={align} value={align}>
                      {t(
                        `tools.pdfEditor.decorateAlign${
                          align === 'left' ? 'Left' : align === 'center' ? 'Center' : 'Right'
                        }`,
                      )}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={6}
                  max={36}
                  value={value.fontSize}
                  aria-label={`${t('tools.pdfEditor.decorateFontSize')} ${key}`}
                  data-testid={`pdf-decoration-${key}-size`}
                  onChange={(event) =>
                    update({ fontSize: number(event.target.value, value.fontSize) })
                  }
                  className={`${inputClass} w-16`}
                />
                <input
                  type="color"
                  value={value.color}
                  aria-label={`${t('tools.pdfEditor.decorateColor')} ${key}`}
                  data-testid={`pdf-decoration-${key}-color`}
                  onChange={(event) => update({ color: event.target.value })}
                  className="h-7 w-10 rounded border border-gray-300 dark:border-gray-700"
                />
              </div>
            </div>
          ))}
        </fieldset>

        <fieldset className={sectionClass}>
          <legend className="px-1 text-gray-700 dark:text-gray-200">
            {t('tools.pdfEditor.decorateWatermark')}
          </legend>
          <input
            value={watermark.text}
            placeholder={t('tools.pdfEditor.decorateWatermarkText')}
            aria-label={t('tools.pdfEditor.decorateWatermarkText')}
            data-testid="pdf-decoration-watermark"
            onChange={(event) => setWatermark({ text: event.target.value })}
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className={labelClass}>
              {t('tools.pdfEditor.decorateFontSize')}
              <input
                type="number"
                min={8}
                max={120}
                value={watermark.fontSize}
                data-testid="pdf-decoration-watermark-size"
                onChange={(event) =>
                  setWatermark({ fontSize: number(event.target.value, watermark.fontSize) })
                }
                className={`${inputClass} w-16`}
              />
            </label>
            <label className={labelClass}>
              {t('tools.pdfEditor.decorateRotation')}
              <input
                type="number"
                min={-90}
                max={90}
                value={watermark.rotation}
                data-testid="pdf-decoration-watermark-rotation"
                onChange={(event) =>
                  setWatermark({ rotation: number(event.target.value, watermark.rotation) })
                }
                className={`${inputClass} w-16`}
              />
            </label>
            <label className={labelClass}>
              {t('tools.pdfEditor.decorateOpacity')}
              <input
                type="number"
                min={5}
                max={100}
                step={5}
                value={Math.round(watermark.opacity * 100)}
                data-testid="pdf-decoration-watermark-opacity"
                onChange={(event) =>
                  setWatermark({
                    opacity: number(event.target.value, watermark.opacity * 100) / 100,
                  })
                }
                className={`${inputClass} w-16`}
              />
            </label>
            <label className={labelClass}>
              {t('tools.pdfEditor.decorateColor')}
              <input
                type="color"
                value={watermark.color}
                data-testid="pdf-decoration-watermark-color"
                onChange={(event) => setWatermark({ color: event.target.value })}
                className="h-7 w-10 rounded border border-gray-300 dark:border-gray-700"
              />
            </label>
            <label className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={watermark.tiled}
                data-testid="pdf-decoration-watermark-tiled"
                onChange={(event) => setWatermark({ tiled: event.target.checked })}
              />
              {t('tools.pdfEditor.decorateTiled')}
            </label>
            {watermark.tiled ? (
              <label className={labelClass}>
                {t('tools.pdfEditor.decorateSpacing')}
                <input
                  type="number"
                  min={60}
                  max={600}
                  step={10}
                  value={watermark.spacing}
                  data-testid="pdf-decoration-watermark-spacing"
                  onChange={(event) =>
                    setWatermark({ spacing: number(event.target.value, watermark.spacing) })
                  }
                  className={`${inputClass} w-16`}
                />
              </label>
            ) : null}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            data-testid="pdf-decoration-clear"
            onClick={() => onApply(undefined)}
            className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.pdfEditor.decorateClear')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              data-testid="pdf-decoration-cancel"
              className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t('tools.pdfEditor.decorateCancel')}
            </button>
            <button
              type="button"
              data-testid="pdf-decoration-apply"
              onClick={() => onApply(hasDecoration(draft) ? normalizeDecoration(draft) : undefined)}
              className="rounded bg-[#b3261e] px-2 py-1 text-white hover:bg-[#8d1d17] disabled:opacity-50"
            >
              {t('tools.pdfEditor.decorateApply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
