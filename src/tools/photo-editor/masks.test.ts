import { describe, expect, it } from 'vitest';
import {
  MAX_VECTOR_FEATHER,
  clipBaseIndex,
  hasVectorMask,
  selectionToVectorContours,
  vectorMaskSignature,
} from './core';
import { createAdjustmentLayer, createGroupLayer, createRasterLayer } from './model/factory';
import { migrateDoc } from './model/migrate';
import type { Layer, PhotoDoc, Selection, VectorMaskRef } from './model/types';

/** 工厂只需文档尺寸，这里给一个最小替身 */
const docStub = { width: 200, height: 200 } as PhotoDoc;

const raster = (patch: Partial<Layer> = {}): Layer =>
  ({ ...createRasterLayer({ assetId: 'a1', width: 40, height: 40 }), ...patch }) as Layer;
const group = (patch: Partial<Layer> = {}): Layer =>
  ({ ...createGroupLayer({ doc: docStub }), ...patch }) as Layer;
const adjustment = (patch: Partial<Layer> = {}): Layer =>
  ({ ...createAdjustmentLayer({ doc: docStub }), ...patch }) as Layer;

const rectSelection: Selection = {
  kind: 'rect',
  x: 20,
  y: 30,
  width: 40,
  height: 50,
  path: [],
  feather: 0,
};

describe('selectionToVectorContours：选区 → 矢量蒙版轮廓', () => {
  it('把矩形选区平移到图层局部坐标', () => {
    const contours = selectionToVectorContours(rectSelection, 20, 30);
    expect(contours).toHaveLength(1);
    expect(contours[0].add).toBe(true);
    expect(contours[0].path).toEqual([0, 0, 40, 0, 40, 50, 0, 50]);
  });

  it('保留布尔运算的并集 / 差集标记（洞转为减选轮廓）', () => {
    const selection: Selection = {
      kind: 'lasso',
      x: 10,
      y: 10,
      width: 40,
      height: 40,
      path: [10, 10, 50, 10, 50, 50, 10, 50],
      hole: [20, 20, 40, 20, 40, 40, 20, 40],
      feather: 0,
    };
    const contours = selectionToVectorContours(selection, 10, 10);
    expect(contours.map((contour) => contour.add)).toEqual([true, false]);
    expect(contours[1].path.slice(0, 2)).toEqual([10, 10]);
  });

  it('点数不足的套索回落为外接矩形（与选区的多边形展开规则一致）', () => {
    const selection: Selection = {
      kind: 'lasso',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      path: [0, 0, 1, 1],
      feather: 0,
    };
    const contours = selectionToVectorContours(selection, 0, 0);
    expect(contours).toHaveLength(1);
    expect(contours[0].path).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
  });
});

describe('vectorMaskSignature / hasVectorMask', () => {
  const mask: VectorMaskRef = {
    enabled: true,
    inverted: false,
    contours: [{ path: [0, 0, 10, 0, 10, 10, 0, 10], add: true }],
    feather: 2,
  };

  it('未启用或没有轮廓时视为不存在', () => {
    expect(hasVectorMask({ ...mask, enabled: false })).toBe(false);
    expect(hasVectorMask({ ...mask, contours: [] })).toBe(false);
    expect(hasVectorMask(null)).toBe(false);
    expect(vectorMaskSignature({ ...mask, enabled: false })).toBe('');
  });

  it('启用且有轮廓时签名非空，并在形状 / 参数变化时换签名', () => {
    const base = vectorMaskSignature(mask);
    expect(base.length).toBeGreaterThan(0);
    expect(vectorMaskSignature({ ...mask, inverted: true })).not.toBe(base);
    expect(vectorMaskSignature({ ...mask, feather: 8 })).not.toBe(base);
    expect(
      vectorMaskSignature({
        ...mask,
        contours: [{ path: [0, 0, 20, 0, 20, 20, 0, 20], add: true }],
      }),
    ).not.toBe(base);
  });

  it('亚像素抖动不会反复换签名（顶点取整）', () => {
    const jitter: VectorMaskRef = {
      ...mask,
      contours: [{ path: [0.2, 0.1, 10.3, 0.4, 10.1, 10.2, 0.3, 10.4], add: true }],
    };
    expect(vectorMaskSignature(jitter)).toBe(vectorMaskSignature(mask));
  });
});

describe('clipBaseIndex：剪贴蒙版的基准图层', () => {
  it('取同层内下方最近的图层', () => {
    const layers = [raster(), raster({ clipped: true })];
    expect(clipBaseIndex(layers, 1)).toBe(0);
    expect(clipBaseIndex(layers, 0)).toBe(-1);
  });

  it('连续多个剪贴图层共用同一个基准', () => {
    const layers = [raster(), raster({ clipped: true }), raster({ clipped: true })];
    expect(clipBaseIndex(layers, 1)).toBe(0);
    expect(clipBaseIndex(layers, 2)).toBe(0);
  });

  it('跳过调整图层（不产生像素，不能作基准）', () => {
    const layers = [raster(), adjustment(), raster({ clipped: true })];
    expect(clipBaseIndex(layers, 2)).toBe(0);
  });

  it('跳过不可见图层', () => {
    const layers = [raster({ visible: false }), raster(), raster({ clipped: true })];
    expect(clipBaseIndex(layers, 2)).toBe(1);
  });

  it('跳过穿透编组（自身没有合成结果可用作 alpha）', () => {
    const layers = [group({ passThrough: true }), raster(), raster({ clipped: true })];
    expect(clipBaseIndex(layers, 2)).toBe(1);
  });

  it('不跨编组向上找基准', () => {
    const layers = [
      raster(),
      group({ id: 'g1', passThrough: false }),
      raster({ parentId: 'g1', clipped: true }),
    ];
    expect(clipBaseIndex(layers, 2)).toBe(-1);
  });

  it('编组内的兄弟图层可以互为基准', () => {
    const layers = [
      raster({ id: 'base', parentId: 'g1' }),
      raster({ parentId: 'g1', clipped: true }),
    ];
    expect(clipBaseIndex(layers, 1)).toBe(0);
  });

  it('下方没有图层时返回 -1', () => {
    expect(clipBaseIndex([raster({ clipped: true })], 0)).toBe(-1);
  });
});

function parseDoc(input: unknown): PhotoDoc {
  const parsed = migrateDoc(input);
  if (!parsed) throw new Error('migrateDoc 返回 null');
  return parsed;
}

describe('migrateDoc：矢量蒙版与剪贴蒙版的归一', () => {
  const raw = (patch: Record<string, unknown>) => ({
    id: 'doc-1',
    name: 'n',
    width: 200,
    height: 200,
    background: 'white',
    layers: [
      {
        id: 'l1',
        kind: 'raster',
        name: '',
        visible: true,
        locked: false,
        opacity: 1,
        blend: 'normal',
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        rotation: 0,
        flipX: false,
        flipY: false,
        assetId: 'a1',
        rev: 1,
        ...patch,
      },
    ],
  });

  it('羽化被钳制到上限，clipped 透传', () => {
    const parsed = parseDoc(
      raw({
        clipped: true,
        vectorMask: {
          enabled: true,
          inverted: true,
          feather: 999,
          contours: [{ path: [0, 0, 10, 0, 10, 10, 0, 10], add: true }],
        },
      }),
    );
    expect(parsed.layers[0].vectorMask?.feather).toBe(MAX_VECTOR_FEATHER);
    expect(parsed.layers[0].vectorMask?.inverted).toBe(true);
    expect(parsed.layers[0].clipped).toBe(true);
  });

  it('轮廓全无效时整份矢量蒙版丢弃', () => {
    const parsed = parseDoc(
      raw({ vectorMask: { enabled: true, contours: [{ path: [0, 0, 1, 1] }, 'nope'] } }),
    );
    expect(parsed.layers[0].vectorMask).toBeNull();
  });

  it('奇数长度的顶点序列被裁齐（不足三点则丢弃）', () => {
    const parsed = parseDoc(
      raw({ vectorMask: { enabled: true, contours: [{ path: [0, 0, 10, 0, 10] }] } }),
    );
    expect(parsed.layers[0].vectorMask).toBeNull();
  });

  it('旧工程没有这些字段时补默认值', () => {
    const parsed = parseDoc(raw({}));
    expect(parsed.layers[0].vectorMask).toBeNull();
    expect(parsed.layers[0].clipped).toBe(false);
  });
});
