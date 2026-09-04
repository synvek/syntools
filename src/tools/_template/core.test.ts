import { describe, expect, it } from 'vitest';
import { countText } from './core';

describe('countText（模板：替换为你的工具测试，覆盖率 ≥ 80%）', () => {
  it('统计字符 / 单词 / 行数', () => {
    const result = countText('hello world\n你好');
    expect(result).toEqual({ ok: true, value: { chars: 14, words: 3, lines: 2 } });
  });

  it('Unicode 字符按码点计数', () => {
    const result = countText('😀');
    expect(result).toEqual({ ok: true, value: { chars: 1, words: 1, lines: 1 } });
  });

  it('空输入返回错误而非抛异常', () => {
    expect(countText('   ')).toEqual({ ok: false, error: '请输入要统计的内容' });
  });
});
