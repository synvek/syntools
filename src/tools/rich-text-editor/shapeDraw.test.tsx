import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';
import { ShapeMenu } from './ShapeMenu';
import { createExtensions } from './extensions';
import { SHAPE_PRESETS, findSelectedShape, shapeSpec } from './shapeNode';
import { CLICK_SLOP, drawRect, isClickGesture, toCanvasPx } from './shapeDraw';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'zh' } }),
}));

/** P3-1.7 拖拽绘制：几何规则、形状库下拉、按落点插入 */

describe('drawRect', () => {
  it('归一化任意方向的拖拽', () => {
    expect(drawRect(100, 100, 140, 160)).toEqual({ left: 100, top: 100, width: 40, height: 60 });
    // 从右下往左上拉，左上角要取终点
    expect(drawRect(140, 160, 100, 100)).toEqual({ left: 100, top: 100, width: 40, height: 60 });
  });

  it('小于最小尺寸时向上取整，避免生成点不到手柄的形状', () => {
    expect(drawRect(10, 10, 12, 12).width).toBe(20);
    expect(drawRect(10, 10, 12, 12).height).toBe(20);
  });

  it('允许传 0 取真实尺寸（拖拽预览用）', () => {
    expect(drawRect(0, 0, 5, 6, 0)).toMatchObject({ width: 5, height: 6 });
  });
});

describe('gesture helpers', () => {
  it('区分单击与拖拽', () => {
    expect(isClickGesture(0, 0)).toBe(true);
    expect(isClickGesture(CLICK_SLOP - 1, 0)).toBe(true);
    expect(isClickGesture(CLICK_SLOP, 0)).toBe(false);
  });

  it('屏幕像素按 zoom 换算成画布像素', () => {
    expect(toCanvasPx(100, 1)).toBe(100);
    expect(toCanvasPx(100, 2)).toBe(50);
    // 非法 zoom 不能把尺寸算成 NaN / Infinity
    expect(toCanvasPx(100, 0)).toBe(100);
    expect(toCanvasPx(100, Number.NaN)).toBe(100);
  });
});

describe('insertDocShapeAt', () => {
  function makeEditor(): Editor {
    return new Editor({
      element: document.createElement('div'),
      extensions: createExtensions({ placeholder: '输入内容…' }),
      content: '<p>第一段</p><p>第二段</p>',
    });
  }

  it('按拖拽尺寸插入并自动选中', () => {
    const editor = makeEditor();
    // 第二个段落中间的位置
    const secondParagraphPos = editor.state.doc.child(0).nodeSize + 2;
    expect(
      editor.commands.insertDocShapeAt({
        prst: 'ellipse',
        width: 240,
        height: 130,
        pos: secondParagraphPos,
      }),
    ).toBe(true);

    const found = findSelectedShape(editor.state);
    expect(found).not.toBeNull();
    const attrs = shapeSpec(found!.node.attrs);
    expect(attrs.prst).toBe('ellipse');
    expect(attrs.width).toBe(240);
    expect(attrs.height).toBe(130);
    editor.destroy();
  });

  it('落在文档末尾时补一个可写段落', () => {
    const editor = makeEditor();
    const end = editor.state.doc.content.size - 1;
    editor.commands.insertDocShapeAt({ prst: 'rect', width: 100, height: 80, pos: end });
    const names: string[] = [];
    editor.state.doc.forEach((node) => names.push(node.type.name));
    expect(names[names.length - 1]).toBe('paragraph');
    editor.destroy();
  });
});

describe('ShapeMenu', () => {
  it('列出全部预设，点击后回调所选 prst', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <ShapeMenu
        open
        activePrst={null}
        onPick={onPick}
        onOpenPanel={() => {}}
        onClose={() => {}}
      />,
    );
    const buttons = screen.getAllByRole('menuitem');
    expect(buttons).toHaveLength(SHAPE_PRESETS.length);
    await user.click(screen.getByLabelText('chevron'));
    expect(onPick).toHaveBeenCalledWith('chevron');
  });

  it('关闭时不渲染', () => {
    render(
      <ShapeMenu
        open={false}
        activePrst={null}
        onPick={() => {}}
        onOpenPanel={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByTestId('rich-text-shape-menu')).toBeNull();
  });
});
