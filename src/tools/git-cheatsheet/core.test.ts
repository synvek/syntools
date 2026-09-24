import { describe, expect, it } from 'vitest';
import { filterGitCommands, GIT_CATEGORIES, GIT_COMMANDS } from './core';

describe('git-cheatsheet', () => {
  it('分类均被使用', () => {
    const used = new Set(GIT_COMMANDS.map((c) => c.category));
    for (const c of GIT_CATEGORIES) expect(used.has(c)).toBe(true);
  });

  it('命令不重复', () => {
    const cmds = GIT_COMMANDS.map((c) => c.command);
    expect(new Set(cmds).size).toBe(cmds.length);
  });

  it('按关键字过滤命令', () => {
    const r = filterGitCommands('rebase');
    expect(r.length).toBeGreaterThan(0);
    expect(
      r.every(
        (c) => c.command.includes('rebase') || c.description.toLowerCase().includes('rebase'),
      ),
    ).toBe(true);
  });

  it('按描述过滤', () => {
    const r = filterGitCommands('stash');
    expect(r.some((c) => c.category === 'stash')).toBe(true);
  });

  it('空查询返回全部', () => {
    expect(filterGitCommands('').length).toBe(GIT_COMMANDS.length);
  });

  it('无匹配返回空', () => {
    expect(filterGitCommands('zzz-not-a-command')).toEqual([]);
  });
});
