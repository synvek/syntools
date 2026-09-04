import { describe, expect, it } from 'vitest';
import { isPdfFile } from './core';

describe('pdf-merge core', () => {
  it('detects pdf files', () => {
    expect(isPdfFile(new File([], 'a.pdf', { type: 'application/pdf' }))).toBe(true);
    expect(isPdfFile(new File([], 'a.png', { type: 'image/png' }))).toBe(false);
    expect(isPdfFile(new File([], 'doc.PDF', { type: '' }))).toBe(true);
  });
});
