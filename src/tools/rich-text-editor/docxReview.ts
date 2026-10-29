import type { ToolResult } from '@/core/types';
import type { TrackedChange } from './docs';

/**
 * docx 修订回读（P2-3.5）：把 `word/document.xml` 里的 `w:ins` / `w:del` 还原成编辑器里的修订标记。
 *
 * 为什么必须自己读 XML：mammoth 对修订的处理恰好把两侧信息都丢掉——
 * - `w:ins` 走 `readChildElements`（透明穿透），**内容保留、修订语义消失**；
 * - `w:del` 直接列在 `ignoreElements` 里，**连 `w:delText` 一起丢弃**，HTML 里根本没有被删的文字。
 * 所以导入不是"解析 HTML"，而是"把 run 流回填到 mammoth 的 HTML 上"。
 *
 * 回填的正确性靠一条硬约束：mammoth 产出的可见文本必须与"非删除 run"拼出的文本**完全一致**。
 * 一致才回填；不一致（第三方 Word 文档里的域、脚注、图片替代文本、分栏重排…）一律**放弃回填并明确降级**，
 * 绝不错位——错误但沉默的还原比诚实的部分还原更糟（同 `sections.ts` 对 `sectPr` 的处理结论）。
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

interface RunState {
  kind: RevisionRun['kind'];
  author: string;
  date: string | null;
}

function collectRuns(node: Node, block: number, state: RunState, out: RevisionRun[]): void {
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
        out,
      );
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
        out,
      );
      continue;
    }

    if (tag === 'w:t' || tag === 'w:delText') {
      const text = element.textContent ?? '';
      if (text) out.push({ text, kind: state.kind, author: state.author, date: state.date, block });
      continue;
    }

    // Whitespace-ish runs mammoth renders as characters: they must count, otherwise the text stream drifts
    if (tag === 'w:tab') {
      out.push({ text: '\t', kind: state.kind, author: state.author, date: state.date, block });
      continue;
    }
    if (tag === 'w:noBreakHyphen') {
      out.push({ text: '\u2011', kind: state.kind, author: state.author, date: state.date, block });
      continue;
    }
    if (tag === 'w:softHyphen') {
      out.push({ text: '\u00AD', kind: state.kind, author: state.author, date: state.date, block });
      continue;
    }
    // Field instructions are not rendered as text by mammoth: counting them would break the alignment
    if (tag === 'w:instrText' || tag === 'w:pPr') continue;

    collectRuns(element, block, state, out);
  }
}

/** Runs in document order (paragraph by paragraph, tables included) */
export function parseRevisionRuns(xml: string): RevisionRun[] {
  if (!xml.trim()) return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return [];
  const runs: RevisionRun[] = [];
  const paragraphs = Array.from(doc.getElementsByTagName('w:p'));
  paragraphs.forEach((paragraph, block) => {
    collectRuns(paragraph, block, { kind: 'normal', author: '', date: null }, runs);
  });
  return mergeRuns(runs);
}

/** True when the package carries any revision at all (import can skip the whole path otherwise) */
export function hasRevisions(runs: RevisionRun[]): boolean {
  return runs.some((run) => run.kind !== 'normal' && run.text.trim().length > 0);
}

export interface AppliedRevisions {
  html: string;
  /** One entry per revision: the review panel and the per-change commands work off these ids */
  changes: TrackedChange[];
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

type RevisionOp =
  | { kind: 'insert'; at: number; text: string; id: string; author: string; createdAt: number }
  | { kind: 'delete'; at: number; text: string; id: string; author: string; createdAt: number };

/**
 * Apply the revision runs to mammoth's HTML.
 *
 * Fails (instead of guessing) when the visible text does not line up: the caller then keeps the plain
 * import and reports the loss, so a wrong revision never lands in the document.
 */
export function applyRevisionMarks(
  html: string,
  runs: RevisionRun[],
  importedAt: number,
): ToolResult<AppliedRevisions> {
  const marked = runs.filter((run) => run.kind !== 'normal' && run.text.length > 0);
  if (marked.length === 0) return { ok: true, value: { html, changes: [] } };

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

  const parseDate = (value: string | null): number => {
    if (!value) return importedAt;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? importedAt : parsed;
  };

  const ops: RevisionOp[] = [];
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
    if (run.kind === 'insert') {
      insertedCount += 1;
      ops.push({
        kind: 'insert',
        at: cursor,
        text: run.text,
        id: `docx-ins-${insertedCount}`,
        author: run.author,
        createdAt: parseDate(run.date),
      });
      cursor += run.text.length;
      continue;
    }
    deletedCount += 1;
    ops.push({
      kind: 'delete',
      at: cursor,
      text: run.text,
      id: `docx-del-${deletedCount}`,
      author: run.author,
      createdAt: parseDate(run.date),
    });
  }

  // Back to front: every operation keeps the offsets of the earlier ones valid
  for (const op of [...ops].sort((a, b) => b.at - a.at)) {
    if (op.kind === 'delete') {
      const start = locate(slots, op.at);
      if (!start) return { ok: false, error: 'REVISION_MISMATCH' };
      const element = doc.createElement('del');
      element.setAttribute('data-track', 'delete');
      element.setAttribute('data-track-id', op.id);
      element.textContent = op.text;
      const range = doc.createRange();
      range.setStart(start.node, start.offset);
      range.collapse(true);
      range.insertNode(element);
      continue;
    }
    const start = locate(slots, op.at);
    const end = locate(slots, op.at + op.text.length);
    if (!start || !end) return { ok: false, error: 'REVISION_MISMATCH' };
    const range = doc.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    // An insertion never spans blocks in OOXML; if it does, the mapping is off and we stop rather than
    // wrap a <p> in an <ins> (the editor schema would reject the node)
    if (containsBlock(range.cloneContents())) return { ok: false, error: 'REVISION_MISMATCH' };
    const wrapper = doc.createElement('ins');
    wrapper.setAttribute('data-track', 'insert');
    wrapper.setAttribute('data-track-id', op.id);
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
  }

  const changes: TrackedChange[] = ops.map((op) => ({
    id: op.id,
    kind: op.kind,
    text: op.text,
    author: op.author,
    createdAt: op.createdAt,
  }));

  return { ok: true, value: { html: doc.body.innerHTML, changes } };
}
