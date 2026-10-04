import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';
import { collectLatex, injectMath } from './math';

/**
 * 公式测试：
 * - 节点只存 LaTeX 源码（atom），预览由 NodeView 用 KaTeX 渲染；
 * - 导出前 injectMath 把源码渲染为 MathML，保证单文件 HTML 不依赖外部样式表；
 * - 序列化结果必须能被再次解析回公式节点。
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
});

describe('公式节点命令', () => {
  it('插入行内公式后序列化带 data-latex 与 data-display', () => {
    const editor = createEditor('<p>正文</p>');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertInlineMath('\\frac{a}{b}');
    const html = editor.getHTML();
    expect(html).toContain('data-math="inline"');
    expect(html).toContain('data-latex="\\frac{a}{b}"');
    expect(html).toContain('data-display="false"');
  });

  it('插入块级公式为独立块节点', () => {
    const editor = createEditor('<p>正文</p>');
    editor.commands.insertBlockMath('\\sum_{i=1}^{n} a_i');
    const html = editor.getHTML();
    expect(html).toContain('<div');
    expect(html).toContain('data-display="true"');
    expect(collectLatex(editor.state.doc)).toEqual(['\\sum_{i=1}^{n} a_i']);
  });

  it('序列化结果可再次解析回公式节点', () => {
    const editor = createEditor(
      '<p>前<span data-math="inline" data-latex="x^2" data-display="false"></span>后</p>' +
        '<div data-math="block" data-latex="y_i" data-display="true"></div>',
    );
    expect(collectLatex(editor.state.doc)).toEqual(['x^2', 'y_i']);
  });

  it('updateMath / removeMath 作用于指定位置的公式', () => {
    const editor = createEditor('<p>正文</p>');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertInlineMath('a');
    const pos = editor.state.selection.from - 1;
    expect(editor.state.doc.nodeAt(pos)?.type.name).toBe('mathInline');
    expect(editor.commands.updateMath(pos, 'a^2')).toBe(true);
    expect(collectLatex(editor.state.doc)).toEqual(['a^2']);
    expect(editor.commands.removeMath(pos)).toBe(true);
    expect(collectLatex(editor.state.doc)).toEqual([]);
  });

  it('对非公式位置执行命令返回 false', () => {
    const editor = createEditor('<p>正文</p>');
    expect(editor.commands.updateMath(0, 'x')).toBe(false);
    expect(editor.commands.removeMath(0)).toBe(false);
  });

  it('NodeView 用 KaTeX 渲染预览，失败时回退为源码', () => {
    const editor = createEditor('<p>正文</p>');
    editor.commands.insertBlockMath('\\frac{a}{b}');
    expect(editor.view.dom.querySelector('.rte-math .katex')).not.toBeNull();

    // 语法错误时回退为源码并标注错误，而不是渲染出红色报错样式
    editor.commands.insertBlockMath('\\undefinedcmd{x}');
    const failed = Array.from(editor.view.dom.querySelectorAll('.rte-math-error'));
    expect(failed.length).toBe(1);
    expect(failed[0].textContent).toContain('\\undefinedcmd{x}');
  });
});

describe('injectMath', () => {
  it('把公式节点的 LaTeX 渲染为 MathML 并保留 data-latex', () => {
    const html = injectMath(
      '<p>前<span data-math="inline" data-latex="x^2" data-display="false"></span>后</p>',
    );
    expect(html).toContain('<math');
    expect(html).toContain('data-latex="x^2"');
    expect(html).toContain('前');
    expect(html).toContain('后');
  });

  it('块级公式以 display 模式渲染', () => {
    const html = injectMath(
      '<div data-math="block" data-display="true" data-latex="\\sum_{i=1}^{n} a_i"></div>',
    );
    expect(html).toContain('<math');
    expect(html).toContain('display="block"');
  });

  it('没有公式时原样返回', () => {
    const html = '<p>只有正文</p>';
    expect(injectMath(html)).toBe(html);
  });

  it('LaTeX 为空或渲染失败时保留节点与源码，不丢内容', () => {
    const empty = injectMath('<span data-math="inline" data-latex=""></span>');
    expect(empty).toContain('data-latex=""');

    const broken = injectMath('<span data-math="inline" data-latex="\\undefinedcmd{x}"></span>');
    expect(broken).toContain('$\\undefinedcmd{x}$');
  });
});
