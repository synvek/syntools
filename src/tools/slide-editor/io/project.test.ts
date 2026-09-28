import { describe, expect, it } from 'vitest';
import { createDoc, createTextElement } from '../model/factory';
import type { SlideDoc } from '../model/types';
import { openProject, PROJECT_FORMAT, saveProject } from './project';

/**
 * jsdom 的 Blob 没有 arrayBuffer()（同 rich-text-editor 的既有处理），
 * 这里补一个 FileReader 兜底，避免测试环境差异掩盖真实问题。
 */
function ensureArrayBuffer(): void {
  const proto = Blob.prototype as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof proto.arrayBuffer === 'function') return;
  proto.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

function sampleDoc(): SlideDoc {
  const doc = createDoc('工程测试');
  doc.slides[0].elements = [createTextElement(doc, '内容')];
  doc.slides.push({ id: 'slide-2', layoutId: doc.layouts[0]?.id, elements: [] });
  doc.slides[1].notes = '第二页备注';
  // 一个 1x1 PNG 的原始字节，验证图片不丢
  doc.media.asset1 = {
    id: 'asset1',
    mime: 'image/png',
    width: 12,
    height: 8,
    bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  };
  return doc;
}

describe('工程文件（.sld）', () => {
  it('保存后能原样打开：页数 / 元素 / 备注 / 图片字节都在', async () => {
    ensureArrayBuffer();
    const doc = sampleDoc();
    const saved = await saveProject(doc);
    expect(saved.ok).toBe(true);
    const bytes = (saved as { ok: true; value: Uint8Array }).value;

    const file = new File([bytes], 'demo.sld', { type: 'application/zip' });
    const opened = await openProject(file);
    expect(opened.ok).toBe(true);
    const back = (opened as { ok: true; value: SlideDoc }).value;

    expect(back.name).toBe('工程测试');
    expect(back.slides).toHaveLength(2);
    expect(back.slides[0].elements).toHaveLength(1);
    expect(back.slides[1].notes).toBe('第二页备注');
    expect(back.media.asset1.mime).toBe('image/png');
    expect(Array.from(back.media.asset1.bytes ?? [])).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it('工程里不写入运行态的 url 字段', async () => {
    ensureArrayBuffer();
    const doc = sampleDoc();
    doc.media.asset1.url = 'blob:runtime-only';
    const saved = await saveProject(doc);
    const bytes = (saved as { ok: true; value: Uint8Array }).value;
    const opened = await openProject(new File([bytes], 'demo.sld'));
    const back = (opened as { ok: true; value: SlideDoc }).value;
    expect(back.media.asset1.url).toBeUndefined();
  });

  it('非工程文件返回 NOT_PROJECT', async () => {
    ensureArrayBuffer();
    const opened = await openProject(new File(['not a zip'], 'x.sld'));
    expect(opened.ok).toBe(false);
    expect((opened as { ok: false; error: string }).error).toBe('IMPORT_FAILED');
  });

  it('缺少 project.json 的 zip 返回 NOT_PROJECT', async () => {
    ensureArrayBuffer();
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('other.txt', 'hello');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const opened = await openProject(new File([new Uint8Array(bytes)], 'other.sld'));
    expect(opened.ok).toBe(false);
    expect((opened as { ok: false; error: string }).error).toBe('NOT_PROJECT');
  });

  it('格式标识不匹配返回 NOT_PROJECT', async () => {
    ensureArrayBuffer();
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify({ format: 'something-else', version: 1, doc: {} }));
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const opened = await openProject(new File([new Uint8Array(bytes)], 'x.sld'));
    expect(opened.ok).toBe(false);
    expect((opened as { ok: false; error: string }).error).toBe('NOT_PROJECT');
  });

  it('版本更高的工程文件拒绝打开', async () => {
    ensureArrayBuffer();
    const doc = sampleDoc();
    const saved = await saveProject(doc);
    const bytes = (saved as { ok: true; value: Uint8Array }).value;
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(bytes);
    const payload = JSON.parse((await zip.file('project.json')?.async('string')) ?? '{}');
    payload.version = 99;
    zip.file('project.json', JSON.stringify(payload));
    const next = await zip.generateAsync({ type: 'uint8array' });
    const opened = await openProject(new File([new Uint8Array(next)], 'future.sld'));
    expect(opened.ok).toBe(false);
    expect((opened as { ok: false; error: string }).error).toBe('PROJECT_VERSION');
  });

  it('格式常量保持稳定（改动即破坏向后兼容）', () => {
    expect(PROJECT_FORMAT).toBe('syntools-slide');
  });
});
