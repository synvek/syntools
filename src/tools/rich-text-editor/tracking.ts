import { Extension } from '@tiptap/core';
import { Fragment } from '@tiptap/pm/model';
import type { Mark, Node as PMNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Mapping, ReplaceStep, StepMap } from '@tiptap/pm/transform';
import { isHistoryTransaction } from '@tiptap/pm/history';

/**
 * Revision mode (P1-2 第一片): record typing / deleting as tracked revisions instead of plain edits.
 *
 * The rewrite happens **on the transaction that is about to be dispatched**, not on a second appended
 * transaction: one keystroke therefore stays one history step (P2-3 第二批的「一次比较 = 一步撤销」同一口径),
 * and undo restores the text exactly as it was before the keystroke.
 *
 * Only what can be expressed as a mark on inline content is tracked:
 * - an insertion gets `trackedInsert` on the new text;
 * - a deletion keeps the text and gives it `trackedDelete`;
 * - typing over a selection does both with one change id, so accepting/rejecting it is one action;
 * - deleting text that is itself a pending insertion cancels out silently (typing then backspace should
 *   not leave a revision behind).
 *
 * Deliberately untracked (see the plan's remaining list): block splits/joins (Enter/Backspace at a block
 * boundary), block-level pastes and structural commands. They pass through unchanged rather than being
 * half-tracked — a wrong mark is worse than a plain edit.
 */

/** Meta flag on transactions that must never be rewritten (accept/reject, comparison, undo/redo …) */
export const NO_TRACK_META = 'rte:no-track';

/** One recorded revision, in the shape the review panel consumes (`author` / `createdAt` added by the host) */
export interface TrackingEntry {
  id: string;
  kind: 'insert' | 'delete';
  text: string;
}

export interface TrackingResult {
  /** The transaction to dispatch instead of the original one */
  tr: Transaction;
  entries: TrackingEntry[];
}

let sequence = 0;

/** Stable-ish unique id; readable in the DOM (`data-track-id`) and in tests */
export function nextChangeId(now: number = Date.now()): string {
  sequence += 1;
  return `tr-${now.toString(36)}-${sequence.toString(36)}`;
}

/** Inline-only slices can be expressed with marks; anything holding a block node cannot */
function inlineOnly(fragment: Fragment): boolean {
  let inline = true;
  fragment.forEach((node) => {
    if (!node.isInline) inline = false;
  });
  return inline;
}

function textOf(fragment: Fragment): string {
  return fragment.textBetween(0, fragment.size, '\n', '\n').trim();
}

/** True when every text leaf already carries the mark (used to cancel a pending insertion) */
function allMarked(fragment: Fragment, markName: string): boolean {
  let all = true;
  let seen = false;
  fragment.forEach((node) => {
    if (!node.isText) {
      all = false;
      return;
    }
    seen = true;
    if (!node.marks.some((mark) => mark.type.name === markName)) all = false;
  });
  return seen && all;
}

function markFragment(fragment: Fragment, mark: Mark): Fragment {
  const nodes: PMNode[] = [];
  fragment.forEach((node) => {
    nodes.push(node.isInline ? node.mark(mark.addToSet(node.marks)) : node);
  });
  return Fragment.fromArray(nodes);
}

/**
 * Rewrite one transaction into tracked revisions.
 *
 * Returns `null` when nothing should be tracked (tracking handled by the caller's `isEnabled`, plus:
 * no document change, meta-flagged transactions, undo/redo, or a batch that only touched structure).
 */
export function trackTransaction(
  state: EditorState,
  tr: Transaction,
  nextId: () => string = nextChangeId,
): TrackingResult | null {
  if (!tr.docChanged) return null;
  if (tr.getMeta(NO_TRACK_META) || tr.getMeta('addToHistory') === false) return null;
  if (isHistoryTransaction(tr)) return null;

  const insertMark = state.schema.marks.trackedInsert;
  const deleteMark = state.schema.marks.trackedDelete;
  if (!insertMark || !deleteMark) return null;

  const out = state.tr;
  /**
   * Maps positions captured in `tr.docs[i]` (the document before step i) onto `out`'s current
   * document: keeping a deletion adds content, so every later step needs shifting by exactly that much.
   */
  const shifts = new Mapping();
  const entries: TrackingEntry[] = [];
  let caret: number | null = null;

  /** Replays a step untouched. `Step.map` can refuse (invalid mapping); then the whole rewrite is off. */
  const replay = (step: (typeof tr.steps)[number]): boolean => {
    const mapped = step.map(shifts);
    if (!mapped) return false;
    out.step(mapped);
    return true;
  };

  const steps = tr.steps;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (!(step instanceof ReplaceStep)) {
      if (!replay(step)) return null;
      continue;
    }

    const doc = tr.docs[index];
    const removed = doc.slice(step.from, step.to);
    const added = step.slice.size > 0 ? step.slice.content : null;
    if (!inlineOnly(removed.content) || (added && !inlineOnly(added))) {
      if (!replay(step)) return null;
      continue;
    }

    const at = shifts.map(step.from, 1);
    const end = shifts.map(step.to, 1);

    // Typing then deleting the same text cancels out: no revision, just the plain deletion
    if (removed.size > 0 && allMarked(removed.content, insertMark.name)) {
      out.delete(at, end);
      caret = at;
      continue;
    }

    const changeId = nextId();
    const pieces: Fragment[] = [];
    if (removed.size > 0) {
      pieces.push(markFragment(removed.content, deleteMark.create({ changeId })));
    }
    if (added) pieces.push(markFragment(added, insertMark.create({ changeId })));

    if (!pieces.length) {
      // Neither side carries text (e.g. an empty replacement): nothing to record
      if (!replay(step)) return null;
      continue;
    }

    const content = pieces.length === 1 ? pieces[0] : pieces[0].append(pieces[1]);
    out.replaceWith(at, end, content);

    const insertedText = added ? textOf(added) : '';
    const removedText = removed.size > 0 ? textOf(removed.content) : '';
    entries.push({
      id: changeId,
      kind: added ? 'insert' : 'delete',
      text: insertedText || removedText || '…',
    });

    caret = at + removed.size + step.slice.size;
    if (removed.size > 0) shifts.appendMap(new StepMap([at, at, at + removed.size]));
  }

  if (!entries.length) return null;

  if (caret !== null) {
    const pos = Math.max(0, Math.min(caret, out.doc.content.size));
    out.setSelection(TextSelection.near(out.doc.resolve(pos)));
  }

  return { tr: out, entries };
}

export interface RevisionTrackingOptions {
  /** Reads the ribbon toggle through a getter, so flipping it never rebuilds the editor */
  isEnabled: () => boolean;
  /** Receives the revisions of one dispatch, in document order */
  onChange: (entries: TrackingEntry[]) => void;
}

/**
 * Installs the rewrite through tiptap's `dispatchTransaction` hook (the documented interception point).
 *
 * A ProseMirror plugin cannot change a transaction's steps, and `appendTransaction` would produce a
 * second history entry per keystroke (undo would then take two presses, the second one bringing the
 * deletion back). Rewriting before the transaction is applied keeps one-keystroke-one-step, and the
 * hook composes with every other extension instead of monkey-patching the view.
 */
export const RevisionTracking = Extension.create<RevisionTrackingOptions>({
  name: 'revisionTracking',

  addOptions() {
    return { isEnabled: () => false, onChange: () => {} };
  },

  dispatchTransaction({ transaction, next }) {
    const { isEnabled, onChange } = this.options;
    if (!isEnabled()) {
      next(transaction);
      return;
    }
    const tracked = trackTransaction(this.editor.state, transaction);
    if (!tracked) {
      next(transaction);
      return;
    }
    next(tracked.tr);
    onChange(tracked.entries);
  },
});
