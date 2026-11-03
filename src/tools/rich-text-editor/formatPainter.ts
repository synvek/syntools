import type { Editor } from '@tiptap/react';
import type { Mark } from '@tiptap/pm/model';

/**
 * Format painter (Word's 格式刷): copy the character formatting of one selection onto the next one.
 *
 * Why a whitelist instead of "all marks": the document carries marks that are *not* formatting — a link
 * URL, a comment anchor, a tracked-revision id. Painting those onto an unrelated selection would
 * silently rewrite a hyperlink target or move a reviewer's comment, which is far worse than a missing
 * format. The list below is exactly what Word's painter copies: font, size, colour, weight, underline,
 * strike, super/subscript, small caps, code and highlight.
 */
const PAINTABLE_MARKS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'smallCaps',
  'superscript',
  'subscript',
  'textStyle',
  'highlight',
] as const;

/** Marks at the caret (or at the start of the selection) that the painter should carry over */
export function captureFormat(editor: Editor): Mark[] {
  const { state } = editor;
  const marks = state.storedMarks ?? state.selection.$from.marks();
  return marks.filter((mark) => (PAINTABLE_MARKS as readonly string[]).includes(mark.type.name));
}

/**
 * Paint the captured marks onto the current selection.
 *
 * Returns false when the selection is empty: a collapsed caret has nothing to paint, and the caller
 * keeps the painter armed so the user can drag over text next.
 */
export function applyFormat(editor: Editor, marks: readonly Mark[]): boolean {
  const { state, view } = editor;
  const { from, to, empty } = state.selection;
  if (empty || from === to) return false;

  const tr = state.tr;
  // Clear only the paintable marks, so link / comment / revision marks stay where the author put them
  for (const name of PAINTABLE_MARKS) {
    const type = state.schema.marks[name];
    if (type) tr.removeMark(from, to, type);
  }
  for (const mark of marks) tr.addMark(from, to, mark);
  view.dispatch(tr);
  return true;
}
