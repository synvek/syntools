import { describe, expect, it } from 'vitest';
import { createDoc } from './doc';
import {
  createDecoration,
  DEFAULT_PAGE_NUMBERS,
  formatPageNumber,
  hasDecoration,
  normalizeDecoration,
  pageNumberFor,
  setDecoration,
  watermarkTileAnchors,
} from './decorations';
import type { PdfSource } from './types';

const source: PdfSource = {
  key: 'main',
  bytes: new Uint8Array([1]),
  pageCount: 2,
  encrypted: false,
  fingerprint: 'fp',
};

const emptyDoc = () => createDoc({ name: 'a.pdf', source, id: 'doc', now: 0 });

describe('formatPageNumber', () => {
  it('替换 {n} 与 {total}', () => {
    expect(formatPageNumber('{n} / {total}', 3, 12)).toBe('3 / 12');
    expect(formatPageNumber('第 {n} 页，共 {total} 页', 3, 12)).toBe('第 3 页，共 12 页');
  });

  it('空格式回落默认值，未知占位符原样保留', () => {
    expect(formatPageNumber('   ', 2, 5)).toBe('2 / 5');
    expect(formatPageNumber('P{n} ({label})', 2, 5)).toBe('P2 ({label})');
  });

  it('startFrom 决定首页编号', () => {
    const rule = { ...DEFAULT_PAGE_NUMBERS, enabled: true, startFrom: 5 };
    expect(pageNumberFor(rule, 0, 10)).toBe('5 / 10');
    expect(pageNumberFor(rule, 2, 10)).toBe('7 / 10');
  });
});

describe('hasDecoration', () => {
  it('默认空白装饰不算启用', () => {
    expect(hasDecoration(createDecoration())).toBe(false);
    expect(hasDecoration(undefined)).toBe(false);
  });

  it('任一页眉文字、水印文字或启用页码都算启用', () => {
    expect(hasDecoration({ header: { ...createDecoration().header!, text: '标题' } })).toBe(true);
    expect(hasDecoration({ watermark: { ...createDecoration().watermark!, text: '机密' } })).toBe(
      true,
    );
    expect(
      hasDecoration({
        numbers: { ...DEFAULT_PAGE_NUMBERS, enabled: true },
      }),
    ).toBe(true);
  });
});

describe('normalizeDecoration', () => {
  it('字号、边距、透明度、旋转都与保存时使用同一套上下限', () => {
    const normalized = normalizeDecoration({
      numbers: { ...DEFAULT_PAGE_NUMBERS, enabled: true, fontSize: 999, margin: 1, startFrom: 0 },
      header: { text: '  页眉  ', align: 'left', fontSize: 1, color: '#000000', margin: 999 },
      watermark: {
        text: ' 机密 ',
        fontSize: 500,
        color: '#ff0000',
        opacity: 2,
        rotation: -400,
        tiled: true,
        spacing: 1,
      },
    });

    expect(normalized.numbers?.fontSize).toBe(36);
    expect(normalized.numbers?.margin).toBe(8);
    expect(normalized.numbers?.startFrom).toBe(1);
    expect(normalized.numbers?.format).toBe('{n} / {total}');
    expect(normalized.header?.text).toBe('页眉');
    expect(normalized.header?.fontSize).toBe(6);
    expect(normalized.header?.margin).toBe(120);
    expect(normalized.watermark?.text).toBe('机密');
    expect(normalized.watermark?.fontSize).toBe(120);
    expect(normalized.watermark?.opacity).toBe(1);
    expect(normalized.watermark?.rotation).toBe(-90);
    expect(normalized.watermark?.spacing).toBe(60);
  });
});

describe('watermarkTileAnchors', () => {
  it('A4 + 220pt 间距得到 3 列 4 行，锚点落在网格中心', () => {
    const anchors = watermarkTileAnchors(595.28, 841.89, 220);
    expect(anchors).toHaveLength(12);
    expect(anchors[0]).toEqual({ x: 0.5 / 3, y: 0.5 / 4 });
    expect(anchors[11]).toEqual({ x: 2.5 / 3, y: 3.5 / 4 });
  });

  it('异常页尺寸或间距时至少给出一个居中锚点', () => {
    expect(watermarkTileAnchors(0, 0, 200)).toEqual([{ x: 0.5, y: 0.5 }]);
    expect(watermarkTileAnchors(100, 100, 0)).toHaveLength(1);
  });
});

describe('setDecoration', () => {
  it('写入装饰并进一次修订', () => {
    const doc = emptyDoc();
    const next = setDecoration(doc, {
      numbers: { ...DEFAULT_PAGE_NUMBERS, enabled: true },
    });
    expect(next.decoration?.numbers?.enabled).toBe(true);
    expect(next.revision).toBe(doc.revision + 1);
  });

  it('空装饰等于清除，且不产生多余修订', () => {
    const doc = emptyDoc();
    expect(setDecoration(doc, createDecoration())).toBe(doc);
    expect(setDecoration(doc, undefined)).toBe(doc);

    const decorated = setDecoration(doc, { header: { ...createDecoration().header!, text: 'H' } });
    const cleared = setDecoration(decorated, undefined);
    expect(cleared.decoration).toBeUndefined();
  });

  it('相同内容不重复记入历史', () => {
    const doc = emptyDoc();
    const rule = { header: { ...createDecoration().header!, text: 'H' } };
    const once = setDecoration(doc, rule);
    expect(setDecoration(once, rule)).toBe(once);
  });
});
