import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView, type NodeView } from '@tiptap/pm/view';

/**
 * 脚注 / 尾注的共享内核（RTE-03）。
 *
 * 两者在文档结构上是同一件事——正文里一个上标引用 + 文末一份有序说明；
 * Word 侧只是分别落进 `footnotes.xml` / `endnotes.xml`，编号各自独立。
 * 因此编号、汇总渲染、导出注入、点击编辑这些语义放在这里，
 * 两个 schema 节点（`footnoteRef` / `endnoteRef`）各自只保留"名字与样式"的接线。
 *
 * 不合并成一个"kind 属性"的节点：Word 里它们是两个独立部件、独立编号、独立引用目标，
 * 合成一个节点后每个消费方都要再判一次 kind，反而更容易写错。
 */

export interface NoteKind {
  /** Schema node name: `footnoteRef` / `endnoteRef` */
  readonly nodeName: string;
  /** Reference attribute: `data-footnote` / `data-endnote` */
  readonly refAttr: string;
  /** Summary attribute: `data-footnote-list` / `data-endnote-list` */
  readonly listAttr: string;
  /** Summary CSS class */
  readonly listClass: string;
  /** Summary item CSS class */
  readonly itemClass: string;
  /** Reference CSS class */
  readonly refClass: string;
  /** Click-to-edit custom event name */
  readonly editEvent: string;
  /** ProseMirror plugin key name (must be unique) */
  readonly pluginKeyName: string;
}

/**
 * 正文里"说明引用"元素的属性（`sup[data-footnote]` / `sup[data-endnote]`）。
 * 上标 mark 的解析规则必须跳过这些元素，否则 mark 会把节点吞掉、注释正文随之丢失。
 */
export const NOTE_REF_ATTRS = ['data-footnote', 'data-endnote'] as const;

export function isNoteReferenceElement(el: Element): boolean {
  return NOTE_REF_ATTRS.some((attr) => el.hasAttribute(attr));
}

export interface NoteLabels {
  /** Toolbar / dialog title / summary heading */
  name: string;
  /** Placeholder for an empty note */
  empty: string;
}

export interface NoteEditDetail {
  /** Document position of the reference node */
  pos: number;
  /** Current note text */
  note: string;
}

export interface NoteSelection {
  pos: number;
  note: string;
}

/** 按文档顺序收集说明文字 */
export function collectNotes(doc: PMNode, kind: NoteKind): string[] {
  const notes: string[] = [];
  doc.descendants((node) => {
    if (node.type.name !== kind.nodeName) return;
    notes.push(String(node.attrs.note ?? '').trim());
  });
  return notes;
}

/** 文末汇总 DOM（屏上 widget 与导出注入共用同一份结构） */
export function renderNoteList(
  notes: readonly string[],
  labels: NoteLabels,
  kind: NoteKind,
): HTMLElement {
  const section = document.createElement('section');
  section.className = kind.listClass;
  section.setAttribute(kind.listAttr, 'true');

  const title = document.createElement('p');
  title.className = `${kind.listClass}-title`;
  title.textContent = labels.name;
  section.appendChild(title);

  const list = document.createElement('ol');
  list.className = `${kind.listClass}-items`;
  notes.forEach((note, index) => {
    const item = document.createElement('li');
    item.className = kind.itemClass;
    item.setAttribute('data-number', String(index + 1));
    item.textContent = note || labels.empty;
    list.appendChild(item);
  });
  section.appendChild(list);
  return section;
}

/**
 * 给引用编号并追加文末汇总（幂等：重复调用会重新编号并替换上一份汇总）。
 * 输入形如 `<sup data-footnote data-note="…">`，
 * 输出 `<sup data-footnote data-number="n" data-note="…">[n]</sup>` + 汇总。
 */
export function injectNotes(html: string, labels: NoteLabels, kind: NoteKind): string {
  if (!html.includes(kind.refAttr)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const refs = Array.from(doc.querySelectorAll(`sup[${kind.refAttr}]`));
  if (refs.length === 0) return html;

  // 先移除上一份汇总，保证重复调用不会叠加
  doc.querySelectorAll(`section[${kind.listAttr}]`).forEach((node) => node.remove());

  const notes = refs.map((ref) => (ref.getAttribute('data-note') ?? '').trim());
  refs.forEach((ref, index) => {
    ref.setAttribute('data-number', String(index + 1));
    ref.textContent = `[${index + 1}]`;
  });

  doc.body.appendChild(renderNoteList(notes, labels, kind));
  return doc.body.innerHTML;
}

/** 每份文档每类说明只遍历一次：所有引用的 NodeView 共享编号结果 */
const numberCache = new WeakMap<PMNode, Map<string, Map<number, number>>>();

export function noteNumbers(state: EditorState, kind: NoteKind): Map<number, number> {
  let perKind = numberCache.get(state.doc);
  if (!perKind) {
    perKind = new Map();
    numberCache.set(state.doc, perKind);
  }
  const cached = perKind.get(kind.nodeName);
  if (cached) return cached;

  const numbers = new Map<number, number>();
  let index = 0;
  state.doc.descendants((node, pos) => {
    if (node.type.name !== kind.nodeName) return;
    index += 1;
    numbers.set(pos, index);
  });
  perKind.set(kind.nodeName, numbers);
  return numbers;
}

/**
 * 当前操作要改的引用：
 * 1) 引用本身被选中（点 [n] 之后就是 NodeSelection）；
 * 2) 光标紧贴引用（插入后光标正停在其右侧，编辑时最常见）。
 */
export function findSelectedNote(state: EditorState, kind: NoteKind): NoteSelection | null {
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.node.type.name === kind.nodeName) {
    return { pos: selection.from, note: String(selection.node.attrs.note ?? '') };
  }
  const { $from } = selection;
  const before = $from.nodeBefore;
  if (before && before.type.name === kind.nodeName) {
    return { pos: selection.from - before.nodeSize, note: String(before.attrs.note ?? '') };
  }
  const after = $from.nodeAfter;
  if (after && after.type.name === kind.nodeName) {
    return { pos: selection.from, note: String(after.attrs.note ?? '') };
  }
  return null;
}

/** 引用 NodeView：显示实时编号，点击派发编辑事件 */
export function createNoteRefView(
  kind: NoteKind,
  labels: NoteLabels,
): (props: { node: PMNode; view: EditorView; getPos: () => number | undefined }) => NodeView {
  return ({ node, view, getPos }) => new NoteRefView(node, view, getPos, labels, kind);
}

class NoteRefView implements NodeView {
  readonly dom: HTMLElement;

  private node: PMNode;
  private readonly view: EditorView;
  private readonly getPos: () => number | undefined;
  private readonly labels: NoteLabels;
  private readonly kind: NoteKind;

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
    labels: NoteLabels,
    kind: NoteKind,
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.labels = labels;
    this.kind = kind;
    this.dom = document.createElement('sup');
    this.dom.className = kind.refClass;
    this.dom.setAttribute(kind.refAttr, 'true');
    this.dom.contentEditable = 'false';
    this.dom.addEventListener('mousedown', (event) => {
      event.preventDefault();
      this.emitEdit();
    });
    this.render();
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }

  private render(): void {
    const pos = this.getPos();
    const numbers = noteNumbers(this.view.state, this.kind);
    const number = pos === undefined ? 0 : (numbers.get(pos) ?? 0);
    const note = String(this.node.attrs.note ?? '').trim();
    this.dom.textContent = `[${number}]`;
    this.dom.setAttribute('data-number', String(number));
    this.dom.setAttribute('title', note || this.labels.empty);
  }

  private emitEdit(): void {
    const pos = this.getPos();
    if (pos === undefined) return;
    const detail: NoteEditDetail = { pos, note: String(this.node.attrs.note ?? '') };
    this.dom.dispatchEvent(
      new CustomEvent<NoteEditDetail>(this.kind.editEvent, { bubbles: true, detail }),
    );
  }
}

/**
 * 文末汇总（屏上）：以 widget 形式挂在文档末尾。
 * 只在文档内容变化时重建，避免每次选区变化都重排整份汇总。
 */
export function createNoteListExtension(
  kind: NoteKind,
  defaultLabels: NoteLabels,
): ReturnType<typeof Extension.create<{ labels?: NoteLabels }>> {
  return Extension.create<{ labels?: NoteLabels }>({
    name: kind.pluginKeyName,

    addOptions() {
      return { labels: defaultLabels };
    },

    addProseMirrorPlugins() {
      const labels = this.options.labels ?? defaultLabels;
      const key = new PluginKey<{ deco: DecorationSet }>(kind.pluginKeyName);
      const build = (doc: PMNode): { deco: DecorationSet } => {
        const notes = collectNotes(doc, kind);
        if (notes.length === 0) return { deco: DecorationSet.empty };
        return {
          deco: DecorationSet.create(doc, [
            Decoration.widget(doc.content.size, () => renderNoteList(notes, labels, kind), {
              side: 1,
            }),
          ]),
        };
      };
      return [
        new Plugin<{ deco: DecorationSet }>({
          key,
          state: {
            init: (_config, state) => build(state.doc),
            apply: (tr, value) => (tr.docChanged ? build(tr.doc) : value),
          },
          props: {
            decorations: (state) => key.getState(state)?.deco ?? DecorationSet.empty,
          },
        }),
      ];
    },
  });
}
