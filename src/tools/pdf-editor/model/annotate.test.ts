import { describe, expect, it } from 'vitest';
import {
  INITIAL_ANNOTATION_STYLE,
  isAnnotateTool,
  isDrawingTool,
  isMarkupTool,
  isShapeTool,
  styleColorFor,
  styleWidthFor,
  withStyleColor,
  withStyleWidth,
} from './annotate';

describe('工具分类', () => {
  it('区分标记、形状与画笔', () => {
    expect(isMarkupTool('highlight')).toBe(true);
    expect(isMarkupTool('arrow')).toBe(false);
    expect(isShapeTool('ellipse')).toBe(true);
    expect(isShapeTool('ink')).toBe(false);
    expect(isDrawingTool('ink')).toBe(true);
    expect(isDrawingTool('strikeout')).toBe(true);
    expect(isDrawingTool('note')).toBe(false);
  });

  it('只有选择与抓手不占用指针', () => {
    expect(isAnnotateTool('select')).toBe(false);
    expect(isAnnotateTool('hand')).toBe(false);
    expect(isAnnotateTool('note')).toBe(true);
    expect(isAnnotateTool('eraser')).toBe(true);
  });
});

describe('注释样式读写', () => {
  it('按工具取到对应的颜色和线宽', () => {
    expect(styleColorFor(INITIAL_ANNOTATION_STYLE, 'highlight')).toBe('#fde047');
    expect(styleColorFor(INITIAL_ANNOTATION_STYLE, 'rect')).toBe('#e11d48');
    expect(styleColorFor(INITIAL_ANNOTATION_STYLE, 'ink')).toBe('#e11d48');
    // 没选注释工具时回退到标记色：格式组不该一打开就是灰的
    expect(styleColorFor(INITIAL_ANNOTATION_STYLE, 'select')).toBe('#fde047');
    expect(styleColorFor(INITIAL_ANNOTATION_STYLE, 'note')).toBeNull();

    expect(styleWidthFor(INITIAL_ANNOTATION_STYLE, 'arrow')).toBe(2);
    expect(styleWidthFor(INITIAL_ANNOTATION_STYLE, 'ink')).toBe(2);
    expect(styleWidthFor(INITIAL_ANNOTATION_STYLE, 'select')).toBe(2);
    expect(styleWidthFor(INITIAL_ANNOTATION_STYLE, 'note')).toBeNull();
  });

  it('写颜色只影响当前工具自己的字段', () => {
    const style = withStyleColor(INITIAL_ANNOTATION_STYLE, 'underline', '#000000');
    expect(style.markupColor).toBe('#000000');
    expect(style.inkColor).toBe(INITIAL_ANNOTATION_STYLE.inkColor);

    const shape = withStyleColor(INITIAL_ANNOTATION_STYLE, 'ellipse', '#123456');
    expect(shape.shapeStroke).toBe('#123456');
    expect(shape.markupColor).toBe(INITIAL_ANNOTATION_STYLE.markupColor);
  });

  it('写线宽只影响当前工具自己的字段', () => {
    const ink = withStyleWidth(INITIAL_ANNOTATION_STYLE, 'ink', 4);
    expect(ink.inkWidth).toBe(4);
    expect(ink.shapeWidth).toBe(INITIAL_ANNOTATION_STYLE.shapeWidth);

    const shape = withStyleWidth(INITIAL_ANNOTATION_STYLE, 'rect', 6);
    expect(shape.shapeWidth).toBe(6);
    expect(shape.inkWidth).toBe(INITIAL_ANNOTATION_STYLE.inkWidth);
  });

  it('没有注释工具时写入标记色 / 形状线宽，而不是丢弃修改', () => {
    expect(withStyleColor(INITIAL_ANNOTATION_STYLE, 'select', '#000000').markupColor).toBe(
      '#000000',
    );
    expect(withStyleWidth(INITIAL_ANNOTATION_STYLE, 'hand', 4).shapeWidth).toBe(4);
    // note / text / patch 没有可绘制的样式，保持原样
    expect(withStyleColor(INITIAL_ANNOTATION_STYLE, 'note', '#000000')).toBe(
      INITIAL_ANNOTATION_STYLE,
    );
  });
});
