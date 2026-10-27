import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  deriveReviewFromHtml,
  migrateDraft,
  normalizeDocExtras,
  toDraftV2,
} from './migrate';

/** Pure-logic tests for draft / document library schema migration (no DOM or IndexedDB). */

describe('migrateDraft（v1 → v2）', () => {
  it('keeps v1 body and title and adds the version number', () => {
    const result = migrateDraft({
      title: '季度报告',
      html: '<p>正文</p>',
      view: 'paged',
      zoom: 1.5,
      pdfMode: 'snapshot',
      pageSetup: { size: 'A4' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.value.title).toBe('季度报告');
    expect(result.value.html).toBe('<p>正文</p>');
    expect(result.value.view).toBe('paged');
    expect(result.value.zoom).toBe(1.5);
    expect(result.value.pdfMode).toBe('snapshot');
    expect(result.value.pageSetup).toEqual({ size: 'A4' });
    expect(result.value.comments).toEqual([]);
    expect(result.value.changes).toEqual([]);
  });

  it('derives comments and revisions from v1 HTML so the sidebar never has marks without entries', () => {
    const html =
      '<p><span data-comment-id="c-1" class="rte-comment">甲</span>' +
      '<ins data-track="insert" class="rte-track-insert">新增</ins>' +
      '<del data-track="delete" class="rte-track-delete">删除</del></p>';
    const result = migrateDraft({ title: '', html });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comments).toEqual([
      { id: 'c-1', quote: '', text: '', author: '', createdAt: 0, resolved: false },
    ]);
    expect(result.value.changes.map((change) => [change.kind, change.text])).toEqual([
      ['insert', '新增'],
      ['delete', '删除'],
    ]);
  });

  it('does not resurrect deleted comments when the data is already v2', () => {
    const html = '<p><span data-comment-id="c-1" class="rte-comment">甲</span></p>';
    const result = migrateDraft({ schemaVersion: CURRENT_SCHEMA_VERSION, html, comments: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comments).toEqual([]);
  });

  it('keeps full comment metadata for v2 data', () => {
    const result = migrateDraft({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      title: 't',
      html: '<p>x</p>',
      comments: [
        {
          id: 'c-9',
          quote: '引文',
          text: '意见',
          author: '审阅人',
          createdAt: 1700000000000,
          resolved: true,
        },
      ],
      changes: [{ id: 't-9', kind: 'delete', text: '旧文', author: 'A', createdAt: 1 }],
      userWords: ['syntools', 'syntools', '  富文本  '],
      templateId: 'official',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comments[0]).toEqual({
      id: 'c-9',
      quote: '引文',
      text: '意见',
      author: '审阅人',
      createdAt: 1700000000000,
      resolved: true,
    });
    expect(result.value.changes).toHaveLength(1);
    // Dedupe and trim
    expect(result.value.userWords).toEqual(['syntools', '富文本']);
    expect(result.value.templateId).toBe('official');
  });

  it('filters invalid comment / revision entries and fills in missing ids', () => {
    const result = migrateDraft({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      html: '<p>x</p>',
      comments: [null, 'nope', { id: '' }, { id: 'c-ok' }],
      changes: [{ kind: 'insert' }, { kind: 'unknown' }, { id: 't-1', kind: 'delete', text: 'z' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comments.map((comment) => comment.id)).toEqual(['c-ok']);
    expect(result.value.changes.map((change) => change.id)).toEqual(['t-migrated-0', 't-1']);
  });

  it('falls back to undefined for invalid optional fields instead of writing junk', () => {
    const result = migrateDraft({
      title: 42,
      html: '<p>x</p>',
      view: 'grid',
      zoom: -3,
      pdfMode: 'png',
      pageSetup: 'A4',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('');
    expect(result.value.view).toBeUndefined();
    expect(result.value.zoom).toBeUndefined();
    expect(result.value.pdfMode).toBeUndefined();
    expect(result.value.pageSetup).toBeUndefined();
  });

  it('returns MIGRATION_FAILED when the data cannot be used as a draft', () => {
    expect(migrateDraft(null)).toEqual({ ok: false, error: 'MIGRATION_FAILED' });
    expect(migrateDraft('text')).toEqual({ ok: false, error: 'MIGRATION_FAILED' });
    expect(migrateDraft([])).toEqual({ ok: false, error: 'MIGRATION_FAILED' });
    expect(migrateDraft({ title: 'x' })).toEqual({ ok: false, error: 'MIGRATION_FAILED' });
  });
});

describe('deriveReviewFromHtml (best-effort derivation)', () => {
  it('collects each comment id once and decodes HTML entities', () => {
    const html =
      '<p><span data-comment-id="c-1">甲</span><span data-comment-id="c-1">乙</span></p>' +
      '<p><ins data-track="insert">a&amp;b &lt;c&gt;</ins></p>';
    const derived = deriveReviewFromHtml(html);
    expect(derived.comments).toHaveLength(1);
    expect(derived.changes[0].text).toBe('a&b <c>');
  });

  it('ignores revision marks without text and unknown data-track values', () => {
    const derived = deriveReviewFromHtml(
      '<p><ins data-track="insert"></ins><ins data-track="other">x</ins></p>',
    );
    expect(derived.changes).toEqual([]);
  });

  it('caps the number of derived entries', () => {
    const many = Array.from(
      { length: 260 },
      (_, index) => `<span data-comment-id="c-${index}">x</span>`,
    ).join('');
    expect(deriveReviewFromHtml(`<p>${many}</p>`).comments).toHaveLength(200);
  });
});

describe('normalizeDocExtras / toDraftV2', () => {
  it('skips deriving from HTML when deriveReview=false', () => {
    const extras = normalizeDocExtras(
      { html: '<p><span data-comment-id="c-1">x</span></p>' },
      false,
    );
    expect(extras.comments).toEqual([]);
    expect(extras.changes).toEqual([]);
  });

  it('fills in the version and default extras in toDraftV2', () => {
    const draft = toDraftV2({ title: 't', html: '<p>x</p>', view: 'flow' });
    expect(draft.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(draft.comments).toEqual([]);
    expect(draft.changes).toEqual([]);
    expect(draft.userWords).toEqual([]);
    expect(draft.templateId).toBeUndefined();
  });

  it('treats missing html as an empty body', () => {
    expect(toDraftV2({ title: 't', html: undefined as unknown as string }).html).toBe('');
  });
});
