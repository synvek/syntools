import { describe, expect, it } from 'vitest';
import {
  FONT_FAMILIES,
  MAX_WARP_AMOUNT,
  TEXT_WARP_KINDS,
  clampWarpAmount,
  needsTextBitmap,
  warpOffset,
} from './core';
import { applyTextStyle, layoutText, textBlockHeight, wrapText } from './render/text';
import { migrateDoc } from './model/migrate';
import type { Layer, TextLayer, TextWarpKind } from './model/types';

/**
 * 变形位移场与文字排版的纯逻辑测试。
 *
 * `render/text.ts` 的排版只依赖 `ctx.measureText`，因此用一个「等宽字符」的假上下文就能测，
 * 不需要真实 Canvas（jsdom 没有 2D 上下文）。
 */
const stubCtx = (charWidth = 10) =>
  ({
    font: '',
    fillStyle: '',
    textBaseline: '',
    textAlign: 'left',
    letterSpacing: undefined as string | undefined,
    measureText: (text: string) => ({ width: text.length * charWidth }),
  }) as unknown as CanvasRenderingContext2D;

const textLayer = (over: Partial<TextLayer> = {}): TextLayer =>
  ({
    id: 't1',
    kind: 'text',
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    rotation: 0,
    flipX: false,
    flipY: false,
    text: 'hello',
    fontSize: 10,
    fontFamily: 'Arial',
    fill: '#111827',
    bold: false,
    italic: false,
    underline: false,
    align: 'left',
    lineHeight: 1.5,
    letterSpacing: 0,
    paragraphSpacing: 0,
    warp: { kind: 'none', bend: 0, horizontal: 0 },
    ...over,
  }) as TextLayer;

describe('变形常量与钳制', () => {
  it('样式全集含 none 与 10 种变形，首项为 none', () => {
    expect(TEXT_WARP_KINDS[0]).toBe('none');
    expect(TEXT_WARP_KINDS).toHaveLength(11);
    expect(new Set(TEXT_WARP_KINDS).size).toBe(11);
  });

  it('强度钳制到 ±100 并取整', () => {
    expect(MAX_WARP_AMOUNT).toBe(100);
    expect(clampWarpAmount(120)).toBe(100);
    expect(clampWarpAmount(-120)).toBe(-100);
    expect(clampWarpAmount(33.6)).toBe(34);
    expect(clampWarpAmount(Number.NaN)).toBe(0);
  });

  it('字体表非空且 id 与 label 一致（专有名词不翻译）', () => {
    expect(FONT_FAMILIES.length).toBeGreaterThan(0);
    for (const font of FONT_FAMILIES) expect(font.id).toBe(font.label);
  });
});

describe('warpOffset：位移场', () => {
  const kinds = TEXT_WARP_KINDS.filter((kind) => kind !== 'none');

  it('none 恒为零位移', () => {
    expect(warpOffset('none', 0.3, 0.7, 100, 100)).toEqual({ dx: 0, dy: 0 });
  });

  it('强度为 0 时任何样式都不产生位移', () => {
    for (const kind of kinds) {
      const offset = warpOffset(kind, 0.42, 0.31, 0, 0);
      expect(Math.abs(offset.dx)).toBeLessThan(1e-9);
      expect(Math.abs(offset.dy)).toBeLessThan(1e-9);
    }
  });

  it('除 fisheye 外只产生纵向位移（dx 恒为 0）', () => {
    for (const kind of kinds.filter((item) => item !== 'fisheye')) {
      expect(warpOffset(kind, 0.3, 0.4, 80, 80).dx).toBe(0);
    }
  });

  it('arc：两端不动、中间最大，且弯曲为正时向上（dy < 0）', () => {
    expect(warpOffset('arc', 0, 0.5, 100, 0).dy).toBeCloseTo(0, 6);
    expect(warpOffset('arc', 1, 0.5, 100, 0).dy).toBeCloseTo(0, 6);
    const mid = warpOffset('arc', 0.5, 0.5, 100, 0).dy;
    expect(mid).toBeLessThan(0);
    expect(mid).toBeCloseTo(-0.25, 6);
    // 反向强度只是取反
    expect(warpOffset('arc', 0.5, 0.5, -100, 0).dy).toBeCloseTo(0.25, 6);
  });

  it('arcLower / arcUpper：分别只弯下半 / 上半', () => {
    expect(warpOffset('arcLower', 0.5, 0, 100, 0).dy).toBeCloseTo(0, 6);
    expect(warpOffset('arcLower', 0.5, 1, 100, 0).dy).toBeLessThan(0);
    expect(warpOffset('arcUpper', 0.5, 1, 100, 0).dy).toBeCloseTo(0, 6);
    expect(warpOffset('arcUpper', 0.5, 0, 100, 0).dy).toBeLessThan(0);
  });

  it('arch：中间最鼓（上下边缘衰减为 0）', () => {
    expect(warpOffset('arch', 0.5, 0, 100, 0).dy).toBeCloseTo(0, 6);
    expect(warpOffset('arch', 0.5, 1, 100, 0).dy).toBeCloseTo(0, 6);
    expect(warpOffset('arch', 0.5, 0.5, 100, 0).dy).toBeLessThan(0);
  });

  it('shellLower 在下边缘更强，shellUpper 在上边缘更强', () => {
    const lowerBottom = warpOffset('shellLower', 0.5, 1, 100, 0).dy;
    const lowerTop = warpOffset('shellLower', 0.5, 0, 100, 0).dy;
    expect(Math.abs(lowerBottom)).toBeGreaterThan(Math.abs(lowerTop));
    const upperTop = warpOffset('shellUpper', 0.5, 0, 100, 0).dy;
    const upperBottom = warpOffset('shellUpper', 0.5, 1, 100, 0).dy;
    expect(Math.abs(upperTop)).toBeGreaterThan(Math.abs(upperBottom));
  });

  it('wave：S 形（u=0.25 与 0.75 符号相反，中点归零）', () => {
    const a = warpOffset('wave', 0.25, 0.5, 100, 0).dy;
    const b = warpOffset('wave', 0.75, 0.5, 100, 0).dy;
    expect(a).toBeCloseTo(0.25, 6);
    expect(b).toBeCloseTo(-0.25, 6);
    expect(warpOffset('wave', 0.5, 0.5, 100, 0).dy).toBeCloseTo(0, 6);
  });

  it('flag：同为波浪，但振幅随高度递增', () => {
    const top = Math.abs(warpOffset('flag', 0.25, 0, 100, 0).dy);
    const bottom = Math.abs(warpOffset('flag', 0.25, 1, 100, 0).dy);
    expect(bottom).toBeGreaterThan(top);
  });

  it('rise：位移与横向位置成正比，且与纵向无关', () => {
    expect(warpOffset('rise', 0.5, 0, 100, 0).dy).toBeCloseTo(
      warpOffset('rise', 0.5, 1, 100, 0).dy,
      9,
    );
    expect(warpOffset('rise', 1, 0.5, 100, 0).dy).toBeCloseTo(-0.25, 6);
    expect(warpOffset('rise', 0, 0.5, 100, 0).dy).toBeCloseTo(0, 6);
  });

  it('fisheye：中心零位移，且同时产生横向与纵向位移', () => {
    const center = warpOffset('fisheye', 0.5, 0.5, 100, 100);
    expect(center.dx).toBeCloseTo(0, 6);
    expect(center.dy).toBeCloseTo(0, 6);
    // 左缘中线：横向被推向外侧
    const left = warpOffset('fisheye', 0, 0.5, 0, 100);
    expect(left.dx).toBeLessThan(0);
    // 顶缘中线：纵向鼓起
    const top = warpOffset('fisheye', 0.5, 0, 100, 0);
    expect(top.dy).toBeLessThan(0);
  });
});

describe('needsTextBitmap：是否需要走位图路径', () => {
  it('无形变且无段间距 → 走原生文字（清晰、可缩放）', () => {
    expect(needsTextBitmap(textLayer())).toBe(false);
  });

  it('有段间距 → 必须走位图（Konva.Text 无法表达段间距）', () => {
    expect(needsTextBitmap(textLayer({ paragraphSpacing: 12 }))).toBe(true);
  });

  it('选择了变形样式但强度为 0 → 仍走原生文字', () => {
    expect(needsTextBitmap(textLayer({ warp: { kind: 'arc', bend: 0, horizontal: 0 } }))).toBe(
      false,
    );
  });

  it('变形强度非零 → 走位图', () => {
    expect(needsTextBitmap(textLayer({ warp: { kind: 'arc', bend: 40, horizontal: 0 } }))).toBe(
      true,
    );
    expect(needsTextBitmap(textLayer({ warp: { kind: 'fisheye', bend: 0, horizontal: 30 } }))).toBe(
      true,
    );
  });
});

describe('render/text：排版（假上下文）', () => {
  it('applyTextStyle 设置字体、颜色、对齐与字距', () => {
    const ctx = stubCtx();
    applyTextStyle(
      ctx,
      textLayer({ bold: true, italic: true, fill: '#FF0000', align: 'center', letterSpacing: 3 }),
    );
    expect(ctx.font).toBe('italic bold 10px Arial, sans-serif');
    expect(ctx.fillStyle).toBe('#FF0000');
    expect(ctx.textAlign).toBe('center');
    expect((ctx as unknown as { letterSpacing?: string }).letterSpacing).toBe('3px');
  });

  it('字距为 0 时显式写回 0px（避免沿用上一次的字距）', () => {
    const ctx = stubCtx();
    (ctx as unknown as { letterSpacing?: string }).letterSpacing = '5px';
    applyTextStyle(ctx, textLayer({ letterSpacing: 0 }));
    expect((ctx as unknown as { letterSpacing?: string }).letterSpacing).toBe('0px');
  });

  it('wrapText 按可用宽度换行（拉丁按词，CJK 逐字）', () => {
    const ctx = stubCtx(10);
    expect(wrapText(ctx, 'aa bb cc', 50)).toEqual(['aa bb', 'cc']);
    // 中文逐字断行：每字 10px，宽 30 → 每行 3 字
    expect(wrapText(ctx, '中文换行测试', 30)).toEqual(['中文换', '行测试']);
  });

  it('layoutText 逐行累加行高，段间距只加在段与段之间', () => {
    const layer = textLayer({ text: 'a\nb', fontSize: 10, lineHeight: 1.5, paragraphSpacing: 20 });
    const lines = layoutText(stubCtx(10), layer);
    expect(lines).toEqual([
      { text: 'a', y: 0 },
      { text: 'b', y: 35 },
    ]);
  });

  it('textBlockHeight 含段间距，空文本按一行计', () => {
    expect(
      textBlockHeight(
        stubCtx(),
        textLayer({ text: 'a\nb', fontSize: 10, lineHeight: 1.5, paragraphSpacing: 20 }),
      ),
    ).toBe(50);
    expect(textBlockHeight(stubCtx(), textLayer({ text: '', fontSize: 10, lineHeight: 1.5 }))).toBe(
      15,
    );
  });
});

describe('migrateDoc：文字新字段归一', () => {
  const rawTextLayer = (extra: Record<string, unknown>) => ({
    id: 'doc-1',
    name: 'n',
    width: 100,
    height: 100,
    background: 'white',
    activeLayerId: null,
    swatches: [],
    layers: [
      {
        id: 't1',
        kind: 'text',
        text: 'hi',
        fontSize: 20,
        fontFamily: 'Arial',
        fill: '#000000',
        bold: false,
        italic: false,
        underline: false,
        align: 'left',
        lineHeight: 1.4,
        x: 0,
        y: 0,
        width: 80,
        height: 30,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        blend: 'normal',
        flipX: false,
        flipY: false,
        ...extra,
      },
    ],
  });

  const firstLayer = (extra: Record<string, unknown>): Layer => {
    const doc = migrateDoc(rawTextLayer(extra));
    if (!doc) throw new Error('migrateDoc 返回 null');
    return doc.layers[0];
  };

  it('旧工程缺字段时补默认值（字距 0 / 段间距 0 / 不变形）', () => {
    const layer = firstLayer({});
    expect(layer.kind).toBe('text');
    if (layer.kind !== 'text') return;
    expect(layer.letterSpacing).toBe(0);
    expect(layer.paragraphSpacing).toBe(0);
    expect(layer.warp).toEqual({ kind: 'none', bend: 0, horizontal: 0 });
  });

  it('非法变形样式回落 none，强度钳制到 ±100', () => {
    const layer = firstLayer({ warp: { kind: 'bogus', bend: 999, horizontal: -999 } });
    if (layer.kind !== 'text') throw new Error('不是文字图层');
    expect(layer.warp.kind).toBe<TextWarpKind>('none');
    expect(layer.warp.bend).toBe(100);
    expect(layer.warp.horizontal).toBe(-100);
  });

  it('段间距不允许为负', () => {
    const layer = firstLayer({ paragraphSpacing: -20, letterSpacing: -3 });
    if (layer.kind !== 'text') throw new Error('不是文字图层');
    expect(layer.paragraphSpacing).toBe(0);
    expect(layer.letterSpacing).toBe(-3);
  });
});
