import { describe, expect, it } from 'vitest';
import { compressPdf } from './core';

describe('compressPdf', () => {
  it('拒绝非 PDF 文件', async () => {
    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    expect(await compressPdf(file, '', { level: 'objects', quality: 0.8, scale: 2 })).toEqual({
      ok: false,
      error: 'NOT_PDF',
    });
  });
});
