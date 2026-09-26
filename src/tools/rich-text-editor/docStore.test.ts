import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeDraftSafe } from './draft';
import {
  deleteDocument,
  duplicateDocument,
  initDocStore,
  listDocuments,
  listVersions,
  loadDocument,
  saveDocument,
} from './docStore';

/** docStore / draft 降级逻辑测试。
 * IndexedDB 在 jsdom 中不可用：验证所有 API 静默降级不抛异常；
 * 纯逻辑（草稿降级写入）走 localStorage 真实路径。
 */

const DRAFT_KEY = 'syntools:rich-text-editor.draft.v1';

describe('docStore（jsdom 无 IndexedDB：静默降级）', () => {
  it('listDocuments / loadDocument 失败时返回空值', async () => {
    await expect(listDocuments()).resolves.toEqual([]);
    await expect(loadDocument('nope')).resolves.toBeNull();
    await expect(listVersions('nope')).resolves.toEqual([]);
  });

  it('saveDocument / deleteDocument / duplicateDocument 不抛异常', async () => {
    await expect(saveDocument('a', { title: 't', html: '<p>x</p>' })).resolves.toBeUndefined();
    await expect(deleteDocument('a')).resolves.toBeUndefined();
    await expect(duplicateDocument('a')).resolves.toBeNull();
  });

  it('initDocStore 在 IndexedDB 不可用时回退 localStorage v1 草稿', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: '旧文档', html: '<p>legacy</p>' }));
    const init = await initDocStore();
    // loadDocument 因 IndexedDB 不可用返回 null，但迁移路径应返回 docId
    expect(init?.docId).toBe('legacy');
    localStorage.removeItem(DRAFT_KEY);
  });
});

describe('writeDraftSafe（超限降级）', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('正常内容直接写入', () => {
    const result = writeDraftSafe({ title: 't', html: '<p>hello</p>' });
    expect(result).toEqual({ ok: true, degraded: false });
    expect(localStorage.getItem(DRAFT_KEY)).toContain('hello');
  });

  it('超过 10MB 时剥离图片后重试成功', () => {
    // 构造 >10MB 的 html：大图片 + 正文
    const bigImage = `<img src="data:image/png;base64,${'A'.repeat(11 * 1024 * 1024)}">`;
    const result = writeDraftSafe({ title: 't', html: `<p>正文</p>${bigImage}` });
    expect(result.ok).toBe(true);
    expect(result.degraded).toBe(true);
    const stored = localStorage.getItem(DRAFT_KEY) ?? '';
    expect(stored).not.toContain('<img');
    expect(stored).toContain('正文');
  });

  it('纯文本超限（无法降级）返回失败', () => {
    const result = writeDraftSafe({ title: 't', html: `<p>${'x'.repeat(11 * 1024 * 1024)}</p>` });
    expect(result.ok).toBe(false);
    expect(result.degraded).toBe(false);
  });
});
