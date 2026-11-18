import { useTranslation } from 'react-i18next';
import { needsUnicodeFont } from '@/core/pdf/text';
import type { ZOrderAction } from '../model/objects';
import type { PdfObject, PdfTextObject } from '../model/types';

interface PropertiesPanelProps {
  /** Current selection (only the single-selection case is editable here) */
  object: PdfObject | null;
  onChangeText(patch: Partial<PdfTextObject>): void;
  /** Note body; annotations (markup / ink / shape) have no text of their own */
  onChangeNoteBody?(body: string): void;
  /** Markup colour, ink colour or shape stroke */
  onChangeColor?(color: string): void;
  /** Ink / shape stroke width in points */
  onChangeWidth?(width: number): void;
  /** Image scaling mode */
  onChangeFit?(fit: 'contain' | 'cover' | 'fill'): void;
  onOpacityChange(value: number): void;
  onToggleLock(): void;
  onZOrder(action: ZOrderAction): void;
  onDelete(): void;
}

const MIN_SIZE = 6;
const MAX_SIZE = 96;

const smallButton =
  'rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700 transition-colors hover:bg-gray-100 motion-reduce:transition-none dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';

/**
 * Right rail: shared object controls (opacity, lock, layer order, delete) plus the text-only style
 * fields. Fields for other kinds arrive with their tools in M2-5 / M3.
 */
export function PropertiesPanel({
  object,
  onChangeText,
  onChangeNoteBody,
  onChangeColor,
  onChangeWidth,
  onChangeFit,
  onOpacityChange,
  onToggleLock,
  onZOrder,
  onDelete,
}: PropertiesPanelProps) {
  const { t } = useTranslation();
  const text = object?.kind === 'text' ? object : null;
  const note = object?.kind === 'note' ? object : null;
  const annotate =
    object && (object.kind === 'markup' || object.kind === 'ink' || object.kind === 'shape')
      ? object
      : null;
  const image = object?.kind === 'image' ? object : null;

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
            {t('tools.pdfEditor.propOpacity')}
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(object.opacity * 100)}
              data-testid="pdf-property-opacity"
              onChange={(event) => onOpacityChange(Number(event.target.value) / 100)}
              className="w-24 accent-[#b3261e]"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              data-testid="pdf-property-lock"
              aria-pressed={object.locked ? 'true' : 'false'}
              onClick={onToggleLock}
              className={smallButton}
            >
              {object.locked ? t('tools.pdfEditor.propUnlock') : t('tools.pdfEditor.propLock')}
            </button>
            <button
              type="button"
              data-testid="pdf-property-front"
              onClick={() => onZOrder('front')}
              className={smallButton}
            >
              {t('tools.pdfEditor.propFront')}
            </button>
            <button
              type="button"
              data-testid="pdf-property-back"
              onClick={() => onZOrder('back')}
              className={smallButton}
            >
              {t('tools.pdfEditor.propBack')}
            </button>
          </div>

          {text ? (
            <>
              <label className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-300">
                {t('tools.pdfEditor.propFontSize')}
                <input
                  type="number"
                  min={MIN_SIZE}
                  max={MAX_SIZE}
                  step={1}
                  value={Math.round(text.fontSize)}
                  data-testid="pdf-property-font-size"
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isFinite(value)) return;
                    onChangeText({ fontSize: Math.min(MAX_SIZE, Math.max(MIN_SIZE, value)) });
                  }}
                  className="w-16 rounded border border-gray-300 bg-white px-1.5 py-1 text-right tabular-nums text-gray-800 outline-none focus:border-[#b3261e] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </label>

              <label className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-300">
                {t('tools.pdfEditor.propColor')}
                <input
                  type="color"
                  value={text.color}
                  data-testid="pdf-property-color"
                  onChange={(event) => onChangeText({ color: event.target.value })}
                  className="h-6 w-10 cursor-pointer rounded border border-gray-300 bg-transparent p-0 dark:border-gray-700"
                />
              </label>

              {needsUnicodeFont(text.text) ? (
                <p
                  role="note"
                  className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400"
                >
                  {t('tools.pdfEditor.textRasterNote')}
                </p>
              ) : null}
            </>
          ) : null}

          {annotate ? (
            <>
              <label className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-300">
                {t('tools.pdfEditor.propColor')}
                <input
                  type="color"
                  value={annotate.kind === 'shape' ? annotate.stroke : annotate.color}
                  data-testid="pdf-property-annotation-color"
                  onChange={(event) => onChangeColor?.(event.target.value)}
                  className="h-6 w-10 cursor-pointer rounded border border-gray-300 bg-transparent p-0 dark:border-gray-700"
                />
              </label>

              {annotate.kind !== 'markup' ? (
                <label className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-300">
                  {t('tools.pdfEditor.propStrokeWidth')}
                  <input
                    type="number"
                    min={0.5}
                    max={12}
                    step={0.5}
                    value={annotate.width}
                    data-testid="pdf-property-stroke-width"
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value)) onChangeWidth?.(value);
                    }}
                    className="w-16 rounded border border-gray-300 bg-white px-1.5 py-1 text-right tabular-nums text-gray-800 outline-none focus:border-[#b3261e] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                </label>
              ) : null}
            </>
          ) : null}

          {image && onChangeFit ? (
            <label className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-300">
              {t('tools.pdfEditor.propImageFit')}
              <select
                value={image.fit}
                data-testid="pdf-property-fit"
                onChange={(event) =>
                  onChangeFit(event.target.value as 'contain' | 'cover' | 'fill')
                }
                className="rounded border border-gray-300 bg-white px-1 py-1 text-[11px] text-gray-800 outline-none focus:border-[#b3261e] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="contain">{t('tools.pdfEditor.fitContain')}</option>
                <option value="cover">{t('tools.pdfEditor.fitCover')}</option>
                <option value="fill">{t('tools.pdfEditor.fitFill')}</option>
              </select>
            </label>
          ) : null}

          {note && onChangeNoteBody ? (
            <label className="flex flex-col gap-1 text-gray-600 dark:text-gray-300">
              {t('tools.pdfEditor.propNoteBody')}
              <textarea
                value={note.body}
                rows={3}
                data-testid="pdf-property-note-body"
                onChange={(event) => onChangeNoteBody(event.target.value)}
                className="w-full resize-none rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] text-gray-800 outline-none focus:border-[#b3261e] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
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
