import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import type { ToolResult } from '@/core/types';
import { decorationRange, onViewportSettled, type DocRange } from './viewportRange';
import { checkChinese } from './zhRules';

/**
 * Fully local spellcheck (English):
 *
 * - The dictionary is a completely local static asset (`public/dict/en-words.txt.gz`), fetched only
 *   on first use, never bundled and never in the initial load; **the browser's native spellchecker is
 *   never used** — Chrome's enhanced spellcheck uploads text to the cloud, violating this tool's
 *   privacy promise.
 * - The custom dictionary is persisted with the draft (`RichTextDraftV2.userWords`).
 * - Tokenizing and suggestions are pure functions, easy to unit test; the decoration layer decides
 *   "what can be marked" at the document level.
 *
 * Word list generation lives in `scripts/build-wordlist.mjs` (public-domain Webster's Second
 * International by default).
 */

/** Word list filename (under public/dict/) */
export const DICTIONARY_FILE = 'en-words.txt.gz';

/** Word list URL (respects the Vite base, supporting sub-path deployments) */
export function dictionaryUrl(file: string = DICTIONARY_FILE): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}dict/${file}`;
}

/** gzip magic bytes: confirm we got the compressed copy and not the SPA fallback HTML */
const GZIP_MAGIC = [0x1f, 0x8b];

function looksGzipped(bytes: Uint8Array): boolean {
  return bytes.length > 2 && GZIP_MAGIC.every((byte, index) => bytes[index] === byte);
}

type DecompressionStreamCtor = new (format: 'gzip') => TransformStream<Uint8Array, Uint8Array>;

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const Native =
    (globalThis as unknown as { DecompressionStream?: DecompressionStreamCtor })
      .DecompressionStream ?? undefined;
  if (Native) {
    try {
      const stream = new Response(bytes).body?.pipeThrough(new Native('gzip'));
      if (stream) return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch {
      // Fall back to pako
    }
  }
  const { ungzip } = await import('pako');
  return ungzip(bytes);
}

/**
 * Load the word list: failures return an error instead of throwing (callers can report "word list
 * unavailable", while the custom dictionary and already-known words keep working).
 */
export async function loadDictionary(
  file: string = DICTIONARY_FILE,
): Promise<ToolResult<ReadonlySet<string>>> {
  if (typeof fetch !== 'function') return { ok: false, error: 'DICT_LOAD_FAILED' };
  try {
    const response = await fetch(dictionaryUrl(file));
    if (!response.ok) return { ok: false, error: 'DICT_LOAD_FAILED' };
    const raw = new Uint8Array(await response.arrayBuffer());
    // If the server already decoded it per Content-Encoding, we get plain text directly
    const bytes = looksGzipped(raw) ? await gunzip(raw) : raw;
    const text = new TextDecoder().decode(bytes);
    const words = new Set<string>();
    for (const line of text.split('\n')) {
      const word = line.trim().toLowerCase();
      if (word) words.add(word);
    }
    if (words.size === 0) return { ok: false, error: 'DICT_LOAD_FAILED' };
    return { ok: true, value: words };
  } catch {
    return { ok: false, error: 'DICT_LOAD_FAILED' };
  }
}

/* ------------------------------------------------------------------ *
 * Tokenizing
 * ------------------------------------------------------------------ */

export interface SpellToken {
  word: string;
  /** Start offset in the source text (inclusive) */
  start: number;
  /** End offset (exclusive) */
  end: number;
}

/** Word: a run of Latin letters (apostrophes allowed, covering possessives and contractions) */
const TOKEN_RE = /[A-Za-z][A-Za-z'’]*/g;
/** Skip URLs and emails entirely: their fragments are almost never natural language */
const SKIP_RE = /(?:https?:\/\/|www\.)[^\s]+|[\w.+-]+@[\w-]+\.[\w.-]+/gi;

/** Collect ranges to skip (URLs / emails) */
function skipRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  SKIP_RE.lastIndex = 0;
  let match = SKIP_RE.exec(text);
  while (match) {
    ranges.push([match.index, match.index + match[0].length]);
    match = SKIP_RE.exec(text);
  }
  return ranges;
}

/**
 * Tokenize: take only Latin-letter words, skipping very short words and fragments inside URLs / emails.
 * The returned offsets are directly usable for ProseMirror decorations (must match text-node offsets).
 */
export function tokenize(text: string, minLength = 3): SpellToken[] {
  const skip = skipRanges(text);
  const inSkipRange = (start: number, end: number) =>
    skip.some(([from, to]) => start < to && end > from);
  const tokens: SpellToken[] = [];
  TOKEN_RE.lastIndex = 0;
  let match = TOKEN_RE.exec(text);
  while (match) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;
    if (raw.length >= minLength && !inSkipRange(start, end)) {
      tokens.push({ word: raw, start, end });
    }
    match = TOKEN_RE.exec(text);
  }
  return tokens;
}

/** Normalize: lowercase and strip possessives ('s / ’s) */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/['’]s$/, '')
    .replace(/['’]$/, '');
}

/** Treat camelCase / underscore identifiers as code and skip them */
export function isCheckableWord(word: string, minLength = 3): boolean {
  if (word.length < minLength) return false;
  if (!/^[A-Za-z][A-Za-z'’]*$/.test(word)) return false;
  // Lower- and uppercase mixed beyond the first letter -> camelCase
  const hasInnerUpper = /[a-z][A-Z]/.test(word);
  return !hasInnerUpper;
}

/* ------------------------------------------------------------------ *
 * Edit distance and suggestions
 * ------------------------------------------------------------------ */

/** Thresholded edit distance: return max + 1 as soon as max is exceeded */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let best = current[0] as number;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (previous[j] as number) + 1,
        (current[j - 1] as number) + 1,
        (previous[j - 1] as number) + cost,
      );
      current[j] = value;
      if (value < best) best = value;
    }
    if (best > max) return max + 1;
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j] as number;
  }
  return previous[b.length] as number;
}

/** Word index bucketed by length: only compare candidates within a length delta of 2, avoiding full scans */
export type WordIndex = Map<number, string[]>;

export function createWordIndex(words: Iterable<string>): WordIndex {
  const index: WordIndex = new Map();
  for (const word of words) {
    const bucket = index.get(word.length);
    if (bucket) bucket.push(word);
    else index.set(word.length, [word]);
  }
  return index;
}

/**
 * Generate spelling suggestions: distance 1 first, then 2, alphabetical within a tier, at most `limit`.
 * Returns an empty array when the word list isn't loaded (the user should be prompted to load it first).
 */
export function suggest(
  word: string,
  index: WordIndex,
  limit = 5,
  extraWords: readonly string[] = [],
): string[] {
  const target = normalizeWord(word);
  const found = new Set<string>();
  for (const distance of [1, 2]) {
    const candidates: string[] = [];
    for (let length = target.length - distance; length <= target.length + distance; length += 1) {
      const bucket = index.get(length);
      if (!bucket) continue;
      for (const candidate of bucket) {
        if (candidate === target || found.has(candidate)) continue;
        if (editDistance(target, candidate, distance) <= distance) candidates.push(candidate);
      }
    }
    candidates.sort();
    for (const candidate of candidates) {
      found.add(candidate);
      if (found.size >= limit) return [...found];
    }
  }
  // A custom-dictionary word may be exactly what the user wants (e.g. a proper noun just added)
  for (const extra of extraWords) {
    const normalized = normalizeWord(extra);
    if (normalized === target || found.has(normalized)) continue;
    if (editDistance(target, normalized, 2) <= 2) {
      found.add(normalized);
      if (found.size >= limit) break;
    }
  }
  return [...found];
}

/* ------------------------------------------------------------------ *
 * Checking
 * ------------------------------------------------------------------ */

/** What a rule flagged: a dictionary miss (`spelling`) or one of the Chinese rules (P1-3) */
export type SpellIssueKind = 'spelling' | 'punctuation' | 'duplicate' | 'typo';

export interface SpellIssue {
  word: string;
  start: number;
  end: number;
  kind: SpellIssueKind;
  /** Correct form when the rule knows it (Chinese typos, punctuation width) */
  suggestion?: string;
}

/** One check pass: the issues plus whether the text had to be cut short */
export interface SpellCheckReport {
  issues: SpellIssue[];
  /** The text exceeded `MAX_CHECK_CHARS`; only the leading part was scanned */
  truncated: boolean;
}

export interface SpellDictionary {
  /** External word list (pass an empty set when not loaded; only the custom dictionary is used then) */
  words: ReadonlySet<string>;
  /** User's custom dictionary (persisted with the draft) */
  userWords: readonly string[];
}

/** Per-check character limit: very long documents scan only the first N chars to avoid freezing the main thread */
export const MAX_CHECK_CHARS = 200_000;

/**
 * Check a piece of text and return likely issues with positions: dictionary lookups for Latin words,
 * rules for Chinese (P1-3). `truncated` tells the caller the text was cut at `MAX_CHECK_CHARS` — the
 * panel shows it, so the cap is never a silent gap.
 */
export function checkTextReport(
  text: string,
  dictionary: SpellDictionary,
  minLength = 3,
): SpellCheckReport {
  if (!text) return { issues: [], truncated: false };
  const truncated = text.length > MAX_CHECK_CHARS;
  const source = truncated ? text.slice(0, MAX_CHECK_CHARS) : text;
  const known = dictionary.words;
  const userKnown = new Set(dictionary.userWords.map((word) => normalizeWord(word)));
  const issues: SpellIssue[] = [];
  for (const token of tokenize(source, minLength)) {
    if (!isCheckableWord(token.word, minLength)) continue;
    const normalized = normalizeWord(token.word);
    if (normalized.length < minLength) continue;
    if (known.has(normalized) || userKnown.has(normalized)) continue;
    // All-caps acronyms (API, HTTP, ...) aren't treated as misspellings
    if (token.word.length > 1 && token.word === token.word.toUpperCase()) continue;
    issues.push({ word: token.word, start: token.start, end: token.end, kind: 'spelling' });
  }
  for (const issue of checkChinese(source, dictionary.userWords)) {
    issues.push({
      word: issue.word,
      start: issue.start,
      end: issue.end,
      kind: issue.kind,
      suggestion: issue.suggestion,
    });
  }
  // Document order, so decorations and the panel list read like the page
  issues.sort((a, b) => a.start - b.start || a.end - b.end);
  return { issues, truncated };
}

/** Convenience wrapper around `checkTextReport` for callers that only need the issues */
export function checkText(text: string, dictionary: SpellDictionary, minLength = 3): SpellIssue[] {
  return checkTextReport(text, dictionary, minLength).issues;
}

/** Add a custom dictionary entry (deduped, trimmed, lowercased), returning a new array */
export function addUserWord(words: readonly string[], word: string): string[] {
  const normalized = normalizeWord(word.trim());
  if (!normalized || words.includes(normalized)) return [...words];
  return [...words, normalized];
}

/** Remove a custom dictionary entry */
export function removeUserWord(words: readonly string[], word: string): string[] {
  const normalized = normalizeWord(word.trim());
  return words.filter((item) => normalizeWord(item) !== normalized);
}

/** Document-level issue: carries a ProseMirror document position for panel replacement and jump-to */
export interface DocSpellIssue {
  word: string;
  from: number;
  to: number;
  kind: SpellIssueKind;
  /** Correct form when the rule knows it */
  suggestion?: string;
}

/** Whole-document result plus the two caps the panel has to disclose (no silent truncation) */
export interface DocSpellReport {
  issues: DocSpellIssue[];
  /** `limit` was reached: the document has more issues than are reported */
  capped: boolean;
  /** Some text was longer than `MAX_CHECK_CHARS` and only partly scanned */
  truncated: boolean;
}

/**
 * Collect issues for the whole document (with document positions).
 * `limit` caps panel rendering: 100 by default, enough to alert the user without flooding long documents —
 * the report says so instead of dropping the rest silently.
 */
export function collectDocIssues(
  doc: PMNode,
  dictionary: SpellDictionary,
  limit = 100,
): DocSpellReport {
  const issues: DocSpellIssue[] = [];
  let capped = false;
  let truncated = false;
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    if (issues.length >= limit) {
      capped = true;
      return false;
    }
    const report = checkTextReport(node.text, dictionary);
    if (report.truncated) truncated = true;
    for (const issue of report.issues) {
      if (issues.length >= limit) {
        capped = true;
        return false;
      }
      issues.push({
        word: issue.word,
        from: pos + issue.start,
        to: pos + issue.end,
        kind: issue.kind,
        suggestion: issue.suggestion,
      });
    }
    return undefined;
  });
  return { issues, capped, truncated };
}

/* ------------------------------------------------------------------ *
 * Editor integration: decoration (wavy underline) plugin
 * ------------------------------------------------------------------ */

/** Plugin key for spell decorations: the tool layer uses it to trigger recomputation */
export const spellcheckKey = new PluginKey<SpellDecorationState>('richTextSpellcheck');

interface SpellDecorationState {
  /** Cache signature: enabled state + word list size + custom dictionary */
  signature: string;
  deco: DecorationSet;
}

/**
 * Build decorations: check each text node; offset + node position gives the document offset.
 * `range` clips the walk to the scrolled viewport on large documents (P1-5, see `viewportRange.ts`).
 */
export function buildSpellDecorations(
  doc: PMNode,
  dictionary: SpellDictionary,
  range?: DocRange | null,
): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    // Outside the scanned range: skip the tokenizer (the expensive half), keep walking.
    // Half-open comparison: a node ending exactly at `from` does not overlap the range.
    if (range && (pos + node.text.length <= range.from || pos > range.to)) return;
    for (const issue of checkText(node.text, dictionary)) {
      decorations.push(
        Decoration.inline(pos + issue.start, pos + issue.end, { class: 'rte-spell-error' }),
      );
    }
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * Spellcheck extension:
 * Dictionary and toggle arrive as getters, so the editor isn't rebuilt once the word list loads;
 * decorations are recomputed only when the document or the signature changes, avoiding a full scan
 * on every selection change.
 */
export const Spellcheck = Extension.create<{
  getDictionary?: () => SpellDictionary;
  isEnabled?: () => boolean;
}>({
  name: 'spellcheck',

  addOptions() {
    return { getDictionary: undefined, isEnabled: undefined };
  },

  addProseMirrorPlugins() {
    const { getDictionary, isEnabled } = this.options;
    const readDictionary = getDictionary ?? (() => ({ words: new Set<string>(), userWords: [] }));
    const readEnabled = isEnabled ?? (() => false);

    const signatureOf = (dictionary: SpellDictionary, enabled: boolean) =>
      `${enabled ? '1' : '0'}|${dictionary.words.size}|${dictionary.userWords.join(',')}`;

    // Set once the editor view exists: long documents only check the visible range (P1-5)
    let currentView: EditorView | null = null;

    const build = (doc: PMNode): SpellDecorationState => {
      const dictionary = readDictionary();
      const enabled = readEnabled();
      const signature = signatureOf(dictionary, enabled);
      if (!enabled) return { signature, deco: DecorationSet.empty };
      const range = decorationRange(currentView, doc.content.size);
      return { signature, deco: buildSpellDecorations(doc, dictionary, range) };
    };

    return [
      new Plugin<SpellDecorationState>({
        key: spellcheckKey,
        state: {
          init: (_config, state) => build(state.doc),
          apply: (tr, value) => {
            const force = tr.getMeta(spellcheckKey) === true;
            if (!tr.docChanged && !force) return value;
            // One scan per document change. The old "signature unchanged" branch rebuilt the very same
            // decorations a second time (two full document walks per keystroke, P1-5) — `next` already
            // carries the correct ones, and its signature equals `value.signature` in that case.
            return build(tr.doc);
          },
        },
        props: {
          decorations: (state) => spellcheckKey.getState(state)?.deco ?? DecorationSet.empty,
        },
        view: (view) => {
          currentView = view;
          // Viewport-clipped documents lose the marks of the previous viewport after scrolling:
          // rescan once scrolling settles (the force meta only rebuilds the visible range).
          const settled = onViewportSettled(view, spellcheckKey, readEnabled);
          return {
            destroy: () => {
              settled.destroy();
              currentView = null;
            },
          };
        },
      }),
    ];
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spellcheck: {
      /** Force decoration recomputation after a spellcheck toggle or word list change */
      refreshSpellcheck: () => ReturnType;
    };
  }
}

/** Trigger spell decoration recomputation (on toggle, custom dictionary edits, or load completion) */
export const SpellcheckCommands = Extension.create({
  name: 'spellcheckCommands',
  addCommands() {
    return {
      refreshSpellcheck:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(spellcheckKey, true);
          return true;
        },
    };
  },
});
