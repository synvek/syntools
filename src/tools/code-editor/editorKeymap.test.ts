import { describe, expect, it } from 'vitest';
import {
  chordOf,
  detectMac,
  EDITOR_BINDINGS,
  formatChord,
  isUndoRedo,
  matchShortcut,
  type EditorKeyEvent,
} from './editorKeymap';

/** Build a minimal keyboard event (macOS semantics by default: primary = metaKey) */
function keyEvent(init: Partial<EditorKeyEvent> & { key: string }): EditorKeyEvent {
  return {
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...init,
  };
}

describe('matchShortcut（macOS：⌘ 为主修饰键）', () => {
  it('解析行操作与格式化快捷键', () => {
    const mac = { mac: true };
    expect(matchShortcut(keyEvent({ key: '/', metaKey: true }), mac)).toBe('toggleLineComment');
    expect(matchShortcut(keyEvent({ key: '/', metaKey: true, altKey: true }), mac)).toBe(
      'toggleBlockComment',
    );
    expect(matchShortcut(keyEvent({ key: 'ArrowUp', altKey: true }), mac)).toBe('moveLineUp');
    expect(matchShortcut(keyEvent({ key: 'ArrowDown', altKey: true }), mac)).toBe('moveLineDown');
    expect(matchShortcut(keyEvent({ key: 'ArrowUp', altKey: true, shiftKey: true }), mac)).toBe(
      'copyLineUp',
    );
    expect(matchShortcut(keyEvent({ key: 'ArrowDown', altKey: true, shiftKey: true }), mac)).toBe(
      'copyLineDown',
    );
    expect(matchShortcut(keyEvent({ key: 'K', metaKey: true, shiftKey: true }), mac)).toBe(
      'deleteLine',
    );
    expect(matchShortcut(keyEvent({ key: 'ArrowUp', metaKey: true, altKey: true }), mac)).toBe(
      'transposeLine',
    );
    expect(matchShortcut(keyEvent({ key: ']', metaKey: true }), mac)).toBe('indent');
    expect(matchShortcut(keyEvent({ key: '[', metaKey: true }), mac)).toBe('outdent');
    expect(matchShortcut(keyEvent({ key: 'F', metaKey: true, shiftKey: true }), mac)).toBe(
      'format',
    );
    expect(matchShortcut(keyEvent({ key: 'l', metaKey: true }), mac)).toBe('gotoLine');
  });

  it('Option 改变的标点字符用 KeyboardEvent.code 回退匹配', () => {
    // On macOS ⌘⌥/ actually produces '÷', so key alone cannot identify it
    expect(
      matchShortcut(keyEvent({ key: '÷', code: 'Slash', metaKey: true, altKey: true }), {
        mac: true,
      }),
    ).toBe('toggleBlockComment');
    // Windows / Linux map to Ctrl+Alt+/ (the key itself is unchanged)
    expect(
      matchShortcut(keyEvent({ key: '/', code: 'Slash', ctrlKey: true, altKey: true }), {
        mac: false,
      }),
    ).toBe('toggleBlockComment');
  });

  it('⇧Tab 减少缩进', () => {
    expect(matchShortcut(keyEvent({ key: 'Tab', shiftKey: true }), { mac: true })).toBe('outdent');
    // A bare Tab is left to CodeJar, which inserts indentation
    expect(matchShortcut(keyEvent({ key: 'Tab' }), { mac: true })).toBeNull();
  });
});

describe('matchShortcut（Windows / Linux：Ctrl 为主修饰键）', () => {
  const win = { mac: false };

  it('Ctrl 组合生效，⌘（meta）不生效', () => {
    expect(matchShortcut(keyEvent({ key: '/', ctrlKey: true }), win)).toBe('toggleLineComment');
    expect(matchShortcut(keyEvent({ key: 'F', ctrlKey: true, shiftKey: true }), win)).toBe(
      'format',
    );
    expect(matchShortcut(keyEvent({ key: '/', metaKey: true }), win)).toBeNull();
  });

  it('macOS 上按 Ctrl 不触发（避免与系统 / 输入法快捷键冲突）', () => {
    expect(matchShortcut(keyEvent({ key: '/', ctrlKey: true }), { mac: true })).toBeNull();
  });
});

describe('matchShortcut 的边界', () => {
  it('无修饰键的普通字符不匹配', () => {
    expect(matchShortcut(keyEvent({ key: 'a' }), { mac: true })).toBeNull();
    expect(matchShortcut(keyEvent({ key: '/' }), { mac: true })).toBeNull();
  });

  it('修饰键必须精确匹配，避免吞掉浏览器 / 系统快捷键', () => {
    // ⌘⇧/ is not bound to anything (the browser default is kept)
    expect(
      matchShortcut(keyEvent({ key: '/', metaKey: true, shiftKey: true }), { mac: true }),
    ).toBeNull();
    // Anything but ⇧⌘K: ⌘K (no shift) does not match
    expect(matchShortcut(keyEvent({ key: 'k', metaKey: true }), { mac: true })).toBeNull();
  });

  it('可通过 bindings 覆盖绑定表（便于后续阶段注入查找类动作）', () => {
    expect(
      matchShortcut(keyEvent({ key: 'f', metaKey: true }), {
        mac: true,
        bindings: [{ action: 'find', chord: { key: 'f', primary: true } }],
      }),
    ).toBe('find');
  });
});

describe('isUndoRedo', () => {
  it('识别撤销 / 重做', () => {
    expect(isUndoRedo(keyEvent({ key: 'z', metaKey: true }), true)).toBe(true);
    expect(isUndoRedo(keyEvent({ key: 'Z', metaKey: true, shiftKey: true }), true)).toBe(true);
    expect(isUndoRedo(keyEvent({ key: 'y', ctrlKey: true }), false)).toBe(true);
    expect(isUndoRedo(keyEvent({ key: 'z', metaKey: true, altKey: true }), true)).toBe(false);
    expect(isUndoRedo(keyEvent({ key: 'a', metaKey: true }), true)).toBe(false);
  });
});

describe('展示用工具', () => {
  it('detectMac 依据 platform / userAgent', () => {
    expect(detectMac({ platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh)' })).toBe(true);
    expect(detectMac({ platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0)' })).toBe(
      false,
    );
    expect(detectMac(undefined)).toBe(false);
  });

  it('formatChord 按平台生成可读提示', () => {
    expect(formatChord({ key: 'f', primary: true, shift: true }, true)).toBe('⌘⇧F');
    expect(formatChord({ key: 'f', primary: true, shift: true }, false)).toBe('Ctrl+Shift+F');
    expect(formatChord({ key: 'ArrowUp', alt: true }, true)).toBe('⌥ArrowUp');
  });

  it('绑定表内动作不重复（除 outdent 的双绑定）', () => {
    const actions = EDITOR_BINDINGS.map((binding) => binding.action);
    const duplicated = actions.filter((action, index) => actions.indexOf(action) !== index);
    expect(new Set(duplicated)).toEqual(new Set(['outdent']));
    expect(chordOf('format')?.key).toBe('f');
    expect(chordOf('find')).toEqual({ key: 'f', primary: true });
    expect(chordOf('jumpToBracket')).toEqual({ key: '\\', primary: true, shift: true });
  });
});
