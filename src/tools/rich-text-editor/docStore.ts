import { clearLegacyDraft, readDraft } from './draft';
import {
  CURRENT_SCHEMA_VERSION,
  isPlainObject,
  migrateDraft,
  readPositiveNumber,
  toDraftV2,
  type RichTextDraftInput,
  type RichTextDraftV2,
} from './migrate';

/**
 * Local document library (IndexedDB): multi-document management + version history.
 * Content never leaves the machine; when IndexedDB is unavailable every API degrades silently
 * (the localStorage draft still acts as a fallback).
 *
 * The schema version evolves with the draft: bumping DB_VERSION only advances the number and relies on
 * lazy backfill at read time (no bulk rewrite of old records), so an upgrade can't corrupt user data.
 */

export interface StoredDocument extends RichTextDraftV2 {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoredVersion extends RichTextDraftV2 {
  id: string;
  docId: string;
  savedAt: number;
  /** User note for a manual snapshot (undefined for automatic snapshots) */
  note?: string;
}

export interface DocMeta {
  id: string;
  title: string;
  updatedAt: number;
}

const DB_NAME = 'syntools-rich-text';
/** v2: draft schema gains comments / tracked changes / custom dictionary / template id (backfilled lazily on read) */
const DB_VERSION = 2;
const DOC_STORE = 'documents';
const VER_STORE = 'versions';
/** Maximum number of version snapshots kept per document */
const MAX_VERSIONS = 20;
/** Minimum interval between version snapshots (2 minutes), so typing doesn't create one every time */
const VERSION_MIN_INTERVAL_MS = 120_000;
/** Current-document pointer: restores the last edited document after a refresh */
const CURRENT_KEY = 'syntools:rich-text-editor.current.v2';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        // Only create missing stores: old records in existing stores are normalized on read,
        // and no failure-prone bulk rewrite happens inside the upgrade transaction
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
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ *
 * Read normalization (v1 records lazily backfilled to v2)
 * ------------------------------------------------------------------ */

function toStoredDocument(raw: unknown): StoredDocument | null {
  if (!isPlainObject(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id) return null;
  // migrateDraft uses schemaVersion to decide whether to derive review info from the HTML
  const migrated = migrateDraft(raw);
  if (!migrated.ok) return null;
  const createdAt = readPositiveNumber(raw.createdAt);
  const updatedAt = readPositiveNumber(raw.updatedAt) || createdAt || Date.now();
  return { id, ...migrated.value, createdAt, updatedAt };
}

function toStoredVersion(raw: unknown): StoredVersion | null {
  if (!isPlainObject(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id : '';
  const docId = typeof raw.docId === 'string' ? raw.docId : '';
  if (!id || !docId) return null;
  const migrated = migrateDraft(raw);
  if (!migrated.ok) return null;
  const note = typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : undefined;
  return {
    id,
    docId,
    ...migrated.value,
    savedAt: readPositiveNumber(raw.savedAt) || Date.now(),
    note,
  };
}

function toDocMeta(raw: unknown): DocMeta | null {
  const doc = toStoredDocument(raw);
  if (!doc) return null;
  return { id: doc.id, title: doc.title, updatedAt: doc.updatedAt };
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/** List all documents (newest update first); returns an empty list on failure */
export async function listDocuments(): Promise<DocMeta[]> {
  try {
    const all = await withStore<unknown[]>(
      DOC_STORE,
      'readonly',
      (store) => store.getAll() as IDBRequest<unknown[]>,
    );
    return all
      .map((item) => toDocMeta(item))
      .filter((item): item is DocMeta => item !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/** Load a single document (normalized to v2); returns null on failure */
export async function loadDocument(id: string): Promise<StoredDocument | null> {
  try {
    const raw = await withStore<unknown>(
      DOC_STORE,
      'readonly',
      (store) => store.get(id) as IDBRequest<unknown>,
    );
    return toStoredDocument(raw);
  } catch {
    return null;
  }
}

/** Save a document (upsert) and create a version snapshot per the interval */
export async function saveDocument(id: string, draft: RichTextDraftInput): Promise<void> {
  try {
    const now = Date.now();
    const existing = await loadDocument(id);
    const doc: StoredDocument = {
      id,
      ...toDraftV2(draft),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await withStore(DOC_STORE, 'readwrite', (store) => store.put(doc));
    await pushVersion(doc, now);
  } catch {
    // IndexedDB unavailable: ignore (the localStorage draft still covers it)
  }
}

function buildVersion(doc: StoredDocument, savedAt: number, note?: string): StoredVersion {
  return {
    id: `${doc.id}-${savedAt}-${Math.random().toString(36).slice(2, 8)}`,
    docId: doc.id,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: doc.title,
    html: doc.html,
    view: doc.view,
    zoom: doc.zoom,
    pdfMode: doc.pdfMode,
    pageSetup: doc.pageSetup,
    comments: doc.comments,
    changes: doc.changes,
    userWords: doc.userWords,
    templateId: doc.templateId,
    savedAt,
    note,
  };
}

/** Write a snapshot and trim old ones beyond the cap */
async function putVersionBounded(version: StoredVersion): Promise<void> {
  const versions = await listVersions(version.docId);
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

async function pushVersion(doc: StoredDocument, now: number): Promise<void> {
  const versions = await listVersions(doc.id);
  const latest = versions[0];
  if (latest && now - latest.savedAt < VERSION_MIN_INTERVAL_MS) return;
  await putVersionBounded(buildVersion(doc, now));
}

/**
 * Manual snapshot: not subject to the automatic snapshot interval, optionally with a note.
 * Used where an explicit archive is needed, e.g. before saving or finalizing for delivery.
 */
export async function saveManualVersion(
  docId: string,
  note?: string,
): Promise<StoredVersion | null> {
  try {
    const doc = await loadDocument(docId);
    if (!doc) return null;
    const version = buildVersion(doc, Date.now(), note);
    await putVersionBounded(version);
    return version;
  } catch {
    return null;
  }
}

/** List a document's version snapshots (newest first, including current content); normalized to v2 */
export async function listVersions(docId: string): Promise<StoredVersion[]> {
  try {
    const db = await openDb();
    const store = db.transaction(VER_STORE, 'readonly').objectStore(VER_STORE);
    const index = store.index('docId');
    const all = await requestAs(index.getAll(docId) as IDBRequest<unknown[]>);
    return all
      .map((item) => toStoredVersion(item))
      .filter((item): item is StoredVersion => item !== null)
      .sort((a, b) => b.savedAt - a.savedAt);
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

/** Duplicate a document (keeping page setup, comments and tracked changes); returns the new id (null on failure) */
export async function duplicateDocument(id: string): Promise<string | null> {
  const source = await loadDocument(id);
  if (!source) return null;
  const cloneId = newId();
  await saveDocument(cloneId, { ...source, title: `${source.title || '未命名文档'} 副本` });
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
  /** Id of the document to restore for editing */
  docId: string;
  /** Document content to restore (null means only the id is recorded) */
  doc: StoredDocument | null;
}

/**
 * Initialize: restore the document the pointer refers to when possible; otherwise migrate the
 * localStorage v1/v2 single-document draft into the library as the first document (one-off) and
 * clean up the old key.
 */
export async function initDocStore(): Promise<DocStoreInit | null> {
  const pointer = readCurrentDocId();
  if (pointer) {
    const doc = await loadDocument(pointer);
    if (doc) return { docId: pointer, doc };
    // The document was deleted but the pointer remains: fall through to the draft migration below
  }
  const legacy = readDraft();
  if (legacy && (legacy.html !== '<p></p>' || legacy.title || legacy.comments.length > 0)) {
    const docId = 'legacy';
    await saveDocument(docId, legacy);
    setCurrentDocId(docId);
    clearLegacyDraft();
    return { docId, doc: await loadDocument(docId) };
  }
  if (pointer) return { docId: pointer, doc: null };
  return null;
}

export { newId as createDocId };
