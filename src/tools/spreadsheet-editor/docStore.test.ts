import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDraft, readDraft, writeDraftSafe } from './draft';
import {
  classifyDocStoreError,
  clearVersions,
  deleteDocument,
  deleteVersion,
  duplicateDocument,
  estimateStorage,
  getDocStoreStatus,
  initDocStore,
  listDocuments,
  listVersions,
  loadDocument,
  readCurrentDocId,
  resetDocStoreStatus,
  retryDocStore,
  saveDocument,
  setCurrentDocId,
  subscribeDocStoreStatus,
  type DocStoreStatus,
} from './docStore';
import { createEmptySnapshot, type WorkbookSnapshot } from './xlsx-io';

/**
 * Tests for the docStore / draft degradation logic.
 * IndexedDB is unavailable under jsdom: verify every API degrades silently without throwing, while
 * the draft path runs against the real localStorage implementation.
 */

const snapshot = (): WorkbookSnapshot => createEmptySnapshot('book');

afterEach(() => {
  clearDraft();
  vi.restoreAllMocks();
});

describe('docStore（jsdom 无 IndexedDB：静默降级）', () => {
  it('listDocuments / loadDocument / listVersions 失败时返回空值', async () => {
    await expect(listDocuments()).resolves.toEqual([]);
    await expect(loadDocument('nope')).resolves.toBeNull();
    await expect(listVersions('nope')).resolves.toEqual([]);
  });

  it('saveDocument / deleteDocument / duplicateDocument 不抛异常', async () => {
    // P2-3：写不进去要能说"没落库"，所以 saveDocument 返回 boolean 而不是 void
    await expect(saveDocument('a', 't', snapshot())).resolves.toBe(false);
    await expect(deleteDocument('a')).resolves.toBeUndefined();
    await expect(
      duplicateDocument('a', { untitled: '未命名工作簿', suffix: ' 副本' }),
    ).resolves.toBeNull();
  });

  it('没有可恢复内容时 initDocStore 返回 null', async () => {
    await expect(initDocStore()).resolves.toBeNull();
  });

  it('当前文档指针走 localStorage', () => {
    expect(readCurrentDocId()).toBeNull();
    setCurrentDocId('doc-1');
    expect(readCurrentDocId()).toBe('doc-1');
  });
});

describe('draft 持久化（可感知失败原因）', () => {
  it('写入成功后 readDraft 可读回', () => {
    expect(writeDraftSafe(snapshot())).toEqual({ ok: true, degraded: false });
    expect(readDraft()?.sheetOrder).toHaveLength(1);
  });

  it('超出体积上限：未保存且非「存储不可用」', () => {
    const oversized: WorkbookSnapshot = {
      ...snapshot(),
      sheets: {
        s: {
          ...createEmptySnapshot('x').sheets[createEmptySnapshot('x').sheetOrder[0]],
          cellData: { '0': { '0': { v: 'a'.repeat(10 * 1024 * 1024 + 64) } } },
        },
      },
      sheetOrder: ['s'],
    };
    expect(writeDraftSafe(oversized)).toEqual({ ok: false, degraded: false });
  });

  it('localStorage 不可用时标记为 degraded', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(writeDraftSafe(snapshot())).toEqual({ ok: false, degraded: true });
  });
});

/**
 * P2-3：文档库降级不再是静默的。库用不了 / 空间不足要落到一个状态上，
 * UI 才能显示横幅并给"重试"，而不是把空列表当成"用户没存过"。
 */
describe('docStore 状态（P2-3：降级要能看见）', () => {
  beforeEach(() => {
    resetDocStoreStatus();
  });

  it('库不可用时切成 unavailable，并通知订阅者', async () => {
    const seen: DocStoreStatus[] = [];
    subscribeDocStoreStatus((next) => seen.push(next));
    await listDocuments();
    expect(getDocStoreStatus()).toEqual({ ok: false, code: 'unavailable' });
    expect(seen).toEqual([{ ok: false, code: 'unavailable' }]);
  });

  it('配额错误与"根本没有库"分开归类', () => {
    expect(classifyDocStoreError({ name: 'QuotaExceededError' })).toBe('quota');
    expect(classifyDocStoreError(new Error('nope'))).toBe('unavailable');
  });

  it('状态没变化就不重复通知', async () => {
    let count = 0;
    subscribeDocStoreStatus(() => {
      count += 1;
    });
    await listDocuments();
    await listDocuments();
    await loadDocument('x');
    expect(count).toBe(1);
  });

  it('重试返回最新状态（jsdom 里仍然不可用，但不会抛）', async () => {
    await expect(retryDocStore()).resolves.toEqual({ ok: false, code: 'unavailable' });
    expect(getDocStoreStatus()).toEqual({ ok: false, code: 'unavailable' });
  });

  it('占用：浏览器不支持时返回 null，支持时给出 used / quota', async () => {
    expect(await estimateStorage()).toBeNull();
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: async () => ({ usage: 1024, quota: 4096 }) },
    });
    await expect(estimateStorage()).resolves.toEqual({ used: 1024, quota: 4096 });
    delete (navigator as unknown as Record<string, unknown>).storage;
  });

  it('删版本 / 清空版本在无库时安全降级', async () => {
    await expect(deleteVersion('v1')).resolves.toBeUndefined();
    await expect(clearVersions('d1')).resolves.toBe(0);
    expect(getDocStoreStatus()).toEqual({ ok: false, code: 'unavailable' });
  });
});
