import { describe, expect, it } from 'vitest';
import {
  applyRename,
  bulkRename,
  DEFAULT_RENAME_RULES,
  findDuplicates,
  splitName,
  type RenameRules,
} from './core';

const rules = (partial: Partial<RenameRules>): RenameRules => ({
  ...DEFAULT_RENAME_RULES,
  ...partial,
});

describe('bulk-rename 拆分', () => {
  it('拆分基础名与扩展名', () => {
    expect(splitName('photo.jpg')).toEqual({ base: 'photo', ext: '.jpg' });
    expect(splitName('.gitignore')).toEqual({ base: '.gitignore', ext: '' });
    expect(splitName('archive.tar.gz')).toEqual({ base: 'archive.tar', ext: '.gz' });
  });
});

describe('bulk-rename 规则', () => {
  it('前后缀', () => {
    expect(applyRename('a.txt', 0, rules({ prefix: 'pre_', suffix: '_suf' }))).toBe(
      'pre_a_suf.txt',
    );
  });

  it('查找替换', () => {
    expect(applyRename('IMG_001.jpg', 0, rules({ search: 'IMG', replace: 'Photo' }))).toBe(
      'Photo_001.jpg',
    );
  });

  it('正则替换', () => {
    expect(
      applyRename('file001.txt', 0, rules({ search: '\\d+', replace: 'X', useRegex: true })),
    ).toBe('fileX.txt');
  });

  it('大小写转换', () => {
    expect(applyRename('Hello.TXT', 0, rules({ caseTransform: 'lower' }))).toBe('hello.TXT');
  });

  it('编号（前缀补零）', () => {
    expect(
      applyRename(
        'a.txt',
        4,
        rules({ numbering: { enabled: true, start: 1, padding: 3, position: 'prefix' } }),
      ),
    ).toBe('005a.txt');
  });

  it('编号（后缀）', () => {
    expect(
      applyRename(
        'a.txt',
        0,
        rules({ numbering: { enabled: true, start: 10, padding: 2, position: 'suffix' } }),
      ),
    ).toBe('a10.txt');
  });

  it('替换扩展名', () => {
    expect(applyRename('a.jpeg', 0, rules({ newExtension: 'png' }))).toBe('a.png');
    expect(applyRename('a.jpeg', 0, rules({ newExtension: '.webp' }))).toBe('a.webp');
  });

  it('保留扩展名', () => {
    expect(applyRename('a.jpeg', 0, rules({ prefix: 'x_' }))).toBe('x_a.jpeg');
  });
});

describe('bulk-rename 批量', () => {
  it('批量生成映射', () => {
    const r = bulkRename(
      ['a.txt', 'b.txt'],
      rules({
        prefix: 'p_',
        numbering: { enabled: true, start: 1, padding: 2, position: 'suffix' },
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual([
      { from: 'a.txt', to: 'p_a01.txt' },
      { from: 'b.txt', to: 'p_b02.txt' },
    ]);
  });

  it('空列表报错', () => {
    expect(bulkRename([], DEFAULT_RENAME_RULES)).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('非法正则报错', () => {
    const r = bulkRename(['a.txt'], rules({ search: '([', useRegex: true }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('INVALID_REGEX');
  });

  it('检测重名', () => {
    const r = bulkRename(
      ['a.txt', 'b.txt'],
      rules({
        prefix: 'same_',
        search: '',
        replace: '',
        numbering: { ...DEFAULT_RENAME_RULES.numbering, enabled: false },
      }),
    );
    // 前缀相同不会重名；构造重名场景
    expect(r.ok).toBe(true);
    const dup = findDuplicates([
      { from: 'a.txt', to: 'x.txt' },
      { from: 'b.txt', to: 'x.txt' },
      { from: 'c.txt', to: 'y.txt' },
    ]);
    expect(dup).toEqual(['x.txt']);
  });
});
