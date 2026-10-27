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

/** The factory only needs the document size, so give it a minimal stand-in */
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

describe('selectionToVectorContours: selection → vector mask contours', () => {
  it('translates a rectangular selection into layer-local coordinates', () => {
    const contours = selectionToVectorContours(rectSelection, 20, 30);
    expect(contours).toHaveLength(1);
    expect(contours[0].add).toBe(true);
    expect(contours[0].path).toEqual([0, 0, 40, 0, 40, 50, 0, 50]);
  });

  it('keeps the union / difference flags (holes become subtractive contours)', () => {
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

  it('a lasso with too few points falls back to its bounding box (same rule as selection polygon expansion)', () => {
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

  it('disabled or contour-less masks count as absent', () => {
    expect(hasVectorMask({ ...mask, enabled: false })).toBe(false);
    expect(hasVectorMask({ ...mask, contours: [] })).toBe(false);
    expect(hasVectorMask(null)).toBe(false);
    expect(vectorMaskSignature({ ...mask, enabled: false })).toBe('');
  });

  it('an enabled mask with contours has a signature that changes with shape / parameters', () => {
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

  it('sub-pixel jitter does not churn the signature (vertices are rounded)', () => {
    const jitter: VectorMaskRef = {
      ...mask,
      contours: [{ path: [0.2, 0.1, 10.3, 0.4, 10.1, 10.2, 0.3, 10.4], add: true }],
    };
    expect(vectorMaskSignature(jitter)).toBe(vectorMaskSignature(mask));
  });
});

describe('clipBaseIndex: the clipping mask base layer', () => {
  it('takes the nearest layer below at the same level', () => {
    const layers = [raster(), raster({ clipped: true })];
    expect(clipBaseIndex(layers, 1)).toBe(0);
    expect(clipBaseIndex(layers, 0)).toBe(-1);
  });

  it('consecutive clipping layers share one base', () => {
    const layers = [raster(), raster({ clipped: true }), raster({ clipped: true })];
    expect(clipBaseIndex(layers, 1)).toBe(0);
    expect(clipBaseIndex(layers, 2)).toBe(0);
  });

  it('skips adjustment layers (no pixels, so they cannot be a base)', () => {
    const layers = [raster(), adjustment(), raster({ clipped: true })];
    expect(clipBaseIndex(layers, 2)).toBe(0);
  });

  it('skips hidden layers', () => {
    const layers = [raster({ visible: false }), raster(), raster({ clipped: true })];
    expect(clipBaseIndex(layers, 2)).toBe(1);
  });

  it('skips pass-through groups (no composite result to use as alpha)', () => {
    const layers = [group({ passThrough: true }), raster(), raster({ clipped: true })];
    expect(clipBaseIndex(layers, 2)).toBe(1);
  });

  it('never looks for a base outside the group', () => {
    const layers = [
      raster(),
      group({ id: 'g1', passThrough: false }),
      raster({ parentId: 'g1', clipped: true }),
    ];
    expect(clipBaseIndex(layers, 2)).toBe(-1);
  });

  it('sibling layers inside a group can serve as a base for each other', () => {
    const layers = [
      raster({ id: 'base', parentId: 'g1' }),
      raster({ parentId: 'g1', clipped: true }),
    ];
    expect(clipBaseIndex(layers, 1)).toBe(0);
  });

  it('returns -1 when nothing lies below', () => {
    expect(clipBaseIndex([raster({ clipped: true })], 0)).toBe(-1);
  });
});

function parseDoc(input: unknown): PhotoDoc {
  const parsed = migrateDoc(input);
  if (!parsed) throw new Error('migrateDoc 返回 null');
  return parsed;
}

describe('migrateDoc: normalizing vector and clipping masks', () => {
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

  it('feather clamps to the maximum and clipped passes through', () => {
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

  it('the whole vector mask is dropped when every contour is invalid', () => {
    const parsed = parseDoc(
      raw({ vectorMask: { enabled: true, contours: [{ path: [0, 0, 1, 1] }, 'nope'] } }),
    );
    expect(parsed.layers[0].vectorMask).toBeNull();
  });

  it('odd-length vertex lists are trimmed (dropped under three points)', () => {
    const parsed = parseDoc(
      raw({ vectorMask: { enabled: true, contours: [{ path: [0, 0, 10, 0, 10] }] } }),
    );
    expect(parsed.layers[0].vectorMask).toBeNull();
  });

  it('old projects without these fields get defaults', () => {
    const parsed = parseDoc(raw({}));
    expect(parsed.layers[0].vectorMask).toBeNull();
    expect(parsed.layers[0].clipped).toBe(false);
  });
});
