import { Mark, mergeAttributes } from '@tiptap/core';

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

const TrackedInsert = Mark.create({
  name: 'trackedInsert',
  inclusive: true,
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

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    docMarks: {
      /** Mark the selection with a comment */
      setComment: (id: string) => ReturnType;
      /** Remove the body marks of one comment (keeping other comments on the same node) */
      removeCommentMark: (id: string) => ReturnType;
      /** Track the selection as an insertion or deletion */
      markTrackedInsert: () => ReturnType;
      markTrackedDelete: () => ReturnType;
      /** Accept all changes (clear marks; deletions also remove the text) */
      acceptAllTracked: () => ReturnType;
      /** Reject all changes (drop inserted text; restore deleted text) */
      rejectAllTracked: () => ReturnType;
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
        () =>
        ({ commands }) =>
          commands.setMark('trackedInsert'),
      markTrackedDelete:
        () =>
        ({ commands }) =>
          commands.setMark('trackedDelete'),
      acceptAllTracked:
        () =>
        ({ state, tr }) => {
          // Deletion marks: remove the text as well (accept the deletion)
          const deletions: { from: number; to: number }[] = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            if (node.marks.some((mark) => mark.type.name === 'trackedDelete')) {
              deletions.push({ from: pos, to: pos + node.nodeSize });
            }
          });
          // Delete back to front so positions stay valid
          deletions.reverse().forEach(({ from, to }) => tr.delete(from, to));
          tr.removeMark(0, tr.doc.content.size, state.schema.marks.trackedInsert);
          return true;
        },
      rejectAllTracked:
        () =>
        ({ state, tr }) => {
          // Insertion marks: drop the inserted text (reject the insertion)
          const insertions: { from: number; to: number }[] = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            if (node.marks.some((mark) => mark.type.name === 'trackedInsert')) {
              insertions.push({ from: pos, to: pos + node.nodeSize });
            }
          });
          insertions.reverse().forEach(({ from, to }) => tr.delete(from, to));
          tr.removeMark(0, tr.doc.content.size, state.schema.marks.trackedDelete);
          return true;
        },
    };
  },
});

export { Comment, TrackedInsert, TrackedDelete };
