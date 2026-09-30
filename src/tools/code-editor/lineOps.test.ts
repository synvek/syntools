import { describe, expect, it } from 'vitest';
import {
  applyEdits,
  deleteLines,
  duplicateLines,
  indentLines,
  moveLines,
  selectLine,
  selectionLineRange,
  toggleBlockComment,
  toggleLineComment,
  transposeLine,
} from './lineOps';

describe('applyEdits', () => {
  it('按序应用编辑并同步选区，落在删除区间内的光标贴到插入内容之后', () => {
    expect(applyEdits('abcdef', [{ at: 1, remove: 3, insert: '' }], 3, 3)).toEqual({
      text: 'aef',
      selectionStart: 1,
      selectionEnd: 1,
    });
    expect(applyEdits('ab', [{ at: 1, remove: 0, insert: 'X' }], 1, 2)).toEqual({
      text: 'aXb',
      selectionStart: 2,
      selectionEnd: 3,
    });
    // 多处编辑（注释放到两行行首）
    expect(
      applyEdits(
        'a\nb',
        [
          { at: 2, remove: 0, insert: '#' },
          { at: 0, remove: 0, insert: '#' },
        ],
        0,
        3,
      ).text,
    ).toBe('#a\n#b');
  });
});

describe('selectionLineRange', () => {
  it('折叠光标只覆盖所在行', () => {
    expect(selectionLineRange('a\nbc\nd', 3, 3)).toEqual({
      firstLine: 2,
      lastLine: 2,
      start: 2,
      end: 4,
    });
  });

  it('跨行选区覆盖首末行，结束落在行首时不把该行计入', () => {
    expect(selectionLineRange('a\nb\nc', 0, 3)).toEqual({
      firstLine: 1,
      lastLine: 2,
      start: 0,
      end: 3,
    });
    expect(selectionLineRange('a\nb\nc', 0, 2)).toEqual({
      firstLine: 1,
      lastLine: 1,
      start: 0,
      end: 1,
    });
  });
});

describe('toggleLineComment', () => {
  it('在行首空白之后加注释，光标随插入位移', () => {
    const result = toggleLineComment('let a = 1;', 0, 0, '//');
    expect(result.ok && result.value).toEqual({
      text: '// let a = 1;',
      selectionStart: 3,
      selectionEnd: 3,
    });
  });

  it('保留原有缩进', () => {
    const result = toggleLineComment('  let a = 1;', 0, 0, '//');
    expect(result.ok && result.value.text).toBe('  // let a = 1;');
  });

  it('取消注释时连同一个尾随空格一并移除', () => {
    const spaced = toggleLineComment('// let a = 1;', 0, 0, '//');
    expect(spaced.ok && spaced.value.text).toBe('let a = 1;');
    const tight = toggleLineComment('//let a = 1;', 0, 0, '//');
    expect(tight.ok && tight.value.text).toBe('let a = 1;');
  });

  it('混合选区统一加注释，空行跳过', () => {
    const result = toggleLineComment('a\n\nb', 0, 4, '//');
    expect(result.ok && result.value.text).toBe('// a\n\n// b');
  });

  it('两次切换回到原文（多行 / 两种注释符族）', () => {
    for (const marker of ['//', '#', '--']) {
      const first = toggleLineComment('  a\n  b', 0, 7, marker);
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      const second = toggleLineComment(first.value.text, 0, first.value.text.length, marker);
      expect(second.ok && second.value.text).toBe('  a\n  b');
    }
  });

  it('语言不支持行注释时返回 UNSUPPORTED', () => {
    expect(toggleLineComment('a', 0, 0, undefined)).toEqual({ ok: false, error: 'UNSUPPORTED' });
  });
});

describe('toggleBlockComment', () => {
  it('折叠光标插入成对块注释并把光标放到中间', () => {
    const result = toggleBlockComment('ab', 1, 1, ['/*', '*/']);
    expect(result.ok && result.value).toEqual({
      text: 'a/* */b',
      selectionStart: 4,
      selectionEnd: 4,
    });
  });

  it('包裹选区，再次调用拆掉包裹（往返一致）', () => {
    const wrapped = toggleBlockComment('let a = 1;', 4, 5, ['/*', '*/']);
    expect(wrapped.ok && wrapped.value.text).toBe('let /* a */ = 1;');
    expect(wrapped.ok && wrapped.value.selectionStart).toBe(7);
    expect(wrapped.ok && wrapped.value.selectionEnd).toBe(8);

    const unwrapped = toggleBlockComment(wrapped.ok ? wrapped.value.text : '', 7, 8, ['/*', '*/']);
    expect(unwrapped.ok && unwrapped.value.text).toBe('let a = 1;');
    expect(unwrapped.ok && unwrapped.value.selectionStart).toBe(4);
    expect(unwrapped.ok && unwrapped.value.selectionEnd).toBe(5);
  });

  it('折叠光标处再次触发即拆掉', () => {
    const once = toggleBlockComment('ab', 1, 1, ['/*', '*/']);
    const twice = toggleBlockComment(once.ok ? once.value.text : '', 4, 4, ['/*', '*/']);
    expect(twice.ok && twice.value.text).toBe('ab');
    expect(twice.ok && twice.value.selectionStart).toBe(1);
  });

  it('语言不支持块注释时返回 UNSUPPORTED', () => {
    expect(toggleBlockComment('a', 0, 1, undefined)).toEqual({ ok: false, error: 'UNSUPPORTED' });
  });
});

describe('moveLines', () => {
  it('上移 / 下移整行块并跟随选区', () => {
    expect(moveLines('a\nb\nc', 2, 2, 'up')).toEqual({
      text: 'b\na\nc',
      selectionStart: 0,
      selectionEnd: 0,
    });
    expect(moveLines('a\nb\nc', 2, 2, 'down')).toEqual({
      text: 'a\nc\nb',
      selectionStart: 4,
      selectionEnd: 4,
    });
  });

  it('在首行 / 末行时原样返回', () => {
    expect(moveLines('a\nb', 0, 0, 'up').text).toBe('a\nb');
    expect(moveLines('a\nb', 2, 2, 'down').text).toBe('a\nb');
  });

  it('保留 CRLF 换行符', () => {
    const result = moveLines('a\r\nb', 3, 3, 'up');
    expect(result.text).toBe('b\r\na');
    expect(result.selectionStart).toBe(0);
  });
});

describe('duplicateLines', () => {
  it('中间行复制到下方，选区保持在原行', () => {
    expect(duplicateLines('a\nb\nc', 2, 2)).toEqual({
      text: 'a\nb\nb\nc',
      selectionStart: 2,
      selectionEnd: 2,
    });
  });

  it('向上复制插到原行之前，选区跟随原行下移', () => {
    expect(duplicateLines('a\nb\nc', 2, 2, 'up')).toEqual({
      text: 'a\nb\nb\nc',
      selectionStart: 4,
      selectionEnd: 4,
    });
  });

  it('末行复制不需要额外的尾随换行', () => {
    expect(duplicateLines('a\nb', 2, 2).text).toBe('a\nb\nb');
    expect(duplicateLines('a\nb', 2, 2, 'up').text).toBe('a\nb\nb');
  });

  it('保留 CRLF 换行符', () => {
    expect(duplicateLines('a\r\nb', 3, 3).text).toBe('a\r\nb\r\nb');
  });
});

describe('deleteLines', () => {
  it('删除中间行连同其换行', () => {
    expect(deleteLines('a\nb\nc', 2, 2)).toEqual({
      text: 'a\nc',
      selectionStart: 2,
      selectionEnd: 2,
    });
  });

  it('删除末行连同上一行的换行', () => {
    expect(deleteLines('a\nb', 3, 3).text).toBe('a');
  });

  it('删除唯一一行后为空文本', () => {
    expect(deleteLines('abc', 1, 1)).toEqual({ text: '', selectionStart: 0, selectionEnd: 0 });
  });
});

describe('transposeLine', () => {
  it('首行与下一行互换，其余与上一行互换', () => {
    expect(transposeLine('a\nb\nc', 0, 0).text).toBe('b\na\nc');
    expect(transposeLine('a\nb\nc', 4, 4).text).toBe('a\nc\nb');
  });
});

describe('indentLines', () => {
  it('增加缩进（空行跳过）', () => {
    const result = indentLines('a\n\n  b', 0, 6, '  ', 1);
    expect(result.text).toBe('  a\n\n    b');
  });

  it('减少缩进最多移除一个缩进单元', () => {
    expect(indentLines('    a', 0, 5, '  ', -1).text).toBe('  a');
    expect(indentLines('\ta', 0, 2, '\t', -1).text).toBe('a');
    // 空格数不足一个单元时只移除已有空白
    expect(indentLines(' a', 0, 2, '    ', -1).text).toBe('a');
    expect(indentLines('a', 0, 1, '  ', -1).text).toBe('a');
  });
});

describe('selectLine', () => {
  it('选中整行且越界钳制', () => {
    expect(selectLine('a\nbc', 2)).toEqual({ text: 'a\nbc', selectionStart: 2, selectionEnd: 4 });
    expect(selectLine('a\nbc', 99).selectionStart).toBe(2);
  });
});
