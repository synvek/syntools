import { describe, expect, it } from 'vitest';
import { formatBytes, isImageFile, parseBase64Input, sniffMime } from './core';

describe('image-base64', () => {
  it('isImageFile', () => {
    expect(isImageFile('image/png')).toBe(true);
    expect(isImageFile('text/plain')).toBe(false);
  });

  it('parseBase64Input data URL', () => {
    const r = parseBase64Input('data:image/png;base64,iVBORw0KGgo=');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.mime).toBe('image/png');
    expect(r.value.base64).toBe('iVBORw0KGgo=');
  });

  it('parseBase64Input 纯 Base64 嗅探 jpeg', () => {
    const r = parseBase64Input('/9j/4AAQSkZJRg==');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.mime).toBe('image/jpeg');
  });

  it('空输入 / 非法 Base64', () => {
    expect(parseBase64Input('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(parseBase64Input('!!!')).toEqual({ ok: false, error: 'INVALID_BASE64' });
  });

  it('sniffMime / formatBytes', () => {
    expect(sniffMime('iVBORw0KGgo')).toBe('image/png');
    expect(sniffMime('R0lGODlh')).toBe('image/gif');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
  });
});
