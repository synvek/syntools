/**
 * 流程图编辑器的本地持久化（IndexedDB）。
 *
 * 为什么不用 localStorage：localStorage 约 5MB、同步阻塞，图片 dataURL 极易触发
 * `draft.ts` 的「丢弃图片」降级。IndexedDB 容量大、异步、结构化存储，
 * 可同时承载「完整草稿（含图片）」「命名快照」「会话设置」三类数据。
 *
 * 降级策略：IndexedDB 不可用（隐私模式 / 测试环境 / 旧浏览器）时所有 API 静默降级——
 * 读取返回空值、写入返回 false / no-op，绝不对编辑流程抛出异常；
 * 草稿仍由 `draft.ts` 的 localStorage 实现兜底。
 */

import { activePageOf, migrateDoc } from '../model/migrate';
import type { LayoutDensity, LayoutDirection } from '../layout';
import type { ThemeId } from '../model/themes';
import type { FlowDoc } from '../model/types';

/** 与 store.SnapshotRec 结构一致；此处独立声明以避免 store ↔ persist 的循环依赖 */
export interface PersistedSnapshot {
  id: string;
  name: string;
  doc: FlowDoc;
  savedAt: number;
}

/** 侧栏面板 key（与 FlowchartTool 的 PanelKey 一致） */
export type PersistedPanelKey = 'prop' | 'layer' | 'history';

/** 会话设置：网格 / 布局 / 对齐阈值 / 主题 / 侧栏面板 */
export interface PersistedSession {
  gridEnabled: boolean;
  gridSize: number;
  layoutDirection: LayoutDirection;
  layoutDensity: LayoutDensity;
  alignTolerance: number;
  theme?: ThemeId;
  panel?: PersistedPanelKey;
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
        // 只补建缺失的 store，升级事务内不做批量重写，避免损坏既有数据
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
    // IndexedDB 不可用：忽略
  }
}

/* ------------------------------ 草稿 ------------------------------ */

/** 读取完整草稿（含图片）；无草稿或不可用时返回 null */
export async function loadPersistedDoc(): Promise<FlowDoc | null> {
  const raw = await readKey<{ doc?: unknown }>(DRAFT_STORE, DRAFT_KEY);
  if (!raw || typeof raw !== 'object') return null;
  return migrateDoc(raw.doc);
}

/** 写入完整草稿（不丢弃图片）；返回是否成功落盘。空文档视为「清除草稿」 */
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

/* ------------------------------ 快照 ------------------------------ */

/** 读取命名快照列表（含图片，已归一化为 v2）；无记录或不可用时返回空数组 */
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

/* ------------------------------ 会话设置 ------------------------------ */

export async function loadPersistedSession(): Promise<Partial<PersistedSession> | null> {
  const raw = await readKey<unknown>(SESSION_STORE, SESSION_KEY);
  if (!raw || typeof raw !== 'object') return null;
  return raw as Partial<PersistedSession>;
}

/** 合并写入会话设置（只覆盖传入字段，避免不同调用点互相清空） */
export async function savePersistedSession(patch: Partial<PersistedSession>): Promise<boolean> {
  const current = (await loadPersistedSession()) ?? {};
  return writeKey(SESSION_STORE, SESSION_KEY, { ...current, ...patch });
}

/** 仅测试用：重置缓存的数据库连接，便于隔离用例 */
export function __resetPersistDb(): void {
  dbPromise = null;
}
