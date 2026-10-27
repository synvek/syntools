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
 * Pure-logic tests for the warp displacement field and text layout.
 *
 * Layout in `render/text.ts` relies only on `ctx.measureText`, so a fake context with monospace characters is
 * enough — no real Canvas needed (jsdom has no 2D context).
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

describe('Warp constants and clamping', () => {
  it('the style set holds none plus 10 warps, with none first', () => {
    expect(TEXT_WARP_KINDS[0]).toBe('none');
    expect(TEXT_WARP_KINDS).toHaveLength(11);
    expect(new Set(TEXT_WARP_KINDS).size).toBe(11);
  });

  it('strength clamps to ±100 and is rounded', () => {
    expect(MAX_WARP_AMOUNT).toBe(100);
    expect(clampWarpAmount(120)).toBe(100);
    expect(clampWarpAmount(-120)).toBe(-100);
    expect(clampWarpAmount(33.6)).toBe(34);
    expect(clampWarpAmount(Number.NaN)).toBe(0);
  });

  it('the font table is non-empty and id matches label (proper nouns stay untranslated)', () => {
    expect(FONT_FAMILIES.length).toBeGreaterThan(0);
    for (const font of FONT_FAMILIES) expect(font.id).toBe(font.label);
  });
});

describe('warpOffset: the displacement field', () => {
  const kinds = TEXT_WARP_KINDS.filter((kind) => kind !== 'none');

  it('none always gives zero displacement', () => {
    expect(warpOffset('none', 0.3, 0.7, 100, 100)).toEqual({ dx: 0, dy: 0 });
  });

  it('at strength 0 no style displaces anything', () => {
    for (const kind of kinds) {
      const offset = warpOffset(kind, 0.42, 0.31, 0, 0);
      expect(Math.abs(offset.dx)).toBeLessThan(1e-9);
      expect(Math.abs(offset.dy)).toBeLessThan(1e-9);
    }
  });

  it('every style but fisheye displaces vertically only (dx is always 0)', () => {
    for (const kind of kinds.filter((item) => item !== 'fisheye')) {
      expect(warpOffset(kind, 0.3, 0.4, 80, 80).dx).toBe(0);
    }
  });

  it('arc: ends fixed, middle maximal, and a positive bend goes up (dy < 0)', () => {
    expect(warpOffset('arc', 0, 0.5, 100, 0).dy).toBeCloseTo(0, 6);
    expect(warpOffset('arc', 1, 0.5, 100, 0).dy).toBeCloseTo(0, 6);
    const mid = warpOffset('arc', 0.5, 0.5, 100, 0).dy;
    expect(mid).toBeLessThan(0);
    expect(mid).toBeCloseTo(-0.25, 6);
    // The inverse strength is just the negation
    expect(warpOffset('arc', 0.5, 0.5, -100, 0).dy).toBeCloseTo(0.25, 6);
  });

  it('arcLower / arcUpper: bend only the lower / upper half', () => {
    expect(warpOffset('arcLower', 0.5, 0, 100, 0).dy).toBeCloseTo(0, 6);
    expect(warpOffset('arcLower', 0.5, 1, 100, 0).dy).toBeLessThan(0);
    expect(warpOffset('arcUpper', 0.5, 1, 100, 0).dy).toBeCloseTo(0, 6);
    expect(warpOffset('arcUpper', 0.5, 0, 100, 0).dy).toBeLessThan(0);
  });

  it('arch: bulges in the middle (zero at the top and bottom edges)', () => {
    expect(warpOffset('arch', 0.5, 0, 100, 0).dy).toBeCloseTo(0, 6);
    expect(warpOffset('arch', 0.5, 1, 100, 0).dy).toBeCloseTo(0, 6);
    expect(warpOffset('arch', 0.5, 0.5, 100, 0).dy).toBeLessThan(0);
  });

  it('shellLower is stronger at the bottom edge, shellUpper at the top', () => {
    const lowerBottom = warpOffset('shellLower', 0.5, 1, 100, 0).dy;
    const lowerTop = warpOffset('shellLower', 0.5, 0, 100, 0).dy;
    expect(Math.abs(lowerBottom)).toBeGreaterThan(Math.abs(lowerTop));
    const upperTop = warpOffset('shellUpper', 0.5, 0, 100, 0).dy;
    const upperBottom = warpOffset('shellUpper', 0.5, 1, 100, 0).dy;
    expect(Math.abs(upperTop)).toBeGreaterThan(Math.abs(upperBottom));
  });

  it('wave: S-shaped (u=0.25 and 0.75 have opposite signs, the midpoint is zero)', () => {
    const a = warpOffset('wave', 0.25, 0.5, 100, 0).dy;
    const b = warpOffset('wave', 0.75, 0.5, 100, 0).dy;
    expect(a).toBeCloseTo(0.25, 6);
    expect(b).toBeCloseTo(-0.25, 6);
    expect(warpOffset('wave', 0.5, 0.5, 100, 0).dy).toBeCloseTo(0, 6);
  });

  it('flag: also a wave, but the amplitude grows with height', () => {
    const top = Math.abs(warpOffset('flag', 0.25, 0, 100, 0).dy);
    const bottom = Math.abs(warpOffset('flag', 0.25, 1, 100, 0).dy);
    expect(bottom).toBeGreaterThan(top);
  });

  it('rise: displacement is proportional to the horizontal position and independent of the vertical', () => {
    expect(warpOffset('rise', 0.5, 0, 100, 0).dy).toBeCloseTo(
      warpOffset('rise', 0.5, 1, 100, 0).dy,
      9,
    );
    expect(warpOffset('rise', 1, 0.5, 100, 0).dy).toBeCloseTo(-0.25, 6);
    expect(warpOffset('rise', 0, 0.5, 100, 0).dy).toBeCloseTo(0, 6);
  });

  it('fisheye: zero at the center and displaces both horizontally and vertically', () => {
    const center = warpOffset('fisheye', 0.5, 0.5, 100, 100);
    expect(center.dx).toBeCloseTo(0, 6);
    expect(center.dy).toBeCloseTo(0, 6);
    // Left edge, mid-height: pushed outward horizontally
    const left = warpOffset('fisheye', 0, 0.5, 0, 100);
    expect(left.dx).toBeLessThan(0);
    // Top edge, mid-width: bulges vertically
    const top = warpOffset('fisheye', 0.5, 0, 100, 0);
    expect(top.dy).toBeLessThan(0);
  });
});

describe('needsTextBitmap: whether the bitmap path is required', () => {
  it('no warp and no paragraph spacing → native text (crisp, scalable)', () => {
    expect(needsTextBitmap(textLayer())).toBe(false);
  });

  it('paragraph spacing → bitmap path (Konva.Text cannot express it)', () => {
    expect(needsTextBitmap(textLayer({ paragraphSpacing: 12 }))).toBe(true);
  });

  it('a warp style chosen at strength 0 still uses native text', () => {
    expect(needsTextBitmap(textLayer({ warp: { kind: 'arc', bend: 0, horizontal: 0 } }))).toBe(
      false,
    );
  });

  it('a non-zero warp strength uses the bitmap path', () => {
    expect(needsTextBitmap(textLayer({ warp: { kind: 'arc', bend: 40, horizontal: 0 } }))).toBe(
      true,
    );
    expect(needsTextBitmap(textLayer({ warp: { kind: 'fisheye', bend: 0, horizontal: 30 } }))).toBe(
      true,
    );
  });

  it('vertical flow and per-run styles need the bitmap path (Konva.Text cannot express them)', () => {
    expect(needsTextBitmap(textLayer({ direction: 'vertical' }))).toBe(true);
    expect(
      needsTextBitmap(
        textLayer({
          runs: [{ text: 'he' }, { text: 'llo', style: { bold: true } }],
        }),
      ),
    ).toBe(true);
    // A single unstyled run is equivalent to plain text → stay native
    expect(needsTextBitmap(textLayer({ runs: [{ text: 'hello' }] }))).toBe(false);
  });
});

describe('render/text: layout (fake context)', () => {
  it('applyTextStyle sets font, color, alignment and letter spacing', () => {
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

  it('letter spacing 0 is written back as 0px (never inherits the previous value)', () => {
    const ctx = stubCtx();
    (ctx as unknown as { letterSpacing?: string }).letterSpacing = '5px';
    applyTextStyle(ctx, textLayer({ letterSpacing: 0 }));
    expect((ctx as unknown as { letterSpacing?: string }).letterSpacing).toBe('0px');
  });

  it('wrapText wraps to the available width (Latin by word, CJK per character)', () => {
    const ctx = stubCtx(10);
    expect(wrapText(ctx, 'aa bb cc', 50)).toEqual(['aa bb', 'cc']);
    // CJK wraps per character: 10 px each, width 30 → 3 characters per line
    expect(wrapText(ctx, '中文换行测试', 30)).toEqual(['中文换', '行测试']);
  });

  it('layoutText accumulates line heights and adds paragraph spacing only between paragraphs', () => {
    const layer = textLayer({ text: 'a\nb', fontSize: 10, lineHeight: 1.5, paragraphSpacing: 20 });
    const lines = layoutText(stubCtx(10), layer);
    expect(lines).toEqual([
      { text: 'a', y: 0 },
      { text: 'b', y: 35 },
    ]);
  });

  it('textBlockHeight includes paragraph spacing; empty text counts as one line', () => {
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

  it('vertical text stacks characters into columns and counts the tallest column', () => {
    // Two paragraphs → two columns; 2 characters each; pitch = 10 × 1.5 = 15 → height 30
    expect(
      textBlockHeight(
        stubCtx(),
        textLayer({
          text: 'ab\ncd',
          fontSize: 10,
          lineHeight: 1.5,
          height: 30,
          direction: 'vertical',
        }),
      ),
    ).toBe(30);
  });

  it('vertical text wraps into a new column once the box height is filled', () => {
    // Box height 30 / pitch 15 → 2 characters per column, so "abcd" becomes two columns of height 30
    // (unwrapped it would be a single 4-character column of height 60)
    expect(
      textBlockHeight(
        stubCtx(),
        textLayer({
          text: 'abcd',
          fontSize: 10,
          lineHeight: 1.5,
          height: 30,
          direction: 'vertical',
        }),
      ),
    ).toBe(30);
  });
});

describe('migrateDoc: normalizing new text fields', () => {
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

  it('old projects get defaults (letter spacing 0 / paragraph spacing 0 / no warp)', () => {
    const layer = firstLayer({});
    expect(layer.kind).toBe('text');
    if (layer.kind !== 'text') return;
    expect(layer.letterSpacing).toBe(0);
    expect(layer.paragraphSpacing).toBe(0);
    expect(layer.warp).toEqual({ kind: 'none', bend: 0, horizontal: 0 });
  });

  it('an illegal warp style falls back to none and strength clamps to ±100', () => {
    const layer = firstLayer({ warp: { kind: 'bogus', bend: 999, horizontal: -999 } });
    if (layer.kind !== 'text') throw new Error('不是文字图层');
    expect(layer.warp.kind).toBe<TextWarpKind>('none');
    expect(layer.warp.bend).toBe(100);
    expect(layer.warp.horizontal).toBe(-100);
  });

  it('paragraph spacing cannot go negative', () => {
    const layer = firstLayer({ paragraphSpacing: -20, letterSpacing: -3 });
    if (layer.kind !== 'text') throw new Error('不是文字图层');
    expect(layer.paragraphSpacing).toBe(0);
    expect(layer.letterSpacing).toBe(-3);
  });
});
