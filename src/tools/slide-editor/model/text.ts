import type { Paragraph, RunStyle, TextAlign, TextBody, TextRun } from './types';

/**
 * Rich-text pure-logic layer: flattens TextBody into a sequence of "char + style + owning paragraph".
 *
 * Why this layer exists: inline editing uses a plain-text textarea, so the new text must be mapped back onto
 * the run-level model afterwards. The early implementation rebuilt paragraphs line by line and applied the
 * first run's style to each, which caused two real defects:
 *   1. mixed styles inside a paragraph (e.g. partial bold) were flattened;
 *   2. paragraph props such as spaceBefore / spaceAfter / indent were dropped.
 * It now diffs the common prefix/suffix and inherits styles per character, recomputing only the changed span.
 */

/** A single flattened character. `paragraph === -1` marks a paragraph separator (\n) */
export interface FlatChar {
  paragraph: number;
  text: string;
  style?: RunStyle;
}

/** TextBody → character sequence (a -1 separator between paragraphs) */
export function flattenBody(body: TextBody): FlatChar[] {
  const chars: FlatChar[] = [];
  body.paragraphs.forEach((paragraph, index) => {
    if (index > 0) chars.push({ paragraph: -1, text: '\n' });
    for (const run of paragraph.runs) {
      // Split by code point so emoji / surrogate pairs aren't cut in half
      for (const text of Array.from(run.text)) {
        chars.push({ paragraph: index, text, style: run.style });
      }
    }
  });
  return chars;
}

/** TextBody → plain text (one-to-one with the textarea content) */
export function bodyToText(body: TextBody): string {
  return flattenBody(body)
    .map((char) => char.text)
    .join('');
}

function styleEquals(a: RunStyle | undefined, b: RunStyle | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false;
  }
  return true;
}

/** Paragraph-level props of one paragraph (without runs) */
function paragraphProps(source: TextBody, origin: number): Omit<Paragraph, 'runs'> {
  const picked = source.paragraphs[origin] ?? source.paragraphs[0];
  if (!picked) return {};
  const { runs: _runs, ...rest } = picked;
  void _runs;
  return rest;
}

/** Character sequence → TextBody: same-style neighbors merge into a run, paragraph props follow the first char */
export function rebuildBody(chars: FlatChar[], source: TextBody): TextBody {
  const paragraphs: Paragraph[] = [];
  let origin = 0;
  let runs: TextRun[] = [];

  const flush = () => {
    paragraphs.push({ ...paragraphProps(source, origin), runs });
    runs = [];
  };

  for (const char of chars) {
    if (char.paragraph === -1) {
      flush();
      continue;
    }
    if (runs.length === 0) origin = char.paragraph;
    const last = runs[runs.length - 1];
    if (last && styleEquals(last.style, char.style)) {
      last.text += char.text;
    } else {
      runs.push({ text: char.text, style: char.style });
    }
  }
  flush();

  // Keep one empty paragraph even for an empty document, otherwise model and render have no anchor
  if (paragraphs.length === 0)
    paragraphs.push({ ...paragraphProps(source, 0), runs: [{ text: '' }] });
  return { ...source, paragraphs };
}

/** Whether "all" chars in [start, end) have a style, for the toolbar's tri-state display */
export function queryStyleRange(body: TextBody, start: number, end: number): RunStyle {
  const chars = flattenBody(body);
  const slice = chars.slice(Math.max(0, start), Math.min(end, chars.length));
  const text = slice.filter((char) => char.paragraph >= 0);
  if (text.length === 0) return {};
  const flags: ('bold' | 'italic' | 'underline' | 'strike')[] = [
    'bold',
    'italic',
    'underline',
    'strike',
  ];
  const result: RunStyle = {};
  for (const flag of flags) {
    result[flag] = text.every((char) => Boolean(char.style?.[flag]));
  }
  return result;
}

/** Apply a style patch to the chars in [start, end) (splitting runs as needed) */
export function applyStyleRange(
  body: TextBody,
  start: number,
  end: number,
  patch: Partial<RunStyle>,
): TextBody {
  if (end <= start) return body;
  const chars = flattenBody(body);
  const from = Math.max(0, start);
  const to = Math.min(end, chars.length);
  let touched = false;
  for (let i = from; i < to; i += 1) {
    const char = chars[i];
    if (char.paragraph < 0) continue;
    char.style = { ...(char.style ?? {}), ...patch };
    touched = true;
  }
  if (!touched) return body;
  return rebuildBody(chars, body);
}

/** Paragraph-level props (without runs), reused when rebuilding paragraphs */
function propsOf(paragraph: Paragraph | undefined): Omit<Paragraph, 'runs'> {
  if (!paragraph) return {};
  const { runs: _runs, ...rest } = paragraph;
  void _runs;
  return rest;
}

/**
 * Diff of the text within a single line: maps the old run sequence onto the new text and returns the merged runs.
 * Only the span after the common prefix and before the common suffix is recomputed; new chars inherit the
 * style of the first replaced char — matching PowerPoint's "inherit from adjacent text" behavior.
 */
function diffLineToRuns(oldRuns: TextRun[], nextLine: string): TextRun[] {
  const oldChars: { text: string; style?: RunStyle }[] = [];
  for (const run of oldRuns) {
    for (const text of Array.from(run.text)) oldChars.push({ text, style: run.style });
  }
  const newChars = Array.from(nextLine);

  let prefix = 0;
  const maxPrefix = Math.min(oldChars.length, newChars.length);
  while (prefix < maxPrefix && oldChars[prefix].text === newChars[prefix]) prefix += 1;

  let suffix = 0;
  const maxSuffix = Math.min(oldChars.length - prefix, newChars.length - prefix);
  while (
    suffix < maxSuffix &&
    oldChars[oldChars.length - 1 - suffix].text === newChars[newChars.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  // Inherit the style of the char before the insertion point: matches PowerPoint's adjacent inheritance
  // (the last char when appending at the end; nothing to inherit when the whole line is empty)
  const inherit = oldChars[Math.max(0, Math.min(prefix - 1, oldChars.length - 1))]?.style;
  const head = oldChars.slice(0, prefix);
  const tail = oldChars.slice(oldChars.length - suffix);
  const middle = newChars
    .slice(prefix, newChars.length - suffix)
    .map((text) => ({ text, style: inherit }));

  const runs: TextRun[] = [];
  for (const char of [...head, ...middle, ...tail]) {
    const last = runs[runs.length - 1];
    if (last && styleEquals(last.style, char.style)) last.text += char.text;
    else runs.push({ text: char.text, style: char.style });
  }
  return runs.length > 0 ? runs : [{ text: '', style: inherit }];
}

/**
 * Replace a TextBody's text with the edited plain text, preserving styles and paragraph props.
 *
 * Paragraph props map per line: same line count → line by line; extra lines inherit the last paragraph's props.
 * Inline styles go through the char-level diff in `diffLineToRuns`, which recomputes only the changed spans.
 */
export function replaceBodyText(body: TextBody, nextText: string): TextBody {
  const oldCount = body.paragraphs.length;
  const newLines = nextText.split('\n');
  const paragraphs: Paragraph[] = newLines.map((line, index) => {
    // Align line by line when the counts match, preserving as much of each paragraph's own props as possible
    const sourceIndex =
      newLines.length === oldCount ? index : Math.min(index, Math.max(0, oldCount - 1));
    const source = body.paragraphs[sourceIndex];
    return { ...propsOf(source), runs: diffLineToRuns(source?.runs ?? [], line) };
  });
  return { ...body, paragraphs };
}

/**
 * Scale every run's font size proportionally, simulating PowerPoint's normAutofit
 * (shrink the text to fit the shape and re-layout, instead of squashing it).
 */
export function scaleBodyFonts(body: TextBody, factor: number): TextBody {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return body;
  return {
    ...body,
    paragraphs: body.paragraphs.map((paragraph) => ({
      ...paragraph,
      runs: paragraph.runs.map((run) => ({
        ...run,
        style: {
          ...(run.style ?? {}),
          size: Math.max(4, (run.style?.size ?? 18) * factor),
        },
      })),
    })),
  };
}

/** Paragraph alignment: written to every paragraph (matching the property panel) */
export function setBodyAlign(body: TextBody, align: TextAlign): TextBody {
  return { ...body, paragraphs: body.paragraphs.map((paragraph) => ({ ...paragraph, align })) };
}
