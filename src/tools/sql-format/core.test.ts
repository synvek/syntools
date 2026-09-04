import { describe, expect, it } from 'vitest';
import { DEFAULT_SQL_OPTIONS, formatSqlText } from './core';

const SQL = "select id,name from users where id = 1 and name = 'a' order by id desc";

const ok = (input: string, options = DEFAULT_SQL_OPTIONS) => {
  const result = formatSqlText(input, options);
  expect(result.ok).toBe(true);
  return result.ok ? result.value : '';
};

describe('formatSqlText', () => {
  it('基础格式化：关键字大写 + 换行', () => {
    const output = ok(SQL);
    expect(output).toContain('SELECT');
    expect(output).toContain('FROM');
    expect(output).toContain('WHERE');
    expect(output.split('\n').length).toBeGreaterThan(2);
  });

  it('keywordCase：lower 与 preserve', () => {
    expect(ok(SQL, { ...DEFAULT_SQL_OPTIONS, keywordCase: 'lower' })).toContain('select');
    // preserve：保留原文小写关键字，不被提升为大写（关键字后默认换行，逐词断言）
    const preserved = ok(SQL, { ...DEFAULT_SQL_OPTIONS, keywordCase: 'preserve' });
    expect(preserved).toContain('select');
    expect(preserved).toContain('from');
    expect(preserved).not.toContain('SELECT');
  });

  it('tabWidth 控制缩进', () => {
    const out2 = ok(SQL, { ...DEFAULT_SQL_OPTIONS, tabWidth: 2 });
    const out4 = ok(SQL, { ...DEFAULT_SQL_OPTIONS, tabWidth: 4 });
    expect(out4).toContain('\n    ');
    expect(out2).toContain('\n  ');
    expect(out2).not.toContain('\n    ');
  });

  it('MySQL 方言：反引号标识符保留', () => {
    const output = ok('select `user`.`name` from `user`', {
      ...DEFAULT_SQL_OPTIONS,
      language: 'mysql',
    });
    expect(output).toContain('`user`');
  });

  it('中文值与字符串字面量不被破坏', () => {
    const output = ok("select * from t where name = '张三'");
    expect(output).toContain("'张三'");
  });

  it('非法 SQL 返回 INVALID（未闭合字符串字面量触发解析错误）', () => {
    expect(formatSqlText("select * from t where name = 'abc", DEFAULT_SQL_OPTIONS)).toEqual({
      ok: false,
      error: 'INVALID',
    });
  });

  it('空输入返回 EMPTY', () => {
    expect(formatSqlText('', DEFAULT_SQL_OPTIONS)).toEqual({ ok: false, error: 'EMPTY' });
    expect(formatSqlText('   ', DEFAULT_SQL_OPTIONS)).toEqual({ ok: false, error: 'EMPTY' });
  });
});
