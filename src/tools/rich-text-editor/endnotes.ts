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
 * 尾注（Word 尾注 / `w:endnote`）。
 *
 * 与脚注同构、但**独立编号、独立引用目标、独立导出部件**：
 * Word 里脚注进 `footnotes.xml`、尾注进 `endnotes.xml`，两者编号各自从 1 开始。
 * 共享逻辑（编号、文末汇总、导出注入、点击编辑）在 `notes.ts`，这里只保留身份与 schema 接线。
 */

export type EndnoteLabels = NoteLabels;
export type EndnoteEditDetail = NoteEditDetail;

export const DEFAULT_ENDNOTE_LABELS: EndnoteLabels = { name: '尾注', empty: '（空尾注）' };

/** 尾注在 schema 与 HTML 里的身份 */
export const ENDNOTE_KIND: NoteKind = {
  nodeName: 'endnoteRef',
  refAttr: 'data-endnote',
  listAttr: 'data-endnote-list',
  listClass: 'rte-endnote-list',
  itemClass: 'rte-endnote-item',
  refClass: 'rte-endnote-ref',
  editEvent: 'rte-endnote-edit',
  pluginKeyName: 'endnoteList',
};

/** Attribute read by the export layer (docx → `w:endnoteReference`) */
export const ENDNOTE_ATTR = ENDNOTE_KIND.refAttr;

/** Click-to-edit custom event (NodeView → tool layer) */
export const ENDNOTE_EDIT_EVENT = ENDNOTE_KIND.editEvent;

/* ------------------------------------------------------------------ *
 * Pure logic: numbering and export injection
 * ------------------------------------------------------------------ */

export function collectEndnoteNotes(doc: PMNode): string[] {
  return collectNotes(doc, ENDNOTE_KIND);
}

/** 文末汇总 DOM（屏上 widget 与导出注入共用） */
export function renderEndnoteList(
  notes: readonly string[],
  labels: EndnoteLabels = DEFAULT_ENDNOTE_LABELS,
): HTMLElement {
  return renderNoteList(notes, labels, ENDNOTE_KIND);
}

/** 编号并追加文末汇总（幂等） */
export function injectEndnotes(
  html: string,
  labels: EndnoteLabels = DEFAULT_ENDNOTE_LABELS,
): string {
  return injectNotes(html, labels, ENDNOTE_KIND);
}

export function findSelectedEndnote(state: EditorState): { pos: number; note: string } | null {
  return findSelectedNote(state, ENDNOTE_KIND);
}

/* ------------------------------------------------------------------ *
 * Schema
 * ------------------------------------------------------------------ */

export const EndnoteRef = Node.create<{ labels: EndnoteLabels }>({
  name: ENDNOTE_KIND.nodeName,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { labels: DEFAULT_ENDNOTE_LABELS };
  },

  addAttributes() {
    return {
      note: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-note') ?? '',
        renderHTML: (attrs: { note?: string }) => ({ 'data-note': attrs.note ?? '' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `sup[${ENDNOTE_ATTR}]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(HTMLAttributes, {
        [ENDNOTE_ATTR]: 'true',
        class: ENDNOTE_KIND.refClass,
      }),
    ];
  },

  addCommands() {
    return {
      insertEndnote:
        (note: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { note } }),
      updateEndnote:
        (pos: number, note: string) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, note });
          return true;
        },
      removeEndnote:
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
    const labels = this.options.labels ?? DEFAULT_ENDNOTE_LABELS;
    return createNoteRefView(ENDNOTE_KIND, labels);
  },
});

/** 屏上文末汇总：排在脚注汇总之后（Word 里尾注也确实位于文档最末） */
export const EndnoteList = createNoteListExtension(ENDNOTE_KIND, DEFAULT_ENDNOTE_LABELS);

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    endnote: {
      /** Insert an endnote reference at the cursor */
      insertEndnote: (note: string) => ReturnType;
      /** Update the note text at the given position */
      updateEndnote: (pos: number, note: string) => ReturnType;
      /** Remove the endnote reference at the given position */
      removeEndnote: (pos: number) => ReturnType;
    };
  }
}
