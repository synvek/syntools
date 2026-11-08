import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEGACY_DRAFT_KEY,
  clearDraft,
  clearLegacyDraft,
  readDraft,
  readReviewerName,
  writeDraft,
  writeDraftSafe,
  writeReviewerName,
} from './draft';
import { CURRENT_SCHEMA_VERSION } from './migrate';
import { MAX_IMPORT_BYTES } from './core';

/** Local draft storage (implementation plan P0-5.2): versioning, quota fallback and key hygiene. */

const V2_KEY = 'syntools:rich-text-editor.draft.v2';
const REVIEWER_KEY = 'syntools:rich-text-editor.reviewer';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('readDraft / writeDraft', () => {
  it('round-trips a draft and stamps the current schema version', () => {
    const written = writeDraft({
      title: '季度报告',
      html: '<p>正文</p>',
      view: 'paged',
      zoom: 1.25,
      pageSetup: { size: 'A4' },
    });
    expect(written).toBe(true);

    const draft = readDraft();
    expect(draft).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      title: '季度报告',
      html: '<p>正文</p>',
      view: 'paged',
      zoom: 1.25,
      pageSetup: { size: 'A4' },
    });
    // Extension fields are backfilled even when the writer omitted them
    expect(draft?.comments).toEqual([]);
    expect(draft?.changes).toEqual([]);
    expect(draft?.userWords).toEqual([]);
  });

  it('rejects an oversized draft instead of truncating it', () => {
    expect(writeDraft({ title: 'big', html: 'x'.repeat(MAX_IMPORT_BYTES + 1) })).toBe(false);
    expect(localStorage.getItem(V2_KEY)).toBeNull();
  });

  it('returns null when neither key holds a usable draft', () => {
    expect(readDraft()).toBeNull();
    localStorage.setItem(V2_KEY, 'not json');
    localStorage.setItem(LEGACY_DRAFT_KEY, JSON.stringify({ title: 'no html' }));
    expect(readDraft()).toBeNull();
  });
});

describe('v1 → v2 migration', () => {
  it('reads a legacy draft, persists it as v2 and drops the old key', () => {
    localStorage.setItem(
      LEGACY_DRAFT_KEY,
      JSON.stringify({ title: '旧稿', html: '<p>旧正文</p>', view: 'flow' }),
    );

    const draft = readDraft();
    expect(draft).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      title: '旧稿',
      html: '<p>旧正文</p>',
      view: 'flow',
    });
    expect(localStorage.getItem(LEGACY_DRAFT_KEY)).toBeNull();
    expect(localStorage.getItem(V2_KEY)).not.toBeNull();
  });

  it('derives review metadata that v1 kept only inside the HTML', () => {
    localStorage.setItem(
      LEGACY_DRAFT_KEY,
      JSON.stringify({
        title: '修订稿',
        html: '<p><ins data-track="insert">新增</ins><span data-comment-id="c1">批注</span></p>',
      }),
    );

    const draft = readDraft();
    expect(draft?.changes).toEqual([
      { id: 't-migrated-0', kind: 'insert', text: '新增', author: '', createdAt: 0 },
    ]);
    expect(draft?.comments.map((comment) => comment.id)).toEqual(['c1']);
  });
});

describe('writeDraftSafe quota fallback', () => {
  it('writes as-is when there is room', () => {
    expect(writeDraftSafe({ title: 'a', html: '<p>a</p>' })).toEqual({
      ok: true,
      degraded: false,
    });
  });

  it('retries without images when the first write is rejected', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    setItem.mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    const result = writeDraftSafe({
      title: '大图',
      html: '<p>文字</p><img src="data:image/png;base64,AAA">',
    });

    expect(result).toEqual({ ok: true, degraded: true });
    // The retry dropped the image but kept the text
    expect(localStorage.getItem(V2_KEY)).toContain('文字');
    expect(localStorage.getItem(V2_KEY)).not.toContain('<img');
  });

  it('reports failure when even the stripped draft cannot be stored', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(writeDraftSafe({ title: 'x', html: '<p>x</p><img src="a">' })).toEqual({
      ok: false,
      degraded: false,
    });
  });
});

describe('reviewer name and clearing', () => {
  it('trims the reviewer name and removes it when emptied', () => {
    writeReviewerName('  张三  ');
    expect(readReviewerName()).toBe('张三');
    expect(localStorage.getItem(REVIEWER_KEY)).toBe('张三');

    writeReviewerName('   ');
    expect(readReviewerName()).toBe('');
    expect(localStorage.getItem(REVIEWER_KEY)).toBeNull();
  });

  it('clearDraft removes both keys while clearLegacyDraft only removes v1', () => {
    localStorage.setItem(V2_KEY, '{}');
    localStorage.setItem(LEGACY_DRAFT_KEY, '{}');

    clearLegacyDraft();
    expect(localStorage.getItem(LEGACY_DRAFT_KEY)).toBeNull();
    expect(localStorage.getItem(V2_KEY)).not.toBeNull();

    localStorage.setItem(LEGACY_DRAFT_KEY, '{}');
    clearDraft();
    expect(localStorage.getItem(V2_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_DRAFT_KEY)).toBeNull();
  });
});
