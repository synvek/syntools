import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_DRAFT_KEY, readDraft, writeDraftSafe } from './draft';
import {
  deleteDocument,
  duplicateDocument,
  initDocStore,
  listDocuments,
  listVersions,
  loadDocument,
  saveDocument,
  saveManualVersion,
} from './docStore';

/** docStore / draft degradation tests.
 * IndexedDB is unavailable in jsdom: verify every API degrades silently without throwing;
 * pure logic (degraded draft writes, schema migration) runs against the real localStorage path.
 */

const DRAFT_KEY_V2 = 'syntools:rich-text-editor.draft.v2';

describe('docStore (no IndexedDB in jsdom: silent degradation)', () => {
  it('returns empty values when listDocuments / loadDocument fail', async () => {
    await expect(listDocuments()).resolves.toEqual([]);
    await expect(loadDocument('nope')).resolves.toBeNull();
    await expect(listVersions('nope')).resolves.toEqual([]);
  });

  it('saveDocument / deleteDocument / duplicateDocument never throw', async () => {
    await expect(saveDocument('a', { title: 't', html: '<p>x</p>' })).resolves.toBeUndefined();
    await expect(deleteDocument('a')).resolves.toBeUndefined();
    await expect(duplicateDocument('a')).resolves.toBeNull();
  });

  it('saveManualVersion returns null when the document is missing', async () => {
    await expect(saveManualVersion('nope', '定稿')).resolves.toBeNull();
  });

  describe('initDocStore migration', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('migrates a v1 draft into the first library document and upgrades it to v2 when IndexedDB is unavailable', async () => {
      localStorage.setItem(
        LEGACY_DRAFT_KEY,
        JSON.stringify({ title: '旧文档', html: '<p>legacy</p>' }),
      );
      const init = await initDocStore();
      // loadDocument returns null without IndexedDB, but the migration path should still return a docId
      expect(init?.docId).toBe('legacy');
      // The v1 key is cleared and the v2 key holds the migrated result
      expect(localStorage.getItem(LEGACY_DRAFT_KEY)).toBeNull();
      const upgraded = JSON.parse(localStorage.getItem(DRAFT_KEY_V2) ?? '{}') as {
        schemaVersion?: number;
        title?: string;
      };
      expect(upgraded.schemaVersion).toBe(2);
      expect(upgraded.title).toBe('旧文档');
    });

    it('recovers metadata for existing comment marks when upgrading a v1 draft', async () => {
      localStorage.setItem(
        LEGACY_DRAFT_KEY,
        JSON.stringify({
          title: '',
          html: '<p><span data-comment-id="c-1">甲</span></p>',
        }),
      );
      const draft = readDraft();
      expect(draft?.comments.map((comment) => comment.id)).toEqual(['c-1']);
    });
  });
});

describe('writeDraftSafe (degradation over the limit)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('writes normal content directly', () => {
    const result = writeDraftSafe({ title: 't', html: '<p>hello</p>' });
    expect(result).toEqual({ ok: true, degraded: false });
    expect(localStorage.getItem(DRAFT_KEY_V2)).toContain('hello');
  });

  it('fills in the schema version and extras on write', () => {
    writeDraftSafe({ title: 't', html: '<p>x</p>', comments: [], changes: [] });
    const stored = JSON.parse(localStorage.getItem(DRAFT_KEY_V2) ?? '{}') as {
      schemaVersion?: number;
      comments?: unknown[];
      changes?: unknown[];
      userWords?: unknown[];
    };
    expect(stored.schemaVersion).toBe(2);
    expect(stored.comments).toEqual([]);
    expect(stored.changes).toEqual([]);
    expect(stored.userWords).toEqual([]);
  });

  it('retries successfully after stripping images beyond 10MB', () => {
    // Build >10MB of html: a large image plus body text
    const bigImage = `<img src="data:image/png;base64,${'A'.repeat(11 * 1024 * 1024)}">`;
    const result = writeDraftSafe({ title: 't', html: `<p>正文</p>${bigImage}` });
    expect(result.ok).toBe(true);
    expect(result.degraded).toBe(true);
    const stored = localStorage.getItem(DRAFT_KEY_V2) ?? '';
    expect(stored).not.toContain('<img');
    expect(stored).toContain('正文');
  });

  it('fails when plain text is over the limit and cannot be degraded', () => {
    const result = writeDraftSafe({ title: 't', html: `<p>${'x'.repeat(11 * 1024 * 1024)}</p>` });
    expect(result.ok).toBe(false);
    expect(result.degraded).toBe(false);
  });
});
