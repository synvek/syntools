import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { createDoc } from '../model/doc';
import { createImageObject, createShapeObject, createTextObject } from '../model/objects';
import type { PdfEditorDoc, PdfSource } from '../model/types';
import {
  fingerprintBytes,
  isProjectFile,
  openProject,
  PROJECT_VERSION,
  projectFilename,
  saveProject,
  type PdfProjectModel,
} from './projectFile';

const MAIN_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 1, 2, 3, 4]);
const ATTACH_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 9, 9, 9]);

function source(overrides: Partial<PdfSource> = {}): PdfSource {
  return {
    key: 'main',
    bytes: MAIN_BYTES,
    pageCount: 2,
    encrypted: false,
    fingerprint: 'fp-main',
    ...overrides,
  };
}

function sampleDoc(): PdfEditorDoc {
  const doc = createDoc({ name: 'report.pdf', source: source(), id: 'doc-1', now: 1 });
  doc.objects = [
    createTextObject({
      page: doc.pages[0].id,
      rect: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 },
      text: '可编辑',
    }),
    createShapeObject({
      page: doc.pages[0].id,
      rect: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 },
      type: 'rect',
    }),
    createImageObject({
      page: doc.pages[1].id,
      rect: { x: 0, y: 0, w: 0.5, h: 0.5 },
      dataUrl: 'data:image/png;base64,AAAA',
      naturalW: 10,
      naturalH: 10,
    }),
  ];
  doc.pages[1] = { ...doc.pages[1], rotation: 90 };
  doc.meta = { title: '报告', author: 'SynTools' };
  doc.decoration = {
    numbers: {
      enabled: true,
      format: '{n}/{total}',
      position: 'bottom-center',
      fontSize: 10,
      color: '#333333',
      margin: 24,
      startFrom: 1,
    },
  };
  doc.view = { mode: 'single', zoom: 1.5, zoomMode: 'custom', page: 2 };
  doc.attachments = [
    {
      key: 'attach-1',
      bytes: ATTACH_BYTES,
      pageCount: 1,
      encrypted: false,
      fingerprint: 'fp-attach',
    },
  ];
  doc.pages.push({ id: 'page-attach-1-0', sourceKey: 'attach-1', sourceIndex: 0, rotation: 0 });
  doc.revision = 7;
  doc.savedRevision = 7;
  return doc;
}

describe('projectFilename / isProjectFile', () => {
  it('只替换扩展名，保留原文件名', () => {
    expect(projectFilename('report.pdf')).toBe('report.pdfproj');
    expect(projectFilename('A.PDF')).toBe('A.pdfproj');
    expect(projectFilename('  ')).toBe('document.pdfproj');
  });

  it('按扩展名识别工程文件（大小写不敏感）', () => {
    expect(isProjectFile('a.pdfproj')).toBe(true);
    expect(isProjectFile('A.PDFPROJ')).toBe(true);
    expect(isProjectFile('a.pdf')).toBe(false);
  });
});

describe('fingerprintBytes', () => {
  it('内容相同则指纹相同，长度不同则不同', () => {
    const first = fingerprintBytes(MAIN_BYTES);
    expect(fingerprintBytes(new Uint8Array(MAIN_BYTES))).toBe(first);
    expect(fingerprintBytes(ATTACH_BYTES)).not.toBe(first);
    expect(first).toMatch(/^proj-/);
  });

  it('长文件只看首尾与长度，仍然区分尾部差异', () => {
    const big = new Uint8Array(20_000).fill(7);
    const changed = new Uint8Array(big);
    changed[changed.length - 1] = 8;
    expect(fingerprintBytes(big)).not.toBe(fingerprintBytes(changed));
  });
});

describe('.pdfproj 保存与打开', () => {
  it('往返后模型逐字段一致，字节原样保留', async () => {
    const doc = sampleDoc();
    const saved = await saveProject(doc);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.filename).toBe('report.pdfproj');

    const opened = await openProject(saved.value.bytes, 'report.pdfproj');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const { model, bytes, attachments, name } = opened.value;
    expect(name).toBe('report.pdf');
    expect(Array.from(bytes)).toEqual(Array.from(MAIN_BYTES));
    expect(attachments).toHaveLength(1);
    expect(attachments[0].key).toBe('attach-1');
    expect(Array.from(attachments[0].bytes)).toEqual(Array.from(ATTACH_BYTES));

    expect(model.pages).toHaveLength(3);
    expect(model.pages[1].rotation).toBe(90);
    expect(model.objects.map((object) => object.kind)).toEqual(['text', 'shape', 'image']);
    expect(model.decoration?.numbers?.format).toBe('{n}/{total}');
    expect(model.meta).toEqual({ title: '报告', author: 'SynTools' });
    expect(model.view.zoom).toBe(1.5);
    expect(model.savedRevision).toBe(model.revision);
    expect(opened.value.fingerprint).toBe(fingerprintBytes(MAIN_BYTES));
  });

  it('工程里不写入密码：加密文档直接拒绝保存', async () => {
    const doc = createDoc({
      name: 'locked.pdf',
      source: source({ encrypted: true, password: 'secret' }),
    });
    const result = await saveProject(doc);
    expect(result).toEqual({ ok: false, error: 'PROJECT_ENCRYPTED' });
  });

  it('更新版本的工程被拒绝，而不是按老结构读', async () => {
    const doc = sampleDoc();
    const saved = await saveProject(doc);
    if (!saved.ok) return;

    const zip = await JSZip.loadAsync(saved.value.bytes);
    const payload = JSON.parse(await zip.file('project.json')!.async('string'));
    payload.version = PROJECT_VERSION + 1;
    zip.file('project.json', JSON.stringify(payload));
    const bumped = await zip.generateAsync({ type: 'uint8array' });

    const opened = await openProject(new Uint8Array(bumped));
    expect(opened).toEqual({ ok: false, error: 'PROJECT_VERSION' });
  });

  it('普通 PDF / 缺少 source.pdf 的压缩包不会被当成工程', async () => {
    const pdf = await openProject(MAIN_BYTES, 'report.pdf');
    expect(pdf.ok).toBe(false);

    const zip = new JSZip();
    zip.file(
      'project.json',
      JSON.stringify({ format: 'syntools-pdf-editor', version: 1, doc: { pages: [] } }),
    );
    const missing = await zip.generateAsync({ type: 'uint8array' });
    const opened = await openProject(new Uint8Array(missing));
    expect(opened.ok).toBe(false);
  });

  it('附件文件缺失时拒绝打开（避免打开后满页占位）', async () => {
    const saved = await saveProject(sampleDoc());
    if (!saved.ok) return;
    const zip = await JSZip.loadAsync(saved.value.bytes);
    zip.remove('attachments/attach-1.pdf');
    const broken = await zip.generateAsync({ type: 'uint8array' });

    const opened = await openProject(new Uint8Array(broken));
    expect(opened).toEqual({ ok: false, error: 'NOT_PROJECT' });
  });

  it('工程模型里没有 source / attachments 字段（不含字节与密码）', async () => {
    const saved = await saveProject(sampleDoc());
    if (!saved.ok) return;
    const zip = await JSZip.loadAsync(saved.value.bytes);
    const payload = JSON.parse(await zip.file('project.json')!.async('string')) as {
      doc: PdfProjectModel & { source?: unknown; attachments?: unknown };
    };
    expect(payload.doc.source).toBeUndefined();
    expect(payload.doc.attachments).toBeUndefined();
    expect(JSON.stringify(payload.doc)).not.toContain('secret');
  });
});
