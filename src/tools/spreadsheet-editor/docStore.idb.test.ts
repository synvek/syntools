import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDocId,
  deleteDocument,
  duplicateDocument,
  initDocStore,
  listDocuments,
  listVersions,
  loadDocument,
  readCurrentDocId,
  saveDocument,
  setCurrentDocId,
} from './docStore';
import { createEmptySnapshot } from './xlsx-io';

/**
 * Spreadsheet doc store against a real (in-memory) IndexedDB.
 * Covers what the jsdom "no IndexedDB" tests cannot: persistence, version interval / cap, delete cleanup.
 */

const DRAFT_KEY = 'syntools:spreadsheet-editor.draft.v1';
const MAX_VERSIONS = 20;
const VERSION_MIN_INTERVAL_MS = 120_000;

let docId = '';

beforeEach(() => {
  localStorage.clear();
  docId = createDocId();
});

describe('saveDocument / loadDocument', () => {
  it('persists a workbook so the library list and a reload both see it', async () => {
    const snapshot = createEmptySnapshot('预算表');
    await saveDocument(docId, '预算表', snapshot);

    expect((await listDocuments()).map((doc) => doc.id)).toContain(docId);

    const doc = await loadDocument(docId);
    expect(doc?.title).toBe('预算表');
    expect(doc?.snapshot.sheetOrder).toEqual(snapshot.sheetOrder);
    expect(doc?.snapshot.sheets).toEqual(snapshot.sheets);
  });

  it('upserts: createdAt is kept while updatedAt and the content follow the last save', async () => {
    const start = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(start);
    await saveDocument(docId, '第一版', createEmptySnapshot('第一版'));
    const first = await loadDocument(docId);

    vi.spyOn(Date, 'now').mockReturnValue(start + 5_000);
    await saveDocument(docId, '第二版', createEmptySnapshot('第二版'));
    const second = await loadDocument(docId);

    expect(second?.createdAt).toBe(first?.createdAt);
    expect(second?.updatedAt).toBe(start + 5_000);
    expect(second?.title).toBe('第二版');
    expect((await listDocuments()).filter((doc) => doc.id === docId)).toHaveLength(1);
  });
});

describe('version snapshots', () => {
  it('only snapshots once the two minute window has passed', async () => {
    const start = 1_700_000_000_000;
    const clock = vi.spyOn(Date, 'now');

    clock.mockReturnValue(start);
    await saveDocument(docId, 't', createEmptySnapshot('t'));
    expect(await listVersions(docId)).toHaveLength(1);

    clock.mockReturnValue(start + 30_000);
    await saveDocument(docId, 't', createEmptySnapshot('t2'));
    expect(await listVersions(docId)).toHaveLength(1);

    clock.mockReturnValue(start + VERSION_MIN_INTERVAL_MS + 1);
    await saveDocument(docId, 't', createEmptySnapshot('t3'));
    const versions = await listVersions(docId);
    expect(versions).toHaveLength(2);
    // Newest first, carrying the snapshot of that moment
    expect(versions[0].snapshot.name).toBe('t3');
  });

  it(`keeps at most ${MAX_VERSIONS} snapshots per workbook`, async () => {
    const start = 1_700_000_000_000;
    const clock = vi.spyOn(Date, 'now');
    clock.mockReturnValue(start);

    for (let index = 0; index < MAX_VERSIONS + 5; index += 1) {
      clock.mockReturnValue(start + index * (VERSION_MIN_INTERVAL_MS + 1));
      await saveDocument(docId, `v${index}`, createEmptySnapshot(`v${index}`));
    }

    const versions = await listVersions(docId);
    expect(versions).toHaveLength(MAX_VERSIONS);
    expect(versions[0].title).toBe(`v${MAX_VERSIONS + 4}`);
    expect(versions[MAX_VERSIONS - 1].title).toBe('v5');
  });
});

describe('deleteDocument / duplicateDocument', () => {
  it('removes the workbook and every one of its snapshots', async () => {
    await saveDocument(docId, '待删除', createEmptySnapshot('待删除'));
    expect(await listVersions(docId)).toHaveLength(1);

    await deleteDocument(docId);

    expect((await listDocuments()).some((doc) => doc.id === docId)).toBe(false);
    expect(await loadDocument(docId)).toBeNull();
    expect(await listVersions(docId)).toEqual([]);
  });

  it('names the duplicate from the labels the caller passes', async () => {
    await saveDocument(docId, '', createEmptySnapshot('原件'));
    const cloneId = await duplicateDocument(docId, {
      untitled: 'Untitled workbook',
      suffix: ' copy',
    });

    const clone = await loadDocument(cloneId as string);
    expect(clone?.title).toBe('Untitled workbook copy');
    expect(clone?.snapshot.sheets).toEqual((await loadDocument(docId))?.snapshot.sheets);
  });

  it('returns null when duplicating a workbook that does not exist', async () => {
    await expect(
      duplicateDocument('missing-doc', { untitled: '未命名工作簿', suffix: ' 副本' }),
    ).resolves.toBeNull();
  });
});

describe('initDocStore', () => {
  it('resumes the workbook the pointer refers to', async () => {
    await saveDocument(docId, '上月报表', createEmptySnapshot('上月报表'));
    setCurrentDocId(docId);
    expect(readCurrentDocId()).toBe(docId);

    const init = await initDocStore();
    expect(init?.docId).toBe(docId);
    expect(init?.doc?.title).toBe('上月报表');
  });

  it('returns the pointer with a null document when that workbook was deleted', async () => {
    setCurrentDocId('gone-doc');

    await expect(initDocStore()).resolves.toEqual({ docId: 'gone-doc', doc: null });
  });

  it('migrates the localStorage draft into the library as the first workbook', async () => {
    const snapshot = createEmptySnapshot('旧草稿');
    localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));

    const init = await initDocStore();
    expect(init?.docId).toBe('legacy');
    expect(init?.doc?.title).toBe('旧草稿');
    expect((await listDocuments()).some((doc) => doc.id === 'legacy')).toBe(true);
    expect(readCurrentDocId()).toBe('legacy');
  });
});
