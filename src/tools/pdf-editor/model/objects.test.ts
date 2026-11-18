import { describe, expect, it } from 'vitest';
import {
  clampOpacity,
  createObjectId,
  createTextObject,
  DEFAULT_TEXT_STYLE,
  moveObjectToPage,
  nextZ,
  sortByZ,
} from './objects';

const rect = { x: 0.1, y: 0.2, w: 0.3, h: 0.1 };
const page = 'page-main-0';

describe('createTextObject', () => {
  it('默认样式：Helvetica 11pt、左对齐、不透明', () => {
    const object = createTextObject({ page: 'page-main-2', rect, text: 'Hello' });

    expect(object.kind).toBe('text');
    expect(object.page).toBe('page-main-2');
    expect(object.text).toBe('Hello');
    expect(object.fontFamily).toBe(DEFAULT_TEXT_STYLE.fontFamily);
    expect(object.fontSize).toBe(11);
    expect(object.color).toBe('#111111');
    expect(object.align).toBe('left');
    expect(object.lineHeight).toBe(1.35);
    expect(object.opacity).toBe(1);
    expect(object.rotation).toBe(0);
    expect(object.z).toBe(1);
    expect(object.id.length).toBeGreaterThan(0);
    expect(object.patch).toBeUndefined();
  });

  it('样式可覆盖，透明度被夹到 0–1', () => {
    const object = createTextObject({
      page,
      rect,
      text: '18pt',
      z: 7,
      id: 'fixed-id',
      style: {
        fontSize: 18,
        bold: true,
        color: '#ff0000',
        align: 'center',
        opacity: 1.5,
        patch: { cover: '#ffffff', sourceText: '旧文本' },
      },
    });

    expect(object.id).toBe('fixed-id');
    expect(object.z).toBe(7);
    expect(object.fontSize).toBe(18);
    expect(object.bold).toBe(true);
    expect(object.color).toBe('#ff0000');
    expect(object.align).toBe('center');
    expect(object.opacity).toBe(1);
    // D1 = B：遮挡信息随对象保存，M3 的自动识别只补 sourceText
    expect(object.patch).toEqual({ cover: '#ffffff', sourceText: '旧文本' });
  });

  it('矩形被夹进页面（反向拖拽也能收敛）', () => {
    const object = createTextObject({
      page,
      rect: { x: 0.9, y: 0.9, w: -0.4, h: -0.5 },
      text: '',
    });
    expect(object.rect.x).toBeCloseTo(0.5, 10);
    expect(object.rect.y).toBeCloseTo(0.4, 10);
    expect(object.rect.w).toBeCloseTo(0.4, 10);
    expect(object.rect.h).toBeCloseTo(0.5, 10);
  });

  it('每次生成的 id 不同', () => {
    const a = createObjectId();
    const b = createObjectId();
    expect(a).not.toBe(b);
  });
});

describe('nextZ / sortByZ', () => {
  it('空列表从 1 开始，否则取最大值 +1', () => {
    expect(nextZ([])).toBe(1);
    const objects = [
      createTextObject({ page, rect, text: 'a', z: 3 }),
      createTextObject({ page, rect, text: 'b', z: 1 }),
    ];
    expect(nextZ(objects)).toBe(4);
  });

  it('sortByZ 返回新数组且不改原数组', () => {
    const low = createTextObject({ page, rect, text: 'low', z: 1 });
    const high = createTextObject({ page, rect, text: 'high', z: 9 });
    const source = [high, low];

    const sorted = sortByZ(source);
    expect(sorted.map((object) => object.id)).toEqual([low.id, high.id]);
    expect(source[0]).toBe(high);
  });
});

describe('对象其他辅助', () => {
  it('clampOpacity 容错非法输入', () => {
    expect(clampOpacity(-1)).toBe(0);
    expect(clampOpacity(2)).toBe(1);
    expect(clampOpacity(0.4)).toBe(0.4);
    expect(clampOpacity(Number.NaN)).toBe(1);
  });

  it('moveObjectToPage 只改页，其余字段保持', () => {
    const object = createTextObject({ page, rect, text: 'move me', z: 5 });
    const moved = moveObjectToPage(object, 'page-main-3');
    expect(moved.page).toBe('page-main-3');
    expect(moved.id).toBe(object.id);
    expect(moved.rect).toEqual(object.rect);
    expect(moved.z).toBe(5);
    expect(object.page).toBe(page);
  });
});
