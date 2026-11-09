import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_DRAFT_KEY } from './draft';
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
  saveManualVersion,
  setCurrentDocId,
  subscribeDocEvents,
  type DocStoreEvent,
} from './docStore';

/**
 * docStore tests against a real (in-memory) IndexedDB.
 * These cover the paths jsdom cannot: persistence and lazy v1 migration, version trimming, delete cleanup.
 */

const DRAFT_KEY_V2 = 'syntools:rich-text-editor.draft.v2';
const MAX_VERSIONS = 20;
const VERSION_MIN_INTERVAL_MS = 120_000;

/** Open the database directly, so raw (pre-migration) records can be injected */
function openRawDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('syntools-rich-text', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('versions')) {
        const store = db.createObjectStore('versions', { keyPath: 'id' });
        store.createIndex('docId', 'docId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putRaw(store: string, value: unknown): Promise<void> {
  return openRawDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

/**
 * Minimal BroadcastChannel stand-in (jsdom has none): peers deliver to every other instance,
 * so a test can act as "the other tab" by posting from a channel it created itself.
 */
class FakeBroadcastChannel {
  static peers = new Set<FakeBroadcastChannel>();
  private listeners = new Set<(event: MessageEvent) => void>();

  constructor(public readonly name: string) {
    FakeBroadcastChannel.peers.add(this);
  }

  postMessage(data: unknown): void {
    const event = { data } as MessageEvent;
    for (const peer of FakeBroadcastChannel.peers) {
      if (peer === this) continue;
      peer.listeners.forEach((listener) => listener(event));
    }
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (type === 'message') this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: (event: MessageEvent) => void): void {
    this.listeners.delete(listener);
  }

  close(): void {
    FakeBroadcastChannel.peers.delete(this);
  }
}

globalThis.BroadcastChannel = FakeBroadcastChannel as unknown as typeof BroadcastChannel;

/** A channel instance owned by the test, standing in for another tab */
const otherTab = () => new FakeBroadcastChannel('syntools-rich-text.docs');

let docId = '';

beforeEach(() => {
  localStorage.clear();
  docId = createDocId();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('saveDocument / loadDocument', () => {
  it('persists the document so the library list sees it right after the write', async () => {
    await saveDocument(docId, { title: '会议纪要', html: '<p>甲</p>' });

    const list = await listDocuments();
    expect(list.map((item) => item.id)).toContain(docId);

    const doc = await loadDocument(docId);
    expect(doc?.title).toBe('会议纪要');
    expect(doc?.html).toBe('<p>甲</p>');
    expect(doc?.schemaVersion).toBe(2);
    // Extension fields are backfilled on read, so callers never deal with undefined arrays
    expect(doc?.comments).toEqual([]);
    expect(doc?.changes).toEqual([]);
    expect(doc?.userWords).toEqual([]);
  });

  it('upserts: keeps createdAt, refreshes updatedAt and the content', async () => {
    const start = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(start);
    await saveDocument(docId, { title: '初稿', html: '<p>1</p>' });
    const first = await loadDocument(docId);

    vi.spyOn(Date, 'now').mockReturnValue(start + 5_000);
    await saveDocument(docId, { title: '二稿', html: '<p>2</p>' });
    const second = await loadDocument(docId);

    expect(second?.createdAt).toBe(first?.createdAt);
    expect(second?.updatedAt).toBe(start + 5_000);
    expect(second?.title).toBe('二稿');
    expect(second?.html).toBe('<p>2</p>');
    // Still a single record, not a duplicate
    expect((await listDocuments()).filter((item) => item.id === docId)).toHaveLength(1);
  });

  it('normalizes a legacy v1 record lazily on read instead of rewriting it in the upgrade', async () => {
    await putRaw('documents', {
      id: docId,
      title: '旧记录',
      html: '<p><span data-comment-id="c-1">甲</span></p>',
      createdAt: 1_600_000_000_000,
      updatedAt: 1_600_000_000_000,
    });

    const doc = await loadDocument(docId);
    expect(doc?.schemaVersion).toBe(2);
    expect(doc?.title).toBe('旧记录');
    // Comment metadata is recovered from the mark for v1 records
    expect(doc?.comments.map((comment) => comment.id)).toEqual(['c-1']);
  });
});

describe('version snapshots', () => {
  it('skips the automatic snapshot inside the 2 minute window, manual snapshots always land', async () => {
    const start = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(start);
    await saveDocument(docId, { title: 't', html: '<p>a</p>' });
    expect(await listVersions(docId)).toHaveLength(1);

    vi.spyOn(Date, 'now').mockReturnValue(start + 30_000);
    await saveDocument(docId, { title: 't', html: '<p>b</p>' });
    expect(await listVersions(docId)).toHaveLength(1);

    vi.spyOn(Date, 'now').mockReturnValue(start + VERSION_MIN_INTERVAL_MS + 1);
    await saveDocument(docId, { title: 't', html: '<p>c</p>' });
    const versions = await listVersions(docId);
    expect(versions).toHaveLength(2);
    // Newest first, and the snapshot carries the document content at that time
    expect(versions[0].html).toBe('<p>c</p>');

    // Advance the clock so the manual snapshot sorts above the automatic one
    vi.spyOn(Date, 'now').mockReturnValue(start + VERSION_MIN_INTERVAL_MS + 1_000);
    const manual = await saveManualVersion(docId, '定稿');
    expect(manual?.note).toBe('定稿');
    const after = await listVersions(docId);
    expect(after).toHaveLength(3);
    expect(after[0].note).toBe('定稿');
  });

  it('returns null for a manual snapshot of a missing document', async () => {
    await expect(saveManualVersion('missing-doc', 'x')).resolves.toBeNull();
  });

  it(`trims the oldest snapshots beyond ${MAX_VERSIONS}`, async () => {
    // Distinct savedAt values: the trim picks the oldest by timestamp, so a frozen clock would make it ambiguous
    const start = 1_700_000_000_000;
    const clock = vi.spyOn(Date, 'now');
    clock.mockReturnValue(start);
    await saveDocument(docId, { title: 't', html: '<p>0</p>' });
    for (let i = 0; i < MAX_VERSIONS + 5; i += 1) {
      clock.mockReturnValue(start + (i + 1) * 1_000);
      await saveManualVersion(docId, `v${i}`);
    }

    const versions = await listVersions(docId);
    expect(versions).toHaveLength(MAX_VERSIONS);
    // The newest snapshot survives, the oldest (the automatic one and early ones) are dropped
    expect(versions[0].note).toBe(`v${MAX_VERSIONS + 4}`);
    expect(versions[MAX_VERSIONS - 1].note).toBe('v5');
    expect(versions.some((version) => version.note === undefined)).toBe(false);
  });
});

describe('deleteDocument / duplicateDocument', () => {
  it('removes the document and its versions before resolving', async () => {
    await saveDocument(docId, { title: '待删除', html: '<p>x</p>' });
    await saveManualVersion(docId, '快照');
    expect(await listVersions(docId)).toHaveLength(2);

    await deleteDocument(docId);

    expect((await listDocuments()).some((item) => item.id === docId)).toBe(false);
    expect(await loadDocument(docId)).toBeNull();
    expect(await listVersions(docId)).toEqual([]);
  });

  it('duplicates content, page setup and review metadata under a new id', async () => {
    await saveDocument(docId, {
      title: '原件',
      html: '<p>内容</p>',
      zoom: 1.5,
      pdfMode: 'snapshot',
      comments: [
        { id: 'c-1', quote: '内容', text: '批注', author: 'A', createdAt: 1, resolved: false },
      ],
      changes: [],
      userWords: ['syntools'],
      templateId: 'report',
    });

    const cloneId = await duplicateDocument(docId, { untitled: '未命名文档', suffix: ' 副本' });
    expect(cloneId).not.toBeNull();
    expect(cloneId).not.toBe(docId);

    const clone = await loadDocument(cloneId as string);
    expect(clone?.title).toBe('原件 副本');
    expect(clone?.html).toBe('<p>内容</p>');
    expect(clone?.pageSetup).toEqual((await loadDocument(docId))?.pageSetup);
    expect(clone?.zoom).toBe(1.5);
    expect(clone?.pdfMode).toBe('snapshot');
    expect(clone?.comments).toHaveLength(1);
    expect(clone?.userWords).toEqual(['syntools']);
    expect(clone?.templateId).toBe('report');
  });

  it('names the duplicate with the labels the caller passes (no hardcoded language in the store)', async () => {
    await saveDocument(docId, { title: '', html: '<p>x</p>' });
    const cloneId = await duplicateDocument(docId, {
      untitled: 'Untitled document',
      suffix: ' copy',
    });

    const clone = await loadDocument(cloneId as string);
    expect(clone?.title).toBe('Untitled document copy');
  });

  it('returns null when duplicating a document that does not exist', async () => {
    await expect(
      duplicateDocument('missing-doc', { untitled: '未命名文档', suffix: ' 副本' }),
    ).resolves.toBeNull();
  });
});

describe('initDocStore', () => {
  it('restores the pointed-to document with its review metadata', async () => {
    await saveDocument(docId, {
      title: '上次编辑',
      html: '<p>继续</p>',
      pageSetup: { size: 'A4' },
      zoom: 1.25,
      comments: [
        { id: 'c-9', quote: '继续', text: '注', author: 'A', createdAt: 2, resolved: true },
      ],
      changes: [],
    });
    setCurrentDocId(docId);
    expect(readCurrentDocId()).toBe(docId);

    const init = await initDocStore();
    expect(init?.docId).toBe(docId);
    expect(init?.doc?.title).toBe('上次编辑');
    expect(init?.doc?.zoom).toBe(1.25);
    expect(init?.doc?.comments[0].id).toBe('c-9');
  });

  it('returns the pointer with a null document when it points at a deleted document', async () => {
    setCurrentDocId('gone-doc');

    const init = await initDocStore();
    expect(init).toEqual({ docId: 'gone-doc', doc: null });
  });

  it('migrates a legacy draft into the library and clears the old keys', async () => {
    localStorage.setItem(
      LEGACY_DRAFT_KEY,
      JSON.stringify({ title: '旧草稿', html: '<p>legacy</p>' }),
    );

    const init = await initDocStore();
    expect(init?.docId).toBe('legacy');
    expect(init?.doc?.title).toBe('旧草稿');
    expect((await listDocuments()).some((item) => item.id === 'legacy')).toBe(true);
    expect(localStorage.getItem(LEGACY_DRAFT_KEY)).toBeNull();

    // Migrated draft is upgraded to the current schema in localStorage as well
    const upgraded = JSON.parse(localStorage.getItem(DRAFT_KEY_V2) ?? '{}') as {
      schemaVersion?: number;
    };
    expect(upgraded.schemaVersion).toBe(2);
  });
});
describe('cross-tab events', () => {
  it('reports a save performed by another tab', () => {
    const events: DocStoreEvent[] = [];
    const unsubscribe = subscribeDocEvents((event) => events.push(event));

    otherTab().postMessage({ type: 'saved', id: 'doc-x', at: 111, tabId: 'other-tab' });

    expect(events).toEqual([{ type: 'saved', id: 'doc-x', at: 111, tabId: 'other-tab' }]);
    unsubscribe();
  });

  it('ignores the events this tab published itself', async () => {
    const events: DocStoreEvent[] = [];
    const unsubscribe = subscribeDocEvents((event) => events.push(event));

    await saveDocument(docId, { title: '本页保存', html: '<p>x</p>' });

    expect(events).toHaveLength(0);
    unsubscribe();
  });

  it('stops delivering after unsubscribe', () => {
    const events: DocStoreEvent[] = [];
    const unsubscribe = subscribeDocEvents((event) => events.push(event));
    unsubscribe();

    otherTab().postMessage({ type: 'deleted', id: 'doc-y', at: 222, tabId: 'other-tab' });

    expect(events).toEqual([]);
  });

  it('tolerates malformed payloads', () => {
    const events: DocStoreEvent[] = [];
    const unsubscribe = subscribeDocEvents((event) => events.push(event));

    otherTab().postMessage(null);
    otherTab().postMessage({ id: 42 });
    otherTab().postMessage({ type: 'saved', tabId: 'other-tab' });

    expect(events).toEqual([]);
    unsubscribe();
  });
});
