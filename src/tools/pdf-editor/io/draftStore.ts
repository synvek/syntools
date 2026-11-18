/**
 * Draft storage (M1-8): the last unsaved edits of a document, kept in IndexedDB.
 *
 * Rules:
 * - One record per `source.fingerprint`; `rev` grows on every write so two tabs can detect a race.
 * - The original bytes live in their own `ArrayBuffer` field (never base64, never inside the JSON
 *   model) and the password is never written: encrypted files are not drafted at all.
 * - Storage pressure degrades to a *model only* record (`sourceBytes: null`); restoring such a
 *   draft requires re-picking the same file, which the editor then matches by fingerprint.
 * - Nothing here throws: quota/tooling failures come back as `ToolResult` so the editor can stay quiet.
 */

import type { ToolResult } from '@/core/types';
import { visiblePageCount } from '../model/doc';
import type { PdfEditorDoc, PdfSource } from '../model/types';

const DB_NAME = 'syntools-pdf-editor';
const STORE = 'drafts';
const DB_VERSION = 1;

/** Keep the newest few documents; stale drafts are the first thing to drop */
const MAX_DRAFTS = 5;
/** Never eat the last bytes of the origin quota */
const HEADROOM_FACTOR = 3;

/** The document without its source: bytes and password must not enter the record */
export type DraftModel = Omit<PdfEditorDoc, 'source'>;

export interface DraftRecord {
  fingerprint: string;
  name: string;
  /** Incremented on every write; the caller passes the last seen value to detect other tabs */
  rev: number;
  updatedAt: number;
  pageCount: number;
  model: DraftModel;
  /**
   * Original bytes. `ArrayBuffer` rather than `Blob`: both are structured-cloneable, but only the
   * buffer survives every IndexedDB implementation (and `fake-indexeddb` in tests).
   * `null` when only the model was saved (restore needs the file re-picked).
   */
  sourceBytes: ArrayBuffer | null;
}

export type DraftSaveResult = {
  rev: number;
  /** `true` when only the model was stored (quota guard) */
  modelOnly: boolean;
};

/* -------------------------------------------------------------------------- */
/* IndexedDB plumbing                                                          */
/* -------------------------------------------------------------------------- */

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'fingerprint' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    // Private mode / blocked upgrade: drafting is best effort, the editor keeps working
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

function transactionDone(tx: IDBTransaction): Promise<boolean> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

async function readAll(db: IDBDatabase): Promise<DraftRecord[]> {
  const tx = db.transaction(STORE, 'readonly');
  const rows = await requestToPromise(tx.objectStore(STORE).getAll() as IDBRequest<DraftRecord[]>);
  return rows ?? [];
}

async function readOne(db: IDBDatabase, fingerprint: string): Promise<DraftRecord | null> {
  const tx = db.transaction(STORE, 'readonly');
  return requestToPromise(
    tx.objectStore(STORE).get(fingerprint) as IDBRequest<DraftRecord | undefined>,
  ).then((row) => row ?? null);
}

/* -------------------------------------------------------------------------- */
/* Serialization                                                               */
/* -------------------------------------------------------------------------- */

/** Copy the document without `source` (bytes stay in the Blob, password never persists) */
export function serializeDoc(doc: PdfEditorDoc): DraftModel {
  const model = { ...doc } as Partial<PdfEditorDoc>;
  delete model.source;
  return model as DraftModel;
}

/** Rebuild the document from a stored model plus the bytes the editor just opened */
export function applyDraftModel(model: DraftModel, source: PdfSource): PdfEditorDoc {
  return { ...model, source };
}

/* -------------------------------------------------------------------------- */
/* Quota                                                                       */
/* -------------------------------------------------------------------------- */

async function hasHeadroom(bytes: number): Promise<boolean> {
  const storage = globalThis.navigator?.storage;
  if (!storage?.estimate) return true;
  try {
    const { quota = 0, usage = 0 } = await storage.estimate();
    if (!quota) return true;
    return quota - usage > bytes * HEADROOM_FACTOR;
  } catch {
    return true;
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Write (or overwrite) the draft of `doc`.
 *
 * `baseRev` is the revision this tab last wrote; when the stored record is newer, another tab won
 * the race and the caller gets `CONFLICT` instead of silently clobbering it.
 */
export async function putDraft(
  doc: PdfEditorDoc,
  options: { baseRev?: number; bytes?: Uint8Array } = {},
): Promise<ToolResult<DraftSaveResult>> {
  const { fingerprint } = doc.source;
  if (!fingerprint) return { ok: false, error: 'UNAVAILABLE' };
  // Passwords are memory-only, so an encrypted file cannot be reopened after a reload
  if (doc.source.encrypted) return { ok: false, error: 'SKIPPED' };

  const db = await openDb();
  if (!db) return { ok: false, error: 'UNAVAILABLE' };

  const stored = await readOne(db, fingerprint);
  if (options.baseRev !== undefined && stored && stored.rev !== options.baseRev) {
    return { ok: false, error: 'CONFLICT' };
  }

  let sourceBytes: ArrayBuffer | null = null;
  let modelOnly = true;
  if (options.bytes && (await hasHeadroom(options.bytes.length))) {
    // Own copy: the caller's view may be transferred to the pdfjs worker later
    sourceBytes = new Uint8Array(options.bytes).buffer;
    modelOnly = false;
  }

  const record: DraftRecord = {
    fingerprint,
    name: doc.name,
    rev: (stored?.rev ?? 0) + 1,
    updatedAt: Date.now(),
    pageCount: visiblePageCount(doc),
    model: serializeDoc(doc),
    sourceBytes,
  };

  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(record);
  if (!(await transactionDone(tx))) return { ok: false, error: 'FAILED' };

  await pruneDrafts(db);
  return { ok: true, value: { rev: record.rev, modelOnly } };
}

async function pruneDrafts(db: IDBDatabase): Promise<void> {
  const rows = await readAll(db);
  if (rows.length <= MAX_DRAFTS) return;
  const stale = rows
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(MAX_DRAFTS)
    .map((row) => row.fingerprint);

  const tx = db.transaction(STORE, 'readwrite');
  for (const fingerprint of stale) tx.objectStore(STORE).delete(fingerprint);
  await transactionDone(tx);
}

/** Most recent draft, used for the "continue where you left off" prompt */
export async function latestDraft(): Promise<DraftRecord | null> {
  const db = await openDb();
  if (!db) return null;
  const rows = await readAll(db);
  return rows.sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
}

export async function getDraft(fingerprint: string): Promise<DraftRecord | null> {
  const db = await openDb();
  if (!db) return null;
  return readOne(db, fingerprint);
}

export async function deleteDraft(fingerprint: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(fingerprint);
  await transactionDone(tx);
}

/** Bytes for a resumable draft; `null` for model-only records */
export function readDraftBytes(record: DraftRecord): Uint8Array | null {
  if (!record.sourceBytes) return null;
  return new Uint8Array(record.sourceBytes);
}

/** Drop every draft (tests, and a future "clear local data" action) */
export async function resetDraftStore(): Promise<void> {
  const db = await openDb();
  if (db) db.close();
  dbPromise = null;
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
