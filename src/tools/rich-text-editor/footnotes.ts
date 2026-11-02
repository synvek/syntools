import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import {
  collectNotes,
  createNoteListExtension,
  createNoteRefView,
  findSelectedNote,
  injectNotes,
  renderNoteList,
  type NoteEditDetail,
  type NoteKind,
  type NoteLabels,
} from './notes';

/**
 * 脚注（Word 脚注）：
 *
 * - 正文持有一个行内 atom `footnoteRef`，说明文字存在节点属性 `note` 里 —— 自包含，
 *   避免"引用 + 列表"两个节点的位置耦合，撤销/重做与序列化都只面对一条记录；
 * - 屏上文末汇总是 widget 装饰：不动文档内容，也永远不进 getHTML；
 * - 打印 / 快照 PDF / 单文件 HTML / Markdown / Word 导出前统一走 injectFootnotes：
 *   按 DOM 顺序编号、把编号写进 HTML、再追加同一份汇总。
 *
 * 与尾注（`endnotes.ts`）的共享语义都在 `notes.ts`：编号、汇总、注入、点击编辑。
 */

export type FootnoteLabels = NoteLabels;
export type FootnoteEditDetail = NoteEditDetail;

export const DEFAULT_FOOTNOTE_LABELS: FootnoteLabels = { name: '脚注', empty: '（空脚注）' };

/** 脚注在 schema 与 HTML 里的身份 */
export const FOOTNOTE_KIND: NoteKind = {
  nodeName: 'footnoteRef',
  refAttr: 'data-footnote',
  listAttr: 'data-footnote-list',
  listClass: 'rte-footnote-list',
  itemClass: 'rte-footnote-item',
  refClass: 'rte-footnote-ref',
  editEvent: 'rte-footnote-edit',
  pluginKeyName: 'footnoteList',
};

/** Attribute on the reference node that outside code (export layer / tests) can read */
export const FOOTNOTE_ATTR = FOOTNOTE_KIND.refAttr;

/** Custom event dispatched on reference click: NodeView -> tool layer opens the edit dialog */
export const FOOTNOTE_EDIT_EVENT = FOOTNOTE_KIND.editEvent;

/* ------------------------------------------------------------------ *
 * Pure logic: numbering and export injection
 * ------------------------------------------------------------------ */

/** Collect footnote notes in document order */
export function collectFootnoteNotes(doc: PMNode): string[] {
  return collectNotes(doc, FOOTNOTE_KIND);
}

/** Build the end-of-document summary DOM (shared by the on-screen widget and export injection) */
export function renderFootnoteList(
  notes: readonly string[],
  labels: FootnoteLabels = DEFAULT_FOOTNOTE_LABELS,
): HTMLElement {
  return renderNoteList(notes, labels, FOOTNOTE_KIND);
}

/**
 * Number footnote references and append the end-of-document summary (idempotent: repeat calls
 * renumber and replace the previous summary).
 */
export function injectFootnotes(
  html: string,
  labels: FootnoteLabels = DEFAULT_FOOTNOTE_LABELS,
): string {
  return injectNotes(html, labels, FOOTNOTE_KIND);
}

/** See `findSelectedNote`: selected reference, or the one next to the caret */
export function findSelectedFootnote(state: EditorState): { pos: number; note: string } | null {
  return findSelectedNote(state, FOOTNOTE_KIND);
}

/* ------------------------------------------------------------------ *
 * Schema: reference node and on-screen summary
 * ------------------------------------------------------------------ */

/** Footnote reference node */
export const FootnoteRef = Node.create<{ labels: FootnoteLabels }>({
  name: FOOTNOTE_KIND.nodeName,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { labels: DEFAULT_FOOTNOTE_LABELS };
  },

  addAttributes() {
    return {
      /** Note text; an empty string means not filled in yet */
      note: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-note') ?? '',
        renderHTML: (attrs: { note?: string }) => ({ 'data-note': attrs.note ?? '' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `sup[${FOOTNOTE_ATTR}]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(HTMLAttributes, {
        [FOOTNOTE_ATTR]: 'true',
        class: FOOTNOTE_KIND.refClass,
      }),
    ];
  },

  addCommands() {
    return {
      insertFootnote:
        (note: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { note } }),
      updateFootnote:
        (pos: number, note: string) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, note });
          return true;
        },
      removeFootnote:
        (pos: number) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) tr.delete(pos, pos + node.nodeSize);
          return true;
        },
    };
  },

  addNodeView() {
    const labels = this.options.labels ?? DEFAULT_FOOTNOTE_LABELS;
    return createNoteRefView(FOOTNOTE_KIND, labels);
  },
});

/** End-of-document summary shown on screen (widget decoration at the document end) */
export const FootnoteList = createNoteListExtension(FOOTNOTE_KIND, DEFAULT_FOOTNOTE_LABELS);

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnote: {
      /** Insert a footnote reference at the cursor */
      insertFootnote: (note: string) => ReturnType;
      /** Update the note text at the given position */
      updateFootnote: (pos: number, note: string) => ReturnType;
      /** Remove the footnote reference at the given position */
      removeFootnote: (pos: number) => ReturnType;
    };
  }
}
