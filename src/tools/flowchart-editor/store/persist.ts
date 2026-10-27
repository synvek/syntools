/**
 * Local persistence for the flowchart editor (IndexedDB).
 *
 * Why not localStorage: it holds about 5MB, is synchronous and blocks, and image dataURLs would very easily trigger
 * the "drop images" downgrade in `draft.ts`. IndexedDB has a large quota, is asynchronous and stores structured data,
 * so it can hold all three kinds of data: the full draft (images included), named snapshots and session settings.
 *
 * Fallback strategy: when IndexedDB is unavailable (private mode / test environment / old browsers) every API degrades silently—
 * reads return empty values and writes return false / no-op, never throwing into the editing flow;
 * the draft still falls back to the localStorage implementation in `draft.ts`.
 */

import { activePageOf, migrateDoc } from '../model/migrate';
import type { LayoutDensity, LayoutDirection } from '../layout';
import type { ThemeId } from '../model/themes';
import type { CanvasGuide, FlowDoc, GridStyle, WheelMode } from '../model/types';

/** Same shape as store.SnapshotRec; declared here separately to avoid a store ↔ persist circular dependency */
export interface PersistedSnapshot {
  id: string;
  name: string;
  doc: FlowDoc;
  savedAt: number;
}

/** Side panel key (matching PanelKey in FlowchartTool) */
export type PersistedPanelKey = 'prop' | 'arrange' | 'layer' | 'history' | 'search';

/** Session settings: grid / layout / alignment threshold / theme / side panel / canvas appearance */
export interface PersistedSession {
  gridEnabled: boolean;
  gridSize: number;
  layoutDirection: LayoutDirection;
  layoutDensity: LayoutDensity;
  alignTolerance: number;
  theme?: ThemeId;
  panel?: PersistedPanelKey;
  /** Mouse wheel behavior: pan (default) / zoom */
  wheelMode?: WheelMode;
  /** Canvas background color (`transparent` means transparent) */
  canvasBackground?: string;
  /** Grid style */
  gridStyle?: GridStyle;
  /** Persistent guides (can be pulled out manually) */
  guides?: CanvasGuide[];
  /** Whether to show the rulers */
  rulersVisible?: boolean;
}

const DB_NAME = 'syntools-flowchart-editor';
const DB_VERSION = 1;
const DRAFT_STORE = 'draft';
const SNAPSHOT_STORE = 'snapshots';
const SESSION_STORE = 'settings';
const DRAFT_KEY = 'current';
const SNAPSHOT_KEY = 'list';
const SESSION_KEY = 'session';

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) return Promise.reject(new Error('IndexedDB unavailable'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        // Only missing stores are created; no bulk rewrite inside the upgrade transaction, avoiding damage to existing data
        if (!db.objectStoreNames.contains(DRAFT_STORE)) db.createObjectStore(DRAFT_STORE);
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE);
        if (!db.objectStoreNames.contains(SESSION_STORE)) db.createObjectStore(SESSION_STORE);
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

async function readKey<T>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await openDb();
    const raw = await requestAs(
      db.transaction(storeName, 'readonly').objectStore(storeName).get(key),
    );
    return (raw as T | undefined) ?? null;
  } catch {
    return null;
  }
}

async function writeKey(storeName: string, key: string, value: unknown): Promise<boolean> {
  try {
    const db = await openDb();
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value, key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB tx failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB tx aborted'));
    });
    return true;
  } catch {
    return false;
  }
}

async function deleteKey(storeName: string, key: string): Promise<void> {
  try {
    const db = await openDb();
    await requestAs(db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key));
  } catch {
    // IndexedDB unavailable: ignore
  }
}

/* ------------------------------ Draft ------------------------------ */

/** Read the full draft (images included); returns null when there is none or it is unavailable */
export async function loadPersistedDoc(): Promise<FlowDoc | null> {
  const raw = await readKey<{ doc?: unknown }>(DRAFT_STORE, DRAFT_KEY);
  if (!raw || typeof raw !== 'object') return null;
  return migrateDoc(raw.doc);
}

/** Write the full draft (images kept); returns whether it was persisted. An empty document counts as "clear the draft" */
export async function savePersistedDoc(doc: FlowDoc): Promise<boolean> {
  const page = activePageOf(doc);
  if (!page || page.nodes.length === 0) {
    await deleteKey(DRAFT_STORE, DRAFT_KEY);
    return false;
  }
  return writeKey(DRAFT_STORE, DRAFT_KEY, { doc, savedAt: Date.now() });
}

export async function clearPersistedDoc(): Promise<void> {
  await deleteKey(DRAFT_STORE, DRAFT_KEY);
}

/* ------------------------------ Snapshots ------------------------------ */

/** Read the named snapshot list (images included, normalized to v2); returns an empty array when there are no records or it is unavailable */
export async function loadPersistedSnapshots(): Promise<PersistedSnapshot[]> {
  const raw = await readKey<unknown>(SNAPSHOT_STORE, SNAPSHOT_KEY);
  if (!Array.isArray(raw)) return [];
  const out: PersistedSnapshot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as { id?: unknown; name?: unknown; doc?: unknown; savedAt?: unknown };
    if (typeof rec.id !== 'string' || typeof rec.name !== 'string') continue;
    const doc = migrateDoc(rec.doc);
    if (!doc) continue;
    out.push({
      id: rec.id,
      name: rec.name,
      doc,
      savedAt: typeof rec.savedAt === 'number' ? rec.savedAt : Date.now(),
    });
  }
  return out;
}

export async function savePersistedSnapshots(list: PersistedSnapshot[]): Promise<boolean> {
  return writeKey(SNAPSHOT_STORE, SNAPSHOT_KEY, list);
}

/* ------------------------------ Session settings ------------------------------ */

export async function loadPersistedSession(): Promise<Partial<PersistedSession> | null> {
  const raw = await readKey<unknown>(SESSION_STORE, SESSION_KEY);
  if (!raw || typeof raw !== 'object') return null;
  return raw as Partial<PersistedSession>;
}

/** Merge-write session settings (only the given fields are overwritten, so different call sites do not clear each other) */
export async function savePersistedSession(patch: Partial<PersistedSession>): Promise<boolean> {
  const current = (await loadPersistedSession()) ?? {};
  return writeKey(SESSION_STORE, SESSION_KEY, { ...current, ...patch });
}

/** For tests only: reset the cached database connection to isolate cases */
export function __resetPersistDb(): void {
  dbPromise = null;
}
