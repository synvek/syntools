import { describe, expect, it } from 'vitest';
import { EDITOR_PADDING_TOP_PX, LINE_HEIGHT_PX, lineAtOffsetY, lineTopPx } from './lineHeight';

describe('行几何', () => {
  it('行高为整数像素（避免按行定位累积亚像素误差）', () => {
    expect(LINE_HEIGHT_PX).toBe(21);
    expect(Number.isInteger(LINE_HEIGHT_PX)).toBe(true);
    expect(EDITOR_PADDING_TOP_PX).toBe(12);
  });

  it('行号 → 像素位置', () => {
    expect(lineTopPx(1)).toBe(12);
    expect(lineTopPx(2)).toBe(33);
    expect(lineTopPx(10)).toBe(12 + 9 * 21);
    expect(lineTopPx(0)).toBe(12);
    expect(lineTopPx(Number.NaN)).toBe(12);
    expect(lineTopPx(3, 0)).toBe(42);
  });

  it('像素位置 → 行号', () => {
    expect(lineAtOffsetY(0)).toBe(1);
    expect(lineAtOffsetY(12)).toBe(1);
    expect(lineAtOffsetY(32.9)).toBe(1);
    expect(lineAtOffsetY(33)).toBe(2);
    expect(lineAtOffsetY(1000, 3)).toBe(3);
    expect(lineAtOffsetY(Number.NaN)).toBe(1);
  });

  it('行号与像素位置互为逆运算（前 200 行）', () => {
    for (let line = 1; line <= 200; line += 1) {
      expect(lineAtOffsetY(lineTopPx(line))).toBe(line);
    }
  });
});
