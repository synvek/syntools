import type { SlideDoc, SlideElement, TextBody } from './types';

/**
 * Cross-slide find and replace (pure functions).
 *
 * Covers every model location that holds text: text boxes / text inside shapes / table cells / notes.
 * Chart categories and series names are excluded (changing them would break data semantics).
 */

export interface TextHit {
  slideIndex: number;
  elementId: string;
  /** Hit location kind: text = element body, table = cell, notes = speaker notes */
  scope: 'text' | 'table' | 'notes';
  /** Row/column of a table hit (scope === 'table') */
  cell?: { row: number; col: number };
  /** Number of matches in that spot */
  count: number;
}

export interface FindOptions {
  matchCase?: boolean;
  /** Whether to search speaker notes */
  includeNotes?: boolean;
}

function haystack(hay: string, query: string, matchCase: boolean): number {
  const source = matchCase ? hay : hay.toLowerCase();
  const needle = matchCase ? query : query.toLowerCase();
  if (!needle) return 0;
  let count = 0;
  let cursor = source.indexOf(needle);
  while (cursor !== -1) {
    count += 1;
    cursor = source.indexOf(needle, cursor + needle.length);
  }
  return count;
}

function bodyText(body: TextBody | undefined): string {
  if (!body) return '';
  return body.paragraphs
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(''))
    .join('\n');
}

/** Searchable text inside an element (excluding chart data) */
export function elementText(element: SlideElement): string {
  if (element.type === 'text') return bodyText(element.body);
  if (element.type === 'shape') return bodyText(element.body);
  if (element.type === 'table') {
    return element.rows
      .flatMap((row) => row.map((cell) => cell.text ?? ''))
      .filter(Boolean)
      .join('\n');
  }
  if (element.type === 'formula') return element.latex;
  return '';
}

/** Count matches across the document (used by the find panel's "N results") */
export function countMatches(doc: SlideDoc, query: string, options: FindOptions = {}): number {
  if (!query.trim()) return 0;
  const matchCase = options.matchCase ?? false;
  let total = 0;
  for (const slide of doc.slides) {
    for (const element of slide.elements) {
      total += haystack(elementText(element), query, matchCase);
    }
    if (options.includeNotes) total += haystack(slide.notes ?? '', query, matchCase);
  }
  return total;
}

/** List every hit (used to step to "next") */
export function findInDoc(doc: SlideDoc, query: string, options: FindOptions = {}): TextHit[] {
  if (!query.trim()) return [];
  const matchCase = options.matchCase ?? false;
  const hits: TextHit[] = [];
  doc.slides.forEach((slide, slideIndex) => {
    for (const element of slide.elements) {
      if (element.type === 'table') {
        element.rows.forEach((row, rowIndex) => {
          row.forEach((cell, colIndex) => {
            const count = haystack(cell.text ?? '', query, matchCase);
            if (count > 0) {
              hits.push({
                slideIndex,
                elementId: element.id,
                scope: 'table',
                cell: { row: rowIndex, col: colIndex },
                count,
              });
            }
          });
        });
        continue;
      }
      const count = haystack(elementText(element), query, matchCase);
      if (count > 0) hits.push({ slideIndex, elementId: element.id, scope: 'text', count });
    }
    if (options.includeNotes) {
      const count = haystack(slide.notes ?? '', query, matchCase);
      if (count > 0) hits.push({ slideIndex, elementId: '', scope: 'notes', count });
    }
  });
  return hits;
}

/** Replace all matches in a piece of text (literal replacement, no regex interpretation) */
export function replaceAllInText(
  source: string,
  query: string,
  replacement: string,
  matchCase: boolean,
): string {
  if (!query) return source;
  if (matchCase) return source.split(query).join(replacement);
  // Case-insensitive: match with a regex but escape metacharacters so user input isn't treated as a pattern
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.replace(new RegExp(escaped, 'gi'), replacement);
}

/** Replace text inside a body; returns the **original reference** when nothing matched so callers can detect "no change" */
function replaceInBody(
  body: TextBody,
  query: string,
  replacement: string,
  matchCase: boolean,
): TextBody {
  let touched = false;
  const paragraphs = body.paragraphs.map((paragraph) => {
    let paragraphTouched = false;
    const runs = paragraph.runs.map((run) => {
      const next = replaceAllInText(run.text, query, replacement, matchCase);
      if (next === run.text) return run;
      paragraphTouched = true;
      return { ...run, text: next };
    });
    if (!paragraphTouched) return paragraph;
    touched = true;
    return { ...paragraph, runs };
  });
  return touched ? { ...body, paragraphs } : body;
}

/** Replace every match in the document, returning a **new document** (input untouched); returns the original ref on no match */
export function replaceInDoc(
  doc: SlideDoc,
  query: string,
  replacement: string,
  options: FindOptions = {},
): SlideDoc {
  if (!query.trim()) return doc;
  const matchCase = options.matchCase ?? false;
  let changed = false;

  const slides = doc.slides.map((slide) => {
    let slideChanged = false;
    const elements = slide.elements.map((element) => {
      if (element.type === 'text' || element.type === 'shape') {
        if (!element.body) return element;
        const body = replaceInBody(element.body, query, replacement, matchCase);
        if (body === element.body) return element;
        slideChanged = true;
        return { ...element, body };
      }
      if (element.type === 'table') {
        let cellTouched = false;
        const rows = element.rows.map((row) =>
          row.map((cell) => {
            const next = replaceAllInText(cell.text ?? '', query, replacement, matchCase);
            if (next === cell.text) return cell;
            cellTouched = true;
            return { ...cell, text: next };
          }),
        );
        if (!cellTouched) return element;
        slideChanged = true;
        return { ...element, rows };
      }
      return element;
    });

    let notes = slide.notes;
    if (options.includeNotes && notes) {
      const next = replaceAllInText(notes, query, replacement, matchCase);
      if (next !== notes) {
        notes = next;
        slideChanged = true;
      }
    }
    if (!slideChanged) return slide;
    changed = true;
    return { ...slide, elements, notes };
  });

  if (!changed) return doc;
  return { ...doc, slides, version: doc.version + 1 };
}
