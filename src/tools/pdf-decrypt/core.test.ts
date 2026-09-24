import { describe, expect, it } from 'vitest';
import { decryptPdf, readPdfBytes } from './core';

function makePdfFile(content: string, name = 'doc.pdf'): File {
  return {
    name,
    type: 'application/pdf',
    size: content.length,
    arrayBuffer: async () => new TextEncoder().encode(content).buffer,
  } as unknown as File;
}

describe('readPdfBytes', () => {
  it('拒绝非 PDF 文件', async () => {
    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    expect(await readPdfBytes(file)).toEqual({ ok: false, error: 'NOT_PDF' });
  });

  it('接受合法 PDF 文件并返回字节', async () => {
    const result = await readPdfBytes(makePdfFile('%PDF-1.4'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.byteLength).toBe(8);
  });
});

describe('decryptPdf', () => {
  it('非 PDF 直接报错', async () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    expect((await decryptPdf(file, '')).ok).toBe(false);
  });
});
