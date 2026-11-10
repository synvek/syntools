import { externalizeImages, hydrateImages } from './assets';
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
  /**
   * Optimistic-concurrency token: bumped on every successful write. A save can pass the revision it
   * started from, so a tab that edited a stale copy is rejected instead of overwriting newer content.
   */
  rev: number;
}

export interface SaveDocumentResult {
  ok: boolean;
  /** Revision after the write (unchanged value when the save was rejected) */
  rev: number;
  /** True when the caller's base revision was older than the stored one: nothing was written */
  conflict: boolean;
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

/**
 * Resolve only after the transaction commits: the write is durable before callers report success,
 * and commit failures (quota / abort) surface here instead of being swallowed by the request promise.
 */
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(storeName, mode);
  const result = await requestAs(run(tx.objectStore(storeName)));
  if (mode !== 'readonly') await txDone(tx);
  return result;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ *
 * Cross-tab notifications (same-origin BroadcastChannel, no server)
 * ------------------------------------------------------------------ */

/** Channel name: one per database, so every tab editing the library hears the same events */
const CHANNEL_NAME = 'syntools-rich-text.docs';
/** Identity of this tab: the receiver ignores events it published itself */
const TAB_ID = newId();

export interface DocStoreEvent {
  type: 'saved' | 'deleted';
  id: string;
  at: number;
  /** Tab that caused the change; receivers skip their own tab */
  tabId: string;
}

let channel: BroadcastChannel | null = null;

function broadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      channel = null;
    }
  }
  return channel;
}

function publish(event: Omit<DocStoreEvent, 'tabId'>): void {
  try {
    broadcastChannel()?.postMessage({ ...event, tabId: TAB_ID });
  } catch {
    // Ignore: other tabs simply miss the hint, persistence is unaffected
  }
}

/**
 * Listen for saves / deletes performed by **other** tabs, so a tab can warn about concurrent edits
 * instead of silently overwriting them. Returns an unsubscribe function.
 */
export function subscribeDocEvents(handler: (event: DocStoreEvent) => void): () => void {
  const ch = broadcastChannel();
  if (!ch) return () => {};
  const onMessage = (event: MessageEvent) => {
    const data = event.data as Partial<DocStoreEvent> | null;
    if (!data || typeof data !== 'object' || typeof data.id !== 'string') return;
    if (data.tabId === TAB_ID) return;
    handler({
      type: data.type === 'deleted' ? 'deleted' : 'saved',
      id: data.id,
      at: typeof data.at === 'number' ? data.at : Date.now(),
      tabId: typeof data.tabId === 'string' ? data.tabId : '',
    });
  };
  ch.addEventListener('message', onMessage);
  return () => ch.removeEventListener('message', onMessage);
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
  // Records written before the lock existed start at revision 1
  const rev = readPositiveNumber(raw.rev) || 1;
  return { id, ...migrated.value, createdAt, updatedAt, rev };
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

/** Read a document exactly as stored (image references still unresolved) */
async function readRawDocument(id: string): Promise<StoredDocument | null> {
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

/** Load a single document (normalized to v2, images resolved back to data URLs); null on failure */
export async function loadDocument(id: string): Promise<StoredDocument | null> {
  const doc = await readRawDocument(id);
  if (!doc) return null;
  // Editors, print and PDF all expect a plain src, so hydration happens at the read boundary
  return { ...doc, html: await hydrateImages(doc.html) };
}

/** Fields that decide whether a save would change anything (bookkeeping fields excluded) */
const PAYLOAD_FIELDS = [
  'title',
  'html',
  'view',
  'zoom',
  'pdfMode',
  'pageSetup',
  'comments',
  'changes',
  'userWords',
  'templateId',
] as const;

function samePayload(a: RichTextDraftV2, b: RichTextDraftV2): boolean {
  return PAYLOAD_FIELDS.every(
    (field) => JSON.stringify(a[field] ?? null) === JSON.stringify(b[field] ?? null),
  );
}

/**
 * Save a document (upsert) and create a version snapshot per the interval.
 * `options.baseRev` enables the optimistic lock: when the stored revision moved on (another tab
 * saved in the meantime) the write is refused and `conflict` comes back, so newer content is never
 * silently overwritten. Without `baseRev` the write is unconditional (migration / duplication).
 */
export async function saveDocument(
  id: string,
  draft: RichTextDraftInput,
  options: { baseRev?: number } = {},
): Promise<SaveDocumentResult> {
  try {
    const now = Date.now();
    const existing = await readRawDocument(id);
    if (typeof options.baseRev === 'number' && existing && options.baseRev !== existing.rev) {
      return { ok: false, rev: existing.rev, conflict: true };
    }

    const normalized = toDraftV2(draft);
    const doc: StoredDocument = {
      id,
      ...normalized,
      // Images leave the document payload here; on failure the base64 simply stays inline
      html: await externalizeImages(normalized.html),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      rev: (existing?.rev ?? 0) + 1,
    };

    // Nothing actually changed (e.g. a tab that just opened and re-applied the loaded content):
    // writing anyway would bump the revision and turn every other open tab into a stale writer
    if (existing && samePayload(existing, doc)) {
      return { ok: true, rev: existing.rev, conflict: false };
    }

    await withStore(DOC_STORE, 'readwrite', (store) => store.put(doc));
    await pushVersion(doc, now);
    // Only after the write is committed: other tabs must not reload a document that isn't stored yet
    publish({ type: 'saved', id, at: now });
    return { ok: true, rev: doc.rev, conflict: false };
  } catch {
    // IndexedDB unavailable: ignore (the localStorage draft still covers it)
    return { ok: false, rev: options.baseRev ?? 0, conflict: false };
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
  const versions = await readRawVersions(version.docId);
  const db = await openDb();
  const tx = db.transaction(VER_STORE, 'readwrite');
  const store = tx.objectStore(VER_STORE);
  store.put(version);
  versions.slice(MAX_VERSIONS - 1).forEach((stale) => store.delete(stale.id));
  await txDone(tx);
}

async function pushVersion(doc: StoredDocument, now: number): Promise<void> {
  const versions = await readRawVersions(doc.id);
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
    // Raw read: the snapshot keeps asset references instead of re-inlining the images
    const doc = await readRawDocument(docId);
    if (!doc) return null;
    const version = buildVersion(doc, Date.now(), note);
    await putVersionBounded(version);
    return version;
  } catch {
    return null;
  }
}

/** Read the snapshots exactly as stored (image references still unresolved) */
async function readRawVersions(docId: string): Promise<StoredVersion[]> {
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

/** List a document's version snapshots (newest first, images resolved); normalized to v2 */
export async function listVersions(docId: string): Promise<StoredVersion[]> {
  const raw = await readRawVersions(docId);
  // Restoring a snapshot puts the HTML back into the editor, so the images must be readable again
  return Promise.all(
    raw.map(async (version) => ({ ...version, html: await hydrateImages(version.html) })),
  );
}

export async function deleteDocument(id: string): Promise<void> {
  try {
    await withStore(DOC_STORE, 'readwrite', (store) => store.delete(id));
    const versions = await listVersions(id);
    if (versions.length === 0) return;
    const db = await openDb();
    const tx = db.transaction(VER_STORE, 'readwrite');
    versions.forEach((version) => tx.objectStore(VER_STORE).delete(version.id));
    await txDone(tx);
    publish({ type: 'deleted', id, at: Date.now() });
  } catch {
    // Ignore
  }
}

/**
 * Duplicate a document (keeping page setup, comments and tracked changes); returns the new id (null on failure).
 * The store layer has no i18n: the caller passes the already-localized untitled label and suffix,
 * so a duplicate in an English UI does not end up with a Chinese title.
 */
export async function duplicateDocument(
  id: string,
  labels: { untitled: string; suffix: string },
): Promise<string | null> {
  const source = await loadDocument(id);
  if (!source) return null;
  const cloneId = newId();
  await saveDocument(cloneId, {
    ...source,
    title: `${source.title || labels.untitled}${labels.suffix}`,
  });
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
