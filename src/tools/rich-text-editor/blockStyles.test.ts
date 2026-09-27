import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT_WIDTH_PX } from './core';
import { createExtensions } from './extensions';

/**
 * 图片节点序列化测试：
 * 1) 修复回归——ImageStyle 覆盖 addAttributes 时必须合并父类，否则 src 丢失、图片不可见；
 * 2) 层级（layer）与浮动偏移（offsetX/offsetY）要能写进 HTML 并再次解析回来。
 */

const editors: Editor[] = [];

function createEditor(content: string): Editor {
  const editor = new Editor({ extensions: createExtensions('输入内容…'), content });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('ImageStyle 属性继承', () => {
  it('保留父类 src/alt/title，不会渲染成没有 src 的空 img', () => {
    const editor = createEditor('<p>文字</p>');
    editor.commands.setImage({ src: 'data:image/png;base64,iVBORw0KGgo=', alt: '样图' });
    const html = editor.getHTML();
    expect(html).toContain('<img');
    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(html).toContain('alt="样图"');
  });

  it('插入的图片节点确实带有 src 属性', () => {
    const editor = createEditor('<p></p>');
    editor.commands.setImage({ src: 'data:image/png;base64,AAAA' });
    let src: unknown = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') src = node.attrs.src;
    });
    expect(src).toBe('data:image/png;base64,AAAA');
  });
});

describe('图片宽度（像素语义）', () => {
  it('选中块级图片（NodeSelection）后可以改宽度——曾经因为只看段落父节点而永远失败', () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA">');
    const pos = 0;
    editor.commands.setNodeSelection(pos);
    expect(editor.commands.setImageWidth(320)).toBe(true);
    expect(editor.getHTML()).toContain('width: 320px');
  });

  it('setImageStyle 同时写入宽度与对齐', () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA">');
    editor.commands.setNodeSelection(0);
    expect(editor.commands.setImageStyle(200, 'center')).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain('width: 200px');
    expect(html).toContain('data-align="center"');
  });

  it('未选中图片时命令返回 false（不会误改其它内容）', () => {
    const editor = createEditor('<p>只有文字</p>');
    editor.commands.setTextSelection(1);
    expect(editor.commands.setImageWidth(200)).toBe(false);
  });

  it('宽度为 null 表示自适应（不输出宽度样式）', () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA" style="width: 320px">');
    editor.commands.setNodeSelection(0);
    editor.commands.setImageWidth(null);
    const html = editor.getHTML();
    expect(html).not.toContain('width: 320px');
  });

  it('旧数据的百分比宽度按 A4 内容宽度换算为像素', () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA" style="width: 50%">');
    let width: unknown = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') width = node.attrs.width;
    });
    expect(width).toBe(Math.round(0.5 * CONTENT_WIDTH_PX));
  });
});

describe('图片层级与浮动偏移', () => {
  it('嵌入型不输出层级属性（默认样式，保持随文排版）', () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA">');
    const html = editor.getHTML();
    expect(html).not.toContain('data-layer');
    expect(html).not.toContain('position: absolute');
  });

  it('浮于文字上方 / 衬于文字下方输出 data-layer 与绝对定位偏移', () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA">');
    editor.commands.setImageLayer('front');
    expect(editor.getHTML()).toContain('data-layer="front"');

    editor.commands.setImageLayer('behind');
    const html = editor.getHTML();
    expect(html).toContain('data-layer="behind"');
    expect(html).toContain('left:');
    expect(html).toContain('top:');
  });

  it('层级与偏移可从 HTML 解析回来（草稿/导入往返一致）', () => {
    const editor = createEditor(
      '<img src="data:image/png;base64,AAAA" data-layer="behind" style="left: 12px; top: 34px">',
    );
    let attrs: Record<string, unknown> | null = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') attrs = node.attrs;
    });
    expect(attrs).toMatchObject({ layer: 'behind', offsetX: 12, offsetY: 34 });
  });

  it('切回嵌入型会清掉浮动定位，避免残留绝对定位样式', () => {
    const editor = createEditor(
      '<img src="data:image/png;base64,AAAA" data-layer="front" style="left: 12px; top: 34px">',
    );
    editor.commands.setImageLayer('inline');
    const html = editor.getHTML();
    expect(html).not.toContain('data-layer');
    expect(html).not.toContain('left:');
  });
});
