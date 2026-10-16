import { describe, expect, it } from 'vitest';
import {
  createColorOverlay,
  createDropShadow,
  createLayerStyle,
  createOuterGlow,
  createStroke,
  hasLayerStyle,
  isEffectActive,
  stylePadding,
  styleSignature,
} from './core';
import { effectOffset, strokeWidths } from './render/style';
import { normalizeLayerStyle } from './model/migrate';
import type { LayerStyle } from './model/types';

describe('图层样式：启用判定与签名', () => {
  it('默认样式（全部关闭）不算有样式', () => {
    expect(hasLayerStyle(createLayerStyle())).toBe(false);
    expect(hasLayerStyle(null)).toBe(false);
    expect(hasLayerStyle(undefined)).toBe(false);
  });

  it('只保留参数但未启用时依然不算有样式', () => {
    const style: LayerStyle = { dropShadow: { ...createDropShadow(), enabled: false } };
    expect(hasLayerStyle(style)).toBe(false);
    expect(styleSignature(style)).toBe('');
  });

  it('启用后签名非空，且参数变化会换签名', () => {
    const style: LayerStyle = { dropShadow: createDropShadow() };
    const first = styleSignature(style);
    expect(first.length).toBeGreaterThan(0);
    const changed: LayerStyle = { dropShadow: { ...createDropShadow(), distance: 20 } };
    expect(styleSignature(changed)).not.toBe(first);
  });

  it('未启用的效果不参与签名（不会因「被关闭的效果」改动而反复重绘）', () => {
    const a: LayerStyle = {
      dropShadow: createDropShadow(),
      stroke: { ...createStroke(), enabled: false, size: 1 },
    };
    const b: LayerStyle = {
      dropShadow: createDropShadow(),
      stroke: { ...createStroke(), enabled: false, size: 90 },
    };
    expect(styleSignature(a)).toBe(styleSignature(b));
  });

  it('isEffectActive 只看 enabled', () => {
    expect(isEffectActive(createOuterGlow())).toBe(true);
    expect(isEffectActive({ enabled: false })).toBe(false);
    expect(isEffectActive(null)).toBe(false);
  });
});

describe('图层样式：外扩留白', () => {
  it('无样式时不需要留白', () => {
    expect(stylePadding(createLayerStyle())).toBe(0);
    expect(stylePadding(null)).toBe(0);
  });

  it('投影的留白覆盖模糊、扩展与偏移', () => {
    const style: LayerStyle = {
      dropShadow: { ...createDropShadow(), size: 10, spread: 5, distance: 30 },
    };
    // 20（模糊） + 5（扩展） + 30（偏移）
    expect(stylePadding(style)).toBe(55);
  });

  it('内阴影与内侧描边不占用留白', () => {
    const style: LayerStyle = {
      innerShadow: {
        enabled: true,
        color: '#000000',
        opacity: 1,
        angle: 0,
        distance: 50,
        size: 20,
      },
      stroke: { ...createStroke(), position: 'inside', size: 40 },
    };
    expect(stylePadding(style)).toBe(0);
  });

  it('外侧描边按线宽留白', () => {
    const style: LayerStyle = { stroke: { ...createStroke(), position: 'outside', size: 12 } };
    expect(stylePadding(style)).toBe(12);
  });

  it('多种效果取最大留白', () => {
    const style: LayerStyle = {
      dropShadow: { ...createDropShadow(), size: 4, spread: 0, distance: 2 },
      outerGlow: { ...createOuterGlow(), size: 30 },
    };
    expect(stylePadding(style)).toBe(60);
  });
});

describe('effectOffset：角度语义', () => {
  it('90° 表示光源在上 → 阴影垂直向下', () => {
    const offset = effectOffset(90, 10);
    expect(offset.x).toBeCloseTo(0, 5);
    expect(offset.y).toBeCloseTo(10, 5);
  });

  it('135° 与 Photoshop 默认一致：阴影落在右下', () => {
    const offset = effectOffset(135, 10);
    expect(offset.x).toBeGreaterThan(0);
    expect(offset.y).toBeGreaterThan(0);
  });

  it('距离为 0 时无偏移', () => {
    expect(effectOffset(0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('strokeWidths：描边位置分配', () => {
  it('外侧全部在外、内侧全部在内', () => {
    expect(strokeWidths('outside', 10)).toEqual({ outside: 10, inside: 0 });
    expect(strokeWidths('inside', 10)).toEqual({ outside: 0, inside: 10 });
  });

  it('居中时内外各半，且总和守恒（含奇数）', () => {
    expect(strokeWidths('center', 10)).toEqual({ outside: 5, inside: 5 });
    const odd = strokeWidths('center', 7);
    expect(odd.outside + odd.inside).toBeCloseTo(7, 5);
  });

  it('负值按 0 处理', () => {
    expect(strokeWidths('outside', -5)).toEqual({ outside: 0, inside: 0 });
  });
});

describe('normalizeLayerStyle：工程文件归一', () => {
  it('非对象 / 未知结构返回 null', () => {
    expect(normalizeLayerStyle(null)).toBeNull();
    expect(normalizeLayerStyle('nope')).toBeNull();
    expect(normalizeLayerStyle({ unknownEffect: { enabled: true } })).toBeNull();
  });

  it('参数越界会被钳制，非法颜色回落默认值', () => {
    const style = normalizeLayerStyle({
      dropShadow: {
        enabled: true,
        color: 'red',
        opacity: 5,
        distance: 9999,
        spread: 9999,
        size: 9999,
      },
    });
    expect(style?.dropShadow).toBeDefined();
    expect(style?.dropShadow?.color).toBe('#000000');
    expect(style?.dropShadow?.opacity).toBe(1);
    expect(style?.dropShadow?.distance).toBe(500);
    expect(style?.dropShadow?.spread).toBe(100);
    expect(style?.dropShadow?.size).toBe(250);
  });

  it('缺省字段补默认值，未知描边位置回落 outside', () => {
    const style = normalizeLayerStyle({ stroke: { enabled: true, position: 'weird' } });
    expect(style?.stroke?.position).toBe('outside');
    expect(style?.stroke?.color).toBe('#FFFFFF');
    expect(style?.stroke?.size).toBe(3);
  });

  it('保留合法颜色并大写化', () => {
    const style = normalizeLayerStyle({ colorOverlay: createColorOverlay() });
    expect(style?.colorOverlay?.color).toBe('#2563EB');
    expect(style?.colorOverlay?.enabled).toBe(true);
  });
});
