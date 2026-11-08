import type { PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/**
 * Viewport clipping for decoration plugins (P1-5).
 *
 * The spellchecker and find & replace both build inline decorations from a whole-document walk. On a
 * 200-page document that is thousands of text nodes and tens of thousands of inline decorations, and
 * almost all of them are far outside the screen. Above `VIEWPORT_CLIP_THRESHOLD` characters both only
 * cover the scrolled viewport plus a margin, and a debounced scroll listener rebuilds them once
 * scrolling settles (the marks of the previous viewport would otherwise stay where they were).
 *
 * `posAtCoords` is the only public ProseMirror mapping from viewport coordinates to document
 * positions — `EditorView.visibleRanges` is internal and not in the typings.
 */

/** Half-open document range */
export interface DocRange {
  from: number;
  to: number;
}

/** Character count above which decoration building is clipped to the viewport */
export const VIEWPORT_CLIP_THRESHOLD = 120_000;

/** Extra context on both sides of the viewport, so a short scroll needs no rebuild */
export const VIEWPORT_CLIP_MARGIN = 3_000;

/** Scrolling must settle for this long before decorations are rebuilt */
const VIEWPORT_RESCAN_DELAY = 150;

/** Widen a range by `margin` and clamp it to the document */
export function expandRange(
  range: DocRange,
  docSize: number,
  margin: number = VIEWPORT_CLIP_MARGIN,
): DocRange {
  return {
    from: Math.max(0, range.from - margin),
    to: Math.min(docSize, range.to + margin),
  };
}

/**
 * Range decorations should cover for this pass, or null for "the whole document": small documents
 * are cheap to walk, and an editor that is off screen (or has no view yet) gives no range to clip to.
 */
export function decorationRange(view: EditorView | null, docSize: number): DocRange | null {
  if (!view || docSize <= VIEWPORT_CLIP_THRESHOLD) return null;
  const rect = view.dom.getBoundingClientRect();
  const top = Math.max(rect.top, 0);
  const bottom = Math.min(rect.bottom, window.innerHeight);
  if (bottom - top < 1) return null;
  const left = rect.left + 1;
  const first = view.posAtCoords({ left, top: top + 1 })?.pos;
  const last = view.posAtCoords({ left, top: bottom - 1 })?.pos;
  if (first === undefined || last === undefined) return null;
  const viewport = first <= last ? { from: first, to: last } : { from: last, to: first };
  return expandRange(viewport, docSize);
}

/**
 * Rebuild decorations once scrolling settles. `isActive` skips the dispatch while the plugin has
 * nothing to show (spellcheck off, no search term); the very first call is scheduled immediately, so a
 * large document mounted with whole-document decorations is clipped right away.
 */
export function onViewportSettled(
  view: EditorView,
  key: PluginKey,
  isActive: () => boolean,
): { destroy: () => void } {
  let timer = 0;
  const rescan = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (view.isDestroyed || !isActive()) return;
      if (view.state.doc.content.size <= VIEWPORT_CLIP_THRESHOLD) return;
      // No document change: the decoration prop re-runs against the new viewport
      view.dispatch(view.state.tr.setMeta(key, true));
    }, VIEWPORT_RESCAN_DELAY);
  };
  // Capture phase: scroll does not bubble, but it does reach ancestors while capturing
  window.addEventListener('scroll', rescan, { passive: true, capture: true });
  rescan();
  return {
    destroy: () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', rescan, { capture: true });
    },
  };
}
