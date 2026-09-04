import { describe, expect, it } from 'vitest';
import { readBasicExif, stripJpegExif } from './core';

function buildJpeg(withApp1: boolean): Uint8Array {
  // SOI + optional APP1 + SOS-like EOI shortcut: SOI APP0 EOI minimal
  const soi = [0xff, 0xd8];
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  // APP1 with Exif header + fake Make
  const exifBody = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // Exif\0\0
    0x4d, 0x4d, 0x00, 0x2a, // TIFF big-endian
    ...Array.from(new TextEncoder().encode('Make\0Canon\0')),
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ];
  const app1Len = exifBody.length + 2;
  const app1 = [0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff, ...exifBody];
  const eoi = [0xff, 0xd9];
  const parts = withApp1 ? [...soi, ...app1, ...app0, ...eoi] : [...soi, ...app0, ...eoi];
  return new Uint8Array(parts);
}

describe('exif-strip', () => {
  it('空输入 EMPTY', () => {
    expect(stripJpegExif(new Uint8Array())).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('非 JPEG UNSUPPORTED', () => {
    expect(stripJpegExif(new Uint8Array([0x89, 0x50]))).toEqual({ ok: false, error: 'UNSUPPORTED' });
  });

  it('剥离 APP1', () => {
    const input = buildJpeg(true);
    const r = stripJpegExif(input, 'photo.jpg');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.filename).toBe('photo-no-exif.jpg');
    // no APP1 marker
    const bytes = r.value.bytes;
    let hasApp1 = false;
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xe1) hasApp1 = true;
    }
    expect(hasApp1).toBe(false);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
  });

  it('无 EXIF 仍可处理', () => {
    const r = stripJpegExif(buildJpeg(false));
    expect(r.ok).toBe(true);
  });

  it('readBasicExif 检测 hasExif', () => {
    expect(readBasicExif(buildJpeg(true)).hasExif).toBe(true);
    expect(readBasicExif(buildJpeg(false)).hasExif).toBe(false);
  });
});
