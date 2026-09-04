import { describe, expect, it } from 'vitest';
import {
  IMAGE_CARD_BACKDROP_PRESETS,
  IMAGE_CARD_BACKDROP_CSS,
  clampImageCard,
  isImageFile,
  resolveBackdropCss,
} from './core';

describe('image-card', () => {
  it('背景预设齐全', () => {
    for (const id of IMAGE_CARD_BACKDROP_PRESETS) {
      expect(IMAGE_CARD_BACKDROP_CSS[id]).toBeTruthy();
    }
  });

  it('clamp / 文件类型 / 背景解析', () => {
    expect(clampImageCard({ padding: 0 }).padding).toBe(8);
    expect(clampImageCard({ textPosition: 'above' }).textPosition).toBe('above');
    expect(clampImageCard({ rotate: 200 }).rotate).toBe(180);
    expect(clampImageCard({ titleSize: 8 }).titleSize).toBe(12);
    expect(clampImageCard({ subtitleSize: 50 }).subtitleSize).toBe(36);
    expect(clampImageCard({ textBg: '#fff' }).textBg).toBe('#ffffff');
    expect(isImageFile('image/png')).toBe(true);
    expect(isImageFile('text/plain')).toBe(false);
    const color = clampImageCard({ backdropMode: 'color', backdropColor: '#112233' });
    expect(resolveBackdropCss(color)).toBe('#112233');
    const grad = clampImageCard({
      backdropMode: 'gradient',
      gradientFrom: '#ff0000',
      gradientTo: '#00ff00',
      gradientAngle: 90,
    });
    expect(resolveBackdropCss(grad)).toBe('linear-gradient(90deg, #ff0000, #00ff00)');
  });
});
