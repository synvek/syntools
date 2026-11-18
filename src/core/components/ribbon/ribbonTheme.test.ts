import { describe, expect, it } from 'vitest';
import { RIBBON_ACCENT } from './ribbonTheme';
import type { RibbonAccent } from './types';

const ACCENTS: RibbonAccent[] = ['blue', 'green', 'orange', 'red'];

/**
 * Adding an accent is a three-file change (`types`, `ribbonTheme`, caller). The `Record<RibbonAccent, …>`
 * type already fails the build on a missing palette; this test pins the class *shape* so a palette
 * cannot be added with empty strings or without a focus ring.
 */
describe('RIBBON_ACCENT', () => {
  it('每个 accent 都提供完整且有内容的四组类名', () => {
    expect(Object.keys(RIBBON_ACCENT).sort()).toEqual([...ACCENTS].sort());

    for (const accent of ACCENTS) {
      const entry = RIBBON_ACCENT[accent];
      for (const key of ['tab', 'toggle', 'launcher', 'ring'] as const) {
        expect(entry[key].trim().length).toBeGreaterThan(0);
      }
      expect(entry.tab).toContain('border-');
      expect(entry.ring).toContain('focus-visible:ring-');
    }
  });

  it('red（PDF 编辑器）与 orange（演示文稿）保持可区分', () => {
    expect(RIBBON_ACCENT.red.tab).not.toBe(RIBBON_ACCENT.orange.tab);
    expect(RIBBON_ACCENT.red.toggle).not.toBe(RIBBON_ACCENT.orange.toggle);
  });
});
