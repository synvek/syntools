import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Find and replace: ProseMirror decoration highlights, match navigation, and replacement.
 * No third-party dependency; all replacements go through TipTap transactions so undo stays intact.
 */

export interface SearchConfig {
  term: string;
  matchCase: boolean;
  /** Index of the current match (wraps around) */
  index: number;
}

export interface TextMatch {
  from: number;
  to: number;
}

export const findReplaceKey = new PluginKey<SearchConfig | null>('findReplace');

/** Find all matches in the document (no cross-text-node matches, matching mainstream editors) */
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

/** Find-and-replace extension: the plugin owns state and highlights, the UI drives it via commands */
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
            // Recompute matches after doc changes and clamp the index to avoid stale references
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
          // Replace back to front so earlier positions stay valid
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
      /** Set the search term (an empty string clears highlights) */
      setSearch: (term: string, matchCase: boolean) => ReturnType;
      /** Move between matches (1 next / -1 previous) */
      gotoMatch: (delta: 1 | -1) => ReturnType;
      /** Replace the current match */
      replaceMatch: (replacement: string) => ReturnType;
      /** Replace all matches */
      replaceAllMatches: (replacement: string) => ReturnType;
    };
  }
}
