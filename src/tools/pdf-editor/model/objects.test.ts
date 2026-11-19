import { describe, expect, it } from 'vitest';
import {
  alignObjects,
  applyObjectFormat,
  clampObject,
  clampOpacity,
  cloneObject,
  createImageObject,
  createInkObject,
  createMarkupObject,
  createNoteObject,
  createObjectId,
  createShapeObject,
  createStampObject,
  createTextObject,
  createTextPatch,
  DEFAULT_TEXT_STYLE,
  distributeObjects,
  moveObjectToPage,
  nextZ,
  readObjectFormat,
  reorderZ,
  setObjectLocked,
  setObjectOpacity,
  sortByZ,
  unionRect,
} from './objects';
import type { PdfObject } from './types';

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
      opacity: 1.5,
      style: {
        fontSize: 18,
        bold: true,
        color: '#ff0000',
        align: 'center',
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

describe('createTextPatch（M3-2）', () => {
  it('继承行框/字号并默认白底遮挡', () => {
    const lineRect = { x: 0.12, y: 0.34, w: 0.4, h: 0.03 };
    const object = createTextPatch({
      page,
      rect: lineRect,
      text: '合计 ¥1,200',
      fontSize: 10.5,
      z: 4,
    });

    expect(object.kind).toBe('text');
    expect(object.rect.x).toBeCloseTo(lineRect.x, 10);
    expect(object.rect.y).toBeCloseTo(lineRect.y, 10);
    expect(object.rect.w).toBeCloseTo(lineRect.w, 10);
    expect(object.rect.h).toBeCloseTo(lineRect.h, 10);
    expect(object.text).toBe('合计 ¥1,200');
    expect(object.fontSize).toBe(10.5);
    expect(object.align).toBe('left');
    expect(object.z).toBe(4);
    expect(object.patch).toEqual({ cover: '#ffffff', sourceText: '合计 ¥1,200' });
  });

  it('覆盖色与文字色可覆盖', () => {
    const object = createTextPatch({
      page,
      rect,
      text: 'x',
      fontSize: 9,
      cover: '#f7f1e3',
      color: '#333333',
    });
    expect(object.patch?.cover).toBe('#f7f1e3');
    expect(object.color).toBe('#333333');
  });

  it('字号与矩形同样被夹紧', () => {
    const object = createTextPatch({
      page,
      rect: { x: 0.9, y: 0.9, w: 0.3, h: 0.3 },
      text: 'x',
      fontSize: 0.5,
    });
    expect(object.fontSize).toBe(4);
    expect(object.rect.x + object.rect.w).toBeLessThanOrEqual(1);
    expect(object.rect.y + object.rect.h).toBeLessThanOrEqual(1);
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

describe('对象工厂（M2-1）', () => {
  const png = 'data:image/png;base64,AAAA';

  it('图片：默认 fit=contain，尺寸为负时收敛到 1', () => {
    const object = createImageObject({
      page,
      rect: { x: 0.2, y: 0.2, w: 0.3, h: 0.2 },
      dataUrl: png,
      naturalW: 0,
      naturalH: -5,
    });

    expect(object.kind).toBe('image');
    expect(object.fit).toBe('contain');
    expect(object.naturalW).toBe(1);
    expect(object.naturalH).toBe(1);
  });

  it('图章与签名共用形状，kind 可区分', () => {
    const stamp = createStampObject({
      page,
      rect,
      dataUrl: png,
      naturalW: 120,
      naturalH: 60,
    });
    const signature = createStampObject({
      page,
      rect,
      dataUrl: png,
      naturalW: 120,
      naturalH: 60,
      kind: 'signature',
    });

    expect(stamp.kind).toBe('stamp');
    expect(signature.kind).toBe('signature');
    expect(signature.naturalW).toBe(120);
  });

  it('画笔：矩形由轨迹包围盒推导，点坐标相对矩形', () => {
    const object = createInkObject({
      page,
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.3, y: 0.4 },
        { x: 0.45, y: 0.25 },
      ],
      width: 3,
    });

    expect(object.points).toHaveLength(3);
    expect(object.rect.x).toBeCloseTo(0.19, 6);
    expect(object.rect.y).toBeCloseTo(0.19, 6);
    expect(object.rect.w).toBeCloseTo(0.27, 6);
    expect(object.rect.h).toBeCloseTo(0.22, 6);
    // first point maps to the padded corner
    expect(object.points[0].x).toBeCloseTo(0.01 / 0.27, 5);
    expect(object.points[0].y).toBeCloseTo(0.01 / 0.22, 5);
  });

  it('画笔：单点轨迹不产生对象点，线宽被夹取', () => {
    const object = createInkObject({ page, points: [{ x: 0.5, y: 0.5 }], width: 999 });
    expect(object.points).toEqual([]);
    expect(object.width).toBe(40);
  });

  it('高亮：多行四边形取并集，并丢弃空四边形', () => {
    const object = createMarkupObject({
      page,
      type: 'highlight',
      quads: [
        { x: 0.1, y: 0.1, w: 0.4, h: 0.02 },
        { x: 0.1, y: 0.13, w: 0.2, h: 0.02 },
        { x: 0.1, y: 0.2, w: 0, h: 0.02 },
      ],
    });

    expect(object.quads).toHaveLength(2);
    expect(object.rect.x).toBeCloseTo(0.1, 10);
    expect(object.rect.y).toBeCloseTo(0.1, 10);
    expect(object.rect.w).toBeCloseTo(0.4, 10);
    expect(object.rect.h).toBeCloseTo(0.05, 10);
    expect(object.color).toBe('#fde047');
  });

  it('形状：默认描边宽度、非法 dash 被过滤', () => {
    const object = createShapeObject({
      page,
      rect,
      type: 'arrow',
      dash: [4, 0, -1, 2],
    });

    expect(object.width).toBe(2);
    expect(object.dash).toEqual([4, 2]);
    expect(object.fill).toBeUndefined();
  });

  it('便签：默认图标与最小尺寸', () => {
    const object = createNoteObject({ page, rect: { x: 0.5, y: 0.5, w: 0, h: 0 } });
    expect(object.icon).toBe('note');
    expect(object.rect.w).toBeCloseTo(0.028, 6);
    expect(object.rect.h).toBeCloseTo(0.028, 6);
  });
});

describe('clampObject / unionRect / cloneObject', () => {
  it('统一夹取角度、透明度与越界矩形', () => {
    const object = clampObject(
      createTextObject({
        page,
        rect: { x: -0.2, y: 0.9, w: 0.5, h: 0.4 },
        text: 'x',
        rotation: -450,
        opacity: 3,
      }),
    );

    expect(object.rotation).toBe(270);
    expect(object.opacity).toBe(1);
    expect(object.rect.x).toBeCloseTo(0, 10);
    expect(object.rect.y).toBeCloseTo(0.9, 10);
    expect(object.rect.w).toBeCloseTo(0.3, 10);
    expect(object.rect.h).toBeCloseTo(0.1, 10);
  });

  it('unionRect 对空集合返回零尺寸，不抛错', () => {
    expect(unionRect([])).toEqual({ x: 1, y: 1, w: 0, h: 0 });
  });

  it('cloneObject 生成新 id，可覆盖页码与层级', () => {
    const source = createTextObject({ page, rect, text: 'a', id: 'fixed' });
    const copy = cloneObject(source, { page: 'page-main-1', z: 9 });

    expect(copy.id).not.toBe('fixed');
    expect(copy.page).toBe('page-main-1');
    expect(copy.z).toBe(9);
    expect(source.page).toBe(page);
  });
});

describe('reorderZ / 锁定 / 透明度', () => {
  const stack = (): PdfObject[] => [
    createShapeObject({ page, rect, type: 'rect', z: 1, id: 'a' }),
    createShapeObject({ page, rect, type: 'rect', z: 2, id: 'b' }),
    createShapeObject({ page, rect, type: 'rect', z: 3, id: 'c' }),
    createShapeObject({ page: 'page-main-1', rect, type: 'rect', z: 1, id: 'other' }),
  ];

  const order = (objects: PdfObject[]) =>
    objects
      .filter((object) => object.page === page)
      .sort((left, right) => left.z - right.z)
      .map((object) => object.id);

  it('置顶/置底只重排同页 z，其他页不受影响', () => {
    const objects = stack();

    expect(order(reorderZ(objects, 'a', 'front'))).toEqual(['b', 'c', 'a']);
    expect(order(reorderZ(objects, 'c', 'back'))).toEqual(['c', 'a', 'b']);
    expect(reorderZ(objects, 'a', 'front').find((object) => object.id === 'other')?.z).toBe(1);
  });

  it('上移/下移一次只换一位，到边界返回原数组', () => {
    const objects = stack();

    expect(order(reorderZ(objects, 'a', 'forward'))).toEqual(['b', 'a', 'c']);
    expect(order(reorderZ(objects, 'c', 'backward'))).toEqual(['a', 'c', 'b']);
    expect(reorderZ(objects, 'c', 'front')).toBe(objects);
    expect(reorderZ(objects, 'a', 'back')).toBe(objects);
    expect(reorderZ(objects, 'missing', 'front')).toBe(objects);
  });

  it('锁定与解锁幂等，无变化时返回同一数组', () => {
    const objects = stack();
    const locked = setObjectLocked(objects, 'b', true);
    expect(locked.find((object) => object.id === 'b')?.locked).toBe(true);
    expect(setObjectLocked(locked, 'b', true)).toBe(locked);
    expect(setObjectLocked(objects, 'missing', true)).toBe(objects);

    const unlocked = setObjectLocked(locked, 'b', false);
    expect(unlocked.find((object) => object.id === 'b')?.locked).toBeUndefined();
  });

  it('透明度夹到 0–1，重复设置不产生新数组', () => {
    const objects = stack();

    expect(setObjectOpacity(objects, 'a', 1.5).find((object) => object.id === 'a')?.opacity).toBe(
      1,
    );
    expect(setObjectOpacity(objects, 'a', -1).find((object) => object.id === 'a')?.opacity).toBe(0);

    const half = setObjectOpacity(objects, 'a', 0.5);
    expect(half.find((object) => object.id === 'a')?.opacity).toBe(0.5);
    expect(setObjectOpacity(half, 'a', 0.5)).toBe(half);
  });
});

describe('alignObjects / distributeObjects / 格式刷（M3-5）', () => {
  const boxes = (): PdfObject[] => [
    createShapeObject({ page, rect: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 }, type: 'rect', id: 'a' }),
    createShapeObject({ page, rect: { x: 0.5, y: 0.3, w: 0.2, h: 0.2 }, type: 'rect', id: 'b' }),
    createShapeObject({ page, rect: { x: 0.8, y: 0.6, w: 0.1, h: 0.1 }, type: 'rect', id: 'c' }),
  ];
  const ids = new Set(['a', 'b', 'c']);
  const rectOf = (objects: PdfObject[], id: string) =>
    objects.find((object) => object.id === id)?.rect;

  it('六种对齐都以选区外框为基准，尺寸不变', () => {
    const objects = boxes();
    expect(rectOf(alignObjects(objects, ids, 'left'), 'b')?.x).toBeCloseTo(0.1, 10);
    // The selection box spans 0.1–0.9 on x and 0.1–0.7 on y
    expect(rectOf(alignObjects(objects, ids, 'right'), 'b')?.x).toBeCloseTo(0.7, 10);
    expect(rectOf(alignObjects(objects, ids, 'center'), 'b')?.x).toBeCloseTo(0.4, 5);
    expect(rectOf(alignObjects(objects, ids, 'top'), 'b')?.y).toBeCloseTo(0.1, 10);
    expect(rectOf(alignObjects(objects, ids, 'bottom'), 'b')?.y).toBeCloseTo(0.5, 10);
    expect(rectOf(alignObjects(objects, ids, 'middle'), 'b')?.y).toBeCloseTo(0.3, 5);
    expect(rectOf(alignObjects(objects, ids, 'left'), 'b')?.w).toBeCloseTo(0.2, 10);
  });

  it('少于两个对象时不做任何事', () => {
    const objects = boxes();
    expect(alignObjects(objects, new Set(['a']), 'left')).toBe(objects);
    expect(distributeObjects(objects, new Set(['a', 'b']), 'horizontal')).toBe(objects);
  });

  it('水平分布让中间对象等距，首尾不动', () => {
    const objects = boxes();
    const distributed = distributeObjects(objects, ids, 'horizontal');
    expect(rectOf(distributed, 'a')?.x).toBeCloseTo(0.1, 10);
    expect(rectOf(distributed, 'c')?.x).toBeCloseTo(0.8, 10);
    const gapAB = (rectOf(distributed, 'b')?.x ?? 0) - ((rectOf(distributed, 'a')?.x ?? 0) + 0.1);
    const gapBC = 0.8 - ((rectOf(distributed, 'b')?.x ?? 0) + 0.2);
    expect(gapAB).toBeCloseTo(gapBC, 6);
  });

  it('垂直分布同样保持首尾位置', () => {
    const objects = boxes();
    const distributed = distributeObjects(objects, ids, 'vertical');
    expect(rectOf(distributed, 'a')?.y).toBeCloseTo(0.1, 10);
    expect(rectOf(distributed, 'c')?.y).toBeCloseTo(0.6, 10);
    expect(rectOf(distributed, 'b')?.y).toBeGreaterThan(0.1);
    expect(rectOf(distributed, 'b')?.y).toBeLessThan(0.6);
  });

  it('格式刷只复制目标类型拥有的属性', () => {
    const source = createTextObject({
      page,
      rect,
      text: 'source',
      style: { fontSize: 22, color: '#123456', bold: true, align: 'right', lineHeight: 1.8 },
    });
    const target = createTextObject({ page, rect, text: 'target' });
    const painted = applyObjectFormat(target, readObjectFormat(source));

    expect(painted.kind).toBe('text');
    if (painted.kind !== 'text') return;
    expect(painted.fontSize).toBe(22);
    expect(painted.color).toBe('#123456');
    expect(painted.bold).toBe(true);
    expect(painted.align).toBe('right');
    expect(painted.text).toBe('target');

    const shape = createShapeObject({ page, rect, type: 'rect', stroke: '#000000' });
    expect(readObjectFormat(source).width).toBeUndefined();
    expect(applyObjectFormat(shape, readObjectFormat(source))).toMatchObject({
      kind: 'shape',
      stroke: '#123456',
    });
  });
});
