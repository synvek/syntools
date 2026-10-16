import { describe, expect, it } from 'vitest';
import { mapPsdBounds, mapPsdBlendMode, mapPsdColor, mapPsdEffects } from './importMap';
import { flattenPsdLayers, isPsdFile, type PsdImportReport } from './reader';
import type { GroupLayer, Layer } from '../model/types';

/**
 * PSD 导入映射的测试。
 *
 * 用结构化子集（而不是真实 PSD 文件）来做断言：映射规则的价值在于「字段缺失 / 禁用 / 未知取值时怎么退化」，
 * 而这些分支在真实文件里很难凑齐，恰恰是线上最容易出问题的部分。
 */

const report = (): PsdImportReport => ({ rasterized: [], skipped: [] });
const fakeCanvas = () => ({ width: 10, height: 10 }) as unknown as HTMLCanvasElement;

describe('mapPsdBlendMode', () => {
  it('带空格的 PSD 写法映射回我们的短横线取值', () => {
    expect(mapPsdBlendMode('soft light')).toBe('soft-light');
    expect(mapPsdBlendMode('color dodge')).toBe('color-dodge');
    expect(mapPsdBlendMode('Hard Light')).toBe('hard-light');
  });

  it('穿透不是混合模式，按 normal 处理（组内穿透由组的 passThrough 表达）', () => {
    expect(mapPsdBlendMode('pass through')).toBe('normal');
  });

  it('未知 / 缺失取值退化为 normal', () => {
    expect(mapPsdBlendMode(undefined)).toBe('normal');
    expect(mapPsdBlendMode('vivid light')).toBe('normal');
  });
});

describe('mapPsdColor', () => {
  it('分量转成大写十六进制', () => {
    expect(mapPsdColor({ r: 255, g: 128, b: 0 })).toBe('#FF8000');
  });

  it('越界分量钳制，缺失回落黑色', () => {
    expect(mapPsdColor({ r: 300, g: -20, b: 10 })).toBe('#FF000A');
    expect(mapPsdColor(undefined)).toBe('#000000');
  });
});

describe('mapPsdBounds', () => {
  it('left/top/right/bottom 转成矩形', () => {
    expect(mapPsdBounds({ left: 10, top: 20, right: 110, bottom: 70 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
  });

  it('空 / 退化矩形返回 null（空图层不该产出 0 尺寸对象）', () => {
    expect(mapPsdBounds(undefined)).toBeNull();
    expect(mapPsdBounds({ left: 5, top: 5, right: 5, bottom: 9 })).toBeNull();
  });
});

describe('mapPsdEffects', () => {
  it('没有效果时返回 null', () => {
    expect(mapPsdEffects(undefined)).toBeNull();
    expect(mapPsdEffects({})).toBeNull();
  });

  it('投影：颜色 / 不透明度 / 角度 / 距离 / 扩展 / 模糊都映射过来（opacity 为 0~1）', () => {
    const style = mapPsdEffects({
      dropShadow: [
        {
          enabled: true,
          color: { r: 10, g: 20, b: 30 },
          // ag-psd 的 opacity 是 0~1（FixedPoint8）
          opacity: 0.6,
          angle: 120,
          distance: { units: 'Pixels', value: 8 },
          choke: { units: 'Pixels', value: 3 },
          blur: { units: 'Pixels', value: 12 },
        },
      ],
    });
    expect(style?.dropShadow).toMatchObject({
      enabled: true,
      color: '#0A141E',
      opacity: 0.6,
      angle: 120,
      distance: 8,
      spread: 3,
      size: 12,
    });
  });

  it('停用的效果被忽略', () => {
    const style = mapPsdEffects({ dropShadow: [{ enabled: false }] });
    expect(style).toBeNull();
  });

  it('取第一个启用中的效果（PSD 的数组里可能有多条）', () => {
    const style = mapPsdEffects({
      outerGlow: [
        { enabled: false, color: { r: 1, g: 1, b: 1 } },
        { enabled: true, color: { r: 255, g: 0, b: 0 }, opacity: 1, size: { value: 6 } },
      ],
    });
    expect(style?.outerGlow).toMatchObject({ color: '#FF0000', size: 6, enabled: true });
  });

  it('颜色叠加与描边：描边位置非法时回落 outside', () => {
    const style = mapPsdEffects({
      solidFill: { enabled: true, color: { r: 0, g: 0, b: 255 }, opacity: 0.5 },
      stroke: { enabled: true, color: { r: 0, g: 0, b: 0 }, size: { value: 4 }, position: 'weird' },
    });
    expect(style?.colorOverlay).toMatchObject({ color: '#0000FF', opacity: 0.5 });
    expect(style?.stroke).toMatchObject({ size: 4, position: 'outside' });
  });

  it('内阴影与描边 inside 位置正常映射', () => {
    const style = mapPsdEffects({
      innerShadow: [{ enabled: true, angle: 90, distance: 4, blur: { value: 6 } }],
      stroke: { enabled: true, position: 'inside', size: { value: 2 } },
    });
    expect(style?.innerShadow).toMatchObject({ angle: 90, distance: 4, size: 6 });
    expect(style?.stroke).toMatchObject({ position: 'inside', size: 2 });
  });

  it('「扩展」兼容 choke（PSD 描述符名）与 spread（其它实现的别名）', () => {
    const viaChoke = mapPsdEffects({ dropShadow: [{ enabled: true, choke: 5 }] });
    expect(viaChoke?.dropShadow?.spread).toBe(5);
    const viaSpread = mapPsdEffects({ dropShadow: [{ enabled: true, spread: { value: 2 } }] });
    expect(viaSpread?.dropShadow?.spread).toBe(2);
  });

  it('尺寸字段直接给数字也能读', () => {
    const style = mapPsdEffects({ dropShadow: [{ enabled: true, distance: 5, blur: 9 }] });
    expect(style?.dropShadow).toMatchObject({ distance: 5, size: 9 });
  });
});

describe('isPsdFile', () => {
  it('只认 .psd 扩展名（大小写与首尾空白都容错）', () => {
    expect(isPsdFile('a.PSD')).toBe(true);
    expect(isPsdFile('  b.psd  ')).toBe(true);
    expect(isPsdFile('c.png')).toBe(false);
    expect(isPsdFile('d.psb')).toBe(false);
  });
});

describe('flattenPsdLayers：层栈展开', () => {
  const raster = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    canvas: fakeCanvas(),
    left: 0,
    top: 0,
    right: 10,
    bottom: 10,
    opacity: 255,
    ...extra,
  });

  it('扁平图层的顺序保持自下而上（与我们的 layers 数组一致）', () => {
    const out = flattenPsdLayers([raster('bottom'), raster('top')], report(), {
      width: 100,
      height: 100,
    });
    expect(out.map((layer) => layer.name)).toEqual(['bottom', 'top']);
  });

  it('组展开为「组 + 紧随其后的子层」，并写入 parentId', () => {
    const out = flattenPsdLayers(
      [
        raster('below'),
        {
          name: 'Group',
          blendMode: 'pass through',
          opened: true,
          children: [raster('inner-1'), raster('inner-2')],
        },
      ],
      report(),
      { width: 100, height: 100 },
    );
    expect(out.map((layer) => layer.name)).toEqual(['below', 'Group', 'inner-1', 'inner-2']);
    const group = out[1] as GroupLayer;
    expect(group.kind).toBe('group');
    expect(group.passThrough).toBe(true);
    expect([out[2].parentId, out[3].parentId]).toEqual([group.id, group.id]);
    expect(out[0].parentId).toBeNull();
  });

  it('非穿透组按普通混合处理', () => {
    const out = flattenPsdLayers(
      [{ name: 'G', blendMode: 'multiply', children: [raster('x')] }],
      report(),
      { width: 10, height: 10 },
    );
    expect((out[0] as GroupLayer).passThrough).toBe(false);
    expect(out[0].blend).toBe('multiply');
  });

  it('拿不到像素的图层被计入 skipped 且不进文档', () => {
    const stats = report();
    const out = flattenPsdLayers([{ name: 'no-pixels' }, raster('ok')], stats, {
      width: 10,
      height: 10,
    });
    expect(out.map((layer) => layer.name)).toEqual(['ok']);
    expect(stats.skipped).toEqual(['no-pixels']);
  });

  it('智能对象（放置图层）计入 rasterized 统计', () => {
    const stats = report();
    const out = flattenPsdLayers([raster('smart', { placedLayer: { id: 'abc' } })], stats, {
      width: 10,
      height: 10,
    });
    expect(out).toHaveLength(1);
    expect(stats.rasterized).toEqual(['smart']);
  });

  it('文字图层还原为可再编辑的文字图层（而不是位图）', () => {
    const out: Layer[] = flattenPsdLayers(
      [
        raster('Title', {
          text: {
            text: 'Hello',
            transform: [0, 1, -1, 0, 100, 200],
            style: {
              font: { name: 'Georgia-Bold' },
              fontSize: 36,
              fillColor: { r: 255, g: 0, b: 0 },
            },
          },
        }),
      ],
      report(),
      { width: 400, height: 300 },
    );
    const layer = out[0];
    expect(layer.kind).toBe('text');
    if (layer.kind !== 'text') return;
    expect(layer.text).toBe('Hello');
    expect(layer.fontSize).toBe(36);
    // 字体名里的族名与粗体标记分别还原
    expect(layer.fontFamily).toBe('Georgia');
    expect(layer.bold).toBe(true);
    expect(layer.fill).toBe('#FF0000');
    // [0, 1, -1, 0] 表示旋转 90°
    expect(layer.rotation).toBe(90);
  });

  it('组自身不产出像素尺寸（由子层推导）', () => {
    const out = flattenPsdLayers([{ name: 'G', children: [raster('x')] }], report(), {
      width: 10,
      height: 10,
    });
    expect(out[0].width).toBe(0);
    expect(out[0].height).toBe(0);
  });

  it('空输入返回空数组（调用方据此判定 INVALID_PSD）', () => {
    expect(flattenPsdLayers(undefined, report(), { width: 1, height: 1 })).toEqual([]);
  });
});
