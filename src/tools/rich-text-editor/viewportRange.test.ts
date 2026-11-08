import type { EditorView } from '@tiptap/pm/view';
import { describe, expect, it } from 'vitest';
import {
  VIEWPORT_CLIP_MARGIN,
  VIEWPORT_CLIP_THRESHOLD,
  decorationRange,
  expandRange,
} from './viewportRange';

/**
 * Decoration viewport clipping (P1-5): only the visible slice of a long document is decorated.
 * The DOM-dependent half is driven through a stub view — jsdom has no layout, so real geometry
 * cannot be produced here; `e2e/perf-p15.spec.ts` covers the wiring in a real browser.
 */

interface StubOptions {
  top?: number;
  bottom?: number;
  /** Position `posAtCoords` reports; `null` simulates coordinates outside the editor */
  positions?: readonly (number | null)[];
}

function stubView(options: StubOptions = {}): { view: EditorView; calls: number[] } {
  const { top = 0, bottom = 800, positions = [1000, 2000] } = options;
  const calls: number[] = [];
  const queue = [...positions];
  const view = {
    dom: { getBoundingClientRect: () => ({ top, bottom, left: 10, right: 700 }) },
    posAtCoords: () => {
      calls.push(1);
      const pos = queue.shift();
      return pos === null || pos === undefined ? null : { pos, inside: -1 };
    },
  } as unknown as EditorView;
  return { view, calls };
}

describe('expandRange', () => {
  it('adds the margin on both sides', () => {
    expect(expandRange({ from: 10_000, to: 12_000 }, 100_000)).toEqual({
      from: 10_000 - VIEWPORT_CLIP_MARGIN,
      to: 12_000 + VIEWPORT_CLIP_MARGIN,
    });
  });

  it('clamps to the document bounds', () => {
    expect(expandRange({ from: 100, to: 200 }, 300)).toEqual({ from: 0, to: 300 });
  });

  it('honours a custom margin', () => {
    expect(expandRange({ from: 500, to: 900 }, 1_000, 0)).toEqual({ from: 500, to: 900 });
  });
});

describe('decorationRange', () => {
  it('covers the whole document when it is small enough', () => {
    const { view, calls } = stubView();
    expect(decorationRange(view, VIEWPORT_CLIP_THRESHOLD)).toBeNull();
    // No geometry read at all on the short path
    expect(calls).toHaveLength(0);
  });

  it('returns null before the view exists (plugin init)', () => {
    expect(decorationRange(null, VIEWPORT_CLIP_THRESHOLD * 10)).toBeNull();
  });

  it('clips a long document to the positions the viewport maps to', () => {
    const { view } = stubView({ top: 100, bottom: 700, positions: [50_000, 51_000] });
    expect(decorationRange(view, 200_000)).toEqual({
      from: 50_000 - VIEWPORT_CLIP_MARGIN,
      to: 51_000 + VIEWPORT_CLIP_MARGIN,
    });
  });

  it('normalizes a reversed range (the view reported a later position first)', () => {
    const { view } = stubView({ positions: [60_000, 40_000] });
    const range = decorationRange(view, 200_000);
    expect(range?.from).toBe(40_000 - VIEWPORT_CLIP_MARGIN);
    expect(range?.to).toBe(60_000 + VIEWPORT_CLIP_MARGIN);
  });

  it('falls back to the whole document when the editor is scrolled out of sight', () => {
    // Zero height after clipping to the window
    const { view } = stubView({ top: -5_000, bottom: -4_000 });
    expect(decorationRange(view, 200_000)).toBeNull();
  });

  it('falls back to the whole document when coordinates map to nothing', () => {
    const { view } = stubView({ positions: [null, null] });
    expect(decorationRange(view, 200_000)).toBeNull();
  });
});
