import { describe, expect, it } from 'vitest';
import {
  PATTERN_DOT_SIZE,
  PATTERN_PRESETS,
  PATTERN_TILE,
  createPatternFill,
  isPatternPreset,
  patternSpec,
} from './patterns';

/**
 * P2-S4 pattern geometry.
 *
 * The renderer only repeats an 8×8 tile, so two properties decide whether a pattern looks like a
 * pattern: the tile must repeat seamlessly (every spacing divides the tile) and the densities must
 * actually differ (a table where `pct5` and `pct75` look the same is a bug report waiting to
 * happen). Both are pure data checks, no canvas needed.
 */

describe('预设清单', () => {
  it('正好 20 种且不重复', () => {
    expect(PATTERN_PRESETS).toHaveLength(20);
    expect(new Set(PATTERN_PRESETS).size).toBe(20);
  });

  it('每种预设都有几何，且名字与 prst 一致', () => {
    for (const prst of PATTERN_PRESETS) {
      const spec = patternSpec(prst);
      expect(spec.prst).toBe(prst);
      const striped =
        spec.lines.horiz.length +
        spec.lines.vert.length +
        spec.lines.dn.length +
        spec.lines.up.length;
      expect(spec.dots.length + striped).toBeGreaterThan(0);
    }
  });

  it('isPatternPreset 只认清单内的值', () => {
    expect(isPatternPreset('pct20')).toBe(true);
    expect(isPatternPreset('smGrid')).toBe(false);
    expect(isPatternPreset(undefined)).toBe(false);
  });

  it('createPatternFill 给出可见的默认值', () => {
    expect(createPatternFill()).toEqual({
      type: 'pattern',
      prst: 'pct20',
      fgColor: '#1F3864',
      bgColor: '#FFFFFF',
    });
  });
});

describe('点阵密度', () => {
  it('密度越大点越多（严格单调）', () => {
    const counts = [
      'pct5',
      'pct10',
      'pct20',
      'pct25',
      'pct30',
      'pct40',
      'pct50',
      'pct60',
      'pct70',
      'pct75',
    ].map((prst) => patternSpec(prst as never).dots.length);
    for (let index = 1; index < counts.length; index += 1) {
      expect(counts[index]).toBeGreaterThan(counts[index - 1]!);
    }
    // 最高密度也要留出空隙，否则 75% 会退化成纯色
    expect(counts[counts.length - 1]).toBeLessThan((PATTERN_TILE / PATTERN_DOT_SIZE) ** 2);
  });

  it('点都在瓦片内且互不重叠（重叠会浪费密度）', () => {
    for (const prst of PATTERN_PRESETS) {
      const { dots } = patternSpec(prst);
      for (const dot of dots) {
        expect(dot.x).toBeGreaterThanOrEqual(0);
        expect(dot.y).toBeGreaterThanOrEqual(0);
        expect(dot.x + PATTERN_DOT_SIZE).toBeLessThanOrEqual(PATTERN_TILE);
        expect(dot.y + PATTERN_DOT_SIZE).toBeLessThanOrEqual(PATTERN_TILE);
      }
      const keys = new Set(dots.map((dot) => `${dot.x},${dot.y}`));
      expect(keys.size).toBe(dots.length);
    }
  });
});

describe('线纹', () => {
  it('所有线偏移都落在瓦片内且能整除瓦片（无缝拼接的前提）', () => {
    for (const prst of PATTERN_PRESETS) {
      const { lines } = patternSpec(prst);
      for (const offsets of [lines.horiz, lines.vert, lines.dn, lines.up]) {
        if (offsets.length === 0) continue;
        // Stripes start at 0 and step by a constant spacing; that *spacing* is what has to divide
        // the tile (0,2,4,6 is fine on an 8px tile even though 6 itself does not divide 8)
        const spacing = offsets.length > 1 ? offsets[1]! - offsets[0]! : PATTERN_TILE;
        expect(spacing).toBeGreaterThan(0);
        expect(PATTERN_TILE % spacing).toBe(0);
        expect(offsets).toEqual(offsets.map((_, index) => index * spacing));
      }
    }
  });

  it('深色线纹的间距是浅色的一半', () => {
    expect(patternSpec('ltHorz').lines.horiz).toEqual([0, 4]);
    expect(patternSpec('dkHorz').lines.horiz).toEqual([0, 2, 4, 6]);
    expect(patternSpec('ltDnDiag').lines.dn).toEqual([0, 4]);
    expect(patternSpec('dkUpDiag').lines.up).toEqual([0, 2, 4, 6]);
  });

  it('网格纹同时带两个方向', () => {
    const cross = patternSpec('cross');
    expect(cross.lines.horiz.length).toBeGreaterThan(0);
    expect(cross.lines.vert.length).toBeGreaterThan(0);
    const diag = patternSpec('diagCross');
    expect(diag.lines.dn.length).toBeGreaterThan(0);
    expect(diag.lines.up.length).toBeGreaterThan(0);
  });
});
