import { readDraft } from './draft';
import type { RichTextDraft } from './draft';

/**
 * 本地文档库（IndexedDB）：多文档管理 + 版本历史。
 * 内容不出本机；IndexedDB 不可用时所有 API 静默降级（草稿 localStorage 仍兜底）。
 */

export interface StoredDocument {
  id: string;
  title: string;
  html: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoredVersion {
  id: string;
  docId: string;
  title: string;
  html: string;
  savedAt: number;
}

export interface DocMeta {
  id: string;
  title: string;
  updatedAt: number;
}

const DB_NAME = 'syntools-rich-text';
const DB_VERSION = 1;
const DOC_STORE = 'documents';
const VER_STORE = 'versions';
/** 每篇文档保留的版本快照上限 */
const MAX_VERSIONS = 20;
/** 两次版本快照的最小间隔（2 分钟），避免每次输入都生成快照 */
const VERSION_MIN_INTERVAL_MS = 120_000;
/** 当前文档指针：刷新后恢复上次编辑的文档 */
const CURRENT_KEY = 'syntools:rich-text-editor.current.v2';

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
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 列出全部文档（按更新时间倒序）；失败返回空列表 */
export async function listDocuments(): Promise<DocMeta[]> {
  try {
    const all = await withStore<StoredDocument[]>(
      DOC_STORE,
      'readonly',
      (store) => store.getAll() as IDBRequest<StoredDocument[]>,
    );
    return all
      .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/** 读取单篇文档；失败返回 null */
export async function loadDocument(id: string): Promise<StoredDocument | null> {
  try {
    const doc = await withStore<StoredDocument | undefined>(
      DOC_STORE,
      'readonly',
      (store) => store.get(id) as IDBRequest<StoredDocument | undefined>,
    );
    return doc ?? null;
  } catch {
    return null;
  }
}

/** 保存文档（upsert），并按间隔生成版本快照 */
export async function saveDocument(id: string, draft: RichTextDraft): Promise<void> {
  try {
    const now = Date.now();
    const existing = await loadDocument(id);
    const doc: StoredDocument = {
      id,
      title: draft.title,
      html: draft.html,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await withStore(DOC_STORE, 'readwrite', (store) => store.put(doc));
    await pushVersion(doc, now);
  } catch {
    // IndexedDB 不可用：忽略（localStorage 草稿仍兜底）
  }
}

async function pushVersion(doc: StoredDocument, now: number): Promise<void> {
  const versions = await listVersions(doc.id);
  const latest = versions[0];
  if (latest && now - latest.savedAt < VERSION_MIN_INTERVAL_MS) return;
  const version: StoredVersion = {
    id: `${doc.id}-${now}-${Math.random().toString(36).slice(2, 8)}`,
    docId: doc.id,
    title: doc.title,
    html: doc.html,
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

/** 列出某文档的版本快照（按时间倒序，含当前内容） */
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
    // 忽略
  }
}

/** 复制文档，返回新文档 id（失败返回 null） */
export async function duplicateDocument(id: string): Promise<string | null> {
  const source = await loadDocument(id);
  if (!source) return null;
  const cloneId = newId();
  await saveDocument(cloneId, { title: `${source.title || '未命名文档'} 副本`, html: source.html });
  return cloneId;
}

export function setCurrentDocId(id: string): void {
  try {
    localStorage.setItem(CURRENT_KEY, id);
  } catch {
    // 忽略
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
  /** 应恢复编辑的文档 id */
  docId: string;
  /** 应恢复的文档内容（null 表示仅记录 id） */
  doc: StoredDocument | null;
}

/**
 * 初始化：优先恢复指针指向的文档；否则把 localStorage v1 单文档草稿
 * 迁移为文档库首篇（一次性），并清理旧键。
 */
export async function initDocStore(): Promise<DocStoreInit | null> {
  const docs = await listDocuments();
  const pointer = readCurrentDocId();
  if (pointer && docs.some((d) => d.id === pointer)) {
    return { docId: pointer, doc: await loadDocument(pointer) };
  }
  const legacy = readDraft();
  if (legacy && (legacy.html !== '<p></p>' || legacy.title)) {
    const docId = 'legacy';
    await saveDocument(docId, legacy);
    setCurrentDocId(docId);
    try {
      localStorage.removeItem('syntools:rich-text-editor.draft.v1');
    } catch {
      // 忽略
    }
    return { docId, doc: await loadDocument(docId) };
  }
  if (pointer) return { docId: pointer, doc: null };
  return null;
}

export { newId as createDocId };
