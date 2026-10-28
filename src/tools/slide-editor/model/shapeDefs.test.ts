import { describe, expect, it } from 'vitest';
import { SHAPE_DEFS, resolveShapeGeometry, shapeAdjustValues, shapeAdjustments } from './shapeDefs';

describe('形状预设定义', () => {
  it('至少 40 个预设且 prst / labelKey 唯一', () => {
    expect(SHAPE_DEFS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(SHAPE_DEFS.map((def) => def.prst)).size).toBe(SHAPE_DEFS.length);
    expect(new Set(SHAPE_DEFS.map((def) => def.labelKey)).size).toBe(SHAPE_DEFS.length);
  });

  it('可调形状带有手柄定义，静态形状没有', () => {
    expect(shapeAdjustments('roundRect')).toHaveLength(1);
    expect(shapeAdjustments('rightArrow')).toHaveLength(2);
    expect(shapeAdjustments('star')).toHaveLength(1);
    expect(shapeAdjustments('rect')).toHaveLength(0);
    expect(shapeAdjustments('not-a-shape')).toHaveLength(0);
  });

  it('调整值改变几何结果', () => {
    const roundRect = resolveShapeGeometry('roundRect', { adj1: 0.4 });
    expect(roundRect).toMatchObject({ kind: 'rect', radius: 0.4, prst: 'roundRect' });

    const star = resolveShapeGeometry('star', { adj1: 0.6 });
    expect(star).toMatchObject({ kind: 'star', innerRatio: 0.6 });

    const triangle = resolveShapeGeometry('triangle', { adj1: 0.2 });
    expect(triangle?.kind).toBe('polygon');
    expect(triangle?.points?.slice(0, 2)).toEqual([0.2, 0]);

    const arrow = resolveShapeGeometry('rightArrow', { adj1: 0.2, adj2: 0.6 });
    expect(arrow?.kind).toBe('polygon');
    // Shaft top edge moves toward the center; the head starts at x = 1 - 0.6
    expect(arrow?.points?.[1]).toBeCloseTo(0.4);
    expect(arrow?.points?.[2]).toBeCloseTo(0.4);
  });

  it('调整值缺省时使用预设默认值并按范围裁剪', () => {
    const defaults = shapeAdjustValues({ prst: 'roundRect' });
    expect(defaults.adj1).toBeCloseTo(0.167);

    const clamped = shapeAdjustValues({ prst: 'roundRect', adj: { adj1: 9 } });
    expect(clamped.adj1).toBe(0.5);
  });

  it('未知预设返回 undefined，交给导入回退表处理', () => {
    expect(resolveShapeGeometry('doesNotExist', { adj1: 1 })).toBeUndefined();
  });
});
