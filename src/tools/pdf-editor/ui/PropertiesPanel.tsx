import { useTranslation } from 'react-i18next';
import { needsUnicodeFont } from '@/core/pdf/text';
import type { PdfTextObject } from '../model/types';

interface PropertiesPanelProps {
  /** Selected object; only text exists in M1 */
  object: PdfTextObject | null;
  onChange(patch: Partial<PdfTextObject>): void;
  onDelete(): void;
}

const MIN_SIZE = 6;
const MAX_SIZE = 96;

/**
 * Right rail: the three things M1 lets the user change on a text box (size, colour, delete).
 *
 * Everything else (bold, box, rotation) is already in the model and arrives with the annotation tab
 * in M2 — shipping disabled controls here would just be noise.
 */
export function PropertiesPanel({ object, onChange, onDelete }: PropertiesPanelProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="pdf-properties"
      className="flex max-h-full w-56 shrink-0 flex-col gap-3 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 text-xs dark:border-gray-800 dark:bg-gray-900"
    >
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400">
        {t('tools.pdfEditor.propertiesTitle')}
      </h3>

      {object ? (
        <>
          <label className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-300">
            {t('tools.pdfEditor.propFontSize')}
            <input
              type="number"
              min={MIN_SIZE}
              max={MAX_SIZE}
              step={1}
              value={Math.round(object.fontSize)}
              data-testid="pdf-property-font-size"
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                onChange({ fontSize: Math.min(MAX_SIZE, Math.max(MIN_SIZE, value)) });
              }}
              className="w-16 rounded border border-gray-300 bg-white px-1.5 py-1 text-right tabular-nums text-gray-800 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>

          <label className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-300">
            {t('tools.pdfEditor.propColor')}
            <input
              type="color"
              value={object.color}
              data-testid="pdf-property-color"
              onChange={(event) => onChange({ color: event.target.value })}
              className="h-6 w-10 cursor-pointer rounded border border-gray-300 bg-transparent p-0 dark:border-gray-700"
            />
          </label>

          {needsUnicodeFont(object.text) ? (
            <p
              role="note"
              className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400"
            >
              {t('tools.pdfEditor.textRasterNote')}
            </p>
          ) : null}

          <button
            type="button"
            data-testid="pdf-property-delete"
            onClick={onDelete}
            className="mt-auto rounded border border-red-300 px-2 py-1 text-red-600 transition-colors hover:bg-red-50 motion-reduce:transition-none dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            {t('tools.pdfEditor.propDelete')}
          </button>
        </>
      ) : (
        <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          {t('tools.pdfEditor.propertiesEmpty')}
        </p>
      )}
    </div>
  );
}
