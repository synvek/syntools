import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
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

/** 文档中第一张图片的绝对位置：行内图片位于段落内部，不能再假设它出现在 pos 0 */
function imagePos(editor: Editor): number {
  let pos = -1;
  editor.state.doc.descendants((node, offset) => {
    if (pos < 0 && node.type.name === 'image') pos = offset;
    return true;
  });
  return pos;
}

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
  it('选中行内图片（NodeSelection）后可以改宽度——曾经因为只看段落父节点而永远失败', () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA">');
    editor.commands.setNodeSelection(imagePos(editor));
    expect(editor.commands.setImageWidth(320)).toBe(true);
    expect(editor.getHTML()).toContain('width: 320px');
  });

  it('setImageStyle 同时写入宽度与对齐', () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA">');
    editor.commands.setNodeSelection(imagePos(editor));
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
    editor.commands.setNodeSelection(imagePos(editor));
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

  it('改宽度后仍选中图片，可以连续调整——行内节点的节点选中曾会退化成光标', () => {
    const editor = createEditor('<p>前<img src="data:image/png;base64,AAAA">后</p>');
    editor.commands.setNodeSelection(imagePos(editor));
    editor.commands.setImageWidth(200);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);

    // 紧接着设置对齐，说明选区仍在同一张图片上
    expect(editor.commands.setImageStyle(120, 'center')).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain('width: 120px');
    expect(html).toContain('data-align="center"');
  });
});

describe('嵌入型图片（行内节点）', () => {
  it('图片与文字落在同一段落，不再独占一行', () => {
    const editor = createEditor('<p>前<img src="data:image/png;base64,AAAA">后</p>');
    const html = editor.getHTML();
    expect(html).toContain('前<img');
    expect(html).toContain('>后</p>');
    expect(html.match(/<p/g)?.length).toBe(1);
  });

  it('插入图片时落在光标处的文字中间', () => {
    const editor = createEditor('<p>前文后</p>');
    editor.commands.setTextSelection(3);
    editor.commands.setImage({ src: 'data:image/png;base64,AAAA' });
    const html = editor.getHTML();
    expect(html).toContain('前文<img');
    expect(html).toContain('>后</p>');
    expect(html.match(/<p/g)?.length).toBe(1);
  });

  it('旧文档里位于正文顶层的 <img> 解析后被包进段落，内容不丢', () => {
    const editor = createEditor('<p>甲</p><img src="data:image/png;base64,AAAA"><p>乙</p>');
    const html = editor.getHTML();
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html.match(/<p/g)?.length).toBe(3);
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

  it('四周型 / 上下型环绕写出 data-layer，但不带绝对定位偏移', () => {
    const editor = createEditor('<p>文字<img src="data:image/png;base64,AAAA"></p>');
    editor.commands.setNodeSelection(imagePos(editor));

    editor.commands.setImageLayer('wrap-left');
    let html = editor.getHTML();
    expect(html).toContain('data-layer="wrap-left"');
    expect(html).not.toContain('position: absolute');

    editor.commands.setImageLayer('top-bottom');
    html = editor.getHTML();
    expect(html).toContain('data-layer="top-bottom"');

    let attrs: Record<string, unknown> = {};
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') attrs = node.attrs;
    });
    expect(attrs.layer).toBe('top-bottom');
    expect(attrs.offsetX).toBeNull();
  });

  it('环绕方式可从 HTML 解析回来（草稿往返一致）', () => {
    const editor = createEditor(
      '<p>文字<img src="data:image/png;base64,AAAA" data-layer="wrap-right"></p>',
    );
    let layer: unknown = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') layer = node.attrs.layer;
    });
    expect(layer).toBe('wrap-right');
  });

  it('未知的 data-layer 取值回退为嵌入型', () => {
    const editor = createEditor(
      '<p>文字<img src="data:image/png;base64,AAAA" data-layer="nonsense"></p>',
    );
    let layer: unknown = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') layer = node.attrs.layer;
    });
    expect(layer).toBe('inline');
  });

  it('切换层级后仍选中图片，可继续切换', () => {
    const editor = createEditor('<p>文字<img src="data:image/png;base64,AAAA"></p>');
    editor.commands.setNodeSelection(imagePos(editor));
    editor.commands.setImageLayer('front');
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(editor.commands.setImageLayer('inline')).toBe(true);
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
