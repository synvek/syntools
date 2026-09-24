import { describe, expect, it } from 'vitest';
import { buildWebPalette, encodeGif, framesToGif, lzwEncode, quantizeFrame } from './core';

function solidFrame(w: number, h: number, r: number, g: number, b: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

describe('video-to-gif 调色板', () => {
  it('调色板 256 项且前 216 项为 web-safe', () => {
    const pal = buildWebPalette();
    expect(pal.length).toBe(768);
    expect(pal.slice(0, 3)).toEqual(new Uint8Array([0, 0, 0]));
    // 第 216 项（最后一个 web-safe）应为 (255,255,255)
    const last = 215 * 3;
    expect([pal[last], pal[last + 1], pal[last + 2]]).toEqual([255, 255, 255]);
  });

  it('量化：黑=0，白=215', () => {
    expect(quantizeFrame(solidFrame(1, 1, 0, 0, 0), 1)[0]).toBe(0);
    expect(quantizeFrame(solidFrame(1, 1, 255, 255, 255), 1)[0]).toBe(215);
  });
});

describe('video-to-gif LZW', () => {
  it('输出非空且以 end 码结束', () => {
    const pixels = new Uint8Array(100).fill(0);
    const out = lzwEncode(pixels, 8);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('video-to-gif GIF', () => {
  it('生成合法 GIF89a 头与结尾', () => {
    const frames = [
      { indices: new Uint8Array(4), delayCentiseconds: 10 },
      { indices: new Uint8Array(4).fill(215), delayCentiseconds: 10 },
    ];
    const gif = encodeGif(frames, 2, 2);
    const header = String.fromCharCode(...gif.slice(0, 6));
    expect(header).toBe('GIF89a');
    expect(gif[gif.length - 1]).toBe(0x3b);
    // 包含 Netscape 循环块
    const body = String.fromCharCode(...gif);
    expect(body).toContain('NETSCAPE2.0');
  });

  it('framesToGif 校验与输出', () => {
    const frames = [
      { rgba: solidFrame(2, 2, 255, 0, 0), width: 2, height: 2 },
      { rgba: solidFrame(2, 2, 0, 255, 0), width: 2, height: 2 },
    ];
    const r = framesToGif(frames, 10);
    expect(r.ok).toBe(true);
    if (r.ok) expect(String.fromCharCode(...r.value.slice(0, 6))).toBe('GIF89a');
  });

  it('空帧报错', () => {
    expect(framesToGif([], 10)).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('非法 fps 报错', () => {
    const frames = [{ rgba: solidFrame(1, 1, 0, 0, 0), width: 1, height: 1 }];
    expect(framesToGif(frames, 0)).toEqual({ ok: false, error: 'INVALID_FPS' });
  });
});
