import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import { compareBlocks, type DocBlock } from './compare';

/**
 * Comparison → tracked revisions (P2-3 第二批).
 *
 * `compareBlocks` only knows block text; this module turns its change list into **one ProseMirror
 * transaction**, so a comparison is a single history step (undo reverts the whole comparison) and the
 * document ends up as "B plus the parts of A that were deleted", which is what accept-all needs to equal B.
 *
 * Two shapes of a changed block:
 * - plain text block → inline revision: deleted tokens get `trackedDelete`, new tokens are inserted with
 *   `trackedInsert`, equal tokens stay untouched (so formatting of the surviving text is preserved);
 * - structured block (list / table / anything with more than one child) → the whole block is marked deleted
 *   and the target block is inserted after it, because splicing table cells inline would corrupt the model.
 *
 * Block kind changes with identical text become a `trackedFormat` revision that keeps the previous kind in
 * its attrs, so rejecting can restore it.
 */

export interface RevisionEntry {
  /** Change id carried by the marks; per-change accept/reject looks it up */
  id: string;
  kind: 'insert' | 'delete' | 'format';
  /** Text shown in the review panel */
  text: string;
  /** Block text before/after, for the panel tooltip */
  before?: string;
  after?: string;
}

export interface RevisionPlan {
  tr: Transaction;
  entries: RevisionEntry[];
}

interface BlockRef {
  block: DocBlock;
  /** Position of the block node inside the document */
  pos: number;
  node: PMNode;
  /** True when the block holds exactly one text node, i.e. inline splicing is safe */
  plain: boolean;
}

type EditOp =
  | { kind: 'markDelete'; at: number; from: number; to: number; changeId: string }
  | { kind: 'markFormat'; at: number; from: number; to: number; changeId: string; target: string }
  | { kind: 'insertText'; at: number; text: string; changeId: string }
  /** The block travels as JSON: the target document may come from a different editor (own schema) */
  | { kind: 'insertBlock'; at: number; json: unknown; changeId: string }
  | { kind: 'setBlockType'; at: number; type: string; blockPos: number };

/** Normalized text of one block (list items / table rows joined with `\n`) */
function blockText(node: PMNode): string {
  const text = node.textBetween(0, node.content.size, '\n', '\n');
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function readBlocks(doc: PMNode): BlockRef[] {
  const refs: BlockRef[] = [];
  doc.forEach((node, offset) => {
    refs.push({
      block: { type: node.type.name, text: blockText(node) },
      pos: offset,
      node,
      plain: node.childCount === 1 && node.firstChild?.isText === true,
    });
  });
  return refs;
}

/**
 * Build the comparison transaction.
 *
 * Returns null when the two documents are identical (the caller can then say "no differences" instead of
 * pushing an empty history step).
 */
export function planComparison(state: EditorState, target: PMNode): RevisionPlan | null {
  const base = readBlocks(state.doc);
  const next = readBlocks(target);
  const result = compareBlocks(
    base.map((ref) => ref.block),
    next.map((ref) => ref.block),
  );
  if (result.stats.identical) return null;

  const ops: EditOp[] = [];
  const entries: RevisionEntry[] = [];
  const marks = state.schema.marks;

  result.changes.forEach((change, index) => {
    const changeId = `cmp-${index + 1}`;
    // Position of the block that precedes this change in the base document
    const anchor = change.beforeIndex === null ? (change.afterIndex ?? 0) : change.beforeIndex;

    if (change.kind === 'insert' && change.after) {
      const targetRef = next[change.afterIndex ?? 0];
      if (!targetRef) return;
      // Insert right after the last base block consumed so far (or at the very top)
      const previous = base[anchor - 1];
      const at = previous ? previous.pos + previous.node.nodeSize : 0;
      ops.push({ kind: 'insertBlock', at, json: targetRef.node.toJSON(), changeId });
      entries.push({
        id: changeId,
        kind: 'insert',
        text: change.after.text,
        after: change.after.text,
      });
      return;
    }

    const baseRef = base[change.beforeIndex ?? 0];
    if (!baseRef) return;

    if (change.kind === 'delete') {
      ops.push({
        kind: 'markDelete',
        at: baseRef.pos,
        from: baseRef.pos + 1,
        to: baseRef.pos + baseRef.node.nodeSize - 1,
        changeId,
      });
      entries.push({
        id: changeId,
        kind: 'delete',
        text: baseRef.block.text,
        before: baseRef.block.text,
      });
      return;
    }

    // replace
    const targetRef = next[change.afterIndex ?? 0];
    if (!targetRef || !change.after) return;
    if (change.formatOnly) {
      ops.push({
        kind: 'setBlockType',
        at: baseRef.pos,
        type: targetRef.block.type,
        blockPos: baseRef.pos,
      });
      ops.push({
        kind: 'markFormat',
        at: baseRef.pos + 1,
        from: baseRef.pos + 1,
        to: baseRef.pos + targetRef.node.nodeSize - 1,
        changeId,
        target: baseRef.block.type,
      });
      entries.push({
        id: changeId,
        kind: 'format',
        text: baseRef.block.text,
        before: baseRef.block.type,
        after: targetRef.block.type,
      });
      return;
    }

    if (baseRef.plain && targetRef.plain) {
      // Inline splice: walk the token diff over the base text offsets
      let offset = 0;
      for (const segment of change.segments ?? []) {
        if (segment.kind === 'equal') {
          offset += segment.text.length;
          continue;
        }
        if (segment.kind === 'delete') {
          ops.push({
            kind: 'markDelete',
            at: baseRef.pos + 1 + offset,
            from: baseRef.pos + 1 + offset,
            to: baseRef.pos + 1 + offset + segment.text.length,
            changeId,
          });
          offset += segment.text.length;
          continue;
        }
        ops.push({
          kind: 'insertText',
          at: baseRef.pos + 1 + offset,
          text: segment.text,
          changeId,
        });
      }
      entries.push({
        id: changeId,
        kind: 'delete',
        text: baseRef.block.text,
        before: baseRef.block.text,
        after: change.after.text,
      });
      return;
    }

    // Structured block: whole block deleted + target block inserted after it
    ops.push({
      kind: 'markDelete',
      at: baseRef.pos,
      from: baseRef.pos + 1,
      to: baseRef.pos + baseRef.node.nodeSize - 1,
      changeId,
    });
    ops.push({
      kind: 'insertBlock',
      at: baseRef.pos + baseRef.node.nodeSize,
      json: targetRef.node.toJSON(),
      changeId,
    });
    entries.push({
      id: changeId,
      kind: 'delete',
      text: baseRef.block.text,
      before: baseRef.block.text,
      after: change.after.text,
    });
  });

  if (!ops.length) return null;

  const tr = state.tr;
  // Back to front: every operation only touches its own range, so positions stay valid
  [...ops]
    .sort((a, b) => b.at - a.at)
    .forEach((op) => {
      if (op.kind === 'markDelete') {
        tr.addMark(op.from, op.to, marks.trackedDelete.create({ changeId: op.changeId }));
        return;
      }
      if (op.kind === 'markFormat') {
        tr.addMark(
          op.from,
          op.to,
          marks.trackedFormat.create({ changeId: op.changeId, target: op.target }),
        );
        return;
      }
      if (op.kind === 'insertText') {
        if (!op.text) return;
        tr.insertText(op.text, op.at);
        tr.addMark(
          op.at,
          op.at + op.text.length,
          marks.trackedInsert.create({ changeId: op.changeId }),
        );
        return;
      }
      if (op.kind === 'insertBlock') {
        // Rebuild through the *editing* schema: a node from another editor's schema is silently rejected
        // by the document's content match, which would lose the block and mark the wrong text instead
        const node = state.schema.nodeFromJSON(op.json);
        tr.insert(op.at, node);
        const from = op.at + 1;
        const to = op.at + node.nodeSize - 1;
        if (to > from) {
          tr.addMark(from, to, marks.trackedInsert.create({ changeId: op.changeId }));
        }
        return;
      }
      const type = state.schema.nodes[op.type];
      const block = tr.doc.nodeAt(op.blockPos);
      if (type && block && type !== block.type && type.validContent(block.content)) {
        tr.setNodeMarkup(op.blockPos, type);
      }
    });

  return { tr, entries };
}

/** Change ids still present in the document (used to drop entries whose marks were removed by a merge) */
export function changeIdsIn(doc: PMNode): Set<string> {
  const ids = new Set<string>();
  doc.descendants((node) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (!mark.type.name.startsWith('tracked')) continue;
      const id = mark.attrs.changeId;
      if (typeof id === 'string' && id) ids.add(id);
    }
  });
  return ids;
}
