import { Mark, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode, Schema } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';

/**
 * Mark implementations for document-level annotations (local, no collaboration service):
 * - comment: comment highlight (the id attribute points to a local comment record)
 * - trackedInsert / trackedDelete: tracked changes (inserts underlined, deletes struck through but kept)
 * All go through Mark (a first-class ProseMirror citizen), so DOMObserver never strips them.
 */

export interface CommentAttrs {
  commentId: string;
}

const Comment = Mark.create<CommentAttrs>({
  name: 'comment',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-comment-id'),
        renderHTML: (attrs) => (attrs.commentId ? { 'data-comment-id': attrs.commentId } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'rte-comment' }), 0];
  },
});

/** `changeId` links a mark to one entry in the review panel, which is what makes per-change accept/reject possible */
const changeIdAttr = {
  default: null as string | null,
  parseHTML: (el: HTMLElement) => el.getAttribute('data-track-id'),
  renderHTML: (attrs: Record<string, unknown>) =>
    attrs.changeId ? { 'data-track-id': String(attrs.changeId) } : {},
};

const TrackedInsert = Mark.create({
  name: 'trackedInsert',
  inclusive: true,
  addAttributes() {
    return { changeId: changeIdAttr };
  },
  parseHTML() {
    return [{ tag: 'ins[data-track]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'ins',
      mergeAttributes(HTMLAttributes, { 'data-track': 'insert', class: 'rte-track-insert' }),
      0,
    ];
  },
});

const TrackedDelete = Mark.create({
  name: 'trackedDelete',
  inclusive: true,
  addAttributes() {
    return { changeId: changeIdAttr };
  },
  parseHTML() {
    return [{ tag: 'del[data-track]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'del',
      mergeAttributes(HTMLAttributes, { 'data-track': 'delete', class: 'rte-track-delete' }),
      0,
    ];
  },
});

/**
 * Format revision: the text is unchanged but the block kind changed (a paragraph turned into a heading).
 * `target` keeps the *previous* block kind, so rejecting can restore it — Word expresses the same thing as
 * `w:pPrChange`, which the docx writer leaves out (documented in the fidelity report).
 */
const TrackedFormat = Mark.create({
  name: 'trackedFormat',
  inclusive: false,
  addAttributes() {
    return {
      changeId: changeIdAttr,
      target: {
        default: null as string | null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-track-format'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.target ? { 'data-track-format': String(attrs.target) } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-track-format]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-track': 'format', class: 'rte-track-format' }),
      0,
    ];
  },
});

/** Text ranges carrying one of the tracked marks (`changeId` omitted = every change) */
function rangesOfChange(
  doc: PMNode,
  markName: 'trackedInsert' | 'trackedDelete',
  changeId?: string,
): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const hit = node.marks.some(
      (mark) =>
        mark.type.name === markName && (changeId === undefined || mark.attrs.changeId === changeId),
    );
    if (hit) ranges.push({ from: pos, to: pos + node.nodeSize });
  });
  return ranges;
}

/** Format revisions, together with the block kind to restore when they are rejected */
function formatRanges(
  doc: PMNode,
  changeId?: string,
): { from: number; to: number; target: string }[] {
  const ranges: { from: number; to: number; target: string }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type.name !== 'trackedFormat') continue;
      if (changeId !== undefined && mark.attrs.changeId !== changeId) continue;
      const target = mark.attrs.target;
      if (typeof target === 'string' && target) {
        ranges.push({ from: pos, to: pos + node.nodeSize, target });
      }
    }
  });
  return ranges;
}

/**
 * Block identity used by format revisions: `heading:2` keeps the level, plain kinds stay bare.
 *
 * The level has to travel with the target: restoring "it used to be a heading" without the level would
 * silently turn an H2 into an H1 (or leave the new level in place).
 */
export function blockTargetKey(node: PMNode): string {
  if (node.type.name === 'heading') {
    const level = Number(node.attrs.level);
    return Number.isFinite(level) && level > 0 ? `heading:${level}` : 'heading';
  }
  return node.type.name;
}

/** Inverse of `blockTargetKey`; `heading` without a level falls back to the current attrs */
export function parseBlockTarget(key: string): { type: string; level?: number } {
  const [type, rawLevel] = key.split(':');
  const level = Number.parseInt(rawLevel ?? '', 10);
  return Number.isFinite(level) && level > 0 ? { type, level } : { type };
}

/**
 * First text range carrying `changeId` (whatever the revision kind).
 *
 * The review panel uses it to jump to a revision: the panel only knows the id, and the id lives on the
 * marks, so the range has to be derived from the document every time (positions move with every edit).
 */
export function findChangeRange(
  doc: PMNode,
  changeId: string,
): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (!node.isText) return true;
    const hit = node.marks.some(
      (mark) => mark.type.name.startsWith('tracked') && mark.attrs.changeId === changeId,
    );
    if (hit) found = { from: pos, to: pos + node.nodeSize };
    return !found;
  });
  return found;
}

function hasTrackedMarks(doc: PMNode): boolean {
  let found = false;
  doc.descendants((node) => {
    if (found) return false;
    if (!node.isText) return true; // keep descending, marks live on text nodes
    if (node.marks.some((mark) => mark.type.name.startsWith('tracked'))) found = true;
    return !found;
  });
  return found;
}

type TrackedOp =
  | { kind: 'delete'; from: number; to: number }
  | {
      kind: 'unmark';
      from: number;
      to: number;
      mark: 'trackedInsert' | 'trackedDelete' | 'trackedFormat';
    }
  | { kind: 'restore'; from: number; target: string };

/**
 * Translate the tracked marks into the operations of one accept/reject pass.
 *
 * Accept keeps insertions (their marks are dropped) and removes deleted text; reject drops inserted text,
 * unmarks deletions (which "brings them back") and restores the previous block kind of format revisions.
 */
function collectTrackedOps(doc: PMNode, mode: 'accept' | 'reject', changeId?: string): TrackedOp[] {
  const ops: TrackedOp[] = [];
  const insertions = rangesOfChange(doc, 'trackedInsert', changeId);
  const deletions = rangesOfChange(doc, 'trackedDelete', changeId);
  const formats = formatRanges(doc, changeId);
  if (mode === 'accept') {
    insertions.forEach((range) => ops.push({ kind: 'unmark', mark: 'trackedInsert', ...range }));
    formats.forEach(({ from, to }) =>
      ops.push({ kind: 'unmark', mark: 'trackedFormat', from, to }),
    );
    deletions.forEach((range) => ops.push({ kind: 'delete', ...range }));
    return ops;
  }
  insertions.forEach((range) => ops.push({ kind: 'delete', ...range }));
  deletions.forEach((range) => ops.push({ kind: 'unmark', mark: 'trackedDelete', ...range }));
  formats.forEach(({ from, to, target }) => {
    ops.push({ kind: 'restore', from, target });
    ops.push({ kind: 'unmark', mark: 'trackedFormat', from, to });
  });
  return ops;
}

/**
 * Apply the operations back to front: document positions stay valid because every operation only touches
 * its own range, and ranges never overlap (marks are split per text node).
 */
function applyTrackedOps(tr: Transaction, schema: Schema, ops: TrackedOp[]): void {
  const restored = new Set<number>();
  [...ops]
    .sort((a, b) => b.from - a.from)
    .forEach((op) => {
      if (op.kind === 'delete') {
        tr.delete(op.from, op.to);
        return;
      }
      if (op.kind === 'unmark') {
        tr.removeMark(op.from, op.to, schema.marks[op.mark]);
        return;
      }
      const $pos = tr.doc.resolve(op.from);
      const blockPos = $pos.depth > 0 ? $pos.before(1) : op.from;
      const block = tr.doc.nodeAt(blockPos);
      const target = parseBlockTarget(op.target);
      const type = schema.nodes[target.type];
      if (!block || !type || type === block.type || restored.has(blockPos)) return;
      // A previous kind that cannot hold the current content (e.g. list item outside a list) is kept
      if (!type.validContent(block.content)) return;
      restored.add(blockPos);
      // Heading level lives in the node attrs, so the type alone cannot describe "it used to be H2"
      tr.setNodeMarkup(
        blockPos,
        type,
        type === schema.nodes.heading && target.level
          ? { ...block.attrs, level: target.level }
          : block.attrs,
      );
    });
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    docMarks: {
      /** Mark the selection with a comment */
      setComment: (id: string) => ReturnType;
      /** Remove the body marks of one comment (keeping other comments on the same node) */
      removeCommentMark: (id: string) => ReturnType;
      /** Track the selection as an insertion or deletion (`changeId` links it to a review entry) */
      markTrackedInsert: (changeId?: string) => ReturnType;
      markTrackedDelete: (changeId?: string) => ReturnType;
      /** Track a block-kind change (text stays, `target` is the previous block kind) */
      markTrackedFormat: (changeId: string, target: string) => ReturnType;
      /** Accept all changes (clear marks; deletions also remove the text) */
      acceptAllTracked: () => ReturnType;
      /** Reject all changes (drop inserted text; restore deleted text) */
      rejectAllTracked: () => ReturnType;
      /** Accept one change by id (insertions stay, deletions are removed, format keeps the new kind) */
      acceptTrackedChange: (changeId: string) => ReturnType;
      /** Reject one change by id (insertions disappear, deletions come back, format is restored) */
      rejectTrackedChange: (changeId: string) => ReturnType;
    };
  }
}

export const DocMarkCommands = Mark.create({
  name: 'docMarkCommands',
  addCommands() {
    return {
      setComment:
        (id: string) =>
        ({ commands }) =>
          commands.setMark('comment', { commentId: id }),
      removeCommentMark:
        (id: string) =>
        ({ state, tr }) => {
          const commentType = state.schema.marks.comment;
          let changed = false;
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            const hasTarget = node.marks.some(
              (mark) => mark.type.name === 'comment' && mark.attrs.commentId === id,
            );
            if (!hasTarget) return;
            changed = true;
            const from = pos;
            const to = pos + node.nodeSize;
            tr.removeMark(from, to, commentType);
            // Other comments may overlap the same text: re-apply them in order after removal
            node.marks
              .filter((mark) => mark.type.name === 'comment' && mark.attrs.commentId !== id)
              .forEach((mark) => tr.addMark(from, to, mark));
          });
          return changed;
        },
      markTrackedInsert:
        (changeId?: string) =>
        ({ commands }) =>
          commands.setMark('trackedInsert', { changeId: changeId ?? null }),
      markTrackedDelete:
        (changeId?: string) =>
        ({ commands }) =>
          commands.setMark('trackedDelete', { changeId: changeId ?? null }),
      markTrackedFormat:
        (changeId: string, target: string) =>
        ({ commands }) =>
          commands.setMark('trackedFormat', { changeId, target }),
      acceptAllTracked:
        () =>
        ({ state, tr }) => {
          if (!hasTrackedMarks(state.doc)) return false;
          applyTrackedOps(tr, state.schema, collectTrackedOps(state.doc, 'accept'));
          return true;
        },
      rejectAllTracked:
        () =>
        ({ state, tr }) => {
          if (!hasTrackedMarks(state.doc)) return false;
          applyTrackedOps(tr, state.schema, collectTrackedOps(state.doc, 'reject'));
          return true;
        },
      acceptTrackedChange:
        (changeId: string) =>
        ({ state, tr }) => {
          const ops = collectTrackedOps(state.doc, 'accept', changeId);
          if (!ops.length) return false;
          applyTrackedOps(tr, state.schema, ops);
          return true;
        },
      rejectTrackedChange:
        (changeId: string) =>
        ({ state, tr }) => {
          const ops = collectTrackedOps(state.doc, 'reject', changeId);
          if (!ops.length) return false;
          applyTrackedOps(tr, state.schema, ops);
          return true;
        },
    };
  },
});

export { Comment, TrackedInsert, TrackedDelete, TrackedFormat };
