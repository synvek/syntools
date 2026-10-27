import { readDraft } from './draft';
import type { WorkbookSnapshot } from './xlsx-io';

/**
 * Local workbook document library (IndexedDB): multi-document management + version history.
 * Content never leaves the device; when IndexedDB is unavailable every API degrades silently (the
 * localStorage draft still acts as a fallback).
 */

export interface StoredWorkbook {
  id: string;
  title: string;
  snapshot: WorkbookSnapshot;
  createdAt: number;
  updatedAt: number;
}

export interface StoredVersion {
  id: string;
  docId: string;
  title: string;
  snapshot: WorkbookSnapshot;
  savedAt: number;
}

export interface DocMeta {
  id: string;
  title: string;
  updatedAt: number;
}

const DB_NAME = 'syntools-spreadsheet';
const DB_VERSION = 1;
const DOC_STORE = 'documents';
const VER_STORE = 'versions';
/** Max version snapshots kept per workbook */
const MAX_VERSIONS = 20;
/** Minimum gap between version snapshots (2 minutes) so not every edit creates one */
const VERSION_MIN_INTERVAL_MS = 120_000;
/** Current-document pointer: restores the last-edited workbook after a reload */
const CURRENT_KEY = 'syntools:spreadsheet-editor.current.v1';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DOC_STORE)) {
          db.createObjectStore(DOC_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(VER_STORE)) {
          const store = db.createObjectStore(VER_STORE, { keyPath: 'id' });
          store.createIndex('docId', 'docId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error ?? new Error('IndexedDB unavailable'));
      };
    });
  }
  return dbPromise;
}

function requestAs<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return requestAs(run(db.transaction(storeName, mode).objectStore(storeName)));
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `wb-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** List all workbooks (newest update first); returns an empty list on failure */
export async function listDocuments(): Promise<DocMeta[]> {
  try {
    const all = await withStore<StoredWorkbook[]>(
      DOC_STORE,
      'readonly',
      (store) => store.getAll() as IDBRequest<StoredWorkbook[]>,
    );
    return all
      .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/** Load a single workbook; null on failure */
export async function loadDocument(id: string): Promise<StoredWorkbook | null> {
  try {
    const doc = await withStore<StoredWorkbook | undefined>(
      DOC_STORE,
      'readonly',
      (store) => store.get(id) as IDBRequest<StoredWorkbook | undefined>,
    );
    return doc ?? null;
  } catch {
    return null;
  }
}

/** Save a workbook (upsert) and push a version snapshot when the interval allows */
export async function saveDocument(
  id: string,
  title: string,
  snapshot: WorkbookSnapshot,
): Promise<void> {
  try {
    const now = Date.now();
    const existing = await loadDocument(id);
    const doc: StoredWorkbook = {
      id,
      title,
      snapshot,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await withStore(DOC_STORE, 'readwrite', (store) => store.put(doc));
    await pushVersion(doc, now);
  } catch {
    // IndexedDB unavailable: ignore it (the localStorage draft still covers us)
  }
}

async function pushVersion(doc: StoredWorkbook, now: number): Promise<void> {
  const versions = await listVersions(doc.id);
  const latest = versions[0];
  if (latest && now - latest.savedAt < VERSION_MIN_INTERVAL_MS) return;
  const version: StoredVersion = {
    id: `${doc.id}-${now}-${Math.random().toString(36).slice(2, 8)}`,
    docId: doc.id,
    title: doc.title,
    snapshot: doc.snapshot,
    savedAt: now,
  };
  const db = await openDb();
  const tx = db.transaction(VER_STORE, 'readwrite');
  const store = tx.objectStore(VER_STORE);
  store.put(version);
  versions.slice(MAX_VERSIONS - 1).forEach((stale) => store.delete(stale.id));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('version tx failed'));
  });
}

/** List a workbook's version snapshots (newest first) */
export async function listVersions(docId: string): Promise<StoredVersion[]> {
  try {
    const db = await openDb();
    const store = db.transaction(VER_STORE, 'readonly').objectStore(VER_STORE);
    const index = store.index('docId');
    const all = await requestAs(index.getAll(docId) as IDBRequest<StoredVersion[]>);
    return all.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function deleteDocument(id: string): Promise<void> {
  try {
    await withStore(DOC_STORE, 'readwrite', (store) => store.delete(id));
    const versions = await listVersions(id);
    const db = await openDb();
    const tx = db.transaction(VER_STORE, 'readwrite');
    versions.forEach((version) => tx.objectStore(VER_STORE).delete(version.id));
  } catch {
    // Ignore
  }
}

/** Duplicate a workbook and return the new document id (null on failure) */
export async function duplicateDocument(id: string): Promise<string | null> {
  const source = await loadDocument(id);
  if (!source) return null;
  const cloneId = newId();
  await saveDocument(cloneId, `${source.title || '未命名工作簿'} 副本`, source.snapshot);
  return cloneId;
}

export function setCurrentDocId(id: string): void {
  try {
    localStorage.setItem(CURRENT_KEY, id);
  } catch {
    // Ignore
  }
}

export function readCurrentDocId(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

export interface DocStoreInit {
  /** Document id that should be resumed */
  docId: string;
  /** Document content to restore (null means only the id is recorded) */
  doc: StoredWorkbook | null;
}

/**
 * Initialise: prefer the document the pointer refers to; otherwise migrate the localStorage v1
 * single-document draft into the library as its first entry (one-off).
 */
export async function initDocStore(): Promise<DocStoreInit | null> {
  const docs = await listDocuments();
  const pointer = readCurrentDocId();
  if (pointer && docs.some((doc) => doc.id === pointer)) {
    return { docId: pointer, doc: await loadDocument(pointer) };
  }
  const legacy = readDraft();
  if (legacy && legacy.sheetOrder?.length) {
    const docId = 'legacy';
    await saveDocument(docId, legacy.name ?? '', legacy);
    setCurrentDocId(docId);
    return { docId, doc: await loadDocument(docId) };
  }
  if (pointer) return { docId: pointer, doc: null };
  return null;
}

export { newId as createDocId };
