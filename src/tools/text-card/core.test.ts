import { describe, expect, it } from 'vitest';
import { CARD_THEMES, THEME_STYLES, clampTextCard, hasCardContent } from './core';

describe('text-card', () => {
  it('主题齐全', () => {
    for (const id of CARD_THEMES) {
      expect(THEME_STYLES[id].background).toBeTruthy();
      expect(THEME_STYLES[id].color).toBeTruthy();
    }
  });

  it('clamp', () => {
    expect(clampTextCard({ fontSize: 999 }).fontSize).toBe(48);
    expect(clampTextCard({ theme: 'ocean' }).theme).toBe('ocean');
    expect(clampTextCard({ theme: 'x' as never }).theme).toBe('slate');
  });

  it('内容判断', () => {
    expect(hasCardContent('', '')).toBe(false);
    expect(hasCardContent('Hi', '')).toBe(true);
  });
});
