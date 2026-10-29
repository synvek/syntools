import type { ToolResult } from '@/core/types';
import type { DocComment, TrackedChange } from './docs';

/**
 * docx 审阅层回读（P2-3.5）：把 `word/document.xml` 的修订/格式修订/批注区间，和 `word/comments.xml`
 * 的批注正文，还原成编辑器里的 mark 与记录。
 *
 * 为什么必须自己读 XML：mammoth 对审阅信息基本"两头都丢"——
 * - `w:ins` 走 `readChildElements`（透明穿透），**内容保留、修订语义消失**；
 * - `w:del` 直接列在 `ignoreElements` 里，**连 `w:delText` 一起丢弃**，HTML 里根本没有被删的文字；
 * - `w:commentRangeStart/End` 也在 `ignoreElements` 里，批注锚点直接消失。
 * 所以导入不是"解析 HTML"，而是"把 XML 的 run 流回填到 mammoth 的 HTML 上"。
 *
 * 回填的正确性靠一条硬约束：mammoth 产出的可见文本必须与"非删除 run"拼出的文本**完全一致**。
 * 一致才回填；不一致（第三方文档里的域、脚注、图片替代文本、分栏重排…）一律**放弃回填并明确降级**，
 * 绝不错位——错误但沉默的还原比诚实的部分还原更糟（同 `sections.ts` 对 `sectPr` 的结论）。
 *
 * 三层的偏移基准是同一份"可见文本流"（删除的文字不占位），因此修订、格式修订、批注可以在**一次**
 * DOM 操作里从后往前应用；分两次会因为前一次的 DOM 变更让后一次的偏移整体错位。
 *
 * 已知位置限制：整段被删除时 mammoth 会留下一个**空段落**，而回填是纯文本流定位，
 * 删除文字会贴在相邻段落的文本边界上（内容与修订标记正确，位置可能差一段）。
 */

/** One text run of the source document, reduced to what revision marking needs */
export interface RevisionRun {
  text: string;
  kind: 'insert' | 'delete' | 'normal';
  author: string;
  /** `w:date` as written (ISO); null when the producer omitted it */
  date: string | null;
  /** Paragraph ordinal: consecutive runs are only merged inside the same paragraph */
  block: number;
}

/** A `w:pPrChange`: the paragraph used to be another block kind (Word's format revision) */
export interface FormatRevision {
  /** Paragraph ordinal, same numbering as `RevisionRun.block` */
  block: number;
  /** Previous block kind in `marks.ts` notation (`heading:2` / `blockquote` / `codeBlock` / `paragraph`) */
  target: string;
  author: string;
  date: string | null;
}

/** A `w:commentRangeStart` … `w:commentRangeEnd` pair, as offsets into the visible text stream */
export interface CommentAnchor {
  docxId: string;
  start: number;
  end: number;
}

/** One `w:comment` from `word/comments.xml` */
export interface ImportedComment {
  docxId: string;
  author: string;
  date: string | null;
  /** Text our exporter (and Word users) put in italics: the quoted range */
  quote: string;
  text: string;
}

export interface ParsedDocumentReview {
  runs: RevisionRun[];
  formats: FormatRevision[];
  anchors: CommentAnchor[];
}

/** Runs carry the same `w:author` on every run of one edit; merging keeps the panel readable */
function mergeRuns(runs: RevisionRun[]): RevisionRun[] {
  const merged: RevisionRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const last = merged[merged.length - 1];
    if (
      last &&
      last.kind === run.kind &&
      last.kind !== 'normal' &&
      last.author === run.author &&
      last.block === run.block
    ) {
      last.text += run.text;
      continue;
    }
    merged.push({ ...run });
  }
  return merged;
}

function attribute(element: Element, name: string): string {
  return element.getAttribute(name) ?? element.getAttribute(name.replace('w:', '')) ?? '';
}

function firstChild(element: Element, name: string): Element | null {
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 1 && (child as Element).nodeName === name) return child as Element;
  }
  return null;
}

/**
 * `w:pPrChange` -> the previous block kind. Word records the *old* properties there, which is exactly
 * what a reject needs; the reverse mapping mirrors the export side (`heading:N` / `Quote` / `Code`).
 */
function paragraphTargetOfChange(change: Element): string {
  const props = firstChild(change, 'w:pPr');
  const styleElement = props ? firstChild(props, 'w:pStyle') : null;
  const style = styleElement ? attribute(styleElement, 'w:val') : '';
  const heading = /^heading\s*(\d)$/i.exec(style);
  if (heading) return `heading:${heading[1]}`;
  if (style === 'Quote' || style === 'IntenseQuote' || style === 'Intense Quote')
    return 'blockquote';
  if (style === 'Code') return 'codeBlock';
  return 'paragraph';
}

interface RunState {
  kind: RevisionRun['kind'];
  author: string;
  date: string | null;
}

/** Mutable state shared by one document pass: text offset, open comment ranges, output arrays */
interface CollectContext {
  runs: RevisionRun[];
  anchors: CommentAnchor[];
  /** Offset into the *visible* text stream (deleted runs do not advance it) */
  offset: number;
  openComments: Map<string, number>;
}

function collectRuns(
  node: Node,
  block: number,
  state: RunState,
  ctx: CollectContext,
  out: RevisionRun[],
): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== 1) continue;
    const element = child as Element;
    const tag = element.nodeName;

    if (tag === 'w:ins' || tag === 'w:del') {
      collectRuns(
        element,
        block,
        {
          kind: tag === 'w:ins' ? 'insert' : 'delete',
          author: attribute(element, 'w:author') || state.author,
          date: attribute(element, 'w:date') || state.date,
        },
        ctx,
        out,
      );
      continue;
    }

    if (tag === 'w:commentRangeStart') {
      ctx.openComments.set(attribute(element, 'w:id'), ctx.offset);
      continue;
    }
    if (tag === 'w:commentRangeEnd') {
      const id = attribute(element, 'w:id');
      const start = ctx.openComments.get(id);
      if (start !== undefined) {
        ctx.anchors.push({ docxId: id, start, end: ctx.offset });
        ctx.openComments.delete(id);
      }
      continue;
    }

    // Word also marks a run from its properties (`<w:rPr><w:ins/></w:rPr>`), where the text stays in `w:t`
    if (tag === 'w:r') {
      const props = firstChild(element, 'w:rPr');
      const inserted = props ? firstChild(props, 'w:ins') : null;
      const deleted = props ? firstChild(props, 'w:del') : null;
      const mark = deleted ?? inserted;
      collectRuns(
        element,
        block,
        mark
          ? {
              kind: deleted ? 'delete' : 'insert',
              author: attribute(mark, 'w:author') || state.author,
              date: attribute(mark, 'w:date') || state.date,
            }
          : state,
        ctx,
        out,
      );
      continue;
    }

    if (tag === 'w:t' || tag === 'w:delText') {
      const text = element.textContent ?? '';
      if (text) {
        out.push({ text, kind: state.kind, author: state.author, date: state.date, block });
        if (state.kind !== 'delete') ctx.offset += text.length;
      }
      continue;
    }

    // Whitespace-ish runs mammoth renders as characters: they must count, otherwise the text stream drifts
    if (tag === 'w:tab' || tag === 'w:noBreakHyphen' || tag === 'w:softHyphen') {
      const text = tag === 'w:tab' ? '\t' : tag === 'w:noBreakHyphen' ? '\u2011' : '\u00AD';
      out.push({ text, kind: state.kind, author: state.author, date: state.date, block });
      if (state.kind !== 'delete') ctx.offset += text.length;
      continue;
    }
    // Field instructions are not rendered as text by mammoth: counting them would break the alignment
    if (tag === 'w:instrText') continue;

    collectRuns(element, block, state, ctx, out);
  }
}

/** Runs, format revisions and comment anchors, all from one pass over the same text stream */
export function parseDocumentReview(xml: string): ParsedDocumentReview {
  const empty: ParsedDocumentReview = { runs: [], formats: [], anchors: [] };
  if (!xml.trim()) return empty;
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return empty;

  const ctx: CollectContext = {
    runs: [],
    anchors: [],
    offset: 0,
    openComments: new Map(),
  };
  const formats: FormatRevision[] = [];
  const paragraphs = Array.from(doc.getElementsByTagName('w:p'));
  paragraphs.forEach((paragraph, block) => {
    const change = firstChild(firstChild(paragraph, 'w:pPr') ?? paragraph, 'w:pPrChange');
    if (change) {
      formats.push({
        block,
        target: paragraphTargetOfChange(change),
        author: attribute(change, 'w:author'),
        date: attribute(change, 'w:date') || null,
      });
    }
    collectRuns(paragraph, block, { kind: 'normal', author: '', date: null }, ctx, ctx.runs);
  });

  // An anchor left open at the end of the document is not a range: drop it rather than guessing an end
  ctx.openComments.clear();

  return { runs: mergeRuns(ctx.runs), formats, anchors: ctx.anchors };
}

/** Runs only (kept for callers/tests that do not care about the other two layers) */
export function parseRevisionRuns(xml: string): RevisionRun[] {
  return parseDocumentReview(xml).runs;
}

/** True when the package carries any revision at all (import can skip the whole path otherwise) */
export function hasRevisions(runs: RevisionRun[]): boolean {
  return runs.some((run) => run.kind !== 'normal' && run.text.trim().length > 0);
}

function paragraphIsItalic(paragraph: Element): boolean {
  const runs = Array.from(paragraph.getElementsByTagName('w:r'));
  if (runs.length === 0) return false;
  return runs.every((run) => {
    const italics = firstChild(firstChild(run, 'w:rPr') ?? run, 'w:i');
    if (!italics) return false;
    const value = attribute(italics, 'w:val');
    return value !== '0' && value !== 'false';
  });
}

function paragraphText(paragraph: Element): string {
  return Array.from(paragraph.getElementsByTagName('w:t'))
    .map((node) => node.textContent ?? '')
    .join('');
}

/**
 * `word/comments.xml` -> comment records.
 *
 * Our exporter writes the quoted range as an italic paragraph followed by the body, which is also what
 * Word users do by hand; the first all-italic paragraph is therefore treated as the quote.
 */
export function parseImportedComments(xml: string): ImportedComment[] {
  if (!xml.trim()) return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return [];

  return Array.from(doc.getElementsByTagName('w:comment')).map((comment) => {
    const paragraphs = Array.from(comment.getElementsByTagName('w:p'));
    let quote = '';
    const body: string[] = [];
    paragraphs.forEach((paragraph) => {
      const text = paragraphText(paragraph).trim();
      if (!text) return;
      if (!quote && paragraphIsItalic(paragraph)) {
        quote = text;
        return;
      }
      body.push(text);
    });
    return {
      docxId: attribute(comment, 'w:id'),
      author: attribute(comment, 'w:author'),
      date: attribute(comment, 'w:date') || null,
      quote,
      text: body.join('\n'),
    };
  });
}

export interface AppliedReview {
  html: string;
  /** One entry per revision: the review panel and the per-change commands work off these ids */
  changes: TrackedChange[];
  /** Comments that were restored as filled records (mark + metadata) */
  comments: DocComment[];
  /** Comments whose range crossed blocks (the editor cannot anchor across paragraphs): reported, not guessed */
  skippedComments: number;
}

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'LI',
  'UL',
  'OL',
  'BLOCKQUOTE',
  'PRE',
  'TABLE',
  'TBODY',
  'THEAD',
  'TR',
  'TD',
  'TH',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
]);

function containsBlock(fragment: DocumentFragment): boolean {
  for (const element of Array.from(fragment.querySelectorAll('*'))) {
    if (BLOCK_TAGS.has(element.tagName)) return true;
  }
  return false;
}

interface TextSlot {
  node: Text;
  start: number;
  length: number;
}

/** Map a global text offset onto a (text node, offset) pair of the parsed HTML */
function locate(slots: TextSlot[], offset: number): { node: Text; offset: number } | null {
  for (const slot of slots) {
    if (offset >= slot.start && offset <= slot.start + slot.length) {
      const local = Math.min(offset - slot.start, slot.node.data.length);
      return { node: slot.node, offset: local };
    }
  }
  return null;
}

/** A block's span in the visible text stream (first/last non-deleted run), used by format revisions */
function blockSpans(runs: RevisionRun[]): Map<number, { start: number; end: number }> {
  const spans = new Map<number, { start: number; end: number }>();
  let cursor = 0;
  for (const run of runs) {
    if (run.kind !== 'delete') {
      const span = spans.get(run.block);
      if (span) span.end += run.text.length;
      else spans.set(run.block, { start: cursor, end: cursor + run.text.length });
      cursor += run.text.length;
    }
  }
  return spans;
}

interface MarkOp {
  at: number;
  /** Length of the covered text (`0` for a deletion, which only inserts the struck-through text) */
  length: number;
  changeId: string;
  kind: 'insert' | 'delete' | 'format' | 'comment';
  /** Revision text for the panel; unused for comments */
  text: string;
  author: string;
  createdAt: number;
  /** Comment id (`data-comment-id`) for `comment` ops */
  commentId?: string;
}

/**
 * Apply the review layer to mammoth's HTML.
 *
 * Fails (instead of guessing) when the visible text does not line up: the caller then keeps the plain
 * import and reports the loss, so a wrong revision never lands in the document.
 */
export function applyDocumentReview(
  html: string,
  parsed: ParsedDocumentReview,
  comments: ImportedComment[],
  importedAt: number,
): ToolResult<AppliedReview> {
  const { runs, formats, anchors } = parsed;
  const marked = runs.filter((run) => run.kind !== 'normal' && run.text.length > 0);
  if (marked.length === 0 && formats.length === 0 && anchors.length === 0) {
    return { ok: true, value: { html, changes: [], comments: [], skippedComments: 0 } };
  }

  const expected = runs
    .filter((run) => run.kind !== 'delete')
    .map((run) => run.text)
    .join('');

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const slots: TextSlot[] = [];
  let visible = '';
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement?.tagName;
    if (parent === 'STYLE' || parent === 'SCRIPT') continue;
    slots.push({ node, start: visible.length, length: node.data.length });
    visible += node.data;
  }

  if (visible !== expected) return { ok: false, error: 'REVISION_MISMATCH' };

  const parseDate = (value: string | null, fallback: number): number => {
    if (!value) return fallback;
    const parsedDate = Date.parse(value);
    return Number.isNaN(parsedDate) ? fallback : parsedDate;
  };

  const ops: MarkOp[] = [];
  const changes: TrackedChange[] = [];
  let cursor = 0;
  let insertedCount = 0;
  let deletedCount = 0;
  // Walk *every* run: unmarked text also advances the cursor, otherwise every revision after the first
  // paragraph of plain text lands at the wrong offset
  for (const run of runs) {
    if (run.kind === 'normal') {
      cursor += run.text.length;
      continue;
    }
    const createdAt = parseDate(run.date, importedAt);
    if (run.kind === 'insert') {
      insertedCount += 1;
      const id = `docx-ins-${insertedCount}`;
      ops.push({
        at: cursor,
        length: run.text.length,
        changeId: id,
        kind: 'insert',
        text: run.text,
        author: run.author,
        createdAt,
      });
      changes.push({ id, kind: 'insert', text: run.text, author: run.author, createdAt });
      cursor += run.text.length;
      continue;
    }
    deletedCount += 1;
    const id = `docx-del-${deletedCount}`;
    ops.push({
      at: cursor,
      length: 0,
      changeId: id,
      kind: 'delete',
      text: run.text,
      author: run.author,
      createdAt,
    });
    changes.push({ id, kind: 'delete', text: run.text, author: run.author, createdAt });
  }

  const spans = blockSpans(runs);
  formats.forEach((format, index) => {
    const span = spans.get(format.block);
    if (!span || span.end <= span.start) return;
    const id = `docx-fmt-${index + 1}`;
    const text = runs
      .filter((run) => run.block === format.block && run.kind !== 'delete')
      .map((run) => run.text)
      .join('');
    const createdAt = parseDate(format.date, importedAt);
    ops.push({
      at: span.start,
      length: span.end - span.start,
      changeId: id,
      kind: 'format',
      text,
      author: format.author,
      createdAt,
    });
    changes.push({ id, kind: 'format', text, author: format.author, createdAt });
  });

  const metaById = new Map(comments.map((comment) => [comment.docxId, comment]));
  const restored: DocComment[] = [];
  let skippedComments = 0;
  anchors.forEach((anchor) => {
    const meta = metaById.get(anchor.docxId);
    if (!meta || anchor.end <= anchor.start || anchor.end > visible.length) {
      skippedComments += 1;
      return;
    }
    const commentId = `docx-cmt-${anchor.docxId}`;
    ops.push({
      at: anchor.start,
      length: anchor.end - anchor.start,
      changeId: commentId,
      kind: 'comment',
      text: '',
      author: meta.author,
      createdAt: parseDate(meta.date, importedAt),
      commentId,
    });
    restored.push({
      id: commentId,
      quote: meta.quote || visible.slice(anchor.start, anchor.end),
      text: meta.text,
      author: meta.author,
      createdAt: parseDate(meta.date, importedAt),
      resolved: false,
    });
  });

  // Back to front: every operation keeps the offsets of the earlier ones valid. A block-wide format wrap
  // starts before anything inside it, so it is applied last and nests around the inner marks.
  for (const op of [...ops].sort((a, b) => b.at - a.at)) {
    const start = locate(slots, op.at);
    if (!start) return { ok: false, error: 'REVISION_MISMATCH' };

    if (op.kind === 'delete') {
      const element = doc.createElement('del');
      element.setAttribute('data-track', 'delete');
      element.setAttribute('data-track-id', op.changeId);
      element.textContent = op.text;
      const range = doc.createRange();
      range.setStart(start.node, start.offset);
      range.collapse(true);
      range.insertNode(element);
      continue;
    }

    const end = locate(slots, op.at + op.length);
    if (!end) return { ok: false, error: 'REVISION_MISMATCH' };
    const range = doc.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    // Neither an insertion nor a comment spans blocks in OOXML (a comment may cross paragraphs, but the
    // editor cannot anchor that); wrapping a <p> would produce a node the schema rejects
    if (containsBlock(range.cloneContents())) {
      if (op.kind === 'comment') {
        skippedComments += 1;
        restored.pop();
        continue;
      }
      return { ok: false, error: 'REVISION_MISMATCH' };
    }

    let wrapper: HTMLElement;
    if (op.kind === 'comment') {
      wrapper = doc.createElement('span');
      wrapper.setAttribute('data-comment-id', op.commentId ?? op.changeId);
    } else if (op.kind === 'format') {
      wrapper = doc.createElement('span');
      wrapper.setAttribute('data-track', 'format');
      wrapper.setAttribute('data-track-format', formatTargetOf(op.changeId, formats));
      wrapper.setAttribute('data-track-id', op.changeId);
    } else {
      wrapper = doc.createElement('ins');
      wrapper.setAttribute('data-track', 'insert');
      wrapper.setAttribute('data-track-id', op.changeId);
    }
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
  }

  return {
    ok: true,
    value: { html: doc.body.innerHTML, changes, comments: restored, skippedComments },
  };
}

/** The `target` of one format op, looked up by its id (ids are assigned in `formats` order) */
function formatTargetOf(changeId: string, formats: FormatRevision[]): string {
  const index = Number.parseInt(changeId.replace('docx-fmt-', ''), 10) - 1;
  return formats[index]?.target ?? 'paragraph';
}

/** Revisions only (kept for callers/tests that do not import comments or format changes) */
export function applyRevisionMarks(
  html: string,
  runs: RevisionRun[],
  importedAt: number,
): ToolResult<{ html: string; changes: TrackedChange[] }> {
  const applied = applyDocumentReview(html, { runs, formats: [], anchors: [] }, [], importedAt);
  if (!applied.ok) return applied;
  return { ok: true, value: { html: applied.value.html, changes: applied.value.changes } };
}
