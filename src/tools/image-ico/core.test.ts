import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ICO_SIZES,
  encodeIco,
  formatBytes,
  isIcoFile,
  isLikelyImageFile,
  normalizeIcoSizes,
  parseIco,
} from './core';

function pngStub(width: number, height: number): Uint8Array {
  // 最小合法 PNG 头 + IHDR 尺寸占位不够完整；测试用假 PNG 魔数 + 填充
  // encodeIco 只检查 PNG 魔数，不校验 CRC
  const data = new Uint8Array(24);
  data.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  data[8] = width;
  data[9] = height;
  return data;
}

describe('image-ico', () => {
  it('normalizeIcoSizes filters and sorts', () => {
    const r = normalizeIcoSizes([32, 16, 32, 999, 48]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([16, 32, 48]);
  });

  it('normalizeIcoSizes rejects empty', () => {
    expect(normalizeIcoSizes([]).ok).toBe(false);
    expect(normalizeIcoSizes([7, 9]).ok).toBe(false);
  });

  it('encodeIco + parseIco roundtrip', () => {
    const frames = DEFAULT_ICO_SIZES.map((s) => ({
      width: s,
      height: s,
      png: pngStub(s, s),
    }));
    const encoded = encodeIco(frames);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    const parsed = parseIco(encoded.value.buffer.slice(
      encoded.value.byteOffset,
      encoded.value.byteOffset + encoded.value.byteLength,
    ));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toHaveLength(3);
    expect(parsed.value.map((e) => e.width)).toEqual([16, 32, 48]);
    expect(parsed.value.every((e) => e.format === 'png')).toBe(true);
  });

  it('encodeIco rejects empty frames', () => {
    expect(encodeIco([]).ok).toBe(false);
  });

  it('parseIco rejects garbage', () => {
    expect(parseIco(new ArrayBuffer(0)).ok).toBe(false);
    expect(parseIco(new Uint8Array([1, 2, 3, 4, 5, 6]).buffer).ok).toBe(false);
  });

  it('file helpers', () => {
    expect(isLikelyImageFile('image/png')).toBe(true);
    expect(isLikelyImageFile('', 'logo.ico')).toBe(true);
    expect(isIcoFile('image/x-icon')).toBe(true);
    expect(isIcoFile('', 'a.ICO')).toBe(true);
    expect(isIcoFile('image/png', 'a.png')).toBe(false);
  });

  it('formatBytes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
  });
});
