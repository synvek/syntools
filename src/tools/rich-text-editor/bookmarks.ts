import { mergeAttributes, Node } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { NodeSelection, type EditorState } from '@tiptap/pm/state';

/**
 * 书签（RTE-03 第一批）：文档内的零宽锚点，供"定位"与后续的"交叉引用"使用。
 *
 * 为什么是零宽 atom 而不是 mark：
 * - Word 的书签可以是"点"也可以是"范围"，但交叉引用真正需要的是**一个位置**（页码 / 编号 / 跳转目标），
 *   而 ProseMirror 的 mark 必须有内容才能落地，光标处插书签就没法表达；
 * - atom 在 HTML 里就是一对空 `<a>`，docx 侧 `w:bookmarkStart`/`w:bookmarkEnd` 天然成对且零宽，
 *   mammoth 读回来也是一对空 `<a id>`，三条路径（草稿 / 导出 / 导入）共用同一形态。
 *
 * 名称规则按 Word 的口径收紧：≤40 字符、只留字母/数字/下划线/连字符、首字符必须是字母。
 * 名称在文档内唯一 —— 重复名会让 Word 里所有交叉引用指向前一个。
 */

export const BOOKMARK_MAX_LENGTH = 40;
/** HTML 标记：`<a data-bookmark="Name">` */
export const BOOKMARK_ATTR = 'data-bookmark';
/** DOM id 前缀，避免和标题锚点 / 脚注锚点撞车 */
export const BOOKMARK_ID_PREFIX = 'rte-bm-';

const INVALID_CHARS = /[^\p{L}\p{N}_-]/gu;

/**
 * 归一化书签名；完全非法时返回 null（调用方据此提示，而不是静默生成一个怪名字）。
 * 空白转下划线而不是直接丢弃：`我的 书签` 变成 `我的_书签` 更接近用户的输入意图。
 */
export function normalizeBookmarkName(raw: string): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  const cleaned = trimmed
    .replace(/\s+/g, '_')
    .replace(INVALID_CHARS, '')
    .slice(0, BOOKMARK_MAX_LENGTH);
  if (!cleaned) return null;
  // Word 要求首字符是字母；数字开头补一个稳定前缀，避免导出后被别的软件改名
  const prefixed = /^\p{L}/u.test(cleaned) ? cleaned : `bm_${cleaned}`;
  return prefixed.slice(0, BOOKMARK_MAX_LENGTH);
}

/** 生成文档内唯一的书签名：已存在则追加 `_2`、`_3`… */
export function uniqueBookmarkName(base: string, taken: readonly string[]): string {
  const normalized = normalizeBookmarkName(base) ?? 'bookmark';
  const used = new Set(taken);
  if (!used.has(normalized)) return normalized;
  for (let index = 2; index < 1000; index += 1) {
    const suffix = `_${index}`;
    const candidate = `${normalized.slice(0, BOOKMARK_MAX_LENGTH - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${normalized.slice(0, BOOKMARK_MAX_LENGTH - 8)}_${Date.now() % 100000}`;
}

export interface BookmarkEntry {
  /** Normalized name */
  name: string;
  /** Document position of the zero-width anchor */
  pos: number;
}

/** 按文档顺序收集全部书签 */
export function collectBookmarks(doc: PmNode): BookmarkEntry[] {
  const entries: BookmarkEntry[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'bookmark') return;
    const name = String(node.attrs.name ?? '');
    if (name) entries.push({ name, pos });
  });
  return entries;
}

/** 文档内已有的书签名（用于查重 / 生成建议名） */
export function bookmarkNames(doc: PmNode): string[] {
  return collectBookmarks(doc).map((entry) => entry.name);
}

export interface SelectedBookmark {
  pos: number;
  name: string;
}

/**
 * 当前选区命中的书签。
 * 除了真正的 NodeSelection，还要看光标左右两侧：零宽 atom 的点选命中区几乎为零，
 * 用户"把光标放到书签旁"是最常见的操作方式。
 */
export function findSelectedBookmark(state: EditorState): SelectedBookmark | null {
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.node.type.name === 'bookmark') {
    return { pos: selection.from, name: String(selection.node.attrs.name ?? '') };
  }
  const { $from } = selection;
  const before = $from.nodeBefore;
  if (before?.type.name === 'bookmark') {
    return { pos: $from.pos - before.nodeSize, name: String(before.attrs.name ?? '') };
  }
  const after = $from.nodeAfter;
  if (after?.type.name === 'bookmark') {
    return { pos: $from.pos, name: String(after.attrs.name ?? '') };
  }
  return null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bookmark: {
      /** 在光标处插入书签；名称为空或重复时返回 false */
      insertBookmark: (name: string) => ReturnType;
      /** 重命名指定位置的书签；名称为空或与其他书签重复时返回 false */
      updateBookmark: (pos: number, name: string) => ReturnType;
      /** 删除指定位置的书签 */
      removeBookmark: (pos: number) => ReturnType;
    };
  }
}

export const DocBookmark = Node.create({
  name: 'bookmark',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      name: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          normalizeBookmarkName(
            element.getAttribute(BOOKMARK_ATTR) ?? element.getAttribute('id') ?? '',
          ) ?? '',
        renderHTML: (attributes: Record<string, unknown>) => ({
          [BOOKMARK_ATTR]: String(attributes.name ?? ''),
        }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: `a[${BOOKMARK_ATTR}]` },
      {
        // mammoth 把 `w:bookmarkStart` 转成空的 `<a id="Name">`；
        // 带 href 的锚点是超链接（Link mark 的地盘），这里只认没有 href 的空锚点
        tag: 'a[id]:not([href])',
        getAttrs: (element: HTMLElement) =>
          normalizeBookmarkName(element.getAttribute('id') ?? '') ? null : false,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = String(node.attrs.name ?? '');
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        class: 'rte-bookmark',
        id: `${BOOKMARK_ID_PREFIX}${name}`,
        title: name,
      }),
    ];
  },

  addCommands() {
    return {
      insertBookmark:
        (name: string) =>
        ({ state, dispatch }) => {
          const normalized = normalizeBookmarkName(name);
          if (!normalized) return false;
          if (bookmarkNames(state.doc).includes(normalized)) return false;
          const type = state.schema.nodes[this.name];
          if (!type) return false;
          const node = type.create({ name: normalized });
          if (dispatch) {
            const { from, to } = state.selection;
            // 选中一段文字时只插在选区开头、不替换内容：零宽锚点不该吃掉用户的文字
            const tr =
              from === to
                ? state.tr.replaceSelectionWith(node, false)
                : state.tr.insert(from, node);
            dispatch(tr.scrollIntoView());
          }
          return true;
        },

      updateBookmark:
        (pos: number, name: string) =>
        ({ state, dispatch }) => {
          const normalized = normalizeBookmarkName(name);
          if (!normalized) return false;
          const node = state.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (node.attrs.name === normalized) return true;
          const others = bookmarkNames(state.doc).filter(
            (candidate) => candidate !== node.attrs.name,
          );
          if (others.includes(normalized)) return false;
          if (dispatch) {
            dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, name: normalized }));
          }
          return true;
        },

      removeBookmark:
        (pos: number) =>
        ({ state, dispatch }) => {
          const node = state.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) dispatch(state.tr.delete(pos, pos + node.nodeSize));
          return true;
        },
    };
  },
});
