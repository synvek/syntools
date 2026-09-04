import { describe, expect, it } from 'vitest';
import { buildCssFilter, clampAdjust, isIdentityAdjust } from './core';

describe('image-adjust', () => {
  it('构建 filter', () => {
    expect(buildCssFilter({ brightness: 120, contrast: 90, saturate: 110, hue: 15 })).toBe(
      'brightness(120%) contrast(90%) saturate(110%) hue-rotate(15deg)',
    );
  });

  it('clamp 与 identity', () => {
    expect(clampAdjust({ brightness: 500 }).brightness).toBe(200);
    expect(isIdentityAdjust({ brightness: 100, contrast: 100, saturate: 100, hue: 0 })).toBe(
      true,
    );
  });
});
