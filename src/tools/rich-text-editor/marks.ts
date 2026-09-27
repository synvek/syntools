import { Mark, mergeAttributes } from '@tiptap/core';

/**
 * 文档级标记的 Mark 实现（本地，不依赖协作服务）：
 * - comment：批注高亮（属性 id 指向本地批注记录）
 * - trackedInsert / trackedDelete：修订追踪（插入为下划线、删除为删除线并保留原文）
 * 全部走 Mark（PM 一等公民），不会被 DOMObserver 抹掉。
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
      /** 给选区加批注标记 */
      setComment: (id: string) => ReturnType;
      /** 以修订方式标记选区为插入/删除 */
      markTrackedInsert: () => ReturnType;
      markTrackedDelete: () => ReturnType;
      /** 接受全部修订（清除标记；删除标记同时移除文本） */
      acceptAllTracked: () => ReturnType;
      /** 拒绝全部修订（清除插入文本；删除标记恢复文本） */
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
          // 删除标记：连同文本一起移除（接受删除）
          const deletions: { from: number; to: number }[] = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            if (node.marks.some((mark) => mark.type.name === 'trackedDelete')) {
              deletions.push({ from: pos, to: pos + node.nodeSize });
            }
          });
          // 倒序删除，避免位置偏移
          deletions.reverse().forEach(({ from, to }) => tr.delete(from, to));
          tr.removeMark(0, tr.doc.content.size, state.schema.marks.trackedInsert);
          return true;
        },
      rejectAllTracked:
        () =>
        ({ state, tr }) => {
          // 插入标记：移除被插入的文本（拒绝插入）
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
