import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * 查找替换：基于 ProseMirror decoration 的搜索高亮 + 命中跳转 + 替换。
 * 不引入第三方依赖；替换全部走 TipTap transactions，保证撤销链完整。
 */

export interface SearchConfig {
  term: string;
  matchCase: boolean;
  /** 当前命中下标（循环跳转） */
  index: number;
}

export interface TextMatch {
  from: number;
  to: number;
}

export const findReplaceKey = new PluginKey<SearchConfig | null>('findReplace');

/** 在文档中查找全部命中（不支持跨文本节点命中，与主流编辑器行为一致） */
export function findMatches(
  doc: import('@tiptap/pm/model').Node,
  term: string,
  matchCase: boolean,
): TextMatch[] {
  const matches: TextMatch[] = [];
  if (!term) return matches;
  const needle = matchCase ? term : term.toLowerCase();
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const haystack = matchCase ? node.text : node.text.toLowerCase();
    let idx = haystack.indexOf(needle);
    while (idx !== -1) {
      matches.push({ from: pos + idx, to: pos + idx + needle.length });
      idx = haystack.indexOf(needle, idx + needle.length);
    }
  });
  return matches;
}

/** 查找替换扩展：状态与高亮都由本插件持有，UI 通过 commands 驱动 */
export const FindReplace = Extension.create({
  name: 'findReplace',

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchConfig | null>({
        key: findReplaceKey,
        state: {
          init: () => null,
          apply: (tr, value) => {
            const meta = tr.getMeta(findReplaceKey) as SearchConfig | null | undefined;
            if (meta !== undefined) return meta;
            if (!value) return null;
            if (!tr.docChanged) return value;
            // 文档变化后重算命中并收敛下标，避免悬空指向
            const matches = findMatches(tr.doc, value.term, value.matchCase);
            if (matches.length === 0) return { ...value, index: 0 };
            return { ...value, index: Math.min(value.index, matches.length - 1) };
          },
        },
        props: {
          decorations(state) {
            const config = findReplaceKey.getState(state);
            if (!config || !config.term) return DecorationSet.empty;
            const matches = findMatches(state.doc, config.term, config.matchCase);
            if (matches.length === 0) return DecorationSet.empty;
            const decorations = matches.map((match, i) =>
              Decoration.inline(match.from, match.to, {
                class: i === config.index ? 'rte-find-current' : 'rte-find-match',
              }),
            );
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setSearch:
        (term: string, matchCase: boolean) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(findReplaceKey, term ? { term, matchCase, index: 0 } : null);
          }
          return true;
        },
      gotoMatch:
        (delta: 1 | -1) =>
        ({ state, tr, dispatch }) => {
          const config = findReplaceKey.getState(state);
          if (!config || !config.term || dispatch === undefined) return false;
          const total = findMatches(state.doc, config.term, config.matchCase).length;
          if (total === 0) return false;
          const next = (config.index + delta + total) % total;
          tr.setMeta(findReplaceKey, { ...config, index: next });
          tr.scrollIntoView();
          return true;
        },
      replaceMatch:
        (replacement: string) =>
        ({ state, tr, dispatch }) => {
          const config = findReplaceKey.getState(state);
          if (!config || !config.term || dispatch === undefined) return false;
          const matches = findMatches(state.doc, config.term, config.matchCase);
          const match = matches[Math.min(config.index, matches.length - 1)];
          if (!match) return false;
          if (replacement) tr.insertText(replacement, match.from, match.to);
          else tr.delete(match.from, match.to);
          tr.scrollIntoView();
          return true;
        },
      replaceAllMatches:
        (replacement: string) =>
        ({ state, tr, dispatch }) => {
          const config = findReplaceKey.getState(state);
          if (!config || !config.term || dispatch === undefined) return false;
          const matches = findMatches(state.doc, config.term, config.matchCase);
          if (matches.length === 0) return false;
          // 从后往前替换，前面的位置不受影响
          for (let i = matches.length - 1; i >= 0; i -= 1) {
            const match = matches[i];
            if (replacement) tr.insertText(replacement, match.from, match.to);
            else tr.delete(match.from, match.to);
          }
          tr.setMeta(findReplaceKey, { ...config, index: 0 });
          return true;
        },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    findReplace: {
      /** 设置搜索词（空串清除高亮） */
      setSearch: (term: string, matchCase: boolean) => ReturnType;
      /** 在命中项间跳转（1 下一个 / -1 上一个） */
      gotoMatch: (delta: 1 | -1) => ReturnType;
      /** 替换当前命中项 */
      replaceMatch: (replacement: string) => ReturnType;
      /** 替换全部命中项 */
      replaceAllMatches: (replacement: string) => ReturnType;
    };
  }
}
