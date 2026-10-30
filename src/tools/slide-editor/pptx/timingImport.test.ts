import { describe, expect, it } from 'vitest';
import { createDoc, createShapeElement, createTextElement } from '../model/factory';
import type { AnimationStep, SlideDoc } from '../model/types';
import { exportPptx } from './export';
import { importPptxFile } from './import';
import { parseSlideMotion } from './timingImport';
import { parseXml, type XmlNode } from './xml';

/**
 * P2-5.5：`p:transition` / `p:timing` 回读。
 *
 * 两条主线：① 自己导出的文件能原样读回（往返闭环）；② 不认识的写法必须**出现在报告里**，
 * 而不是让动画静静消失——"导入后什么也没发生"是用户最难归因的降级。
 */

const fileOf = (bytes: Uint8Array, name: string): File => {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { name, size: bytes.byteLength, arrayBuffer: async () => buffer } as unknown as File;
};

const slideNode = (inner: string): XmlNode => parseXml(`<p:sld>${inner}</p:sld>`)[0];

interface LeafOptions {
  spid: string;
  preset?: number;
  presetClass?: string;
  nodeType?: 'clickEffect' | 'withEffect' | 'afterEffect';
  dur?: number;
  delay?: number;
}

/** 单个效果节点（结构与 PowerPoint 写出来的一致：cTn > stCondLst + childTnLst(set + animEffect)） */
const leaf = (options: LeafOptions): string => {
  const preset = options.preset === undefined ? '' : ` presetID="${options.preset}"`;
  const klass = options.presetClass ? ` presetClass="${options.presetClass}"` : '';
  return (
    `<p:par><p:cTn id="5"${preset}${klass} fill="hold" grpId="0"` +
    ` nodeType="${options.nodeType ?? 'clickEffect'}">` +
    `<p:stCondLst><p:cond delay="${options.delay ?? 0}"/></p:stCondLst><p:childTnLst>` +
    `<p:set><p:cBhvr><p:cTn id="6" dur="1" fill="hold"/>` +
    `<p:tgtEl><p:spTgt spid="${options.spid}"/></p:tgtEl>` +
    '<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>' +
    '<p:to><p:strVal val="visible"/></p:to></p:set>' +
    '<p:animEffect transition="in" filter="fade"><p:cBhvr>' +
    `<p:cTn id="7" dur="${options.dur ?? 500}"/>` +
    `<p:tgtEl><p:spTgt spid="${options.spid}"/></p:tgtEl></p:cBhvr></p:animEffect>` +
    '</p:childTnLst></p:cTn></p:par>'
  );
};

/** mainSeq > 单击组 > 内层 par > 若干效果 */
const timingNode = (leaves: string): string =>
  '<p:timing><p:tnLst><p:par>' +
  '<p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>' +
  '<p:seq concurrent="1" nextAc="seek">' +
  '<p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>' +
  '<p:par><p:cTn id="3" fill="hold">' +
  '<p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>' +
  '<p:par><p:cTn id="4" fill="hold">' +
  '<p:stCondLst><p:cond delay="0"/></p:stCondLst>' +
  `<p:childTnLst>${leaves}</p:childTnLst>` +
  '</p:cTn></p:par></p:childTnLst></p:cTn></p:par>' +
  '</p:childTnLst></p:cTn>' +
  '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>' +
  '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>' +
  '</p:seq>' +
  '</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>';

describe('往返：自己导出的动画能读回', () => {
  it('切换 + 淡入/飞入 + 同时触发全部还原，且 elementId 指向导入后的元素', async () => {
    const doc: SlideDoc = createDoc('motion');
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' });
    const text = createTextElement(doc, 'B');
    doc.slides[0].elements = [shape, text];
    doc.slides[0].transition = { type: 'push', duration: 800, advanceOnClick: false };
    const steps: AnimationStep[] = [
      {
        id: 's1',
        elementId: shape.id,
        effect: 'fadeIn',
        duration: 600,
        delay: 0,
        trigger: 'onClick',
      },
      {
        id: 's2',
        elementId: text.id,
        effect: 'flyIn',
        duration: 450,
        delay: 200,
        trigger: 'withPrevious',
      },
    ];
    doc.slides[0].animations = steps;

    const exported = await exportPptx(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const imported = await importPptxFile(fileOf(exported.value, 'motion.pptx'));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const slide = imported.value.doc.slides[0];
    expect(slide.transition).toEqual({ type: 'push', duration: 800, advanceOnClick: false });
    expect(slide.animations).toHaveLength(2);
    expect(slide.animations?.[0]).toMatchObject({
      effect: 'fadeIn',
      duration: 600,
      delay: 0,
      trigger: 'onClick',
    });
    expect(slide.animations?.[1]).toMatchObject({
      effect: 'flyIn',
      duration: 450,
      delay: 200,
      trigger: 'withPrevious',
    });
    // spid 是导出时分配的，导入后元素 id 会重新生成 —— 动画必须跟着新 id 走
    const ids = slide.elements.map((element) => element.id).sort();
    expect((slide.animations ?? []).map((step) => step.elementId).sort()).toEqual(ids);
    expect(imported.value.report.unsupportedMotion).toEqual([]);
  });

  it('没有动画与切换的文档不凭空多出字段', async () => {
    const doc = createDoc('plain');
    doc.slides[0].elements = [createShapeElement(doc, { kind: 'rect', prst: 'rect' })];
    const exported = await exportPptx(doc);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const imported = await importPptxFile(fileOf(exported.value, 'plain.pptx'));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.doc.slides[0].transition).toBeUndefined();
    expect(imported.value.doc.slides[0].animations).toBeUndefined();
    expect(imported.value.report.unsupportedMotion).toEqual([]);
  });
});

describe('降级必须进报告', () => {
  it('不认识的切换（cover）不写 transition，但报告 transition:cover', () => {
    const root = slideNode('<p:transition spd="fast"><p:cover/></p:transition>');
    const motion = parseSlideMotion(root, new Map());
    expect(motion.transition).toBeUndefined();
    expect(motion.unsupported).toContain('transition:cover');
  });

  it('不认识的入场预设（presetID=22）记 anim:preset22', () => {
    const root = slideNode(timingNode(leaf({ spid: '2', preset: 22 })));
    const motion = parseSlideMotion(root, new Map([['2', 'el_a']]));
    expect(motion.animations).toHaveLength(0);
    expect(motion.unsupported).toContain('anim:preset22');
  });

  it('退出/强调类动画记 anim:exit / anim:emph，不当成入场', () => {
    const exitRoot = slideNode(timingNode(leaf({ spid: '2', preset: 1, presetClass: 'exit' })));
    const exitMotion = parseSlideMotion(exitRoot, new Map([['2', 'el_a']]));
    expect(exitMotion.animations).toHaveLength(0);
    expect(exitMotion.unsupported).toContain('anim:exit');

    const emphRoot = slideNode(timingNode(leaf({ spid: '2', preset: 26, presetClass: 'emph' })));
    expect(parseSlideMotion(emphRoot, new Map([['2', 'el_a']])).unsupported).toContain('anim:emph');
  });

  it('目标形状没导入成功（spid 对不上）记 anim:target', () => {
    const root = slideNode(timingNode(leaf({ spid: '99', preset: 10 })));
    const motion = parseSlideMotion(root, new Map([['2', 'el_a']]));
    expect(motion.animations).toHaveLength(0);
    expect(motion.unsupported).toContain('anim:target');
  });

  it('同一元素的多段入场只保留第一段，其余记 anim:duplicate', () => {
    const root = slideNode(
      timingNode(leaf({ spid: '2', preset: 10 }) + leaf({ spid: '2', preset: 10, dur: 300 })),
    );
    const motion = parseSlideMotion(root, new Map([['2', 'el_a']]));
    expect(motion.animations).toHaveLength(1);
    expect(motion.animations[0]).toMatchObject({ elementId: 'el_a', effect: 'fadeIn' });
    expect(motion.unsupported).toContain('anim:duplicate');
  });

  it('淡入 / 飞入按 presetID 区分，trigger 按 nodeType 还原', () => {
    const root = slideNode(
      timingNode(
        leaf({ spid: '2', preset: 10, delay: 0 }) +
          leaf({ spid: '3', preset: 2, nodeType: 'withEffect', delay: 250 }) +
          leaf({ spid: '4', preset: 10, nodeType: 'afterEffect', delay: 100 }),
      ),
    );
    const motion = parseSlideMotion(
      root,
      new Map([
        ['2', 'el_a'],
        ['3', 'el_b'],
        ['4', 'el_c'],
      ]),
    );
    expect(motion.unsupported).toEqual([]);
    expect(motion.animations.map((step) => [step.elementId, step.effect, step.trigger])).toEqual([
      ['el_a', 'fadeIn', 'onClick'],
      ['el_b', 'flyIn', 'withPrevious'],
      ['el_c', 'fadeIn', 'afterPrevious'],
    ]);
    expect(motion.animations[1].delay).toBe(250);
  });

  it('没有 p:timing / p:transition 的结构返回空结果而不是报错', () => {
    const motion = parseSlideMotion(slideNode('<p:cSld><p:spTree/></p:cSld>'), new Map());
    expect(motion.transition).toBeUndefined();
    expect(motion.animations).toEqual([]);
    expect(motion.unsupported).toEqual([]);
  });
});
