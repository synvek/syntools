import { describe, expect, it } from 'vitest';
import { computeMergeLayout, fitContain } from './core';

describe('image-merge', () => {
  it('水平合并', () => {
    const r = computeMergeLayout(
      [
        { width: 10, height: 20 },
        { width: 30, height: 10 },
      ],
      'horizontal',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.canvasWidth).toBe(40);
    expect(r.value.canvasHeight).toBe(20);
  });

  it('网格', () => {
    const r = computeMergeLayout(
      [
        { width: 10, height: 10 },
        { width: 10, height: 10 },
        { width: 10, height: 10 },
        { width: 10, height: 10 },
      ],
      'grid',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.slots).toHaveLength(4);
  });

  it('contain', () => {
    expect(fitContain(200, 100, 100, 100)).toEqual({ width: 100, height: 50 });
  });
});
