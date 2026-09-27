import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearDraft, readDraft, writeDraftSafe } from './draft';
import {
  deleteDocument,
  duplicateDocument,
  initDocStore,
  listDocuments,
  listVersions,
  loadDocument,
  readCurrentDocId,
  saveDocument,
  setCurrentDocId,
} from './docStore';
import { createEmptySnapshot, type WorkbookSnapshot } from './xlsx-io';

/**
 * docStore / draft 降级逻辑测试。
 * IndexedDB 在 jsdom 中不可用：验证所有 API 静默降级不抛异常；
 * 草稿路径走 localStorage 真实实现。
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
    await expect(saveDocument('a', 't', snapshot())).resolves.toBeUndefined();
    await expect(deleteDocument('a')).resolves.toBeUndefined();
    await expect(duplicateDocument('a')).resolves.toBeNull();
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
