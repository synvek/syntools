import { describe, expect, it } from 'vitest';
import {
  alignOf,
  alignPatch,
  cornerRadiusOf,
  cornerRadiusPatch,
  fillColorOf,
  fillPatch,
  fontSizeOf,
  fontSizeStepPatch,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  hasFillOf,
  lineSpacingOf,
  listKindOf,
  listPatch,
  opacityOf,
  opacityPatch,
  paragraphPatch,
  runStyleOf,
  runStylePatch,
  shadowOf,
  shadowPatch,
  strokeColorOf,
  strokeColorPatch,
  strokeWidthOf,
  strokeWidthPatch,
  supportsCorner,
  supportsFill,
  supportsShadow,
  supportsStroke,
  supportsText,
  textBodyOf,
} from './format';
import {
  createChartElement,
  createDoc,
  createLineElement,
  createShapeElement,
  createTableElement,
  createTextElement,
} from './factory';
import type { ShapeElement, SlideDoc, SlideElement, TextBody, TextElement } from './types';

function makeDoc(): SlideDoc {
  return createDoc('format-test');
}

/** 补丁里的 body → 纯文本（校验多选时各自保留自己的文字） */
function bodyTextOf(patch: Partial<SlideElement> | null): string {
  const body = (patch as { body?: TextBody } | null)?.body;
  return (
    body?.paragraphs.flatMap((paragraph) => paragraph.runs.map((run) => run.text)).join('') ?? ''
  );
}

/** 把补丁套到元素上（模拟 store 的 patchElements），返回新元素 */
function withPatch<T extends SlideElement>(element: T, patch: Partial<SlideElement> | null): T {
  return { ...element, ...(patch ?? {}) } as T;
}

describe('能力判定', () => {
  const doc = makeDoc();
  const text = createTextElement(doc, 'hi');
  const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' });
  const image: SlideElement = {
    id: 'img',
    type: 'image',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    mediaId: 'm1',
  };
  const line = createLineElement(doc);
  const table = createTableElement(doc, 2, 2);
  const chart = createChartElement(doc, 'bar');

  it('文字能力只给文本框与形状', () => {
    expect(supportsText(text)).toBe(true);
    expect(supportsText(shape)).toBe(true);
    expect(supportsText(image)).toBe(false);
    expect(supportsText(table)).toBe(false);
  });

  it('填充只给文本框与形状，轮廓给文本/形状/图片/线条', () => {
    expect(supportsFill(text)).toBe(true);
    expect(supportsFill(image)).toBe(false);
    expect(supportsFill(table)).toBe(false);
    expect(supportsStroke(image)).toBe(true);
    expect(supportsStroke(line)).toBe(true);
    expect(supportsStroke(table)).toBe(false);
  });

  it('圆角只给文本框与图片；阴影排除线条/表格/占位框', () => {
    expect(supportsCorner(text)).toBe(true);
    expect(supportsCorner(image)).toBe(true);
    expect(supportsCorner(shape)).toBe(false);
    expect(supportsShadow(shape)).toBe(true);
    expect(supportsShadow(chart)).toBe(true);
    expect(supportsShadow(line)).toBe(false);
    expect(supportsShadow(table)).toBe(false);
  });
});

describe('读取当前值', () => {
  const doc = makeDoc();

  it('文本框读出字号 / 对齐 / 行距 / 列表形态', () => {
    const text = createTextElement(doc, 'hello') as TextElement;
    expect(fontSizeOf(text)).toBe(24);
    expect(alignOf(text)).toBe('left');
    expect(lineSpacingOf(text)).toBe(1.2);
    expect(listKindOf(text)).toBe('none');
  });

  it('形状默认没有 body，读出的是默认值而不是崩溃', () => {
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' });
    expect(textBodyOf(shape)).toBeUndefined();
    expect(runStyleOf(shape)).toBeUndefined();
    expect(fontSizeOf(shape)).toBe(18);
    expect(fillColorOf(shape)).toBe('#4472C4');
    expect(hasFillOf(shape)).toBe(true);
    expect(strokeWidthOf(shape)).toBe(2);
    expect(opacityOf(shape)).toBe(1);
    expect(cornerRadiusOf(shape)).toBe(0);
  });

  it('不适用该能力的元素读出 undefined / false', () => {
    const table = createTableElement(doc, 2, 2);
    expect(fillColorOf(table)).toBeUndefined();
    expect(strokeColorOf(table)).toBeUndefined();
    expect(strokeWidthOf(table)).toBe(0);
    expect(shadowOf(table)).toBeUndefined();
  });
});

describe('文字样式补丁', () => {
  const doc = makeDoc();

  it('形状没有 body 时自动补一个空 body，让字体立刻可设', () => {
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
    const next = withPatch(shape, runStylePatch(shape, { font: 'Georgia', size: 30 }));
    expect(textBodyOf(next)).toBeDefined();
    expect(runStyleOf(next)).toMatchObject({ font: 'Georgia', size: 30 });
  });

  it('run 级样式写到整框的每个 run，而不是只改第一个', () => {
    const text = createTextElement(doc, 'ab') as TextElement;
    const twoRuns: TextElement = {
      ...text,
      body: {
        ...text.body,
        paragraphs: [
          {
            runs: [
              { text: 'a', style: { size: 20 } },
              { text: 'b', style: { size: 20 } },
            ],
          },
          { runs: [{ text: 'c', style: { size: 20 } }] },
        ],
      },
    };
    const next = withPatch(twoRuns, runStylePatch(twoRuns, { bold: true })) as TextElement;
    const styles = next.body.paragraphs.flatMap((p) => p.runs.map((r) => r.style));
    expect(styles).toHaveLength(3);
    expect(styles.every((style) => style?.bold === true)).toBe(true);
  });

  it('空段落补样式时不丢段落结构', () => {
    const text = createTextElement(doc, '') as TextElement;
    const empty: TextElement = {
      ...text,
      body: { ...text.body, paragraphs: [{ runs: [] }] },
    };
    const next = withPatch(empty, runStylePatch(empty, { italic: true })) as TextElement;
    expect(next.body.paragraphs).toHaveLength(1);
    expect(next.body.paragraphs[0]?.runs[0]?.style?.italic).toBe(true);
  });

  it('字号阶梯基于各自当前字号增减，且带上下限', () => {
    const small = createTextElement(doc, 'a') as TextElement;
    small.body = { ...small.body, paragraphs: [{ runs: [{ text: 'a', style: { size: 20 } }] }] };
    const bigger = withPatch(small, fontSizeStepPatch(small, 2)) as TextElement;
    expect(fontSizeOf(bigger)).toBe(22);

    const smaller = withPatch(small, fontSizeStepPatch(small, -2)) as TextElement;
    expect(fontSizeOf(smaller)).toBe(18);

    // 已达上限时返回 null，调用方据此不产生撤销点
    const huge = { ...small, body: { ...small.body } } as TextElement;
    huge.body.paragraphs = [{ runs: [{ text: 'a', style: { size: FONT_SIZE_MAX } }] }];
    expect(fontSizeStepPatch(huge, 2)).toBeNull();

    const tiny = { ...small } as TextElement;
    tiny.body = {
      ...small.body,
      paragraphs: [{ runs: [{ text: 'a', style: { size: FONT_SIZE_MIN } }] }],
    };
    expect(fontSizeStepPatch(tiny, -2)).toBeNull();
  });

  it('对齐 / 行距 / 列表写回段落级字段，且项目符号与编号互斥', () => {
    const text = createTextElement(doc, 'a') as TextElement;
    const centered = withPatch(text, alignPatch(text, 'center')) as TextElement;
    expect(alignOf(centered)).toBe('center');

    const spaced = withPatch(centered, paragraphPatch(centered, { lineSpacing: 2 })) as TextElement;
    expect(lineSpacingOf(spaced)).toBe(2);

    const bulleted = withPatch(spaced, listPatch(spaced, 'bullet')) as TextElement;
    expect(listKindOf(bulleted)).toBe('bullet');

    const numbered = withPatch(bulleted, listPatch(bulleted, 'numbering')) as TextElement;
    expect(numbered.body.paragraphs[0]?.bullet).toBe(false);
    expect(listKindOf(numbered)).toBe('numbering');

    const cleared = withPatch(numbered, listPatch(numbered, 'none')) as TextElement;
    expect(listKindOf(cleared)).toBe('none');
  });

  it('不支持的元素返回 null，而不是丢掉能力判定', () => {
    const table = createTableElement(doc, 2, 2);
    expect(runStylePatch(table, { bold: true })).toBeNull();
    expect(alignPatch(table, 'center')).toBeNull();
    expect(fontSizeStepPatch(table, 2)).toBeNull();
    expect(fillPatch(table, { type: 'solid', color: '#000000' })).toBeNull();
  });
});

describe('颜色 / 尺寸类补丁', () => {
  const doc = makeDoc();

  it('填充：纯色与无填充', () => {
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' });
    const filled = withPatch(shape, fillPatch(shape, { type: 'solid', color: '#FF0000' }));
    expect(fillColorOf(filled)).toBe('#FF0000');

    const cleared = withPatch(shape, fillPatch(shape, 'none'));
    expect(hasFillOf(cleared)).toBe(false);
    expect(fillColorOf(cleared)).toBeUndefined();
  });

  it('描边：原本没有描边时给默认线宽；线宽归零等于去掉描边', () => {
    const image: SlideElement = {
      id: 'img',
      type: 'image',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      mediaId: 'm1',
    };
    const stroked = withPatch(image, strokeColorPatch(image, '#00FF00'));
    expect(strokeColorOf(stroked)).toBe('#00FF00');
    expect(strokeWidthOf(stroked)).toBe(1);

    const removed = withPatch(stroked, strokeWidthPatch(stroked, 0));
    expect(removed.type === 'image' ? removed.stroke : 'unexpected').toBeUndefined();
  });

  it('圆角与不透明度做范围收敛', () => {
    const text = createTextElement(doc, 'a');
    const rounded = withPatch(text, cornerRadiusPatch(text, 12.6));
    expect(cornerRadiusOf(rounded)).toBe(13);

    const clamped = withPatch(text, cornerRadiusPatch(text, -5));
    expect(cornerRadiusOf(clamped)).toBe(0);

    expect(opacityPatch(1.4)).toEqual({ opacity: 1 });
    expect(opacityPatch(-1)).toEqual({ opacity: 0 });
  });

  it('阴影开关：开启给默认参数，关闭清除字段，且保留已调过的参数', () => {
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
    const on = withPatch(shape, shadowPatch(shape, true));
    expect(shadowOf(on)).toMatchObject({ blur: 8, offsetX: 2, offsetY: 2 });

    const custom: ShapeElement = {
      ...shape,
      shadow: { color: '#123456', blur: 20, offsetX: 5, offsetY: 5 },
    };
    const kept = withPatch(custom, shadowPatch(custom, true));
    expect(shadowOf(kept)).toMatchObject({ color: '#123456', blur: 20 });

    const off = withPatch(custom, shadowPatch(custom, false));
    expect(shadowOf(off)).toBeUndefined();
  });
});

describe('多选场景：逐元素计算补丁，不覆盖其它元素的内容', () => {
  const doc = makeDoc();

  it.each([
    ['字体', (element: SlideElement) => runStylePatch(element, { font: 'Georgia' })],
    ['对齐', (element: SlideElement) => alignPatch(element, 'center')],
    ['行距', (element: SlideElement) => paragraphPatch(element, { lineSpacing: 1.5 })],
    ['列表', (element: SlideElement) => listPatch(element, 'bullet')],
  ])('%s：各自保留自己的文字', (_label, makePatch) => {
    const first = createTextElement(doc, '第一页文字') as TextElement;
    const second = createTextElement(doc, '第二页文字') as TextElement;
    const secondBody: TextBody = {
      ...second.body,
      paragraphs: [{ runs: [{ text: '第二段两个run', style: { size: 12 } }, { text: '尾部' }] }],
    };
    const target: TextElement = { ...second, body: secondBody };

    const patchFirst = makePatch(first);
    const patchSecond = makePatch(target);

    // 两个补丁必须各自来自自己的 body —— 这正是 patchSelectedWith 存在的理由
    const bodyOfFirst = bodyTextOf(patchFirst);
    const bodyOfSecond = bodyTextOf(patchSecond);
    expect(bodyOfFirst).toBe('第一页文字');
    expect(bodyOfSecond).toBe('第二段两个run尾部');
    expect(bodyOfSecond).not.toBe(bodyOfFirst);
  });

  it('不适用该能力的元素在批量应用时被跳过而不是写入无效字段', () => {
    const text = createTextElement(doc, 'a');
    const table = createTableElement(doc, 2, 2);
    const targets: SlideElement[] = [text, table];
    const patches = targets
      .map((element) => runStylePatch(element, { bold: true }))
      .filter((patch) => patch !== null);
    expect(patches).toHaveLength(1);
  });
});
