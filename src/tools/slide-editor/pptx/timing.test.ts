import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  createChartElement,
  createDoc,
  createShapeElement,
  createTextElement,
} from '../model/factory';
import type {
  AnimationStep,
  ShapeElement,
  SlideDoc,
  SlideTransition,
  TextElement,
} from '../model/types';
import { exportPptx, hasSlideMotion, motionExportDegradations } from './export';
import { importPptxFile } from './import';
import { resetShapeIds, shapeIdOf, slideXml, timingXml, transitionXml } from './write';

/**
 * P2-5.4：`p:transition` / `p:timing` 的手写输出。
 *
 * 这里断言的是**结构与自洽性**（元素顺序、spid 对齐、cTn id 唯一、分组的 cond delay），
 * 而不是"PowerPoint 里播得对"——后者只能人工复验。结构错了 PowerPoint 会直接报修复，
 * 结构对了但视觉参数不理想只是观感差异，两者必须分开对待。
 */

const fileOf = (bytes: Uint8Array, name: string): File => {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { name, size: bytes.byteLength, arrayBuffer: async () => buffer } as unknown as File;
};

function docWith(
  elements: SlideDoc['slides'][number]['elements'],
  animations?: AnimationStep[],
  transition?: SlideTransition,
): SlideDoc {
  const doc = createDoc('motion');
  doc.slides[0].elements = elements;
  if (animations) doc.slides[0].animations = animations;
  if (transition) doc.slides[0].transition = transition;
  return doc;
}

const step = (
  elementId: string,
  effect: AnimationStep['effect'],
  extra: Partial<AnimationStep> = {},
): AnimationStep => ({
  id: `anim-${elementId}-${effect}-${String(extra.delay ?? 0)}`,
  elementId,
  effect,
  duration: 500,
  delay: 0,
  trigger: 'onClick',
  ...extra,
});

const timingOf = (xml: string): string => {
  const start = xml.indexOf('<p:timing>');
  const end = xml.indexOf('</p:timing>');
  return start < 0 || end < 0 ? '' : xml.slice(start, end + '</p:timing>'.length);
};

/** cNvPr id set inside spTree (ids only need to be unique per slide, so read them from the output) */
const shapeIdsIn = (xml: string): number[] =>
  [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((match) => Number(match[1]));

const targetIdsIn = (timing: string): number[] =>
  [...timing.matchAll(/<p:spTgt spid="(\d+)"\/>/g)].map((match) => Number(match[1]));

describe('p:transition（页面切换）', () => {
  it('没有切换时不写任何节点', () => {
    expect(transitionXml(undefined)).toBe('');
    expect(transitionXml({ type: 'none', duration: 400, advanceOnClick: true })).toBe('');
  });

  it('淡出映射为 p:fade，时长按三档归类（阈值与导入侧互逆）', () => {
    expect(transitionXml({ type: 'fade', duration: 200, advanceOnClick: true })).toBe(
      '<p:transition spd="fast" advClick="1"><p:fade/></p:transition>',
    );
    expect(transitionXml({ type: 'fade', duration: 400, advanceOnClick: true })).toContain(
      'spd="med"',
    );
    expect(transitionXml({ type: 'fade', duration: 1200, advanceOnClick: true })).toContain(
      'spd="slow"',
    );
  });

  it('推入映射为 p:push 且带方向；取消"单击推进"写 advClick="0"', () => {
    expect(transitionXml({ type: 'push', duration: 400, advanceOnClick: true })).toBe(
      '<p:transition spd="med" advClick="1"><p:push dir="l"/></p:transition>',
    );
    expect(transitionXml({ type: 'push', duration: 400, advanceOnClick: false })).toContain(
      'advClick="0"',
    );
  });

  it('按 ECMA-376 顺序落在 clrMapOvr 之后、p:timing 之前', () => {
    const shape = createShapeElement(createDoc('order'), { kind: 'rect', prst: 'rect' });
    const doc = createDoc('order');
    doc.slides[0].elements = [shape];
    const xml = slideXml([shape], new Map(), undefined, {
      transition: { type: 'fade', duration: 400, advanceOnClick: true },
      animations: [step(shape.id, 'fadeIn')],
    });
    const clrMapOvr = xml.indexOf('<p:clrMapOvr>');
    const transition = xml.indexOf('<p:transition');
    const timing = xml.indexOf('<p:timing>');
    expect(clrMapOvr).toBeGreaterThan(-1);
    expect(transition).toBeGreaterThan(clrMapOvr);
    expect(timing).toBeGreaterThan(transition);
    expect(xml.indexOf('</p:sld>')).toBeGreaterThan(timing);
  });
});

describe('p:timing（入场动画）', () => {
  it('无动画或无可用元素时不写 p:timing', () => {
    expect(timingXml(undefined)).toBe('');
    expect(timingXml([])).toBe('');
    // 元素从未分配过 cNvPr（例如被隐藏、没进 spTree），动画整段丢弃而不是留下悬空 spid
    resetShapeIds();
    expect(timingXml([step('ghost', 'fadeIn')])).toBe('');
  });

  it('每次单击开一组：3 个 onclick 动画 = 3 个等待单击的 par', () => {
    const doc = createDoc('clicks');
    const shapes = [0, 1, 2].map(() => createShapeElement(doc, { kind: 'rect', prst: 'rect' }));
    doc.slides[0].elements = shapes;
    const xml = slideXml(shapes, new Map(), undefined, {
      animations: shapes.map((shape) => step(shape.id, 'fadeIn')),
    });
    const timing = timingOf(xml);
    expect(timing).not.toBe('');
    expect(timing.match(/<p:cond delay="indefinite"\/>/g)).toHaveLength(3);
    expect(timing.match(/nodeType="clickEffect"/g)).toHaveLength(3);
    expect(timing).toContain('nodeType="mainSeq"');
    expect(timing).toContain('nodeType="tmRoot"');
  });

  it('withPrevious / afterPrevious 落在同一组，delay 按时间线累加', () => {
    const doc = createDoc('group');
    const shapes = [0, 1, 2].map(() => createShapeElement(doc, { kind: 'rect', prst: 'rect' }));
    doc.slides[0].elements = shapes;
    const xml = slideXml(shapes, new Map(), undefined, {
      animations: [
        step(shapes[0].id, 'fadeIn', { duration: 600 }),
        step(shapes[1].id, 'fadeIn', { trigger: 'withPrevious' }), // 与上一动画同时 → delay 0
        step(shapes[2].id, 'fadeIn', { trigger: 'afterPrevious', delay: 200 }), // 600 + 200
      ],
    });
    const timing = timingOf(xml);
    expect(timing.match(/nodeType="clickEffect"/g)).toHaveLength(1);
    expect(timing.match(/nodeType="withEffect"/g)).toHaveLength(1);
    expect(timing.match(/nodeType="afterEffect"/g)).toHaveLength(1);
    expect(timing).toContain('<p:cond delay="0"/>');
    expect(timing).toContain('<p:cond delay="800"/>');
  });

  it('淡入用 animEffect(fade)，飞入用 ppt_x 位移且不叠淡入', () => {
    const doc = createDoc('effects');
    const fade = createShapeElement(doc, { kind: 'rect', prst: 'rect' });
    const fly = createShapeElement(doc, { kind: 'rect', prst: 'rect' });
    doc.slides[0].elements = [fade, fly];

    const fadeTiming = timingOf(
      slideXml([fade], new Map(), undefined, { animations: [step(fade.id, 'fadeIn')] }),
    );
    expect(fadeTiming).toContain('presetID="10"');
    expect(fadeTiming).toContain('<p:animEffect transition="in" filter="fade">');

    const flyTiming = timingOf(
      slideXml([fly], new Map(), undefined, { animations: [step(fly.id, 'flyIn')] }),
    );
    expect(flyTiming).toContain('presetID="2"');
    expect(flyTiming).toContain('presetSubtype="4"');
    expect(flyTiming).toContain('<p:attrName>ppt_x</p:attrName>');
    expect(flyTiming).not.toContain('<p:animEffect');
  });

  it('每个 spid 都能在 spTree 的 cNvPr 里找到（否则 PowerPoint 报修复）', () => {
    const doc = createDoc('spid');
    const text = createTextElement(doc, '标题') as TextElement;
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
    doc.slides[0].elements = [text, shape];
    const xml = slideXml([text, shape], new Map(), undefined, {
      animations: [step(text.id, 'fadeIn'), step(shape.id, 'flyIn')],
    });
    const declared = new Set(shapeIdsIn(xml));
    const targeted = targetIdsIn(timingOf(xml));
    expect(targeted).toHaveLength(4); // 2 个 set + 2 个效果各一个 tgtEl
    for (const spid of targeted) expect(declared.has(spid)).toBe(true);
  });

  it('timing 内的 cTn id 互不重复', () => {
    const doc = createDoc('ids');
    const shapes = [0, 1, 2].map(() => createShapeElement(doc, { kind: 'rect', prst: 'rect' }));
    doc.slides[0].elements = shapes;
    const timing = timingOf(
      slideXml(shapes, new Map(), undefined, {
        animations: [
          step(shapes[0].id, 'fadeIn'),
          step(shapes[1].id, 'flyIn', { trigger: 'withPrevious' }),
          step(shapes[2].id, 'fadeIn', { trigger: 'afterPrevious' }),
          step(shapes[0].id, 'flyIn'),
        ],
      }),
    );
    const ids = [...timing.matchAll(/<p:cTn id="(\d+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(6);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('bldLst 覆盖每个参与构建的形状，且不重复', () => {
    const doc = createDoc('build');
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' });
    doc.slides[0].elements = [shape];
    const timing = timingOf(
      slideXml([shape], new Map(), undefined, {
        animations: [
          step(shape.id, 'fadeIn'),
          step(shape.id, 'flyIn', { trigger: 'withPrevious' }),
        ],
      }),
    );
    expect(timing.match(/<p:bldP /g)).toHaveLength(1);
  });

  it('隐藏元素不写进 timing（spTree 里也没有它）', () => {
    const doc = createDoc('hidden');
    const shown = createShapeElement(doc, { kind: 'rect', prst: 'rect' });
    const hidden = createShapeElement(doc, { kind: 'rect', prst: 'rect' });
    hidden.visible = false;
    doc.slides[0].elements = [shown, hidden];
    resetShapeIds();
    // 导出层会先把不可见元素过滤掉，这里模拟同样的入参
    const visible = doc.slides[0].elements.filter((element) => element.visible !== false);
    const xml = slideXml(visible, new Map(), undefined, {
      animations: doc.slides[0].elements.map((element) => step(element.id, 'fadeIn')),
    });
    expect(shapeIdOf(hidden.id)).toBeUndefined();
    expect(targetIdsIn(timingOf(xml))).toHaveLength(2); // 只剩 shown 的 set + animEffect
    expect(timingOf(xml).match(/nodeType="clickEffect"/g)).toHaveLength(1);
  });
});

describe('导出通道分派', () => {
  it('含动画的文档被判为需要手写通道', () => {
    const doc = createDoc('route');
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' });
    doc.slides[0].elements = [shape];
    expect(hasSlideMotion(doc)).toBe(false);
    doc.slides[0].animations = [step(shape.id, 'fadeIn')];
    expect(hasSlideMotion(doc)).toBe(true);

    doc.slides[0].animations = [];
    doc.slides[0].transition = { type: 'fade', duration: 400, advanceOnClick: true };
    expect(hasSlideMotion(doc)).toBe(true);
  });

  it('默认通道导出后 pptx 里确实有 p:timing / p:transition', async () => {
    const doc = docWith(
      [createShapeElement(createDoc('x'), { kind: 'rect', prst: 'rect' })],
      undefined,
      { type: 'push', duration: 400, advanceOnClick: true },
    );
    const shape = doc.slides[0].elements[0];
    doc.slides[0].animations = [step(shape.id, 'fadeIn')];

    const result = await exportPptx(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const zip = await JSZip.loadAsync(result.value);
    const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
    expect(xml).toContain('<p:push dir="l"/>');
    expect(xml).toContain('<p:timing>');
  });

  it('动画把文档推去手写通道时，原生图表被计入降级数量', () => {
    const doc = createDoc('chart');
    const chart = createChartElement(doc, 'bar');
    doc.slides[0].elements = [chart];
    // 没有动画时走 pptxgen，图表是原生对象 → 不报降级
    expect(motionExportDegradations(doc)).toBe(0);
    doc.slides[0].animations = [step(chart.id, 'fadeIn')];
    expect(motionExportDegradations(doc)).toBe(1);
  });

  it('携带动画的 pptx 仍能重新导入（timing 不影响读取）', async () => {
    const doc = createDoc('roundtrip');
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
    doc.slides[0].elements = [shape];
    doc.slides[0].transition = { type: 'fade', duration: 400, advanceOnClick: true };
    doc.slides[0].animations = [step(shape.id, 'flyIn')];

    const exported = await exportPptx(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const imported = await importPptxFile(fileOf(exported.value, 'motion.pptx'));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.doc.slides[0].elements).toHaveLength(1);
  });
});
