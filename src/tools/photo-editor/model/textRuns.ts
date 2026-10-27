import type { TextLayer, TextRun, TextRunStyle } from './types';

/**
 * Rich-text run helpers (pure logic, no DOM).
 *
 * A text layer stores its plain text in `text` and optional per-range overrides in `runs`.
 * The two must always describe the same characters: `runs.map(r => r.text).join('') === text`.
 * Every mutation in this module preserves that invariant, and callers use `runs` only when the
 * layer really has more than one style (otherwise the native/fast path renders the whole text).
 */

export type TextLayerModel = Extract<TextLayer, { kind: 'text' }>;

export interface ResolvedRunStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fill: string;
  fontSize: number;
}

/** Merge a run's overrides onto the layer-level character style */
export function resolveRunStyle(layer: TextLayerModel, style?: TextRunStyle): ResolvedRunStyle {
  return {
    bold: style?.bold ?? layer.bold,
    italic: style?.italic ?? layer.italic,
    underline: style?.underline ?? layer.underline,
    fill: style?.fill ?? layer.fill,
    fontSize: style?.fontSize ?? layer.fontSize,
  };
}

/** Effective runs: the stored ones when valid, otherwise the whole text as one default run */
export function effectiveRuns(layer: TextLayerModel): TextRun[] {
  if (layer.runs && layer.runs.length > 0) return layer.runs;
  return [{ text: layer.text }];
}

/**
 * Whether the layer needs per-run rendering.
 *
 * True for multiple runs **and** for a single run carrying overrides: applying a style to the whole
 * text can collapse to one run, which still must be rendered with the per-run path (otherwise it
 * would be masked by the layer-level style).
 */
export function hasRichText(layer: Pick<TextLayerModel, 'runs'>): boolean {
  if (!layer.runs || layer.runs.length === 0) return false;
  if (layer.runs.length > 1) return true;
  const style = layer.runs[0].style;
  return Boolean(style && Object.keys(style).length > 0);
}

/** Plain text of a run list (one-to-one with the textarea content) */
export function runsToText(runs: TextRun[]): string {
  return runs.map((run) => run.text).join('');
}

function styleValue(style: TextRunStyle | undefined, key: keyof TextRunStyle): unknown {
  return style?.[key];
}

/** Compare two run styles, treating absent fields as equal to `undefined` */
function styleEquals(a: TextRunStyle | undefined, b: TextRunStyle | undefined): boolean {
  const keys: (keyof TextRunStyle)[] = ['bold', 'italic', 'underline', 'fill', 'fontSize'];
  return keys.every((key) => styleValue(a, key) === styleValue(b, key));
}

function isEmptyStyle(style: TextRunStyle | undefined): boolean {
  return !style || Object.keys(style).length === 0;
}

interface StyledChar {
  ch: string;
  style: TextRunStyle;
}

function flattenRuns(runs: TextRun[]): StyledChar[] {
  const out: StyledChar[] = [];
  for (const run of runs) {
    // Split by code point so emoji / surrogate pairs are not cut in half
    for (const ch of Array.from(run.text)) out.push({ ch, style: run.style ?? {} });
  }
  return out;
}

/** Characters → runs: same-style neighbors merge, empty runs are dropped */
function charsToRuns(chars: StyledChar[]): TextRun[] {
  const runs: TextRun[] = [];
  for (const char of chars) {
    const last = runs[runs.length - 1];
    if (last && styleEquals(last.style, char.style)) {
      last.text += char.ch;
    } else {
      runs.push({ text: char.ch, style: isEmptyStyle(char.style) ? undefined : { ...char.style } });
    }
  }
  return runs.filter((run) => run.text.length > 0);
}

/**
 * Remap stored runs after the plain text changed in the textarea / inline editor.
 *
 * Only the span between the common prefix and suffix is new; those characters inherit the style of
 * the character before the insertion point (matching how rich-text editors behave).
 * Returns `undefined` when the layer had no runs, so plain text stays on the cheap path.
 */
export function remapRunsAfterTextEdit(
  layer: TextLayerModel,
  nextText: string,
): TextRun[] | undefined {
  if (!layer.runs || layer.runs.length === 0) return undefined;
  if (runsToText(layer.runs) === nextText) return layer.runs;

  const oldChars = flattenRuns(layer.runs);
  const nextChars = Array.from(nextText);

  let prefix = 0;
  const maxPrefix = Math.min(oldChars.length, nextChars.length);
  while (prefix < maxPrefix && oldChars[prefix].ch === nextChars[prefix]) prefix += 1;

  let suffix = 0;
  const maxSuffix = Math.min(oldChars.length - prefix, nextChars.length - prefix);
  while (
    suffix < maxSuffix &&
    oldChars[oldChars.length - 1 - suffix].ch === nextChars[nextChars.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const inherit = oldChars[Math.max(0, Math.min(prefix - 1, oldChars.length - 1))]?.style ?? {};
  const head = oldChars.slice(0, prefix);
  const tail = oldChars.slice(oldChars.length - suffix);
  const middle = nextChars
    .slice(prefix, nextChars.length - suffix)
    .map((ch) => ({ ch, style: { ...inherit } }));

  const runs = charsToRuns([...head, ...middle, ...tail]);
  return runs.length > 0 ? runs : [{ text: '' }];
}

/** Apply a style patch to the character range `[start, end)`, returning the new run list */
export function applyRunStyleToRange(
  layer: TextLayerModel,
  start: number,
  end: number,
  patch: TextRunStyle,
): TextRun[] {
  const chars = flattenRuns(effectiveRuns(layer));
  const from = Math.max(0, Math.min(start, chars.length));
  const to = Math.max(0, Math.min(end, chars.length));
  if (to <= from) return effectiveRuns(layer);
  for (let index = from; index < to; index += 1) {
    chars[index].style = { ...chars[index].style, ...patch };
  }
  return charsToRuns(chars);
}

/** Read the shared style of a range (for tri-state buttons); returns the resolved style of the first char */
export function rangeRunStyle(layer: TextLayerModel, start: number, end: number): TextRunStyle {
  const chars = flattenRuns(effectiveRuns(layer));
  const from = Math.max(0, Math.min(start, chars.length));
  const to = Math.max(from, Math.min(end, chars.length));
  const slice = chars.slice(from, to);
  if (slice.length === 0) return {};
  const first = slice[0].style;
  const flags: (keyof TextRunStyle)[] = ['bold', 'italic', 'underline', 'fill', 'fontSize'];
  const result: TextRunStyle = {};
  for (const key of flags) {
    if (first[key] !== undefined && slice.every((char) => char.style[key] === first[key])) {
      (result as Record<string, unknown>)[key] = first[key];
    }
  }
  return result;
}
