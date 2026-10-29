import { describe, expect, it } from 'vitest';
import {
  blocksFromHtml,
  compareBlocks,
  compareDocuments,
  inlineSegments,
  tokenizeForDiff,
  type DocBlock,
} from './compare';

/** Pure-logic tests for document comparison (P2-3 第一批：块对齐 + 行内 diff) */

const base: DocBlock[] = [
  { type: 'h1', text: '项目说明' },
  { type: 'p', text: '第一段内容。' },
  { type: 'p', text: '第二段内容。' },
  { type: 'ul', text: '苹果\n香蕉' },
];

describe('tokenizeForDiff', () => {
  it('splits CJK per character and keeps Latin words whole', () => {
    expect(tokenizeForDiff('第 1 段用 Word 编辑')).toEqual([
      '第',
      ' ',
      '1',
      ' ',
      '段',
      '用',
      ' ',
      'Word',
      ' ',
      '编',
      '辑',
    ]);
  });

  it('keeps punctuation as its own token', () => {
    expect(tokenizeForDiff('甲乙，丙')).toEqual(['甲', '乙', '，', '丙']);
  });
});

describe('inlineSegments', () => {
  it('reports only the changed words', () => {
    const segments = inlineSegments('第一段内容。', '第一段正文。');
    expect(segments).toEqual([
      { kind: 'equal', text: '第一段' },
      { kind: 'delete', text: '内容' },
      { kind: 'insert', text: '正文' },
      { kind: 'equal', text: '。' },
    ]);
  });

  it('returns a single equal segment for identical text', () => {
    expect(inlineSegments('相同', '相同')).toEqual([{ kind: 'equal', text: '相同' }]);
  });

  it('merges adjacent segments of the same kind', () => {
    const segments = inlineSegments('abcdef', 'abXYef');
    expect(segments.filter((segment) => segment.kind === 'delete')).toHaveLength(1);
    expect(segments.filter((segment) => segment.kind === 'insert')).toHaveLength(1);
  });
});

describe('compareBlocks', () => {
  it('reports nothing for identical documents', () => {
    const result = compareBlocks(base, base);
    expect(result.changes).toEqual([]);
    expect(result.stats).toEqual({
      inserted: 0,
      deleted: 0,
      replaced: 0,
      changedChars: 0,
      identical: true,
    });
  });

  it('finds an inserted paragraph and keeps its index', () => {
    const after = [...base.slice(0, 2), { type: 'p', text: '新增一段。' }, ...base.slice(2)];
    const result = compareBlocks(base, after);
    expect(result.stats).toMatchObject({ inserted: 1, deleted: 0, replaced: 0, identical: false });
    expect(result.changes).toEqual([
      {
        kind: 'insert',
        beforeIndex: null,
        afterIndex: 2,
        after: { type: 'p', text: '新增一段。' },
      },
    ]);
  });

  it('finds a deleted paragraph', () => {
    const after = [base[0], base[1], base[3]];
    const result = compareBlocks(base, after);
    expect(result.stats).toMatchObject({ inserted: 0, deleted: 1, replaced: 0 });
    expect(result.changes[0]).toMatchObject({
      kind: 'delete',
      beforeIndex: 2,
      afterIndex: null,
      before: { type: 'p', text: '第二段内容。' },
    });
  });

  it('pairs a rewrite into one replace change instead of delete + insert', () => {
    const after = base.map((block, index) =>
      index === 1 ? { type: 'p', text: '第一段正文。' } : block,
    );
    const result = compareBlocks(base, after);
    expect(result.stats).toMatchObject({ inserted: 0, deleted: 0, replaced: 1, changedChars: 4 });
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({ kind: 'replace', beforeIndex: 1, afterIndex: 1 });
    expect(result.changes[0].segments).toContainEqual({ kind: 'insert', text: '正文' });
    expect(result.changes[0].segments).toContainEqual({ kind: 'delete', text: '内容' });
  });

  it('reports a block-kind change as a format-only replace', () => {
    const after = base.map((block, index) =>
      index === 0 ? { type: 'h2', text: block.text } : block,
    );
    const result = compareBlocks(base, after);
    expect(result.stats).toMatchObject({ replaced: 1, changedChars: 0 });
    expect(result.changes[0]).toMatchObject({ kind: 'replace', formatOnly: true, segments: [] });
  });

  it('pairs multi-line table rows by index', () => {
    const beforeTable: DocBlock[] = [{ type: 'table', text: '姓名\n年龄\n张三\n18' }];
    const afterTable: DocBlock[] = [{ type: 'table', text: '姓名\n年龄\n张三\n20' }];
    const result = compareBlocks(beforeTable, afterTable);
    expect(result.stats).toMatchObject({ replaced: 1, inserted: 0, deleted: 0 });
    expect(result.changes[0].segments).toContainEqual({ kind: 'delete', text: '18' });
    expect(result.changes[0].segments).toContainEqual({ kind: 'insert', text: '20' });
  });

  it('pairs runs element-wise and leaves the surplus as pure inserts', () => {
    const before: DocBlock[] = [
      { type: 'p', text: 'A' },
      { type: 'p', text: 'B' },
    ];
    const after: DocBlock[] = [
      { type: 'p', text: 'A1' },
      { type: 'p', text: 'B1' },
      { type: 'p', text: 'C1' },
    ];
    const result = compareBlocks(before, after);
    expect(result.stats).toMatchObject({ replaced: 2, inserted: 1, deleted: 0 });
    expect(result.changes.filter((change) => change.kind === 'insert')).toHaveLength(1);
  });
});

describe('blocksFromHtml / compareDocuments', () => {
  it('extracts top-level blocks and joins list items with newlines', () => {
    const blocks = blocksFromHtml('<h1>标题</h1><p>第一段</p><ul><li>苹果</li><li>香蕉</li></ul>');
    expect(blocks).toEqual([
      { type: 'h1', text: '标题' },
      { type: 'p', text: '第一段' },
      { type: 'ul', text: '苹果\n香蕉' },
    ]);
  });

  it('normalizes whitespace so re-indentation is not a change', () => {
    const result = compareDocuments('<p>甲乙</p>', '<p>\n  甲乙\n</p>');
    expect(result.stats.identical).toBe(true);
  });

  it('compares two HTML documents end to end', () => {
    const result = compareDocuments(
      '<h1>标题</h1><p>第一段</p><p>第二段</p>',
      '<h1>标题</h1><p>第一段</p><p>第三段</p>',
    );
    expect(result.stats).toMatchObject({ replaced: 1, inserted: 0, deleted: 0 });
    expect(result.changes[0].before?.text).toBe('第二段');
    expect(result.changes[0].after?.text).toBe('第三段');
  });
});
