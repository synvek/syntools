import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExtensions } from './extensions';
import {
  addUserWord,
  buildSpellDecorations,
  checkText,
  collectDocIssues,
  createWordIndex,
  editDistance,
  isCheckableWord,
  loadDictionary,
  normalizeWord,
  removeUserWord,
  suggest,
  tokenize,
} from './spellcheck';

/**
 * 拼写检查测试（全部本地、无网络）：
 * 分词边界、编辑距离建议、自定义词典，以及文档级装饰的偏移正确性。
 */

const editors: Editor[] = [];

function createEditor(content: string): Editor {
  const editor = new Editor({
    extensions: createExtensions({ placeholder: '输入内容…' }),
    content,
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  vi.restoreAllMocks();
});

describe('tokenize / normalizeWord', () => {
  it('返回词与在文本中的偏移', () => {
    const tokens = tokenize('the quick brown');
    expect(tokens.map((token) => [token.word, token.start, token.end])).toEqual([
      ['the', 0, 3],
      ['quick', 4, 9],
      ['brown', 10, 15],
    ]);
  });

  it('跳过短词、URL 与邮箱', () => {
    const tokens = tokenize('a be https://example.com/xx hello@example.com world');
    expect(tokens.map((token) => token.word)).toEqual(['world']);
  });

  it('归一化小写并去掉所有格', () => {
    expect(normalizeWord("Editor's")).toBe('editor');
    expect(normalizeWord('Word’s')).toBe('word');
    expect(normalizeWord('WORD')).toBe('word');
  });

  it('驼峰命名不参与检查', () => {
    expect(isCheckableWord('getElementById')).toBe(false);
    expect(isCheckableWord('hello')).toBe(true);
    expect(isCheckableWord('it')).toBe(false);
  });
});

describe('editDistance', () => {
  it('返回真实编辑距离', () => {
    expect(editDistance('kitten', 'sitting', 3)).toBe(3);
    expect(editDistance('word', 'word', 2)).toBe(0);
    expect(editDistance('word', 'words', 2)).toBe(1);
  });

  it('超过阈值时提前返回更大的值', () => {
    expect(editDistance('abcdef', 'zzzzzz', 1)).toBeGreaterThan(1);
    expect(editDistance('a', 'abcdefgh', 2)).toBeGreaterThan(2);
  });
});

describe('suggest', () => {
  const index = createWordIndex(['hello', 'help', 'helm', 'world', 'yellow']);

  it('优先返回编辑距离为 1 的候选，同级按字母序', () => {
    // 字母序：hello < helm < help（第 4 个字符 l < m < p）
    expect(suggest('helo', index, 5)).toEqual(['hello', 'helm', 'help']);
  });

  it('尊重数量上限且不含原词', () => {
    expect(suggest('help', index, 2)).toHaveLength(2);
    expect(suggest('help', index, 5)).not.toContain('help');
  });

  it('词表为空时返回空数组', () => {
    expect(suggest('helo', createWordIndex([]), 5)).toEqual([]);
  });

  it('自定义词典里的词也会成为候选', () => {
    expect(suggest('syntol', createWordIndex([]), 5, ['syntools'])).toEqual(['syntools']);
  });
});

describe('checkText', () => {
  const dictionary = { words: new Set(['hello', 'world', 'quick', 'brown']), userWords: [] };

  it('只报告不在词典中的词', () => {
    const issues = checkText('hello wrold', dictionary);
    expect(issues.map((issue) => issue.word)).toEqual(['wrold']);
    expect(issues[0].start).toBe(6);
  });

  it('把自定义词典计入已知词', () => {
    expect(checkText('syntools', { ...dictionary, userWords: ['syntools'] })).toEqual([]);
  });

  it('全大写缩写不视为拼写错误', () => {
    expect(checkText('HTTP API', dictionary)).toEqual([]);
  });

  it('空文本返回空结果', () => {
    expect(checkText('', dictionary)).toEqual([]);
  });
});

describe('自定义词典', () => {
  it('添加去重并归一化', () => {
    expect(addUserWord([], "Alpha's")).toEqual(['alpha']);
    expect(addUserWord(['alpha'], 'alpha')).toEqual(['alpha']);
    expect(addUserWord(['alpha'], '  ')).toEqual(['alpha']);
  });

  it('移除同样按归一化比较', () => {
    expect(removeUserWord(['alpha', 'beta'], "Alpha's")).toEqual(['beta']);
  });
});

describe('loadDictionary', () => {
  it('解析纯文本词表（服务端已透明解码的情况）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('hello\nworld\n\nHELLO\n', { status: 200 })),
    );
    const result = await loadDictionary('test-words.txt');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.value]).toEqual(['hello', 'world']);
  });

  it('请求失败时返回错误而不抛异常', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    expect(await loadDictionary('missing.txt')).toEqual({ ok: false, error: 'DICT_LOAD_FAILED' });
  });

  it('内容为空时同样视为加载失败', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('\n\n', { status: 200 })),
    );
    expect(await loadDictionary('empty.txt')).toEqual({ ok: false, error: 'DICT_LOAD_FAILED' });
  });
});

describe('文档级装饰与问题清单', () => {
  const dictionary = { words: new Set(['hello', 'world', 'and']), userWords: [] };

  it('装饰覆盖拼错的词，偏移与文本一致', () => {
    const editor = createEditor('<p>hello wrold</p>');
    const deco = buildSpellDecorations(editor.state.doc, dictionary);
    const found = deco.find();
    expect(found).toHaveLength(1);
    // 段落起始偏移 1 + 'hello ' 6 个字符
    expect(found[0].from).toBe(1 + 6);
    expect(found[0].to).toBe(1 + 11);
    // 装饰类名由 CSS 命中（Decoration 类型未公开 attrs，这里显式取内部结构）
    const spec = found[0] as unknown as { type: { attrs: { class?: string } } };
    expect(spec.type.attrs.class).toBe('rte-spell-error');
  });

  it('collectDocIssues 返回带文档位置的问题并遵守上限', () => {
    const editor = createEditor('<p>hello wrold and anther</p>');
    const issues = collectDocIssues(editor.state.doc, dictionary);
    expect(issues.map((issue) => issue.word)).toEqual(['wrold', 'anther']);
    expect(issues[0].from).toBeLessThan(issues[1].from);
    expect(collectDocIssues(editor.state.doc, dictionary, 1)).toHaveLength(1);
  });

  it('词典命中时没有装饰与问题', () => {
    const editor = createEditor('<p>hello world</p>');
    expect(buildSpellDecorations(editor.state.doc, dictionary).find()).toHaveLength(0);
    expect(collectDocIssues(editor.state.doc, dictionary)).toEqual([]);
  });
});
