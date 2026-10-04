import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  deriveReviewFromHtml,
  migrateDraft,
  normalizeDocExtras,
  toDraftV2,
} from './migrate';

/** 草稿 / 文档库 schema 迁移纯逻辑测试（不依赖 DOM 与 IndexedDB）。 */

describe('migrateDraft（v1 → v2）', () => {
  it('保留 v1 正文与标题并补齐版本号', () => {
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

  it('v1 文档从 HTML 反推批注与修订，避免侧栏「有标记无条目」', () => {
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

  it('已是 v2 时不复活用户已删除的批注', () => {
    const html = '<p><span data-comment-id="c-1" class="rte-comment">甲</span></p>';
    const result = migrateDraft({ schemaVersion: CURRENT_SCHEMA_VERSION, html, comments: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comments).toEqual([]);
  });

  it('v2 数据保留完整批注元数据', () => {
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
    // 去重 + 去空白
    expect(result.value.userWords).toEqual(['syntools', '富文本']);
    expect(result.value.templateId).toBe('official');
  });

  it('过滤非法批注 / 修订条目并补齐缺失 id', () => {
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

  it('非法可选字段回退为 undefined 而不是写入脏值', () => {
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

  it('无法作为草稿使用时返回 MIGRATION_FAILED', () => {
    expect(migrateDraft(null)).toEqual({ ok: false, error: 'MIGRATION_FAILED' });
    expect(migrateDraft('text')).toEqual({ ok: false, error: 'MIGRATION_FAILED' });
    expect(migrateDraft([])).toEqual({ ok: false, error: 'MIGRATION_FAILED' });
    expect(migrateDraft({ title: 'x' })).toEqual({ ok: false, error: 'MIGRATION_FAILED' });
  });
});

describe('deriveReviewFromHtml（尽力而为反推）', () => {
  it('同一批注 id 只收录一次并还原 HTML 实体', () => {
    const html =
      '<p><span data-comment-id="c-1">甲</span><span data-comment-id="c-1">乙</span></p>' +
      '<p><ins data-track="insert">a&amp;b &lt;c&gt;</ins></p>';
    const derived = deriveReviewFromHtml(html);
    expect(derived.comments).toHaveLength(1);
    expect(derived.changes[0].text).toBe('a&b <c>');
  });

  it('忽略没有文本的修订标记与未知 data-track 值', () => {
    const derived = deriveReviewFromHtml(
      '<p><ins data-track="insert"></ins><ins data-track="other">x</ins></p>',
    );
    expect(derived.changes).toEqual([]);
  });

  it('反推条目数量受上限保护', () => {
    const many = Array.from(
      { length: 260 },
      (_, index) => `<span data-comment-id="c-${index}">x</span>`,
    ).join('');
    expect(deriveReviewFromHtml(`<p>${many}</p>`).comments).toHaveLength(200);
  });
});

describe('normalizeDocExtras / toDraftV2', () => {
  it('deriveReview=false 时不从 HTML 反推', () => {
    const extras = normalizeDocExtras(
      { html: '<p><span data-comment-id="c-1">x</span></p>' },
      false,
    );
    expect(extras.comments).toEqual([]);
    expect(extras.changes).toEqual([]);
  });

  it('toDraftV2 补齐版本号与默认扩展字段', () => {
    const draft = toDraftV2({ title: 't', html: '<p>x</p>', view: 'flow' });
    expect(draft.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(draft.comments).toEqual([]);
    expect(draft.changes).toEqual([]);
    expect(draft.userWords).toEqual([]);
    expect(draft.templateId).toBeUndefined();
  });

  it('缺 html 的入参视为空正文写入', () => {
    expect(toDraftV2({ title: 't', html: undefined as unknown as string }).html).toBe('');
  });
});
