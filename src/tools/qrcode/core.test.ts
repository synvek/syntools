import { create, type BitMatrix } from 'qrcode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_QR_OPTIONS,
  decodeQrFromImage,
  generateQr,
  normalizeQrColor,
  clampMargin,
  resolveQrOptions,
  QR_LEVELS,
  QR_SIZES,
} from './core';

const { toDataURLMock } = vi.hoisted(() => ({ toDataURLMock: vi.fn() }));
vi.mock('qrcode', async () => {
  const actual = await vi.importActual<typeof import('qrcode')>('qrcode');
  return { ...actual, toDataURL: toDataURLMock };
});

function matrixToRgba(modules: BitMatrix, scale: number, quiet: number) {
  const dim = (modules.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(dim * dim * 4).fill(255);
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (!modules.get(row, col)) continue;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const px = ((quiet + row) * scale + y) * dim + (quiet + col) * scale + x;
          data[px * 4] = 0;
          data[px * 4 + 1] = 0;
          data[px * 4 + 2] = 0;
        }
      }
    }
  }
  return { data, width: dim, height: dim };
}

describe('normalizeQrColor / clampMargin', () => {
  it('normalizes hex colors', () => {
    expect(normalizeQrColor('#abc')).toBe('#aabbcc');
    expect(normalizeQrColor('#FF0000')).toBe('#ff0000');
    expect(normalizeQrColor('red')).toBeNull();
  });

  it('clamps margin 0–10', () => {
    expect(clampMargin(2)).toBe(2);
    expect(clampMargin(2.6)).toBe(3);
    expect(clampMargin(-1)).toBeNull();
    expect(clampMargin(11)).toBeNull();
  });
});

describe('generateQr', () => {
  beforeEach(() => {
    toDataURLMock.mockReset();
  });

  it('空输入返回 EMPTY 且不调用渲染', async () => {
    const result = await generateQr('   ');
    expect(result).toEqual({ ok: false, error: 'EMPTY' });
    expect(toDataURLMock).not.toHaveBeenCalled();
  });

  it('正常生成时透传纠错、尺寸、颜色与边距', async () => {
    toDataURLMock.mockResolvedValue('data:image/png;base64,QUJD');
    const result = await generateQr('hello', {
      level: 'Q',
      size: 512,
      foreground: '#112233',
      background: '#abcdef',
      margin: 4,
    });
    expect(result).toEqual({ ok: true, value: 'data:image/png;base64,QUJD' });
    expect(toDataURLMock).toHaveBeenCalledWith('hello', {
      errorCorrectionLevel: 'Q',
      width: 512,
      margin: 4,
      color: { dark: '#112233', light: '#abcdef' },
    });
  });

  it('缺省选项使用默认颜色与边距', async () => {
    toDataURLMock.mockResolvedValue('data:image/png;base64,QUJD');
    await generateQr('hello');
    expect(toDataURLMock).toHaveBeenCalledWith('hello', {
      errorCorrectionLevel: DEFAULT_QR_OPTIONS.level,
      width: DEFAULT_QR_OPTIONS.size,
      margin: DEFAULT_QR_OPTIONS.margin,
      color: {
        dark: DEFAULT_QR_OPTIONS.foreground,
        light: DEFAULT_QR_OPTIONS.background,
      },
    });
  });

  it('非法颜色返回 INVALID_COLOR', async () => {
    const result = await generateQr('hello', { foreground: 'nope' });
    expect(result).toEqual({ ok: false, error: 'INVALID_COLOR' });
    expect(toDataURLMock).not.toHaveBeenCalled();
  });

  it('非法边距返回 INVALID_MARGIN', async () => {
    expect(await generateQr('hello', { margin: 99 })).toEqual({
      ok: false,
      error: 'INVALID_MARGIN',
    });
  });

  it('渲染失败（容量超限等）返回 TOO_LONG', async () => {
    toDataURLMock.mockRejectedValue(new Error('too big'));
    const result = await generateQr('x'.repeat(10_000));
    expect(result).toEqual({ ok: false, error: 'TOO_LONG' });
  });
});

describe('resolveQrOptions', () => {
  it('accepts short hex', () => {
    const r = resolveQrOptions({ foreground: '#f00', background: '#fff' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.foreground).toBe('#ff0000');
      expect(r.value.background).toBe('#ffffff');
    }
  });
});

describe('decodeQrFromImage', () => {
  it('生成→解码往返：能还原原始文本', () => {
    const qr = create('https://example.com/?a=1', { errorCorrectionLevel: 'M' });
    const { data, width, height } = matrixToRgba(qr.modules, 4, 4);
    const result = decodeQrFromImage(data, width, height);
    expect(result).toEqual({ ok: true, value: 'https://example.com/?a=1' });
  });

  it('中文内容往返正常', () => {
    const qr = create('你好，SynTools！', { errorCorrectionLevel: 'H' });
    const { data, width, height } = matrixToRgba(qr.modules, 4, 4);
    const result = decodeQrFromImage(data, width, height);
    expect(result).toEqual({ ok: true, value: '你好，SynTools！' });
  });

  it('纯白图片返回 NOT_FOUND', () => {
    const size = 100;
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    const result = decodeQrFromImage(data, size, size);
    expect(result).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('像素数据与尺寸不匹配返回 DECODE', () => {
    const result = decodeQrFromImage(new Uint8ClampedArray(4), 100, 100);
    expect(result).toEqual({ ok: false, error: 'DECODE' });
  });
});

describe('常量导出', () => {
  it('纠错等级与尺寸白名单', () => {
    expect(QR_LEVELS).toEqual(['L', 'M', 'Q', 'H']);
    expect(QR_SIZES).toEqual([128, 256, 512, 1024]);
  });
});
