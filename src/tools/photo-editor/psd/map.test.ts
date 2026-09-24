import { describe, expect, it } from 'vitest';
import { buildPsdPlan, mapBlendMode } from './map';
import type { Layer, PhotoDoc } from '../model/types';

const base = {
  name: '',
  visible: true,
  locked: false,
  opacity: 1,
  blend: 'normal' as const,
  x: 10,
  y: 20,
  width: 100,
  height: 80,
  rotation: 0,
  flipX: false,
  flipY: false,
};

const raster = (id: string, patch: Partial<Layer> = {}): Layer =>
  ({
    ...base,
    id,
    kind: 'raster',
    assetId: `a-${id}`,
    rev: 1,
    adjustments: {} as never,
    filters: [],
    ...patch,
  }) as Layer;

const group = (id: string, passThrough = true, patch: Partial<Layer> = {}): Layer =>
  ({ ...base, id, kind: 'group', passThrough, ...patch }) as Layer;

const adjustment = (id: string, patch: Partial<Layer> = {}): Layer =>
  ({
    ...base,
    id,
    kind: 'adjustment',
    adjustments: {} as never,
    filters: [],
    ...patch,
  }) as Layer;

const docOf = (layers: Layer[]): PhotoDoc => ({
  id: 'd',
  name: '',
  width: 800,
  height: 600,
  background: 'white',
  layers,
  activeLayerId: null,
});

describe('PSD 结构映射（纯函数）', () => {
  it('混合模式映射到 Photoshop 可读名', () => {
    expect(mapBlendMode('normal')).toBe('normal');
    expect(mapBlendMode('multiply')).toBe('multiply');
    expect(mapBlendMode('color-dodge')).toBe('color dodge');
    expect(mapBlendMode('luminosity')).toBe('luminosity');
  });

  it('普通图层：一层一个像素图层', () => {
    const plan = buildPsdPlan(docOf([raster('a'), raster('b')]));
    expect(plan.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(plan.degraded).toHaveLength(0);
  });

  it('调整图层：与其下方的同层内容合并为一个像素图层', () => {
    const plan = buildPsdPlan(docOf([raster('a'), raster('b'), adjustment('adj')]));
    // a、b 被合并，再折进调整图层
    expect(plan.nodes).toHaveLength(1);
    expect(plan.nodes[0].sources).toEqual(['a', 'b', 'adj']);
    expect(plan.degraded).toEqual([{ layerId: 'adj', reason: 'adjustment' }]);
  });

  it('不可见的调整图层被忽略', () => {
    const plan = buildPsdPlan(docOf([raster('a'), adjustment('adj', { visible: false })]));
    expect(plan.nodes).toHaveLength(1);
    expect(plan.nodes[0].sources).toEqual(['a']);
    expect(plan.degraded).toHaveLength(0);
  });

  it('穿透编组导出为 PSD 图层组，整体合成模式压成像素图层', () => {
    const passThrough = buildPsdPlan(docOf([group('g'), raster('c', { parentId: 'g' })]));
    expect(passThrough.nodes[0].kind).toBe('group');
    expect(passThrough.nodes[0].children).toHaveLength(1);

    const isolated = buildPsdPlan(docOf([group('g', false), raster('c', { parentId: 'g' })]));
    expect(isolated.nodes[0].kind).toBe('pixel');
    // 整体合成：组内子图层压成一张图（编组自身没有像素）
    expect(isolated.nodes[0].sources).toEqual(['c']);
  });

  it('空编组被丢弃（PSD 里没有意义）', () => {
    const plan = buildPsdPlan(docOf([group('g'), raster('a')]));
    expect(plan.nodes.map((n) => n.id)).toEqual(['a']);
  });

  it('文字 / 形状 / 智能对象标记为降级位图化', () => {
    const plan = buildPsdPlan(
      docOf([
        { ...base, id: 't', kind: 'text', text: 'hi', fontSize: 24 } as Layer,
        { ...base, id: 's', kind: 'shape', shape: 'rect' } as Layer,
        {
          ...base,
          id: 'm',
          kind: 'smart',
          sourceAssetId: 'src',
          sourceWidth: 5,
          sourceHeight: 5,
        } as Layer,
      ]),
    );
    expect(plan.degraded.map((d) => d.reason)).toEqual(['text', 'shape', 'smart']);
  });

  it('蒙版随图层导出（停用则不导出）', () => {
    const mask = { assetId: 'mk', rev: 1, enabled: true, inverted: false, density: 1, feather: 3 };
    const plan = buildPsdPlan(docOf([raster('a', { mask })]));
    expect(plan.nodes[0].mask).toMatchObject({ assetId: 'mk', density: 1, feather: 3 });

    const off = buildPsdPlan(docOf([raster('a', { mask: { ...mask, enabled: false } })]));
    expect(off.nodes[0].mask).toBeNull();
  });
});
