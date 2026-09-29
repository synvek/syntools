import { describe, expect, it } from 'vitest';
import { createDoc, createShapeElement, createTextElement } from './factory';
import { applyStyleSnapshot, extractStyleSnapshot, isEmptySnapshot } from './style';
import type { ShapeElement, SlideElement, TextElement } from './types';

/**
 * 补丁值是「按目标元素类型决定」的宽松记录，测试里统一按 Record 读取，
 * 避免为了取一个字段要先窄化整个 SlideElement 联合类型。
 */
function patchOf(element: SlideElement, source: SlideElement): Record<string, unknown> {
  return applyStyleSnapshot(element, extractStyleSnapshot(source)) as Record<string, unknown>;
}

function makeShape(): ShapeElement {
  return createShapeElement(createDoc(), { kind: 'rect', prst: 'rect' }) as ShapeElement;
}

function makeText(text: string): TextElement {
  return createTextElement(createDoc(), text) as TextElement;
}

function textWithStyle(): TextElement {
  const element = makeText('标题');
  element.body.paragraphs[0]!.runs[0]!.style = { bold: true, size: 32, color: '#FF0000' };
  element.body.paragraphs[0]!.align = 'center';
  element.fill = { type: 'solid', color: '#EEEEEE' };
  return element;
}

describe('格式刷快照', () => {
  it('只抽取样式，不含几何与内容', () => {
    const element = textWithStyle();
    element.x = 123;
    element.width = 456;
    const snapshot = extractStyleSnapshot(element);
    expect(snapshot.run).toEqual({ bold: true, size: 32, color: '#FF0000' });
    expect(snapshot.paragraph?.align).toBe('center');
    expect(snapshot.fill).toEqual({ type: 'solid', color: '#EEEEEE' });
    expect(Object.keys(snapshot)).not.toContain('x');
    expect(Object.keys(snapshot)).not.toContain('width');
  });

  it('空样式识别：无填充/描边/文本的快照为空，有填充则不为空', () => {
    const shape = makeShape();
    shape.fill = undefined;
    shape.stroke = undefined;
    expect(isEmptySnapshot(extractStyleSnapshot(shape))).toBe(true);
    shape.fill = { type: 'solid', color: '#ABCDEF' };
    expect(isEmptySnapshot(extractStyleSnapshot(shape))).toBe(false);
  });

  it('套用到文本框：run 与段落样式都生效，内容与坐标不变', () => {
    const source = textWithStyle();
    const target = makeText('正文内容');
    target.x = 10;
    target.y = 20;
    const patch = patchOf(target, source);
    expect(patch.x).toBeUndefined();
    const next = { ...target, ...patch } as TextElement;
    expect(next.body.paragraphs[0]!.runs[0]!.style).toMatchObject({
      bold: true,
      size: 32,
      color: '#FF0000',
    });
    expect(next.body.paragraphs[0]!.align).toBe('center');
    expect(next.body.paragraphs[0]!.runs[0]!.text).toBe('正文内容');
    expect(next.x).toBe(10);
  });

  it('形状 → 文本框：填充可刷，几何不刷', () => {
    const shape = makeShape();
    shape.fill = { type: 'gradient', angle: 45, stops: [{ offset: 0, color: '#111111' }] };
    shape.stroke = { color: '#222222', width: 3 };
    const patch = patchOf(makeText('x'), shape);
    expect(patch.fill).toEqual(shape.fill);
    expect(patch.stroke).toEqual(shape.stroke);
    expect(patch.width).toBeUndefined();
  });

  it('图片只吃描边，不继承填充', () => {
    const shape = makeShape();
    shape.fill = { type: 'solid', color: '#123456' };
    const image: SlideElement = {
      id: 'img',
      type: 'image',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      mediaId: 'm1',
    };
    const patch = patchOf(image, shape);
    expect(patch.fill).toBeUndefined();
  });

  it('不把样式刷到无关类型（表格不受影响）', () => {
    const table: SlideElement = {
      id: 'tbl',
      type: 'table',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      rows: [[{ text: 'a' }]],
      colWidths: [100],
      rowHeights: [50],
    };
    expect(patchOf(table, textWithStyle())).toEqual({});
  });
});
