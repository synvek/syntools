import { readDraft } from './draft';
import type { WorkbookSnapshot } from './xlsx-io';

/**
 * Local workbook document library (IndexedDB): multi-document management + version history.
 * Content never leaves the device; when IndexedDB is unavailable every API degrades to a neutral
 * return value (the localStorage draft still acts as a fallback).
 *
 * Degrading is not the same as hiding the problem (P2-3): every failure lands in a small status
 * channel below, so the UI can say "库不可用 / 空间不足" and offer a retry instead of showing an
 * empty document list as if the user had never saved anything.
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

/**
 * 为什么库用不了：
 * - `unavailable`：浏览器没有 IndexedDB / 被隐私模式或站点设置禁用 / 被另一个标签页阻塞；
 * - `quota`：写进去了但空间不够（`QuotaExceededError`）。
 * 两者对用户的含义完全不同，所以不合并成一个"出错了"。
 */
export type DocStoreErrorCode = 'unavailable' | 'quota';

export interface DocStoreStatus {
  ok: boolean;
  code?: DocStoreErrorCode;
}

/** 库里的占用；`navigator.storage.estimate()` 拿不到时整项为 null */
export interface DocStorageEstimate {
  used: number;
  quota: number;
}

const OK_STATUS: DocStoreStatus = { ok: true };
let status: DocStoreStatus = OK_STATUS;
const statusListeners = new Set<(status: DocStoreStatus) => void>();

/** 当前状态（同步读，给不订阅的调用方用） */
export function getDocStoreStatus(): DocStoreStatus {
  return status;
}

/** 订阅状态变化；返回取消订阅（与 `issues.ts` 同一套写法，避免组件各记一份） */
export function subscribeDocStoreStatus(listener: (status: DocStoreStatus) => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/** 测试辅助：模块级状态会在用例之间泄漏，和 `resetSheetIssues` 同一个理由 */
export function resetDocStoreStatus(): void {
  status = OK_STATUS;
  statusListeners.clear();
  dbPromise = null;
}

/** 把底层异常归类：配额和"根本没有库"要分开说 */
export function classifyDocStoreError(error: unknown): DocStoreErrorCode {
  const name = (error as { name?: string } | null)?.name ?? '';
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    ? 'quota'
    : 'unavailable';
}

function reportStatus(next: DocStoreStatus): void {
  if (status.ok === next.ok && status.code === next.code) return;
  status = next;
  for (const listener of statusListeners) listener(status);
}

function fail(error: unknown): void {
  reportStatus({ ok: false, code: classifyDocStoreError(error) });
}

/**
 * 只有"写成功"才清除告警：读操作在配额已满时仍然能成功，若读一次就清掉横幅，
 * 用户会看到"空间不足"闪一下就消失，然后在下次保存时又冒出来。
 */
function succeed(): void {
  reportStatus(OK_STATUS);
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
      // 另一个标签页还握着升级锁：不 reject 的话这里会一直挂着，"重试"永远等不到结果
      request.onblocked = () => {
        dbPromise = null;
        reject(new Error('IndexedDB blocked by another tab'));
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
  } catch (error) {
    fail(error);
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
  } catch (error) {
    fail(error);
    return null;
  }
}

/** Save a workbook (upsert) and push a version snapshot when the interval allows; false = 没落库 */
export async function saveDocument(
  id: string,
  title: string,
  snapshot: WorkbookSnapshot,
): Promise<boolean> {
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
    succeed();
    return true;
  } catch (error) {
    // 库里写不进去时草稿仍在，但必须让用户知道"这个文件没进文档库"
    fail(error);
    return false;
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
  await txDone(tx);
}

/** List a workbook's version snapshots (newest first) */
export async function listVersions(docId: string): Promise<StoredVersion[]> {
  try {
    const db = await openDb();
    const store = db.transaction(VER_STORE, 'readonly').objectStore(VER_STORE);
    const index = store.index('docId');
    const all = await requestAs(index.getAll(docId) as IDBRequest<StoredVersion[]>);
    return all.sort((a, b) => b.savedAt - a.savedAt);
  } catch (error) {
    fail(error);
    return [];
  }
}

/** 删掉一个历史版本（P2-3：空间不足时用户要有"腾地方"的出口） */
export async function deleteVersion(versionId: string): Promise<void> {
  try {
    await withStore(VER_STORE, 'readwrite', (store) => store.delete(versionId));
    succeed();
  } catch (error) {
    fail(error);
  }
}

/** 清空某文档的全部历史版本，返回删掉的条数（0 表示没有或失败） */
export async function clearVersions(docId: string): Promise<number> {
  try {
    const versions = await listVersions(docId);
    if (versions.length === 0) return 0;
    const db = await openDb();
    const tx = db.transaction(VER_STORE, 'readwrite');
    versions.forEach((version) => tx.objectStore(VER_STORE).delete(version.id));
    await txDone(tx);
    succeed();
    return versions.length;
  } catch (error) {
    fail(error);
    return 0;
  }
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
    succeed();
  } catch (error) {
    fail(error);
  }
}

/**
 * Duplicate a workbook and return the new document id (null on failure).
 * The store layer has no i18n: the caller passes the localized untitled label and suffix.
 */
export async function duplicateDocument(
  id: string,
  labels: { untitled: string; suffix: string },
): Promise<string | null> {
  const source = await loadDocument(id);
  if (!source) return null;
  const cloneId = newId();
  const saved = await saveDocument(
    cloneId,
    `${source.title || labels.untitled}${labels.suffix}`,
    source.snapshot,
  );
  return saved ? cloneId : null;
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

/**
 * 用户点了"重试"：丢掉缓存的连接（配额满、被另一个标签页阻塞、临时错误都靠重开来恢复），
 * 重新打开一次库。成功就清掉告警，失败把新的分类写回状态里。
 */
export async function retryDocStore(): Promise<DocStoreStatus> {
  dbPromise = null;
  try {
    const db = await openDb();
    db.close();
    dbPromise = null;
    succeed();
  } catch (error) {
    fail(error);
  }
  return status;
}

/**
 * 库里占了多少：`navigator.storage.estimate()` 给的是整个源（本工具 + 其他工具）的用量，
 * 拿不到（浏览器不支持 / 隐私模式）返回 null，UI 就不显示这一行，而不是显示 0。
 */
export async function estimateStorage(): Promise<DocStorageEstimate | null> {
  const manager =
    typeof navigator === 'undefined'
      ? undefined
      : (navigator as Navigator & { storage?: StorageManager }).storage;
  if (!manager?.estimate) return null;
  try {
    const { usage, quota } = await manager.estimate();
    if (typeof quota !== 'number' || quota <= 0) return null;
    return { used: usage ?? 0, quota };
  } catch {
    return null;
  }
}

export { newId as createDocId };
