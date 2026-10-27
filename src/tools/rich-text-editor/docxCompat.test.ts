import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { exportDocxBlob, importDocx } from './docx';
import { DEFAULT_PAGE_SETUP } from './pageSetup';

// jsdom lacks Blob/File.prototype.arrayBuffer, so fall back to FileReader (test-only)
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error('READ_FAILED'));
      reader.readAsArrayBuffer(this);
    });
  };
}

/**
 * Import/export compatibility regression:
 * 1) Page setup, header, and footer really land in the OOXML (sectPr / header / footer);
 * 2) Re-importing the exported .docx through mammoth preserves heading levels / lists / tables
 *    (covering the common structure paths of docx files exported by Shimo, Tencent Docs, Yuque, and WPS).
 */

async function readDocumentXml(
  blob: Blob,
): Promise<{ document: string; header: string; footer: string }> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const document = (await zip.file('word/document.xml')?.async('string')) ?? '';
  const header = (await zip.file('word/header1.xml')?.async('string')) ?? '';
  const footer = (await zip.file('word/footer1.xml')?.async('string')) ?? '';
  return { document, header, footer };
}

describe('exportDocxBlob page setup output', () => {
  it('writes A4 portrait + 20mm margins + header, footer, and page number to OOXML', async () => {
    const result = await exportDocxBlob('<p>hello</p>', 't', {
      ...DEFAULT_PAGE_SETUP,
      header: '页眉文本',
      footer: '页脚文本',
      showPageNumber: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { document, header, footer } = await readDocumentXml(result.value);
    // Page size and margins in twips: A4 width 210mm ≈ 11907, margin 20mm ≈ 1134
    expect(document).toContain('<w:pgSz');
    expect(document).toMatch(/w:w="11906"/);
    expect(document).toMatch(/w:h="16838"/);
    expect(document).toContain('<w:pgMar');
    expect(header).toContain('页眉文本');
    expect(footer).toContain('页脚文本');
    expect(footer).toContain('PAGE'); // page number field
  });

  it('swaps width and height for Letter landscape', async () => {
    const result = await exportDocxBlob('<p>x</p>', 't', {
      ...DEFAULT_PAGE_SETUP,
      size: 'Letter',
      orientation: 'landscape',
      header: '',
      footer: '',
      showPageNumber: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { document } = await readDocumentXml(result.value);
    // Letter landscape: width 279.4mm ≈ 15840, height 215.9mm ≈ 12240, landscape
    expect(document).toMatch(/w:w="15840"/);
    expect(document).toMatch(/w:orient="landscape"/);
  });
});

describe('docx export → mammoth import round trip', () => {
  it('keeps headings / lists / tables across the round trip', async () => {
    const html = [
      '<h1>文档标题</h1>',
      '<h2>小节</h2>',
      '<p>普通段落</p>',
      '<ul><li>项目一</li><li>项目二</li></ul>',
      '<ol><li>第一</li></ol>',
      '<table><tr><th>姓名</th><th>年龄</th></tr><tr><td>张三</td><td>18</td></tr></table>',
    ].join('');
    const exported = await exportDocxBlob(html, 'roundtrip', DEFAULT_PAGE_SETUP);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const file = new File([exported.value], 'roundtrip.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const imported = await importDocx(file);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    const result = imported.value;
    expect(result).toContain('<h1');
    expect(result).toContain('文档标题');
    expect(result).toContain('<h2');
    expect(result).toContain('<ul');
    expect(result).toContain('<ol');
    expect(result).toContain('<table');
    expect(result).toContain('姓名');
    expect(result).toContain('张三');
  });
});
