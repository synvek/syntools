import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addObject,
  createDoc,
  insertPagesFrom,
  markSaved,
  pageIdFor,
  setCurrentPage,
  setZoom,
} from '../model/doc';
import { createTextObject } from '../model/objects';
import type { PdfEditorDoc } from '../model/types';
import {
  applyDraftModel,
  deleteDraft,
  getDraft,
  latestDraft,
  putDraft,
  readDraftAttachments,
  readDraftBytes,
  resetDraftStore,
  serializeDoc,
} from './draftStore';

function makeDoc(fingerprint: string, pageCount = 2): PdfEditorDoc {
  return createDoc({
    name: `${fingerprint}.pdf`,
    source: {
      key: 'main',
      bytes: new Uint8Array([1, 2, 3]),
      pageCount,
      encrypted: false,
      fingerprint,
    },
    id: `doc-${fingerprint}`,
    now: 1000,
  });
}

beforeEach(async () => {
  await resetDraftStore();
});

describe('putDraft', () => {
  it('写入后可读回，rev 从 1 递增', async () => {
    const doc = makeDoc('fp-1');
    const first = await putDraft(doc, { bytes: doc.source.bytes });
    expect(first.ok && first.value.rev).toBe(1);
    expect(first.ok && first.value.modelOnly).toBe(false);

    const again = await putDraft(doc, { bytes: doc.source.bytes, baseRev: 1 });
    expect(again.ok && again.value.rev).toBe(2);

    const record = await getDraft('fp-1');
    expect(record?.name).toBe('fp-1.pdf');
    expect(record?.rev).toBe(2);
    expect(record?.pageCount).toBe(2);
  });

  it('baseRev 落后时返回 CONFLICT（其他标签页先写了）', async () => {
    const doc = makeDoc('fp-2');
    await putDraft(doc, { bytes: doc.source.bytes });

    const stale = await putDraft(doc, { bytes: doc.source.bytes, baseRev: 0 });
    expect(stale).toEqual({ ok: false, error: 'CONFLICT' });
    expect((await getDraft('fp-2'))?.rev).toBe(1);
  });

  it('加密文件不写草稿（密码只在内存里）', async () => {
    const encrypted = createDoc({
      name: 'secret.pdf',
      source: {
        key: 'main',
        bytes: new Uint8Array([1]),
        pageCount: 1,
        encrypted: true,
        password: 'syntools',
        fingerprint: 'fp-secret',
      },
      now: 0,
    });

    expect(await putDraft(encrypted, { bytes: encrypted.source.bytes })).toEqual({
      ok: false,
      error: 'SKIPPED',
    });
    expect(await getDraft('fp-secret')).toBeNull();
  });

  it('没有指纹（未打开文件）时拒绝写入', async () => {
    const empty = makeDoc('');
    expect(await putDraft(empty)).toEqual({ ok: false, error: 'UNAVAILABLE' });
  });

  it('最多保留 5 份草稿，最旧的被清理', async () => {
    for (let index = 0; index < 6; index += 1) {
      const doc = makeDoc(`fp-${index}`);
      await putDraft(doc, { bytes: doc.source.bytes });
      // `updatedAt` uses the wall clock; keep the ordering unambiguous
      await new Promise((resolve) => setTimeout(resolve, 2));
    }

    expect(await getDraft('fp-0')).toBeNull();
    expect(await latestDraft()).not.toBeNull();
  });
});

describe('checksum / bytes round trip', () => {
  it('sourceBlob 保存原始字节，读回逐字节一致', async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const doc = createDoc({
      name: 'bytes.pdf',
      source: { key: 'main', bytes, pageCount: 1, encrypted: false, fingerprint: 'fp-bytes' },
      now: 0,
    });

    await putDraft(doc, { bytes });
    const record = await getDraft('fp-bytes');
    expect(record).not.toBeNull();

    const restored = readDraftBytes(record!);
    expect(Array.from(restored ?? [])).toEqual(Array.from(bytes));
  });

  it('没有 sourceBytes 时返回 null（只存了模型）', async () => {
    const doc = makeDoc('fp-model');
    await putDraft(doc);
    const record = await getDraft('fp-model');
    expect(record?.sourceBytes).toBeNull();
    expect(readDraftBytes(record!)).toBeNull();
  });
});

describe('serializeDoc / applyDraftModel', () => {
  it('模型不含 source（字节与密码都不会进库）', () => {
    const doc = createDoc({
      name: 'secret.pdf',
      source: {
        key: 'main',
        bytes: new Uint8Array([1]),
        pageCount: 1,
        encrypted: false,
        password: 'syntools-secret',
        fingerprint: 'fp-x',
      },
      now: 0,
    });

    const model = serializeDoc(doc);
    expect('source' in model).toBe(false);
    expect(JSON.stringify(model)).not.toContain('syntools-secret');
  });

  it('恢复后对象、页码、缩放一致，source 用新字节', () => {
    let doc = makeDoc('fp-restore');
    doc = addObject(
      doc,
      createTextObject({
        page: pageIdFor('main', 0),
        rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 },
        text: 'Hello',
        z: 1,
      }),
    );
    doc = setZoom(setCurrentPage(doc, 2), 1.5);
    doc = markSaved(doc);

    const source = {
      key: 'main',
      bytes: new Uint8Array([9]),
      pageCount: 2,
      encrypted: false,
      fingerprint: 'fp-restore',
    };
    const restored = applyDraftModel(serializeDoc(doc), source);

    expect(restored.objects).toEqual(doc.objects);
    expect(restored.view).toEqual(doc.view);
    expect(restored.revision).toBe(doc.revision);
    expect(restored.savedRevision).toBe(doc.savedRevision);
    expect(Array.from(restored.source.bytes)).toEqual([9]);
  });
});

describe('deleteDraft', () => {
  it('删除后不再出现在最新草稿里', async () => {
    const doc = makeDoc('fp-del');
    await putDraft(doc, { bytes: doc.source.bytes });
    await deleteDraft('fp-del');

    expect(await getDraft('fp-del')).toBeNull();
    expect(await latestDraft()).toBeNull();
  });
});

describe('模型版本与附件', () => {
  it('附件字节随草稿保存并可恢复', async () => {
    const attachmentBytes = new Uint8Array([7, 7, 7]);
    let doc = makeDoc('fp-attach');
    doc = insertPagesFrom(
      doc,
      2,
      {
        key: 'attach-1',
        bytes: attachmentBytes,
        pageCount: 1,
        encrypted: false,
        fingerprint: 'fp-attach-src',
      },
      [0],
    );

    await putDraft(doc, { bytes: doc.source.bytes });
    const record = await getDraft('fp-attach');

    expect(record?.attachments).toHaveLength(1);
    const sources = readDraftAttachments(record!);
    expect(sources[0].key).toBe('attach-1');
    expect(Array.from(sources[0].bytes)).toEqual([7, 7, 7]);
    expect(record?.model.pages.some((page) => page.blank)).toBe(false);
  });

  it('旧版本（v1）记录被视为无草稿', async () => {
    // Written directly: the store under test refuses to deserialize foreign shapes
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('syntools-pdf-editor', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('drafts')) {
          request.result.createObjectStore('drafts', { keyPath: 'fingerprint' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      tx.objectStore('drafts').put({
        fingerprint: 'fp-old',
        name: 'old.pdf',
        rev: 1,
        updatedAt: 1,
        pageCount: 1,
        model: { version: 1 },
        sourceBytes: null,
        attachments: [],
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    expect(await getDraft('fp-old')).toBeNull();
    expect(await latestDraft()).toBeNull();
  });
});
