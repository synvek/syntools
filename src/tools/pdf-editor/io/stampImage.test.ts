import { describe, expect, it } from 'vitest';
import {
  createStampImage,
  renderStampDataUrl,
  STAMP_COLORS,
  STAMP_KEYS,
  STAMP_LABEL_KEYS,
  stampSpec,
} from './stampImage';

describe('stampSpec', () => {
  it('四个预设共用同一尺寸与字号比例', () => {
    const specs = STAMP_KEYS.map((key) => stampSpec(key, STAMP_LABEL_KEYS[key]));
    for (const spec of specs) {
      expect(spec.width).toBe(360);
      expect(spec.height).toBe(120);
      expect(spec.fontSize).toBe(Math.round(120 * 0.42));
      expect(spec.borderWidth).toBeGreaterThan(0);
    }
    expect(new Set(specs.map((spec) => spec.color)).size).toBe(4);
  });

  it('颜色与文案来自预设表', () => {
    expect(stampSpec('void', '作废')).toMatchObject({
      label: '作废',
      color: STAMP_COLORS.void,
    });
    expect(STAMP_LABEL_KEYS.draft).toBe('stampDraft');
  });
});

describe('renderStampDataUrl', () => {
  it('没有 canvas 支持时返回 null 而不抛错（jsdom 环境）', async () => {
    const result = await renderStampDataUrl(stampSpec('approved', '已批准'));
    expect(result === null || result.dataUrl.startsWith('data:image/png')).toBe(true);
    if (result) expect(result.width).toBe(360);
  });

  it('createStampImage 走同一条路径', async () => {
    const result = await createStampImage('reviewed', '已阅');
    expect(result === null || result.width === 360).toBe(true);
  });
});
