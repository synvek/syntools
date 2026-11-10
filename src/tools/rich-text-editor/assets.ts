/**
 * Embedded images live outside the document payload (implementation plan P1-6).
 *
 * A pasted data URL is megabytes of base64. Keeping it inline meant every autosave, every version
 * snapshot and every localStorage draft carried the same bytes again, and the 10MB draft budget was
 * burned by a single screenshot. Images are moved into their own IndexedDB store; the document keeps
 * a stable `syntools-asset:<id>` reference and readers get the data URL back, so the editor, print,
 * PDF and export paths keep seeing a plain `src` value.
 *
 * Everything degrades to the original HTML: if IndexedDB is unavailable the base64 stays inline,
 * exactly like before this module existed.
 */

const DB_NAME = 'syntools-rich-text-assets';
const DB_VERSION = 1;
const STORE = 'assets';

export const ASSET_REF_PREFIX = 'syntools-asset:';

export interface StoredAsset {
  id: string;
  mime: string;
  /** Decoded size in bytes, for diagnostics / future quota accounting */
  bytes: number;
  dataUrl: string;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    // Only create the missing store: existing records are never rewritten here
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () => reject(new Error('IndexedDB blocked'));
  }).catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function requestAs<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

/**
 * FNV-1a over the data URL: the same image pasted twice keeps one record instead of piling up
 * copies, and the reference stays stable across saves (so diffs and version snapshots stay small).
 */
function contentId(dataUrl: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < dataUrl.length; index += 1) {
    hash ^= dataUrl.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `img-${hash.toString(36)}-${dataUrl.length.toString(36)}`;
}

export function isAssetRef(src: string): boolean {
  return src.startsWith(ASSET_REF_PREFIX);
}

/** Approximate decoded size of a base64 payload (exact enough for diagnostics) */
function base64Bytes(payload: string): number {
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

async function putAsset(id: string, mime: string, dataUrl: string): Promise<boolean> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const record: StoredAsset = {
      id,
      mime,
      bytes: base64Bytes(dataUrl.slice(dataUrl.indexOf(',') + 1)),
      dataUrl,
      createdAt: Date.now(),
    };
    tx.objectStore(STORE).put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('asset write failed'));
      tx.onabort = () => reject(tx.error ?? new Error('asset write aborted'));
    });
    return true;
  } catch {
    return false;
  }
}

/** Read one asset back as a data URL (null when missing or IndexedDB is unavailable) */
export async function getAssetDataUrl(ref: string): Promise<string | null> {
  try {
    const db = await openDb();
    const record = await requestAs<StoredAsset | undefined>(
      db.transaction(STORE, 'readonly').objectStore(STORE).get(ref) as IDBRequest<
        StoredAsset | undefined
      >,
    );
    return typeof record?.dataUrl === 'string' ? record.dataUrl : null;
  } catch {
    return null;
  }
}

const IMG_SRC = /(<img\b[^>]*?\bsrc=)(["'])(data:image\/([a-zA-Z0-9.+-]+);base64,[^"']+)\2/gi;
const REF_SRC = /(<img\b[^>]*?\bsrc=)(["'])(syntools-asset:[^"']+)\2/gi;

/**
 * Replace inline `data:image/...` sources with asset references.
 * Returns the HTML unchanged when there is nothing to move or when storage fails (base64 fallback).
 */
export async function externalizeImages(html: string): Promise<string> {
  if (!html.includes('data:image/')) return html;

  const refs = new Map<string, string>();
  for (const match of html.matchAll(IMG_SRC)) {
    const dataUrl = match[3];
    const mime = match[4];
    if (refs.has(dataUrl)) continue;
    const ref = `${ASSET_REF_PREFIX}${contentId(dataUrl)}`;
    if (await putAsset(ref, mime, dataUrl)) refs.set(dataUrl, ref);
  }
  if (refs.size === 0) return html;

  return html.replace(IMG_SRC, (whole: string, prefix: string, quote: string, dataUrl: string) => {
    const ref = refs.get(dataUrl);
    return ref ? `${prefix}${quote}${ref}${quote}` : whole;
  });
}

/**
 * Resolve asset references back to data URLs.
 * Unknown references are left untouched (a stale image shows as broken instead of vanishing silently).
 */
export async function hydrateImages(html: string): Promise<string> {
  if (!html.includes(ASSET_REF_PREFIX)) return html;

  const refs = new Set<string>();
  for (const match of html.matchAll(REF_SRC)) refs.add(match[3]);
  if (refs.size === 0) return html;

  const resolved = new Map<string, string>();
  for (const ref of refs) {
    const dataUrl = await getAssetDataUrl(ref);
    if (dataUrl) resolved.set(ref, dataUrl);
  }
  if (resolved.size === 0) return html;

  return html.replace(REF_SRC, (whole: string, prefix: string, quote: string, ref: string) => {
    const dataUrl = resolved.get(ref);
    return dataUrl ? `${prefix}${quote}${dataUrl}${quote}` : whole;
  });
}
