import { clampedFontSize } from './commands';
import {
  DEFAULT_BORDER,
  EMPTY_SHEET_FORMAT,
  type BorderPresetId,
  type BorderSpec,
  type BorderStyleId,
  type HAlign,
  type SheetFormatPatch,
  type SheetFormatState,
  type VAlign,
} from './sheetFormat';

/**
 * State and conversion behind the "设置单元格格式" dialog (P1-2).
 *
 * The dialog edits a *draft* that starts from the current selection and is committed in one go.
 * Everything here is pure so the interesting rules — one undo step, mixed selections, empty size
 * boxes — are unit tests instead of manual clicking.
 */

export interface FormatCellsDraft {
  numberFormat: string;
  fontFamily: string;
  /** Text, not a number: an empty box means "no override", which is not the same as 0 */
  fontSize: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: string;
  fill: string;
  hAlign: Exclude<HAlign, 'mixed'>;
  vAlign: Exclude<VAlign, 'mixed'>;
  wrap: boolean;
  /** Which edges to draw; `keep` leaves the existing border untouched */
  borderPreset: BorderPresetId | 'keep';
  borderStyle: BorderStyleId;
  borderColor: string;
}

export const EMPTY_DRAFT: FormatCellsDraft = {
  numberFormat: '',
  fontFamily: '',
  fontSize: '',
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  color: '',
  fill: '',
  hAlign: 'general',
  vAlign: 'bottom',
  wrap: false,
  borderPreset: 'keep',
  borderStyle: DEFAULT_BORDER.style,
  borderColor: DEFAULT_BORDER.color,
};

/**
 * Seed the draft from the selection. Mixed values collapse the way Office shows them: alignment
 * falls back to the neutral option, colours to "自动", size to an empty box.
 */
export function draftFromFormat(format: SheetFormatState | null): FormatCellsDraft {
  const source = format ?? EMPTY_SHEET_FORMAT;
  return {
    numberFormat: source.numberFormat ?? '',
    fontFamily: source.fontFamily ?? '',
    fontSize: source.fontSize === null ? '' : String(source.fontSize),
    bold: source.bold === true,
    italic: source.italic === true,
    underline: source.underline === true,
    strike: source.strike === true,
    color: source.color ?? '',
    fill: source.fill ?? '',
    hAlign: source.hAlign === 'mixed' ? 'general' : source.hAlign,
    vAlign: source.vAlign === 'mixed' ? 'bottom' : source.vAlign,
    wrap: source.wrap === true,
    borderPreset: 'keep',
    borderStyle: source.border?.style ?? DEFAULT_BORDER.style,
    borderColor: source.border?.color ?? DEFAULT_BORDER.color,
  };
}

export interface FormatCellsCommit {
  /** Font / number / alignment — applied as one `applyFormat` call */
  patch: SheetFormatPatch;
  /** Border edges to draw; `null` means "leave whatever is there" */
  border: { preset: BorderPresetId; spec: BorderSpec } | null;
}

export function commitFromDraft(draft: FormatCellsDraft): FormatCellsCommit {
  const size = draft.fontSize.trim();
  return {
    patch: {
      numberFormat: draft.numberFormat.trim() || null,
      fontFamily: draft.fontFamily || null,
      fontSize: size === '' ? null : clampedFontSize(Number(size)),
      bold: draft.bold,
      italic: draft.italic,
      underline: draft.underline,
      strike: draft.strike,
      color: draft.color || null,
      fill: draft.fill || null,
      hAlign: draft.hAlign,
      vAlign: draft.vAlign,
      wrap: draft.wrap,
    },
    border:
      draft.borderPreset === 'keep'
        ? null
        : {
            preset: draft.borderPreset,
            spec: { style: draft.borderStyle, color: draft.borderColor },
          },
  };
}
