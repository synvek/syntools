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
 * 本地文档库（IndexedDB）：多文档管理 + 版本历史。
 * 内容不出本机；IndexedDB 不可用时所有 API 静默降级（草稿 localStorage 仍兜底）。
 *
 * schema 版本随草稿同步演进，DB_VERSION 升级只做版本号推进 +
 * 读取时惰性补齐（不批量重写旧记录），避免升级过程中损坏用户数据。
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
  /** 手动快照的用户备注（自动快照为 undefined） */
  note?: string;
}

export interface DocMeta {
  id: string;
  title: string;
  updatedAt: number;
}

const DB_NAME = 'syntools-rich-text';
/** v2：草稿 schema 增加批注 / 修订 / 自定义词典 / 模板 id（读取时惰性补齐） */
const DB_VERSION = 2;
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
        // 仅补建缺失的 store：既有 store 内的旧记录留给读取时归一化，
        // 升级事务中不做可能失败的批量重写
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
 * 读取归一化（v1 记录惰性补齐为 v2）
 * ------------------------------------------------------------------ */

function toStoredDocument(raw: unknown): StoredDocument | null {
  if (!isPlainObject(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id) return null;
  // migrateDraft 依据 schemaVersion 决定是否从 HTML 反推审阅信息
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
 * 公开 API
 * ------------------------------------------------------------------ */

/** 列出全部文档（按更新时间倒序）；失败返回空列表 */
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

/** 读取单篇文档（已归一化为 v2）；失败返回 null */
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

/** 保存文档（upsert），并按间隔生成版本快照 */
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
    // IndexedDB 不可用：忽略（localStorage 草稿仍兜底）
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

/** 写入快照并裁剪超出上限的旧快照 */
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
 * 手动打快照：不受自动快照的最小间隔限制，可附备注。
 * 用于「保存前留档 / 交付前定稿」等需要显式留存的场景。
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

/** 列出某文档的版本快照（按时间倒序，含当前内容）；已归一化为 v2 */
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
    // 忽略
  }
}

/** 复制文档（保留页面设置与批注修订），返回新文档 id（失败返回 null） */
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
 * 初始化：优先恢复指针指向的文档；否则把 localStorage v1/v2 单文档草稿
 * 迁移为文档库首篇（一次性），并清理旧键。
 */
export async function initDocStore(): Promise<DocStoreInit | null> {
  const pointer = readCurrentDocId();
  if (pointer) {
    const doc = await loadDocument(pointer);
    if (doc) return { docId: pointer, doc };
    // 文档已被删除但指针残留：交给下面的草稿迁移路径
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
