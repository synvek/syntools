import { describe, expect, it } from 'vitest';
import {
  BRANCH,
  branchColorOf,
  defaultShapeOf,
  defaultStyleOf,
  MIND_THEMES,
  MIND_THEME_IDS,
  themeOf,
} from './themes';
import { MIND_SHAPES } from './types';

describe('脑图主题', () => {
  it('主题 id 唯一且至少 8 套', () => {
    expect(new Set(MIND_THEME_IDS).size).toBe(MIND_THEME_IDS.length);
    expect(MIND_THEMES.length).toBeGreaterThanOrEqual(8);
  });

  it('未知 id 回落到首套主题', () => {
    expect(themeOf('not-exist').id).toBe(MIND_THEMES[0].id);
  });

  it('每套主题都定义了三级样式、分支配色与连线粗细', () => {
    for (const theme of MIND_THEMES) {
      expect(theme.branches.length).toBeGreaterThanOrEqual(6);
      expect(theme.lineWidth).toBeGreaterThan(0);
      expect(theme.background).toMatch(/^#[0-9A-Fa-f]{6}$/);
      for (const level of [theme.root, theme.main, theme.sub]) {
        expect(MIND_SHAPES).toContain(level.shape);
        expect(level.fontSize).toBeGreaterThanOrEqual(10);
        expect(level.fill).toBeTruthy();
      }
    }
  });

  it('defaultStyleOf：中心主题用主题色，一级分支用所属分支色', () => {
    const theme = themeOf('classic');
    const root = defaultStyleOf(theme, 0, theme.branches[0]);
    expect(root.fill).toBe(theme.root.fill);
    expect(root.bold).toBe(theme.root.bold);

    const main = defaultStyleOf(theme, 1, '#123456');
    expect(main.stroke).toBe('#123456');
    expect(main.textColor).toBe('#123456');

    // 二级及以下：描边取分支色，文字色用主题定义的固定色
    const sub = defaultStyleOf(theme, 2, '#123456');
    expect(sub.stroke).toBe('#123456');
    expect(sub.textColor).toBe(theme.sub.textColor);
    expect(sub.fontSize).toBe(theme.sub.fontSize);
  });

  it('BRANCH 占位在填充上同样生效（暖阳橙的一级分支为实心彩底）', () => {
    const theme = themeOf('sunset');
    expect(theme.main.fill).toBe(BRANCH);
    const style = defaultStyleOf(theme, 1, '#ff0000');
    expect(style.fill).toBe('#ff0000');
    expect(style.textColor).toBe('#FFFFFF');
  });

  it('defaultShapeOf 按主题与层级给出默认形状', () => {
    expect(defaultShapeOf(themeOf('classic'), 0)).toBe('pill');
    expect(defaultShapeOf(themeOf('grape'), 0)).toBe('ellipse');
    expect(defaultShapeOf(themeOf('slate'), 0)).toBe('rect');
    expect(defaultShapeOf(themeOf('classic'), 2)).toBe('underline');
  });

  it('branchColorOf 按顺序循环取色', () => {
    const theme = themeOf('classic');
    expect(branchColorOf(theme, 0)).toBe(theme.branches[0]);
    expect(branchColorOf(theme, theme.branches.length)).toBe(theme.branches[0]);
  });
});
