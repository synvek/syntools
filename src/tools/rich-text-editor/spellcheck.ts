import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { ToolResult } from '@/core/types';

/**
 * 纯本地拼写检查（英文）：
 *
 * - 词典是完全本地的静态资源（`public/dict/en-words.txt.gz`），首次启用时才 fetch，
 *   不进打包产物、不进首屏；**绝不调用浏览器原生拼写检查**——Chrome 的增强拼写检查
 *   会把文本上送云端，违反本工具的隐私约定。
 * - 自定义词典随草稿落盘（`RichTextDraftV2.userWords`）。
 * - 分词与建议都是纯函数，便于单测；文档级「是否可标记」由装饰层决定。
 *
 * 词表生成见 `scripts/build-wordlist.mjs`（默认取公有领域的 Webster's Second International）。
 */

/** 词表文件名（放在 public/dict/ 下） */
export const DICTIONARY_FILE = 'en-words.txt.gz';

/** 词表 URL（尊重 Vite base，兼容子路径部署） */
export function dictionaryUrl(file: string = DICTIONARY_FILE): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}dict/${file}`;
}

/** gzip 魔数：确认拿到的是压缩副本而不是 SPA fallback 的 HTML */
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
      // 落到 pako
    }
  }
  const { ungzip } = await import('pako');
  return ungzip(bytes);
}

/**
 * 加载词表：失败时返回错误而不抛异常（调用方据此提示「词表不可用」，
 * 但自定义词典与已识别的单词仍可继续工作）。
 */
export async function loadDictionary(
  file: string = DICTIONARY_FILE,
): Promise<ToolResult<ReadonlySet<string>>> {
  if (typeof fetch !== 'function') return { ok: false, error: 'DICT_LOAD_FAILED' };
  try {
    const response = await fetch(dictionaryUrl(file));
    if (!response.ok) return { ok: false, error: 'DICT_LOAD_FAILED' };
    const raw = new Uint8Array(await response.arrayBuffer());
    // 服务端若已按 Content-Encoding 透明解码，则直接拿到纯文本
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
 * 分词
 * ------------------------------------------------------------------ */

export interface SpellToken {
  word: string;
  /** 在源文本中的起始偏移（含） */
  start: number;
  /** 结束偏移（不含） */
  end: number;
}

/** 词：连续拉丁字母（可带撇号，覆盖所有格与缩写） */
const TOKEN_RE = /[A-Za-z][A-Za-z'’]*/g;
/** URL 与邮箱整体跳过：其中的片段几乎都不是自然语言 */
const SKIP_RE = /(?:https?:\/\/|www\.)[^\s]+|[\w.+-]+@[\w-]+\.[\w.-]+/gi;

/** 收集需要跳过的区间（URL / 邮箱） */
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
 * 分词：只取拉丁字母词，跳过过短词以及 URL / 邮箱内的片段。
 * 返回的偏移可直接用于 ProseMirror 装饰（要求与文本节点偏移一致）。
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

/** 归一化：小写 + 去掉所有格（'s / ’s） */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/['’]s$/, '')
    .replace(/['’]$/, '');
}

/** 驼峰 / 下划线标识符视为代码，不参与检查 */
export function isCheckableWord(word: string, minLength = 3): boolean {
  if (word.length < minLength) return false;
  if (!/^[A-Za-z][A-Za-z'’]*$/.test(word)) return false;
  // 同时出现小写与大写（且非首字母大写）→ 驼峰命名
  const hasInnerUpper = /[a-z][A-Z]/.test(word);
  return !hasInnerUpper;
}

/* ------------------------------------------------------------------ *
 * 编辑距离与建议
 * ------------------------------------------------------------------ */

/** 带阈值的编辑距离：超过 max 立即返回 max + 1 */
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

/** 按长度分桶的词表索引：只比较长度差 ≤ 2 的候选，避免全量扫描 */
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
 * 生成拼写建议：优先编辑距离 1，其次 2，同级按字母序，最多 limit 条。
 * 词表未加载时返回空数组（此时应提示用户先加载词表）。
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
  // 自定义词典里的词也可能正是用户想找的（例如刚添加过的专有名词）
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
 * 检查
 * ------------------------------------------------------------------ */

export interface SpellIssue {
  word: string;
  start: number;
  end: number;
}

export interface SpellDictionary {
  /** 外部词表（未加载时传空集合，此时只依赖自定义词典） */
  words: ReadonlySet<string>;
  /** 用户自定义词典（随草稿落盘） */
  userWords: readonly string[];
}

/** 单次检查的字符上限：超长文档只扫前 N 个字符，避免卡住主线程 */
export const MAX_CHECK_CHARS = 200_000;

/**
 * 检查一段文本，返回疑似拼写错误的词与位置。
 * 只做「查表判定」，不生成建议——建议是昂贵操作，由面板按需对可见条目计算。
 */
export function checkText(text: string, dictionary: SpellDictionary, minLength = 3): SpellIssue[] {
  if (!text) return [];
  const known = dictionary.words;
  const userKnown = new Set(dictionary.userWords.map((word) => normalizeWord(word)));
  const issues: SpellIssue[] = [];
  for (const token of tokenize(text.slice(0, MAX_CHECK_CHARS), minLength)) {
    if (!isCheckableWord(token.word, minLength)) continue;
    const normalized = normalizeWord(token.word);
    if (normalized.length < minLength) continue;
    if (known.has(normalized) || userKnown.has(normalized)) continue;
    // 全大写缩写（如 API、HTTP）不视为拼写错误
    if (token.word.length > 1 && token.word === token.word.toUpperCase()) continue;
    issues.push({ word: token.word, start: token.start, end: token.end });
  }
  return issues;
}

/** 添加自定义词典条目（去重、去空白、小写归一），返回新数组 */
export function addUserWord(words: readonly string[], word: string): string[] {
  const normalized = normalizeWord(word.trim());
  if (!normalized || words.includes(normalized)) return [...words];
  return [...words, normalized];
}

/** 移除自定义词典条目 */
export function removeUserWord(words: readonly string[], word: string): string[] {
  const normalized = normalizeWord(word.trim());
  return words.filter((item) => normalizeWord(item) !== normalized);
}

/** 文档级问题：带 ProseMirror 文档位置，供面板替换与跳转 */
export interface DocSpellIssue {
  word: string;
  from: number;
  to: number;
}

/**
 * 收集整篇文档的拼写问题（带文档位置）。
 * limit 用于限制面板渲染量：默认 100 条，足够提示用户而不是把长文档全量铺开。
 */
export function collectDocIssues(
  doc: PMNode,
  dictionary: SpellDictionary,
  limit = 100,
): DocSpellIssue[] {
  const issues: DocSpellIssue[] = [];
  doc.descendants((node, pos) => {
    if (issues.length >= limit || !node.isText || !node.text) return;
    for (const issue of checkText(node.text, dictionary)) {
      issues.push({ word: issue.word, from: pos + issue.start, to: pos + issue.end });
      if (issues.length >= limit) return;
    }
  });
  return issues;
}

/* ------------------------------------------------------------------ *
 * 编辑器集成：装饰（波浪线）插件
 * ------------------------------------------------------------------ */

/** 拼写装饰的 plugin key：工具层通过它触发重算 */
export const spellcheckKey = new PluginKey<SpellDecorationState>('richTextSpellcheck');

interface SpellDecorationState {
  /** 参与缓存的签名：启用状态 + 词表规模 + 自定义词典 */
  signature: string;
  deco: DecorationSet;
}

/** 生成装饰：逐文本节点检查，偏移加上节点位置即为文档偏移 */
export function buildSpellDecorations(doc: PMNode, dictionary: SpellDictionary): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (const issue of checkText(node.text, dictionary)) {
      decorations.push(
        Decoration.inline(pos + issue.start, pos + issue.end, { class: 'rte-spell-error' }),
      );
    }
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * 拼写检查扩展：
 * 词典与开关都以 getter 传入，避免词表加载完成后重建编辑器；
 * 仅当文档变化或签名变化时才重算装饰，避免每次选区变化都全量扫描。
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

    const build = (doc: PMNode): SpellDecorationState => {
      const dictionary = readDictionary();
      const enabled = readEnabled();
      const signature = signatureOf(dictionary, enabled);
      if (!enabled) return { signature, deco: DecorationSet.empty };
      return { signature, deco: buildSpellDecorations(doc, dictionary) };
    };

    return [
      new Plugin<SpellDecorationState>({
        key: spellcheckKey,
        state: {
          init: (_config, state) => build(state.doc),
          apply: (tr, value) => {
            const force = tr.getMeta(spellcheckKey) === true;
            if (!tr.docChanged && !force) return value;
            const next = build(tr.doc);
            // 签名与装饰都没变时保持原对象，避免 PM 无谓重绘
            if (!force && next.signature === value.signature) {
              return {
                signature: value.signature,
                deco: buildSpellDecorations(tr.doc, readDictionary()),
              };
            }
            return next;
          },
        },
        props: {
          decorations: (state) => spellcheckKey.getState(state)?.deco ?? DecorationSet.empty,
        },
      }),
    ];
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spellcheck: {
      /** 拼写开关或词表变化后强制重算装饰 */
      refreshSpellcheck: () => ReturnType;
    };
  }
}

/** 触发拼写装饰重算（开关词表 / 增删自定义词典 / 加载完成时调用） */
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
