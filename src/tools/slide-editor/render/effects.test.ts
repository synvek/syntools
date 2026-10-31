import { describe, expect, it } from 'vitest';
import {
  NO_SHADOW_PROPS,
  glowShadowProps,
  innerShadowPaint,
  outerShadowProps,
  softEdgeRadius,
} from './effects';

/**
 * P2-S3.0: outer shadow on the canvas path.
 *
 * The interesting part is not "props are copied" but the two哑 cases — a zero-blur/zero-offset
 * shadow is a dark copy of the shape rather than a shadow, and a removed shadow must clear the
 * props on a reused node. Both are locked here.
 */

describe('outerShadowProps', () => {
  it('没有阴影就不产生任何属性', () => {
    expect(outerShadowProps(undefined)).toBeUndefined();
  });

  it('正常阴影 1:1 拷贝，并关掉描边投影', () => {
    expect(outerShadowProps({ color: '#123456', blur: 12, offsetX: 3, offsetY: -4 })).toEqual({
      shadowColor: '#123456',
      shadowBlur: 12,
      shadowOffsetX: 3,
      shadowOffsetY: -4,
      shadowOpacity: 1,
      shadowEnabled: true,
      shadowForStrokeEnabled: false,
    });
  });

  it('透明度取模型值', () => {
    expect(
      outerShadowProps({ color: '#000000', blur: 8, offsetX: 1, offsetY: 1, opacity: 0.4 })
        ?.shadowOpacity,
    ).toBe(0.4);
  });

  it('零模糊 + 零偏移 = 完全重合的暗影，不画', () => {
    expect(outerShadowProps({ color: '#000000', blur: 0, offsetX: 0, offsetY: 0 })).toBeUndefined();
  });

  it('偏移不为零时零模糊仍然可见（硬边阴影）', () => {
    expect(
      outerShadowProps({ color: '#000000', blur: 0, offsetX: 4, offsetY: 4 })?.shadowOffsetX,
    ).toBe(4);
  });

  it('负模糊收敛为 0，透明度为 0 时整体不画', () => {
    expect(
      outerShadowProps({ color: '#000000', blur: -5, offsetX: 2, offsetY: 2 })?.shadowBlur,
    ).toBe(0);
    expect(
      outerShadowProps({ color: '#000000', blur: 8, offsetX: 2, offsetY: 2, opacity: 0 }),
    ).toBeUndefined();
  });

  it('线条需要从描边取阴影，否则 Konva 画不出（线没有填充）', () => {
    const base = { color: '#000000', blur: 6, offsetX: 1, offsetY: 1 };
    expect(outerShadowProps(base)?.shadowForStrokeEnabled).toBe(false);
    expect(outerShadowProps(base, { fromStroke: true })?.shadowForStrokeEnabled).toBe(true);
  });

  it('清除投影用的 props 只有 shadowEnabled', () => {
    expect(NO_SHADOW_PROPS).toEqual({ shadowEnabled: false });
  });
});

describe('glowShadowProps', () => {
  it('光晕是零偏移的阴影（画在克隆节点上）', () => {
    expect(glowShadowProps({ color: '#38bdf8', radius: 10, opacity: 0.5 })).toEqual({
      shadowColor: '#38bdf8',
      shadowBlur: 10,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowOpacity: 0.5,
      shadowEnabled: true,
      shadowForStrokeEnabled: false,
    });
  });

  it('没有光晕 / 半径 0 / 透明度 0 都不画', () => {
    expect(glowShadowProps(undefined)).toBeUndefined();
    expect(glowShadowProps({ color: '#fff', radius: 0 })).toBeUndefined();
    expect(glowShadowProps({ color: '#fff', radius: 8, opacity: 0 })).toBeUndefined();
  });

  it('线条的光晕要从描边取', () => {
    expect(
      glowShadowProps({ color: '#fff', radius: 8 }, { fromStroke: true })?.shadowForStrokeEnabled,
    ).toBe(true);
  });

  it('负半径收敛为 0 → 不画（不是画一个反向光晕）', () => {
    expect(glowShadowProps({ color: '#fff', radius: -4 })).toBeUndefined();
  });
});

describe('softEdgeRadius', () => {
  it('有半径时原样返回（单位已是 px）', () => {
    expect(softEdgeRadius({ radius: 18 })).toBe(18);
  });

  it('缺失/零/负半径都视为没有柔化（否则会导出空的 a:softEdge）', () => {
    expect(softEdgeRadius(undefined)).toBe(0);
    expect(softEdgeRadius({ radius: 0 })).toBe(0);
    expect(softEdgeRadius({ radius: -5 })).toBe(0);
  });
});

describe('innerShadowPaint', () => {
  it('正常内阴影原样返回，并给出缓存 padding', () => {
    expect(
      innerShadowPaint({ color: '#123456', blur: 6, offsetX: 4, offsetY: -3, opacity: 0.5 }),
    ).toEqual({
      color: '#123456',
      blur: 6,
      offsetX: 4,
      offsetY: -3,
      opacity: 0.5,
      cacheOffset: 6,
    });
  });

  it('模糊与偏移全为 0 时不画：PowerPoint 会整体压暗，我们不复现那个观感', () => {
    expect(innerShadowPaint({ color: '#000000', blur: 0, offsetX: 0, offsetY: 0 })).toBeUndefined();
  });

  it('有偏移时零模糊仍然画（硬边内阴影）', () => {
    expect(innerShadowPaint({ color: '#000000', blur: 0, offsetX: 0, offsetY: 5 })?.offsetY).toBe(
      5,
    );
  });

  it('缺失 / 透明度 0 / 负模糊都不画', () => {
    expect(innerShadowPaint(undefined)).toBeUndefined();
    expect(
      innerShadowPaint({ color: '#000000', blur: 6, offsetX: 2, offsetY: 2, opacity: 0 }),
    ).toBeUndefined();
    expect(innerShadowPaint({ color: '#000000', blur: -4, offsetX: 2, offsetY: 2 })?.blur).toBe(0);
  });
});
