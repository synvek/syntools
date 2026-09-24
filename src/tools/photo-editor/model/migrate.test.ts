import { describe, expect, it } from 'vitest';
import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from '../core';
import { migrateDoc } from './migrate';
import type { Layer, PhotoDoc } from './types';

function doc(layers: unknown[], extra: Record<string, unknown> = {}): unknown {
  return { id: 'doc-1', name: 'n', width: 800, height: 600, background: 'white', layers, ...extra };
}

function raster(id: string, patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    kind: 'raster',
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    flipX: false,
    flipY: false,
    assetId: `asset-${id}`,
    rev: 1,
    adjustments: {},
    filters: [],
    ...patch,
  };
}

function group(id: string, patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    kind: 'group',
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    rotation: 0,
    flipX: false,
    flipY: false,
    passThrough: true,
    ...patch,
  };
}

describe('文档迁移 / 归一（工程 v1 → v2）', () => {
  it('v1 文档（只有三类旧图层）迁移后新字段补齐、内容不变', () => {
    const result = migrateDoc(doc([raster('a'), { ...raster('b'), kind: 'text', text: 'hi' }]));
    expect(result).not.toBeNull();
    expect(result!.layers).toHaveLength(2);
    for (const layer of result!.layers) {
      expect(layer.parentId ?? null).toBeNull();
      expect(layer.mask ?? null).toBeNull();
    }
    expect(result!.width).toBe(800);
    expect(result!.activeLayerId).toBeNull();
  });

  it('未知类型的图层被丢弃而不是让整档打不开', () => {
    const result = migrateDoc(doc([raster('a'), { id: 'x', kind: 'ufo' }, raster('b')]));
    expect(result!.layers.map((layer) => layer.id)).toEqual(['a', 'b']);
  });

  it('parentId 指向不存在或非编组时降级为顶层', () => {
    const result = migrateDoc(
      doc([
        group('g'),
        raster('child', { parentId: 'g' }),
        raster('ghost', { parentId: 'g' }),
        raster('orphan', { parentId: 'nope' }),
      ]),
    )!;
    expect(result.layers.find((l) => l.id === 'child')!.parentId).toBe('g');
    expect(result.layers.find((l) => l.id === 'ghost')!.parentId).toBe('g');
    expect(result.layers.find((l) => l.id === 'orphan')!.parentId).toBeNull();
  });

  it('编组自指与父子环被打断', () => {
    const self = migrateDoc(doc([group('g', { parentId: 'g' })]))!;
    expect(self.layers[0].parentId).toBeNull();

    const loop = migrateDoc(doc([group('a', { parentId: 'b' }), group('b', { parentId: 'a' })]))!;
    // 两个编组各自都不能留在环里
    expect(loop.layers.filter((l) => l.parentId === null).length).toBeGreaterThanOrEqual(1);
  });

  it('缺失字段按类型补默认值', () => {
    const result = migrateDoc(doc([{ id: 'a', kind: 'raster' }]))!;
    const layer = result.layers[0];
    expect(layer.visible).toBe(true);
    expect(layer.opacity).toBe(1);
    expect(layer.blend).toBe('normal');
    expect(layer.width).toBeGreaterThanOrEqual(1);
    expect(layer.kind === 'raster' && layer.rev).toBeGreaterThanOrEqual(1);
    expect(layer.kind === 'raster' && layer.adjustments.brightness).toBe(0);
  });

  it('非法混合模式与滤镜被过滤', () => {
    const result = migrateDoc(
      doc([
        raster('a', { blend: 'luminosity' }),
        raster('b', { blend: 'nope', filters: ['blur', 'fake'] }),
      ]),
    )!;
    expect(result.layers[0].blend).toBe('luminosity');
    expect(result.layers[1].blend).toBe('normal');
    expect(result.layers[1].kind === 'raster' && result.layers[1].filters).toEqual(['blur']);
  });

  it('画布尺寸被钳到合法区间', () => {
    const small = migrateDoc(doc([], { width: 1, height: 99999 }))!;
    expect(small.width).toBe(MIN_CANVAS_SIZE);
    expect(small.height).toBe(MAX_CANVAS_SIZE);
  });

  it('activeLayerId 指向不存在时归零', () => {
    const result = migrateDoc(doc([raster('a')], { activeLayerId: 'gone' }))!;
    expect(result.activeLayerId).toBeNull();
    const ok = migrateDoc(doc([raster('a')], { activeLayerId: 'a' }))!;
    expect(ok.activeLayerId).toBe('a');
  });

  it('蒙版参数被归一（浓度 0~1、rev ≥ 1、无 assetId 视为无蒙版）', () => {
    const result = migrateDoc(
      doc([
        raster('a', { mask: { assetId: 'm1', density: 9, rev: 0, feather: -2 } }),
        raster('b', { mask: { density: 0.5 } }),
      ]),
    )!;
    const mask = result.layers[0].mask!;
    expect(mask.assetId).toBe('m1');
    expect(mask.density).toBe(1);
    expect(mask.rev).toBe(1);
    expect(mask.feather).toBe(0);
    expect(result.layers[1].mask).toBeNull();
  });

  it('结构不可用（无 layers / 非对象）返回 null', () => {
    expect(migrateDoc(null)).toBeNull();
    expect(migrateDoc({ width: 100, height: 100 })).toBeNull();
    expect(migrateDoc(doc([]))).not.toBeNull();
  });

  it('智能对象保留源像素尺寸', () => {
    const result = migrateDoc(
      doc([{ id: 's', kind: 'smart', sourceAssetId: 'src', sourceWidth: 40, sourceHeight: 30 }]),
    )!;
    const layer = result.layers[0];
    expect(layer.kind === 'smart' && layer.sourceWidth).toBe(40);
    expect(layer.kind === 'smart' && layer.sourceHeight).toBe(30);
  });

  it('图层顺序即 z 序（尾部为最上层）', () => {
    const result = migrateDoc(doc([raster('a'), raster('b'), raster('c')]))!;
    expect((result.layers as Layer[]).map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect((result as PhotoDoc).layers.at(-1)!.id).toBe('c');
  });
});
