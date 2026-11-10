import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DRAFT_WARN_RATIO,
  LEGACY_DRAFT_KEY,
  clearDraft,
  clearLegacyDraft,
  draftWarningLevel,
  readDraft,
  readReviewerName,
  utf8Bytes,
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
  it('writes as-is when there is room and reports the byte usage', () => {
    const result = writeDraftSafe({ title: 'a', html: '<p>a</p>' });

    expect(result).toMatchObject({ ok: true, degraded: false, tooLarge: false });
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.ratio).toBeLessThan(DRAFT_WARN_RATIO);
    expect(draftWarningLevel(result)).toBe('ok');
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

    expect(result).toMatchObject({ ok: true, degraded: true });
    // The retry dropped the image but kept the text
    expect(localStorage.getItem(V2_KEY)).toContain('文字');
    expect(localStorage.getItem(V2_KEY)).not.toContain('<img');
  });

  it('reports failure when even the stripped draft cannot be stored', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    const result = writeDraftSafe({ title: 'x', html: '<p>x</p><img src="a">' });
    expect(result).toMatchObject({ ok: false, degraded: false });
    // The write failed on the storage side, not because of the size budget
    expect(result.tooLarge).toBe(false);
    expect(draftWarningLevel(result)).toBe('failed');
  });
});

describe('byte-based measurement and quota warning', () => {
  it('counts UTF-8 bytes, not UTF-16 code units', () => {
    expect(utf8Bytes('abc')).toBe(3);
    // Two Chinese characters are 2 JS code units but 6 bytes: the reason html.length under-reported usage
    expect(utf8Bytes('中文')).toBe(6);
    expect(utf8Bytes('a中')).toBe(4);
  });

  it('rejects a draft that fits by character count but not by bytes', () => {
    // 3 bytes per character, so this exceeds 10MB while `html.length` stays well under the limit
    const html = '中'.repeat(Math.floor(MAX_IMPORT_BYTES / 3) + 1);

    expect(html.length).toBeLessThan(MAX_IMPORT_BYTES);
    expect(writeDraft({ title: '中文', html })).toBe(false);
    expect(localStorage.getItem(V2_KEY)).toBeNull();
  });

  it('maps byte usage onto the three notice levels', () => {
    const base = { degraded: false, bytes: 100, tooLarge: false };
    expect(draftWarningLevel({ ...base, ok: true, ratio: 0 })).toBe('ok');
    // Exactly at the threshold already counts as "near the limit"
    expect(draftWarningLevel({ ...base, ok: true, ratio: DRAFT_WARN_RATIO })).toBe('nearLimit');
    expect(draftWarningLevel({ ...base, ok: false, ratio: 1.2, tooLarge: true })).toBe('failed');
  });

  it('reports the oversized payload instead of silently dropping it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    const result = writeDraftSafe({ title: 'x', html: '中'.repeat(4_000_000) });

    expect(result.ok).toBe(false);
    expect(result.bytes).toBeGreaterThan(MAX_IMPORT_BYTES);
    expect(result.ratio).toBeGreaterThan(1);
    expect(result.tooLarge).toBe(true);
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
