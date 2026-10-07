import { beforeEach, describe, expect, it } from 'vitest';
import { buildTemplateDoc } from '../model/templates';
import {
  __resetPersistDb,
  clearPersistedDoc,
  loadPersistedDoc,
  loadPersistedSession,
  loadPersistedSnapshots,
  savePersistedDoc,
  savePersistedSession,
  savePersistedSnapshots,
} from './persist';

/**
 * persist 降级逻辑测试。
 * IndexedDB 在 jsdom 中不可用：验证所有 API 静默降级、不抛异常，
 * 且空文档写入语义为「清除草稿」（返回 false）。
 */
describe('persist（jsdom 无 IndexedDB：静默降级）', () => {
  beforeEach(() => {
    __resetPersistDb();
  });

  it('读取接口返回空值', async () => {
    await expect(loadPersistedDoc()).resolves.toBeNull();
    await expect(loadPersistedSnapshots()).resolves.toEqual([]);
    await expect(loadPersistedSession()).resolves.toBeNull();
  });

  it('写入接口返回 false 且不抛异常', async () => {
    await expect(savePersistedDoc(buildTemplateDoc('basic'))).resolves.toBe(false);
    await expect(savePersistedSnapshots([])).resolves.toBe(false);
    await expect(savePersistedSession({ gridEnabled: true })).resolves.toBe(false);
  });

  it('清除草稿不抛异常', async () => {
    await expect(clearPersistedDoc()).resolves.toBeUndefined();
  });

  it('空文档写入视为清除草稿（返回 false）', async () => {
    const empty = {
      version: 2 as const,
      pages: [{ id: 'p', name: '页面 1', nodes: [], edges: [] }],
    };
    await expect(savePersistedDoc(empty)).resolves.toBe(false);
  });
});
