import { describe, expect, it } from 'vitest';
import { SNAP_THRESHOLD_PX, collectSnapTargets, snapBoxPosition } from './core';
import { createDoc } from './model/factory';
import type { Guide, Layer, PhotoDoc } from './model/types';

/**
 * 对齐吸附（智能参考线）的纯逻辑测试。
 *
 * 吸附是「差一点就对齐」的典型场景：差 2px 时不吸会让人反复微调，多吸了又会失控，
 * 因此这里把「阈值内吸住、阈值外放开、开关与修饰键能关掉」三条契约全部固定下来。
 */

const raster = (over: Partial<Layer> & { id: string }): Layer =>
  ({
    kind: 'raster',
    name: over.id,
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    rotation: 0,
    flipX: false,
    flipY: false,
    assetId: `asset-${over.id}`,
    rev: 0,
    adjustments: [],
    filters: [],
    ...over,
  }) as Layer;

const docWith = (layers: Layer[], over: Partial<PhotoDoc> = {}): PhotoDoc => ({
  ...createDoc(),
  width: 800,
  height: 600,
  layers,
  activeLayerId: layers[0]?.id ?? null,
  ...over,
});

describe('collectSnapTargets：候选线来源', () => {
  it('画布边界与中心始终是候选', () => {
    const targets = collectSnapTargets(docWith([]));
    expect(targets.vertical).toEqual([0, 400, 800]);
    expect(targets.horizontal).toEqual([0, 300, 600]);
  });

  it('其它可见图层的左 / 中 / 右与上 / 中 / 下都是候选', () => {
    const doc = docWith([raster({ id: 'a', x: 100, y: 200, width: 80, height: 40 })]);
    const targets = collectSnapTargets(doc);
    expect(targets.vertical).toEqual(expect.arrayContaining([100, 140, 180]));
    expect(targets.horizontal).toEqual(expect.arrayContaining([200, 220, 240]));
  });

  it('被拖拽的图层自身不参与（否则会自己吸自己）', () => {
    const doc = docWith([raster({ id: 'a', x: 100, y: 200 }), raster({ id: 'b', x: 500, y: 400 })]);
    const targets = collectSnapTargets(doc, { excludeLayerId: 'a' });
    expect(targets.vertical).not.toContain(100);
    expect(targets.vertical).toEqual(expect.arrayContaining([500, 550, 600]));
  });

  it('隐藏图层不参与吸附', () => {
    const doc = docWith([raster({ id: 'a', x: 700, visible: false })]);
    expect(collectSnapTargets(doc).vertical).not.toContain(700);
  });

  it('已有参考线按方向并入候选', () => {
    const guides: Guide[] = [
      { axis: 'v', pos: 123 },
      { axis: 'h', pos: 456 },
    ];
    const targets = collectSnapTargets(docWith([]), { guides });
    expect(targets.vertical).toContain(123);
    expect(targets.horizontal).toContain(456);
  });
});

describe('snapBoxPosition：吸附判定', () => {
  const targets = { vertical: [400], horizontal: [300] };

  it('阈值内把中心吸到候选线并给出参考线', () => {
    // 盒子中心 402 → 距候选线 2px，阈值 6 → 应吸住
    const result = snapBoxPosition({ x: 352, y: 100, width: 100, height: 40 }, targets, 6);
    expect(result.x).toBe(350);
    expect(result.guides).toEqual([{ axis: 'x', position: 400 }]);
  });

  it('阈值外不动，也不产生参考线', () => {
    // 三条线分别是 200 / 250 / 300，距候选线 400 都超过阈值
    const result = snapBoxPosition({ x: 200, y: 100, width: 100, height: 40 }, targets, 6);
    expect(result.x).toBe(200);
    expect(result.guides).toEqual([]);
  });

  it('已经对齐时不移动，但依然给出参考线（提示「已对齐」）', () => {
    const result = snapBoxPosition({ x: 300, y: 100, width: 100, height: 40 }, targets, 6);
    expect(result.x).toBe(300);
    expect(result.guides).toEqual([{ axis: 'x', position: 400 }]);
  });

  it('左右边与中心都可以吸（三条线任一命中即可）', () => {
    // 右边缘 400 + 8 = 408 之外；把右边缘放到 402 处应吸住
    const result = snapBoxPosition({ x: 302, y: 0, width: 100, height: 40 }, targets, 6);
    expect(result.x + 100).toBe(400);
    expect(result.guides[0]).toEqual({ axis: 'x', position: 400 });
  });

  it('两个方向可同时吸住', () => {
    const result = snapBoxPosition({ x: 350, y: 250, width: 100, height: 100 }, targets, 6);
    expect(result.x).toBe(350);
    expect(result.y).toBe(300 - 50);
    expect(result.guides).toHaveLength(2);
    expect(result.guides.map((guide) => guide.axis).sort()).toEqual(['x', 'y']);
  });

  it('阈值内取最近的一条（不会吸到更远但更大的候选）', () => {
    const many = { vertical: [396, 400], horizontal: [] };
    const result = snapBoxPosition({ x: 352, y: 0, width: 100, height: 10 }, many, 6);
    // 中心 402 距 400 更近（2 < 6），距离 396 是 6 —— 取 400
    expect(result.x).toBe(350);
  });

  it('关闭吸附时原样返回', () => {
    const result = snapBoxPosition({ x: 352, y: 100, width: 100, height: 40 }, targets, 6, {
      enabled: false,
    });
    expect(result).toEqual({ x: 352, y: 100, guides: [] });
  });

  it('阈值为 0 时不吸附（含缩放极大时的边界情况）', () => {
    const result = snapBoxPosition({ x: 352, y: 100, width: 100, height: 40 }, targets, 0);
    expect(result.x).toBe(352);
  });

  it('开启网格时按网格线就近吸附', () => {
    const result = snapBoxPosition(
      { x: 17, y: 100, width: 10, height: 10 },
      { vertical: [], horizontal: [] },
      4,
      { gridSize: 20 },
    );
    // 网格只吸左上角：左边缘 17 → 最近网格线 20（中心线 22 不参与）
    expect(result.x).toBe(20);
    expect(result.guides[0]).toEqual({ axis: 'x', position: 20 });
  });

  it('屏幕阈值换算后的语义：缩放越小，文档单位的阈值越大', () => {
    // 同一盒子在缩放 0.1 时，6 屏幕像素 = 60 文档单位，足以吸住远端候选
    const result = snapBoxPosition(
      { x: 352, y: 0, width: 100, height: 10 },
      { vertical: [400], horizontal: [] },
      SNAP_THRESHOLD_PX / 0.1,
    );
    expect(result.x).toBe(350);
  });
});
