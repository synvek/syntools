import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { exportDocxBlob, importDocx } from './docx';
import { DEFAULT_PAGE_SETUP } from './pageSetup';

// jsdom 未实现 Blob/File.prototype.arrayBuffer，用 FileReader 兜底（仅测试环境需要）
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
 * 导入/导出兼容回归：
 * 1) 页面设置与页眉页脚确实写入 OOXML（sectPr / header / footer）；
 * 2) 导出的 .docx 再经 mammoth 导入后，标题层级 / 列表 / 表格结构不丢失
 *    （覆盖石墨、腾讯文档、语雀、WPS 导出 docx 的通用结构路径）。
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

describe('exportDocxBlob 页面设置写入', () => {
  it('A4 纵向 + 20mm 边距 + 页眉页脚页码写入 OOXML', async () => {
    const result = await exportDocxBlob('<p>hello</p>', 't', {
      ...DEFAULT_PAGE_SETUP,
      header: '页眉文本',
      footer: '页脚文本',
      showPageNumber: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { document, header, footer } = await readDocumentXml(result.value);
    // 页面尺寸与边距（twip）：A4 宽 210mm ≈ 11907，边距 20mm ≈ 1134
    expect(document).toContain('<w:pgSz');
    expect(document).toMatch(/w:w="11906"/);
    expect(document).toMatch(/w:h="16838"/);
    expect(document).toContain('<w:pgMar');
    expect(header).toContain('页眉文本');
    expect(footer).toContain('页脚文本');
    expect(footer).toContain('PAGE'); // 页码域
  });

  it('Letter 横向会交换宽高', async () => {
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
    // Letter 横向：宽 279.4mm ≈ 15840，高 215.9mm ≈ 12240，landscape
    expect(document).toMatch(/w:w="15840"/);
    expect(document).toMatch(/w:orient="landscape"/);
  });
});

describe('docx 导出 → mammoth 导入 往返', () => {
  it('标题 / 列表 / 表格结构在往返后保留', async () => {
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
