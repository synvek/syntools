import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { decorationRange, onViewportSettled } from './viewportRange';

/**
 * Find and replace: ProseMirror decoration highlights, match navigation, and replacement.
 * No third-party dependency; all replacements go through TipTap transactions so undo stays intact.
 */

export interface SearchConfig {
  term: string;
  matchCase: boolean;
  /** Index of the current match (wraps around) */
  index: number;
  /**
   * Cached match list, maintained by the plugin.
   *
   * P1-5: the decoration query runs on every state update, and a 200-page document has ~8k text
   * nodes — scanning them per keystroke (twice: once in `apply`, once in `decorations`) dominated the
   * cost of having the find bar open. The list is recomputed once per document change instead.
   */
  matches?: TextMatch[];
}

export interface TextMatch {
  from: number;
  to: number;
}

export const findReplaceKey = new PluginKey<SearchConfig | null>('findReplace');

/**
 * Meta value meaning "the viewport moved, rebuild the highlights": no state change, only the
 * decoration prop re-runs (see `viewportRange.ts`).
 */
const REBUILD_META = true;

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
    // Set once the editor view exists: long documents only decorate the visible matches (P1-5)
    let currentView: EditorView | null = null;
    return [
      new Plugin<SearchConfig | null>({
        key: findReplaceKey,
        state: {
          init: () => null,
          apply: (tr, value) => {
            const meta = tr.getMeta(findReplaceKey) as SearchConfig | true | null | undefined;
            // Viewport moved: the cached match list is still valid, only the highlights are rebuilt
            if (meta === REBUILD_META) return value;
            if (meta !== undefined) {
              if (!meta) return null;
              // Navigation reuses the cached list; a new term recomputes exactly once
              const matches = meta.matches ?? findMatches(tr.doc, meta.term, meta.matchCase);
              return { ...meta, matches };
            }
            if (!value) return null;
            if (!tr.docChanged) return value;
            // Recompute matches after doc changes and clamp the index to avoid stale references
            const matches = findMatches(tr.doc, value.term, value.matchCase);
            if (matches.length === 0) return { ...value, matches, index: 0 };
            return { ...value, matches, index: Math.min(value.index, matches.length - 1) };
          },
        },
        props: {
          decorations(state) {
            const config = findReplaceKey.getState(state);
            // Only the decoration objects are built here: scanning the document happens in `apply`
            const matches = config?.matches;
            if (!config || !matches || matches.length === 0) return DecorationSet.empty;
            // Highlighting every match of a common word in a 200-page document would build tens of
            // thousands of inline decorations, nearly all of them off screen (P1-5)
            const range = decorationRange(currentView, state.doc.content.size);
            const decorations: Decoration[] = [];
            matches.forEach((match, index) => {
              if (range && (match.to <= range.from || match.from >= range.to)) return;
              decorations.push(
                Decoration.inline(match.from, match.to, {
                  class: index === config.index ? 'rte-find-current' : 'rte-find-match',
                }),
              );
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
        view: (view) => {
          currentView = view;
          const settled = onViewportSettled(
            view,
            findReplaceKey,
            () => findReplaceKey.getState(view.state) !== null,
          );
          return {
            destroy: () => {
              settled.destroy();
              currentView = null;
            },
          };
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
          const matches = config.matches ?? findMatches(state.doc, config.term, config.matchCase);
          const total = matches.length;
          if (total === 0) return false;
          const next = (config.index + delta + total) % total;
          const match = matches[next];
          tr.setMeta(findReplaceKey, { ...config, index: next });
          // Selecting the match is what scrolls it into view (`scrollIntoView` follows the
          // selection), and with viewport-clipped highlights (P1-5) an off-screen match would
          // otherwise stay unhighlighted and invisible
          if (match) {
            tr.setSelection(
              TextSelection.between(tr.doc.resolve(match.from), tr.doc.resolve(match.to)),
            );
          }
          tr.scrollIntoView();
          return true;
        },
      replaceMatch:
        (replacement: string) =>
        ({ state, tr, dispatch }) => {
          const config = findReplaceKey.getState(state);
          if (!config || !config.term || dispatch === undefined) return false;
          const matches = config.matches ?? findMatches(state.doc, config.term, config.matchCase);
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
          const matches = config.matches ?? findMatches(state.doc, config.term, config.matchCase);
          if (matches.length === 0) return false;
          // Replace back to front so earlier positions stay valid
          for (let i = matches.length - 1; i >= 0; i -= 1) {
            const match = matches[i];
            if (replacement) tr.insertText(replacement, match.from, match.to);
            else tr.delete(match.from, match.to);
          }
          // Deliberately drops the cached matches: they describe the pre-replace document
          tr.setMeta(findReplaceKey, { term: config.term, matchCase: config.matchCase, index: 0 });
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
