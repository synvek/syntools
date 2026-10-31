import { describe, expect, it } from 'vitest';
import { createDoc, createShapeElement, createTextElement } from './factory';
import { applyStyleSnapshot, extractStyleSnapshot, isEmptySnapshot } from './style';
import type { ShapeElement, SlideElement, TextElement } from './types';

/**
 * Patch values are loose records decided by the target element type; tests read them as Records,
 * so fetching one field doesn't require narrowing the whole SlideElement union first.
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

describe('P2-S3：效果随格式刷传播', () => {
  it('阴影与光晕都会被捕获并应用到目标元素', () => {
    const source = makeShape();
    source.shadow = { color: '#111111', blur: 6, offsetX: 2, offsetY: 3 };
    source.glow = { color: '#38BDF8', radius: 12, opacity: 0.6 };
    source.softEdge = { radius: 9 };

    const snapshot = extractStyleSnapshot(source);
    expect(snapshot.shadow).toEqual(source.shadow);
    expect(snapshot.glow).toEqual(source.glow);
    expect(snapshot.softEdge).toEqual({ radius: 9 });
    expect(isEmptySnapshot(snapshot)).toBe(false);

    const target = makeShape();
    const patch = patchOf(target, source);
    expect(patch.shadow).toEqual(source.shadow);
    expect(patch.glow).toEqual(source.glow);
    expect(patch.softEdge).toEqual({ radius: 9 });
  });

  it('内阴影同样随格式刷传播（P2-S3.3）', () => {
    const source = makeShape();
    source.innerShadow = { color: '#c00000', blur: 6, offsetX: 3, offsetY: 4, opacity: 0.8 };

    const snapshot = extractStyleSnapshot(source);
    expect(snapshot.innerShadow).toEqual(source.innerShadow);
    expect(isEmptySnapshot(snapshot)).toBe(false);

    const patch = patchOf(makeShape(), source);
    expect(patch.innerShadow).toEqual(source.innerShadow);
  });

  it('只有效果、没有填充描边时快照依然非空（否则格式刷会当成空操作）', () => {
    const source = makeShape();
    source.glow = { color: '#FF0000', radius: 10 };
    expect(isEmptySnapshot(extractStyleSnapshot(source))).toBe(false);
  });
});
