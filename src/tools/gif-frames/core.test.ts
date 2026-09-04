import { describe, expect, it } from 'vitest';
import { isGifFile, parseGifBuffer } from './core';

/** 1×1 红色 GIF87a */
const TINY_GIF = Uint8Array.from(
  atob(
    'R0lGODlhAQABAIABAP8AAP///yH5BAEAAAEALAAAAAABAAEAAAICRAEAOw==',
  ),
  (c) => c.charCodeAt(0),
);

describe('gif-frames', () => {
  it('识别 gif', () => {
    expect(isGifFile('image/gif')).toBe(true);
    expect(isGifFile('', 'a.GIF')).toBe(true);
    expect(isGifFile('image/png')).toBe(false);
  });

  it('解析最小 GIF', () => {
    const buf = TINY_GIF.buffer.slice(
      TINY_GIF.byteOffset,
      TINY_GIF.byteOffset + TINY_GIF.byteLength,
    );
    const r = parseGifBuffer(buf);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.width).toBe(1);
    expect(r.value.height).toBe(1);
    expect(r.value.frames.length).toBeGreaterThanOrEqual(1);
  });

  it('空缓冲', () => {
    expect(parseGifBuffer(new ArrayBuffer(0))).toEqual({ ok: false, error: 'EMPTY' });
  });
});
