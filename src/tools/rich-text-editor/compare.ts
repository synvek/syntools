import { diffArrays } from 'diff';

/**
 * Document comparison (P2-3, M3 ①): pure logic layer.
 *
 * `compareBlocks` turns two documents (as flat block lists) into a change list that a later batch can
 * apply as tracked revisions (`trackedInsert` / `trackedDelete` marks). Two levels of diffing:
 *
 * 1. Block level — `diffArrays` over `type#text` keys aligns the documents and yields insert/delete runs;
 * 2. Inline level — a delete run followed by an insert run is paired into `replace` changes, and each pair
 *    gets a token-level diff (CJK per character, Latin per word) so the UI can highlight just the changed
 *    words and the mark writer knows the exact ranges.
 *
 * Deliberate limits of this batch: no DOM, no editor, no docx. The caller supplies block text, which keeps
 * the algorithm testable and lets the same code serve "compare with current draft" and "compare two files".
 */

/** A top-level document block, reduced to what comparison needs */
export interface DocBlock {
  /** Block kind: `p` / `h1`…`h6` / `li` / `pre` / `blockquote` / `table` / `tr` … */
  type: string;
  /** Plain text of the block (list items and table rows joined with `\n`) */
  text: string;
}

export type CompareChangeKind = 'insert' | 'delete' | 'replace';

/** A diff segment inside one changed block; `equal` segments keep the context readable */
export interface CompareSegment {
  kind: 'equal' | 'insert' | 'delete';
  text: string;
}

export interface CompareChange {
  kind: CompareChangeKind;
  /** Index in the base document; null for a pure insertion */
  beforeIndex: number | null;
  /** Index in the compared document; null for a pure deletion */
  afterIndex: number | null;
  /** The base block (undefined for a pure insertion) */
  before?: DocBlock;
  /** The compared block (undefined for a pure deletion) */
  after?: DocBlock;
  /** Token diff of a `replace`; absent for inserts/deletes (whole block added/removed) */
  segments?: CompareSegment[];
  /** Text is identical and only the block kind changed (e.g. a paragraph turned into a heading) */
  formatOnly?: boolean;
}

export interface CompareStats {
  inserted: number;
  deleted: number;
  replaced: number;
  /** Characters that actually differ inside `replace` changes (0 for format-only changes) */
  changedChars: number;
  identical: boolean;
}

export interface CompareResult {
  changes: CompareChange[];
  stats: CompareStats;
}

const CJK =
  /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af\u3000-\u303f\uff00-\uffef]/;

/**
 * Tokenize for inline diffing: CJK and punctuation break per character, Latin runs stay whole words,
 * whitespace stays its own token. Token-level (instead of character-level) diffing keeps "replace" runs
 * readable in Chinese and avoids marking a whole word as changed for a one-letter edit.
 */
export function tokenizeForDiff(text: string): string[] {
  const tokens: string[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) {
      tokens.push(buffer);
      buffer = '';
    }
  };
  for (const char of text) {
    if (CJK.test(char) || /\s/.test(char)) {
      flush();
      tokens.push(char);
    } else if (/[\w'’-]/.test(char)) {
      buffer += char;
    } else {
      flush();
      tokens.push(char);
    }
  }
  flush();
  return tokens;
}

/** Token-level diff between two block texts; adjacent same-kind parts are merged */
export function inlineSegments(beforeText: string, afterText: string): CompareSegment[] {
  const parts = diffArrays(tokenizeForDiff(beforeText), tokenizeForDiff(afterText));
  const segments: CompareSegment[] = [];
  for (const part of parts) {
    const kind: CompareSegment['kind'] = part.added ? 'insert' : part.removed ? 'delete' : 'equal';
    const text = part.value.join('');
    if (!text) continue;
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) last.text += text;
    else segments.push({ kind, text });
  }
  return segments;
}

interface Run {
  kind: 'equal' | 'insert' | 'delete';
  /** Index of the first block in the corresponding document */
  start: number;
  /** Number of blocks in the run */
  length: number;
}

/** Turn raw `diffArrays` output into runs carrying document indexes */
function toRuns(before: DocBlock[], after: DocBlock[]): Run[] {
  const parts = diffArrays(
    before.map((block) => `${block.type}#${block.text}`),
    after.map((block) => `${block.type}#${block.text}`),
  );
  const runs: Run[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  for (const part of parts) {
    const length = part.value.length;
    if (length === 0) continue;
    if (part.removed) {
      runs.push({ kind: 'delete', start: beforeIndex, length });
      beforeIndex += length;
    } else if (part.added) {
      runs.push({ kind: 'insert', start: afterIndex, length });
      afterIndex += length;
    } else {
      runs.push({ kind: 'equal', start: beforeIndex, length });
      beforeIndex += length;
      afterIndex += length;
    }
  }
  return runs;
}

/**
 * Compare two block lists.
 *
 * Adjacent delete/insert runs are paired index-by-index into `replace` changes (a paragraph that was
 * rewritten should read as "1 处替换", not "1 处删除 + 1 处插入"); unpaired leftovers stay as pure
 * inserts/deletes. A pair with identical text but a different block kind is reported as `formatOnly`.
 */
export function compareBlocks(before: DocBlock[], after: DocBlock[]): CompareResult {
  const runs = toRuns(before, after);
  const changes: CompareChange[] = [];
  const stats: CompareStats = {
    inserted: 0,
    deleted: 0,
    replaced: 0,
    changedChars: 0,
    identical: runs.every((run) => run.kind === 'equal'),
  };

  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index];
    if (run.kind === 'equal') continue;
    const next = runs[index + 1];
    const paired = run.kind === 'delete' && next?.kind === 'insert';
    if (paired) {
      const count = Math.min(run.length, next.length);
      for (let offset = 0; offset < count; offset += 1) {
        const beforeBlock = before[run.start + offset];
        const afterBlock = after[next.start + offset];
        const formatOnly = beforeBlock.text === afterBlock.text;
        const segments = formatOnly ? [] : inlineSegments(beforeBlock.text, afterBlock.text);
        if (!formatOnly) {
          stats.changedChars += segments
            .filter((segment) => segment.kind !== 'equal')
            .reduce((sum, segment) => sum + segment.text.length, 0);
        }
        stats.replaced += 1;
        changes.push({
          kind: 'replace',
          beforeIndex: run.start + offset,
          afterIndex: next.start + offset,
          before: beforeBlock,
          after: afterBlock,
          segments,
          ...(formatOnly ? { formatOnly: true } : {}),
        });
      }
      for (let offset = count; offset < run.length; offset += 1) {
        stats.deleted += 1;
        changes.push({
          kind: 'delete',
          beforeIndex: run.start + offset,
          afterIndex: null,
          before: before[run.start + offset],
        });
      }
      for (let offset = count; offset < next.length; offset += 1) {
        stats.inserted += 1;
        changes.push({
          kind: 'insert',
          beforeIndex: null,
          afterIndex: next.start + offset,
          after: after[next.start + offset],
        });
      }
      index += 1; // The insert run was consumed
      continue;
    }
    if (run.kind === 'delete') {
      for (let offset = 0; offset < run.length; offset += 1) {
        stats.deleted += 1;
        changes.push({
          kind: 'delete',
          beforeIndex: run.start + offset,
          afterIndex: null,
          before: before[run.start + offset],
        });
      }
      continue;
    }
    for (let offset = 0; offset < run.length; offset += 1) {
      stats.inserted += 1;
      changes.push({
        kind: 'insert',
        beforeIndex: null,
        afterIndex: run.start + offset,
        after: after[run.start + offset],
      });
    }
  }

  return { changes, stats };
}

/** Blocks whose text spans several lines (list items, table rows) join their parts with `\n` */
const MULTILINE_BLOCKS = new Set(['ul', 'ol', 'table', 'blockquote']);

/** Normalize whitespace so indifferent line breaks / indentation don't show up as changes */
function normalizeText(text: string, multiline: boolean): string {
  if (multiline) {
    return text
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extract top-level blocks from document HTML (the editor's own `getHTML()` output).
 *
 * Text is normalized, and list/table blocks join their items with `\n`, so a reordered list item shows up
 * as a change instead of matching by accident. Returns `[]` where no DOM is available (SSR / node tests
 * that supply blocks directly).
 */
export function blocksFromHtml(html: string): DocBlock[] {
  if (typeof DOMParser === 'undefined') return [];
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const blocks: DocBlock[] = [];
  for (const child of Array.from(parsed.body.children)) {
    const type = child.tagName.toLowerCase();
    const multiline = MULTILINE_BLOCKS.has(type);
    const raw = multiline
      ? Array.from(child.children)
          .map((inner) => inner.textContent ?? '')
          .join('\n')
      : (child.textContent ?? '');
    blocks.push({ type, text: normalizeText(raw, multiline) });
  }
  return blocks;
}

/** Convenience wrapper: compare two HTML documents */
export function compareDocuments(beforeHtml: string, afterHtml: string): CompareResult {
  return compareBlocks(blocksFromHtml(beforeHtml), blocksFromHtml(afterHtml));
}
