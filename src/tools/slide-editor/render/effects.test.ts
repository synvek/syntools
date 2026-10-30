import { describe, expect, it } from 'vitest';
import { NO_SHADOW_PROPS, glowShadowProps, outerShadowProps } from './effects';

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
