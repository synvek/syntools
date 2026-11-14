import { describe, expect, it } from 'vitest';
import { diagnoseParts, diagnoseXlsxArchive, sniffContainer, WORKBOOK_PART } from './xlsx-diagnose';

/**
 * Import diagnosis (plan P0-2).
 *
 * Each case here maps to a different user action, which is the whole reason the classification
 * exists: "remove the password" is not the same advice as "re-download the file".
 */

const zipHeader = (...extra: number[]): Uint8Array =>
  new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...extra]);
const ole2Header = (): Uint8Array =>
  new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);

describe('sniffContainer', () => {
  it('识别普通 ZIP（OOXML）', () => {
    expect(sniffContainer(zipHeader())).toBe('zip');
  });

  it('识别空归档 / 分卷归档的 ZIP 头', () => {
    expect(sniffContainer(new Uint8Array([0x50, 0x4b, 0x05, 0x06]))).toBe('zip');
    expect(sniffContainer(new Uint8Array([0x50, 0x4b, 0x07, 0x08]))).toBe('zip');
  });

  it('识别 OLE2（旧版 .xls 或加密工作簿）', () => {
    expect(sniffContainer(ole2Header())).toBe('ole2');
  });

  it('其他内容一律 unknown', () => {
    expect(sniffContainer(new Uint8Array([0x3c, 0x78, 0x6d, 0x6c]))).toBe('unknown');
    expect(sniffContainer(new Uint8Array([]))).toBe('unknown');
    expect(sniffContainer(new Uint8Array([0x50, 0x4b]))).toBe('unknown');
  });

  it('短于魔数长度的 OLE2 前缀不会被误判为正常文件', () => {
    expect(sniffContainer(new Uint8Array([0xd0, 0xcf, 0x11]))).toBe('unknown');
  });
});

describe('diagnoseParts', () => {
  it('缺少 xl/workbook.xml 时给出 MISSING_WORKBOOK_PART', () => {
    const result = diagnoseParts(['[Content_Types].xml', 'xl/worksheets/sheet1.xml']);
    expect(result).toEqual({ ok: false, error: 'MISSING_WORKBOOK_PART' });
  });

  it('部件齐全时原样带回部件列表（供保真报告复用）', () => {
    const parts = ['[Content_Types].xml', WORKBOOK_PART, 'xl/worksheets/sheet1.xml'];
    expect(diagnoseParts(parts)).toEqual({ ok: true, parts });
  });
});

describe('diagnoseXlsxArchive', () => {
  it('OLE2 容器 → FILE_ENCRYPTED（加密或旧版二进制）', async () => {
    const result = await diagnoseXlsxArchive(ole2Header().buffer as ArrayBuffer);
    expect(result).toEqual({ ok: false, error: 'FILE_ENCRYPTED' });
  });

  it('非 ZIP 内容 → NOT_ZIP', async () => {
    const bytes = new TextEncoder().encode('<html>not a workbook</html>');
    const result = await diagnoseXlsxArchive(bytes.buffer as ArrayBuffer);
    expect(result).toEqual({ ok: false, error: 'NOT_ZIP' });
  });

  it('ZIP 头但内容损坏 → NOT_ZIP', async () => {
    const result = await diagnoseXlsxArchive(zipHeader(0, 0, 0, 0).buffer as ArrayBuffer);
    expect(result).toEqual({ ok: false, error: 'NOT_ZIP' });
  });

  it('真实 ZIP：缺 workbook part 时报 MISSING_WORKBOOK_PART', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types/>');
    const buffer = (await zip.generateAsync({ type: 'arraybuffer' })) as ArrayBuffer;
    expect(await diagnoseXlsxArchive(buffer)).toEqual({
      ok: false,
      error: 'MISSING_WORKBOOK_PART',
    });
  });

  it('真实 ZIP：部件齐全时通过并返回部件名', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types/>');
    zip.file(WORKBOOK_PART, '<workbook/>');
    const buffer = (await zip.generateAsync({ type: 'arraybuffer' })) as ArrayBuffer;
    const result = await diagnoseXlsxArchive(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parts).toContain(WORKBOOK_PART);
  });
});
