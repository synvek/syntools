import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BORDER_PRESETS,
  BORDER_STYLES,
  FONT_FAMILY_PRESETS,
  FONT_SIZE_PRESETS,
  NUMBER_FORMAT_PRESETS,
  type BorderPresetId,
  type BorderStyleId,
  type SheetFormatState,
} from '../sheetFormat';
import type { FormatCellsDraft } from '../formatCells';
import { draftFromFormat } from '../formatCells';

/**
 * "设置单元格格式" (P1-2) — Excel's Ctrl+1 dialog, cut down to what this editor can actually honour.
 *
 * Four tabs instead of six: 数字 / 字体 / 对齐 / 边框. Protection lives in the sheet-protection panel
 * and there is no theme-colour picker, so those tabs would be empty buttons.
 *
 * The whole dialog commits as **one** `applyFormat` call plus (optionally) one border command, which
 * keeps a repaint to a single undo step for the styling part.
 */

type TabId = 'number' | 'font' | 'align' | 'border';

const TABS: Array<{ id: TabId; labelKey: string }> = [
  { id: 'number', labelKey: 'fmtTabNumber' },
  { id: 'font', labelKey: 'fmtTabFont' },
  { id: 'align', labelKey: 'fmtTabAlign' },
  { id: 'border', labelKey: 'fmtTabBorder' },
];

export interface FormatCellsDialogProps {
  open: boolean;
  /** Current selection format; `null` (nothing selected yet) behaves like an empty selection */
  format: SheetFormatState | null;
  onApply: (draft: FormatCellsDraft) => void;
  onClose: () => void;
}

export function FormatCellsDialog({ open, format, onApply, onClose }: FormatCellsDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<FormatCellsDraft>(() => draftFromFormat(format));
  const [tab, setTab] = useState<TabId>('number');

  // Re-seed on every open: the dialog must show the selection it is about to change
  useEffect(() => {
    if (!open) return;
    setDraft(draftFromFormat(format));
    setTab('number');
  }, [open, format]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const patch = <K extends keyof FormatCellsDraft>(key: K, value: FormatCellsDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const inputClass =
    'h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-800 outline-none focus:border-green-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';
  const labelClass = 'flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400';
  const toggleClass = (active: boolean) =>
    `h-8 w-8 rounded-md border text-xs font-semibold ${
      active
        ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        : 'border-gray-300 text-gray-600 hover:bg-black/[0.03] dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/10'
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.sheet.r.formatCellsDialog')}
      data-testid="sheet-format-cells-dialog"
    >
      <div className="flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.sheet.r.formatCellsDialog')}
        </h2>

        <div
          role="tablist"
          aria-label={t('tools.sheet.r.formatCellsDialog')}
          className="flex gap-1"
        >
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              data-testid={`sheet-format-tab-${entry.id}`}
              onClick={() => setTab(entry.id)}
              className={
                tab === entry.id
                  ? 'rounded-md border border-green-600 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'rounded-md border border-transparent px-3 py-1.5 text-xs text-gray-600 hover:bg-black/[0.04] dark:text-gray-300 dark:hover:bg-white/10'
              }
            >
              {t(`tools.sheet.r.${entry.labelKey}`)}
            </button>
          ))}
        </div>

        <div className="min-h-[168px]">
          {tab === 'number' ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1">
                {NUMBER_FORMAT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => patch('numberFormat', preset.pattern)}
                    className={
                      draft.numberFormat === preset.pattern
                        ? 'rounded border border-green-600 px-2 py-1 text-[11px] text-green-700 dark:text-green-300'
                        : 'rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-black/[0.04] dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/10'
                    }
                  >
                    {t(`tools.sheet.r.${preset.labelKey}`)}
                  </button>
                ))}
              </div>
              <label className={labelClass}>
                {t('tools.sheet.r.numberFormat')}
                <input
                  value={draft.numberFormat}
                  data-testid="sheet-format-number-input"
                  onChange={(event) => patch('numberFormat', event.target.value)}
                  placeholder="0.00"
                  className={`${inputClass} flex-1`}
                />
              </label>
            </div>
          ) : null}

          {tab === 'font' ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <label className={`${labelClass} flex-1`}>
                  {t('tools.sheet.r.fontFamily')}
                  <select
                    value={draft.fontFamily}
                    onChange={(event) => patch('fontFamily', event.target.value)}
                    className={`${inputClass} flex-1`}
                  >
                    <option value="">{t('tools.sheet.r.fontDefault')}</option>
                    {FONT_FAMILY_PRESETS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  {t('tools.sheet.r.fontSize')}
                  <input
                    list="sheet-format-sizes"
                    value={draft.fontSize}
                    data-testid="sheet-format-size-input"
                    onChange={(event) => patch('fontSize', event.target.value)}
                    className={`${inputClass} w-16`}
                  />
                  <datalist id="sheet-format-sizes">
                    {FONT_SIZE_PRESETS.map((size) => (
                      <option key={size} value={size} />
                    ))}
                  </datalist>
                </label>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-pressed={draft.bold}
                  aria-label={t('tools.sheet.r.bold')}
                  onClick={() => patch('bold', !draft.bold)}
                  className={toggleClass(draft.bold)}
                >
                  B
                </button>
                <button
                  type="button"
                  aria-pressed={draft.italic}
                  aria-label={t('tools.sheet.r.italic')}
                  onClick={() => patch('italic', !draft.italic)}
                  className={`${toggleClass(draft.italic)} italic`}
                >
                  I
                </button>
                <button
                  type="button"
                  aria-pressed={draft.underline}
                  aria-label={t('tools.sheet.r.underline')}
                  onClick={() => patch('underline', !draft.underline)}
                  className={`${toggleClass(draft.underline)} underline`}
                >
                  U
                </button>
                <button
                  type="button"
                  aria-pressed={draft.strike}
                  aria-label={t('tools.sheet.r.strike')}
                  onClick={() => patch('strike', !draft.strike)}
                  className={`${toggleClass(draft.strike)} line-through`}
                >
                  S
                </button>
                <label className={`${labelClass} ml-2`}>
                  {t('tools.sheet.r.fontColor')}
                  <input
                    type="color"
                    value={draft.color || '#000000'}
                    onChange={(event) => patch('color', event.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => patch('color', '')}
                  className="text-[11px] text-gray-500 underline dark:text-gray-400"
                >
                  {t('tools.sheet.r.autoColor')}
                </button>
                <label className={`${labelClass} ml-2`}>
                  {t('tools.sheet.r.fillColor')}
                  <input
                    type="color"
                    value={draft.fill || '#ffffff'}
                    onChange={(event) => patch('fill', event.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => patch('fill', '')}
                  className="text-[11px] text-gray-500 underline dark:text-gray-400"
                >
                  {t('tools.sheet.r.noFill')}
                </button>
              </div>
            </div>
          ) : null}

          {tab === 'align' ? (
            <div className="flex flex-col gap-3">
              <label className={labelClass}>
                {t('tools.sheet.grp.align')}
                <select
                  value={draft.hAlign}
                  data-testid="sheet-format-halign"
                  onChange={(event) =>
                    patch('hAlign', event.target.value as FormatCellsDraft['hAlign'])
                  }
                  className={inputClass}
                >
                  <option value="general">{t('tools.sheet.r.alignGeneral')}</option>
                  <option value="left">{t('tools.sheet.r.alignLeft')}</option>
                  <option value="center">{t('tools.sheet.r.alignCenter')}</option>
                  <option value="right">{t('tools.sheet.r.alignRight')}</option>
                </select>
              </label>
              <label className={labelClass}>
                {t('tools.sheet.r.alignTop')}
                <select
                  value={draft.vAlign}
                  data-testid="sheet-format-valign"
                  onChange={(event) =>
                    patch('vAlign', event.target.value as FormatCellsDraft['vAlign'])
                  }
                  className={inputClass}
                >
                  <option value="top">{t('tools.sheet.r.alignTop')}</option>
                  <option value="middle">{t('tools.sheet.r.alignMiddle')}</option>
                  <option value="bottom">{t('tools.sheet.r.alignBottom')}</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={draft.wrap}
                  onChange={(event) => patch('wrap', event.target.checked)}
                />
                {t('tools.sheet.r.wrapText')}
              </label>
            </div>
          ) : null}

          {tab === 'border' ? (
            <div className="flex flex-col gap-3">
              <label className={labelClass}>
                {t('tools.sheet.r.borders')}
                <select
                  value={draft.borderPreset}
                  data-testid="sheet-format-border-preset"
                  onChange={(event) =>
                    patch('borderPreset', event.target.value as BorderPresetId | 'keep')
                  }
                  className={inputClass}
                >
                  <option value="keep">{t('tools.sheet.r.fmtBorderKeep')}</option>
                  {BORDER_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {t(`tools.sheet.r.${preset.labelKey}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                {t('tools.sheet.r.fmtBorderStyle')}
                <select
                  value={draft.borderStyle}
                  data-testid="sheet-format-border-style"
                  onChange={(event) => patch('borderStyle', event.target.value as BorderStyleId)}
                  className={inputClass}
                >
                  {BORDER_STYLES.map((style) => (
                    <option key={style.id} value={style.id}>
                      {t(`tools.sheet.r.${style.labelKey}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                {t('tools.sheet.r.fmtBorderColor')}
                <input
                  type="color"
                  value={draft.borderColor}
                  onChange={(event) => patch('borderColor', event.target.value)}
                  className="h-7 w-9 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-gray-300 px-3 text-xs text-gray-600 hover:bg-black/[0.03] dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/10"
          >
            {t('tools.sheet.printCancel')}
          </button>
          <button
            type="button"
            data-testid="sheet-format-apply"
            onClick={() => onApply(draft)}
            className="h-8 rounded-md bg-green-700 px-3 text-xs font-medium text-white hover:bg-green-800"
          >
            {t('tools.sheet.r.numberApply')}
          </button>
        </div>
      </div>
    </div>
  );
}
