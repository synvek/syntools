import { describe, expect, it } from 'vitest';
import { SHEET_COMMANDS } from './commands';
import {
  duplicateShortcuts,
  findShortcut,
  formatShortcut,
  matchesShortcut,
  parseShortcut,
  SHEET_SHORTCUTS,
  shortcutLabel,
} from './shortcuts';

/**
 * Shortcut layer (P1-1).
 *
 * Two failure modes are worth locking down: a combo that silently binds to two commands (the second
 * becomes unreachable) and a matcher that fires on a superset combo (⌘S also firing on ⌘⇧S).
 */

const event = (overrides: Partial<Parameters<typeof matchesShortcut>[0]> = {}) => ({
  key: 's',
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...overrides,
});

describe('parseShortcut', () => {
  it('解析修饰键与字母', () => {
    expect(parseShortcut('Mod+Shift+S')).toEqual({
      key: 's',
      mod: true,
      shift: true,
      alt: false,
    });
  });

  it('接受 cmd / ctrl / option 等别名，大小写不敏感', () => {
    expect(parseShortcut('CMD+Option+K')?.key).toBe('k');
    expect(parseShortcut('ctrl+alt+k')).toEqual({ key: 'k', mod: true, shift: false, alt: true });
  });

  it('拒绝非法写法，而不是猜一个键', () => {
    expect(parseShortcut('')).toBeNull();
    expect(parseShortcut('Mod+')).toBeNull();
    expect(parseShortcut('Mod+A+B')).toBeNull();
  });
});

describe('formatShortcut', () => {
  it('macOS 用符号，其他平台用单词', () => {
    expect(formatShortcut('Mod+Shift+S', true)).toBe('⌘⇧S');
    expect(formatShortcut('Mod+Shift+S', false)).toBe('Ctrl+Shift+S');
    expect(formatShortcut('Mod+Alt+1', true)).toBe('⌘⌥1');
  });
});

describe('matchesShortcut', () => {
  const mod = parseShortcut('Mod+S');
  if (!mod) throw new Error('Mod+S must parse');

  it('macOS 只认 ⌘，Windows/Linux 只认 Ctrl', () => {
    expect(matchesShortcut(event({ metaKey: true }), mod, true)).toBe(true);
    expect(matchesShortcut(event({ ctrlKey: true }), mod, true)).toBe(false);
    expect(matchesShortcut(event({ ctrlKey: true }), mod, false)).toBe(true);
    expect(matchesShortcut(event({ metaKey: true }), mod, false)).toBe(false);
  });

  it('多余的修饰键不匹配（⌘S 不会吃掉 ⌘⇧S）', () => {
    expect(matchesShortcut(event({ metaKey: true, shiftKey: true }), mod, true)).toBe(false);
  });

  it('缺省修饰键时，按下 Ctrl/⌘ 就不算匹配', () => {
    const plain = parseShortcut('S');
    if (!plain) throw new Error('S must parse');
    expect(matchesShortcut(event(), plain, true)).toBe(true);
    expect(matchesShortcut(event({ metaKey: true }), plain, true)).toBe(false);
  });
});

describe('findShortcut', () => {
  it('把事件映射到对应命令', () => {
    expect(findShortcut(event({ metaKey: true }), true)).toBe('exportXlsx');
    expect(findShortcut(event({ ctrlKey: true, shiftKey: true }), false)).toBe('exportCsv');
    expect(findShortcut(event({ ctrlKey: true, altKey: true, key: '1' }), false)).toBe(
      'formatCells',
    );
  });

  it('没有绑定的组合返回 null', () => {
    expect(findShortcut(event({ ctrlKey: true, key: 'q' }), false)).toBeNull();
  });
});

describe('table integrity', () => {
  it('每条绑定都指向真实命令', () => {
    for (const binding of SHEET_SHORTCUTS) {
      expect(SHEET_COMMANDS[binding.id], binding.id).toBeDefined();
    }
  });

  it('没有重复占用同一个组合', () => {
    expect(duplicateShortcuts()).toEqual([]);
  });

  it('不绑定浏览器不可拦截的 ⌘N / ⌘T / ⌘W', () => {
    const reserved = new Set(['mod+n', 'mod+t', 'mod+w']);
    for (const binding of SHEET_SHORTCUTS) {
      for (const keys of binding.keys) {
        const parsed = parseShortcut(keys);
        if (!parsed) continue;
        const signature = `${parsed.mod ? 'mod+' : ''}${parsed.shift ? 'shift+' : ''}${
          parsed.alt ? 'alt+' : ''
        }${parsed.key}`;
        expect(reserved.has(signature), signature).toBe(false);
      }
    }
  });

  it('菜单里显示的快捷键来自同一张表', () => {
    expect(shortcutLabel('exportXlsx', true)).toBe('⌘S');
    expect(shortcutLabel('exportXlsx', false)).toBe('Ctrl+S');
    expect(shortcutLabel('paste', false)).toBeNull();
  });
});
