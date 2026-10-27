import { describe, expect, it } from 'vitest';
import {
  MAX_MESH_OFFSET,
  TRANSFORM_MODES,
  applyTransformDelta,
  clampMeshOffset,
  createMesh,
  createQuadMesh,
  dragMeshEdge,
  dragMeshPoint,
  isIdentityDelta,
  meshControlPoints,
  meshEdgeAt,
  meshIsIdentity,
  meshPadding,
  meshParamAt,
  meshSignature,
  normalizeMesh,
  transformOverlayFor,
  WARP_COLS,
  WARP_ROWS,
} from './core';
import type { LayerBox } from './core';
import type { MeshWarp } from './model/types';
import { migrateDoc } from './model/migrate';
import type { Layer } from './model/types';

/**
 * Pure-logic tests for mesh warping (perspective / distort / skew / warp) and "transform again".
 * All differences within this family live in core's pure functions; the draw layer only resamples by mesh.
 */

const box = (over: Partial<LayerBox> = {}): LayerBox => ({
  x: 100,
  y: 50,
  width: 200,
  height: 100,
  rotation: 0,
  ...over,
});

const meshWith = (
  cols: number,
  rows: number,
  entries: Record<number, [number, number]>,
): MeshWarp => {
  const mesh = createMesh(cols, rows);
  for (const [index, value] of Object.entries(entries)) {
    mesh.points[Number(index) * 2] = value[0];
    mesh.points[Number(index) * 2 + 1] = value[1];
  }
  return mesh;
};

describe('Mesh basics', () => {
  it('all modes: free / perspective / distort / skew / warp', () => {
    expect(TRANSFORM_MODES).toEqual(['free', 'perspective', 'distort', 'skew', 'warp']);
  });

  it('a new mesh is all zeros, and the four-corner grid is 2×2', () => {
    const quad = createQuadMesh();
    expect(quad.cols).toBe(2);
    expect(quad.rows).toBe(2);
    expect(quad.points).toHaveLength(8);
    expect(meshIsIdentity(quad)).toBe(true);
    expect(meshIsIdentity(null)).toBe(true);
    expect(meshIsIdentity(undefined)).toBe(true);
  });

  it('a 4×4 warp mesh has 32 numbers (16 control points)', () => {
    const warp = createMesh(WARP_COLS, WARP_ROWS);
    expect(warp.points).toHaveLength(32);
  });

  it('offsets clamp to ±50%', () => {
    expect(MAX_MESH_OFFSET).toBe(0.5);
    expect(clampMeshOffset(0.9)).toBe(0.5);
    expect(clampMeshOffset(-0.9)).toBe(-0.5);
    expect(clampMeshOffset(Number.NaN)).toBe(0);
  });

  it('any non-zero entry counts as warped', () => {
    const mesh = meshWith(2, 2, { 0: [0.1, 0] });
    expect(meshIsIdentity(mesh)).toBe(false);
    expect(meshSignature(mesh)).toContain('2x2');
    expect(meshSignature(createQuadMesh())).toBe('');
  });
});

describe('normalizeMesh: validating external data', () => {
  it('accepts 2×2 and 4×4 and clamps offsets', () => {
    const quad = normalizeMesh({ cols: 2, rows: 2, points: [0.9, 0, 0, 0, 0, 0, 0, 0] });
    expect(quad?.points[0]).toBe(0.5);
    const warp = normalizeMesh({
      cols: 4,
      rows: 4,
      points: new Array(32).fill(0).map((_, i) => (i === 0 ? 0.2 : 0)),
    });
    expect(warp?.cols).toBe(4);
  });

  it('rejects other sizes (no interaction implements them)', () => {
    expect(normalizeMesh({ cols: 3, rows: 3, points: new Array(18).fill(0.1) })).toBeUndefined();
    expect(normalizeMesh({ cols: 2, rows: 4, points: new Array(16).fill(0.1) })).toBeUndefined();
  });

  it('rejects wrong length / illegal values / all zeros', () => {
    expect(normalizeMesh({ cols: 2, rows: 2, points: [0.1] })).toBeUndefined();
    expect(normalizeMesh({ cols: 2, rows: 2, points: new Array(8).fill(0) })).toBeUndefined();
    expect(normalizeMesh(null)).toBeUndefined();
    expect(normalizeMesh('nope')).toBeUndefined();
  });
});

describe('meshControlPoints / meshParamAt: geometry math', () => {
  it('without warping the control points are the box corners (row-major: top-left / top-right / bottom-left / bottom-right)', () => {
    const points = meshControlPoints(createQuadMesh(), box(), false);
    expect(points.map((p) => [p.x, p.y])).toEqual([
      [100, 50],
      [300, 50],
      [100, 150],
      [300, 150],
    ]);
  });

  it('offsets are normalized by width / height before being added', () => {
    const mesh = meshWith(2, 2, { 0: [-0.5, -0.5] });
    const points = meshControlPoints(mesh, box(), false);
    // -50% × 200 = -100, -50% × 100 = -50
    expect([points[0].x, points[0].y]).toEqual([0, 0]);
    expect([points[0].baseX, points[0].baseY]).toEqual([100, 50]);
  });

  it('with rotated = true the layer rotation is applied (for the overlay); with false it is not (for Canvas2D)', () => {
    const rotated = meshControlPoints(createQuadMesh(), box({ rotation: 90 }), true);
    // Rotate 90° about the center (200,100): top-left (100,50) → (250,0)
    expect(rotated[0].x).toBeCloseTo(250, 6);
    expect(rotated[0].y).toBeCloseTo(0, 6);
    const plain = meshControlPoints(createQuadMesh(), box({ rotation: 90 }), false);
    expect([plain[0].x, plain[0].y]).toEqual([100, 50]);
  });

  it('meshParamAt and meshControlPoints are inverses (including rotation)', () => {
    const target = box({ rotation: 37 });
    const points = meshControlPoints(createQuadMesh(), target, true);
    for (const [index, expected] of [
      [0, { u: 0, v: 0 }],
      [1, { u: 1, v: 0 }],
      [2, { u: 0, v: 1 }],
      [3, { u: 1, v: 1 }],
    ] as [number, { u: number; v: number }][]) {
      const param = meshParamAt(target, points[index].x, points[index].y, true);
      expect(param.u).toBeCloseTo(expected.u, 6);
      expect(param.v).toBeCloseTo(expected.v, 6);
    }
  });
});

describe('dragMeshPoint: drag constraints per mode', () => {
  it('distort: only the dragged point moves', () => {
    const mesh = createQuadMesh();
    const next = dragMeshPoint(mesh, 0, 0.2, 0.3, 'distort');
    expect(next.points.slice(0, 2)).toEqual([0.2, 0.3]);
    expect(next.points.slice(2)).toEqual(mesh.points.slice(2));
  });

  it('perspective: the two neighbours inherit horizontal / vertical offsets, the diagonal stays put', () => {
    const next = dragMeshPoint(createQuadMesh(), 0, 0.2, 0.3, 'perspective');
    expect(next.points.slice(0, 2)).toEqual([0.2, 0.3]); // top-left: full offset
    expect(next.points.slice(2, 4)).toEqual([0.2, 0]); // top-right: inherits dx only
    expect(next.points.slice(4, 6)).toEqual([0, 0.3]); // bottom-left: inherits dy only
    expect(next.points.slice(6, 8)).toEqual([0, 0]); // bottom-right: unchanged
  });

  it('offsets beyond the limit are truncated to ±50%', () => {
    const next = dragMeshPoint(createQuadMesh(), 0, 5, 5, 'distort');
    expect(next.points.slice(0, 2)).toEqual([0.5, 0.5]);
  });

  it('returns the input unchanged when the index is out of range', () => {
    const mesh = createQuadMesh();
    expect(dragMeshPoint(mesh, 99, 0.2, 0.2, 'free')).toBe(mesh);
  });

  it('warp: any point on a 4×4 grid moves freely and independently', () => {
    const mesh = createMesh(WARP_COLS, WARP_ROWS);
    const next = dragMeshPoint(mesh, 5, 0.4, 0.6, 'warp');
    // 5th point: col=1, row=1 → base (1/3, 1/3)
    expect(next.points[10]).toBeCloseTo(0.4 - 1 / 3, 6);
    expect(next.points[11]).toBeCloseTo(0.6 - 1 / 3, 6);
    expect(next.points.filter((value) => value !== 0)).toHaveLength(2);
  });
});

describe('dragMeshEdge / meshEdgeAt: skew', () => {
  it('dragging the top edge: both top corners shift together, the bottom stays', () => {
    const next = dragMeshEdge(createQuadMesh(), 'top', 0.1, -0.2);
    expect(next.points.slice(0, 4)).toEqual([0.1, -0.2, 0.1, -0.2]);
    expect(next.points.slice(4)).toEqual([0, 0, 0, 0]);
  });

  it('dragging the left edge: both left corners move, the right stays (vertical shear)', () => {
    const next = dragMeshEdge(createQuadMesh(), 'left', 0, 0.25);
    expect(next.points.slice(0, 2)).toEqual([0, 0.25]);
    expect(next.points.slice(4, 6)).toEqual([0, 0.25]);
    expect(next.points.slice(2, 4)).toEqual([0, 0]);
  });

  it('on a 4×4 grid all 4 points of the bottom edge move together', () => {
    const next = dragMeshEdge(createMesh(4, 4), 'bottom', 0.05, 0);
    const moved = next.points.filter((value, index) => index % 2 === 0 && value === 0.05);
    expect(moved).toHaveLength(4);
  });

  it('meshEdgeAt only detects edges within the tolerance and returns null inside', () => {
    expect(meshEdgeAt(0.5, 0.01, 0.05, 0.05)).toBe('top');
    expect(meshEdgeAt(0.5, 0.99, 0.05, 0.05)).toBe('bottom');
    expect(meshEdgeAt(0.01, 0.5, 0.05, 0.05)).toBe('left');
    expect(meshEdgeAt(0.99, 0.5, 0.05, 0.05)).toBe('right');
    expect(meshEdgeAt(0.5, 0.5, 0.05, 0.05)).toBeNull();
  });
});

describe('meshPadding: padding for warping', () => {
  it('no padding without warping', () => {
    expect(meshPadding(null, 200, 100)).toBe(0);
    expect(meshPadding(createQuadMesh(), 200, 100)).toBe(0);
  });

  it('takes the larger of the maximum offset and the size', () => {
    const mesh = meshWith(2, 2, { 0: [0.5, 0] });
    expect(meshPadding(mesh, 200, 100)).toBe(100);
    const tall = meshWith(2, 2, { 0: [0, 0.5] });
    expect(meshPadding(tall, 200, 100)).toBe(50);
  });
});

describe('transformOverlayFor: what the overlay shows', () => {
  const layer = (over: Record<string, unknown> = {}) => ({
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    rotation: 0,
    ...over,
  });

  it('free-transform mode shows the regular transform box', () => {
    const overlay = transformOverlayFor(layer(), 'free');
    expect(overlay.transformBox).not.toBeNull();
    expect(overlay.meshGrid).toBeNull();
  });

  it('mesh mode with a non-zero mesh shows control points', () => {
    const mesh = meshWith(2, 2, { 0: [0.1, 0.1] });
    const overlay = transformOverlayFor(layer({ mesh }), 'perspective');
    expect(overlay.transformBox).toBeNull();
    expect(overlay.meshGrid?.points).toHaveLength(4);
  });

  it('an all-zero mesh equals no warp, so mesh mode falls back to the transform box', () => {
    const overlay = transformOverlayFor(layer({ mesh: createQuadMesh() }), 'perspective');
    expect(overlay.transformBox).not.toBeNull();
    expect(overlay.meshGrid).toBeNull();
  });

  it('mesh mode without a mesh yet falls back to the transform box (never an empty overlay)', () => {
    const overlay = transformOverlayFor(layer(), 'perspective');
    expect(overlay.transformBox).not.toBeNull();
    expect(overlay.meshGrid).toBeNull();
  });

  it('a locked layer shows no handles', () => {
    const overlay = transformOverlayFor(
      layer({ locked: true, mesh: meshWith(2, 2, { 0: [0.1, 0] }) }),
      'warp',
    );
    expect(overlay.transformBox).toBeNull();
    expect(overlay.meshGrid).toBeNull();
  });
});

describe('applyTransformDelta / isIdentityDelta: transform again', () => {
  it('translation adds up directly', () => {
    const next = applyTransformDelta(box(), { dx: 10, dy: -5, scaleX: 1, scaleY: 1, rotation: 0 });
    expect([next.x, next.y]).toEqual([110, 45]);
  });

  it('scaling anchors at the box center', () => {
    const next = applyTransformDelta(box(), { dx: 0, dy: 0, scaleX: 0.5, scaleY: 2, rotation: 0 });
    // Original center (200,100)
    expect(next.width).toBe(100);
    expect(next.height).toBe(200);
    expect(next.x).toBe(150);
    expect(next.y).toBe(0);
    expect(next.x + next.width / 2).toBeCloseTo(200, 6);
    expect(next.y + next.height / 2).toBeCloseTo(100, 6);
  });

  it('rotation accumulates', () => {
    const next = applyTransformDelta(box({ rotation: 30 }), {
      dx: 0,
      dy: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 15,
    });
    expect(next.rotation).toBe(45);
  });

  it('scaling never collapses the size to 0 (a minimum is kept)', () => {
    const next = applyTransformDelta(box({ width: 10, height: 10 }), {
      dx: 0,
      dy: 0,
      scaleX: 0,
      scaleY: 0,
      rotation: 0,
    });
    expect(next.width).toBeGreaterThanOrEqual(8);
    expect(next.height).toBeGreaterThanOrEqual(8);
  });

  it('a near-zero delta counts as no transform', () => {
    expect(isIdentityDelta({ dx: 0, dy: 0, scaleX: 1, scaleY: 1, rotation: 0 })).toBe(true);
    expect(isIdentityDelta({ dx: 0.2, dy: 0, scaleX: 1, scaleY: 1, rotation: 0 })).toBe(true);
    expect(isIdentityDelta({ dx: 3, dy: 0, scaleX: 1, scaleY: 1, rotation: 0 })).toBe(false);
    expect(isIdentityDelta({ dx: 0, dy: 0, scaleX: 1.2, scaleY: 1, rotation: 0 })).toBe(false);
  });
});

describe('migrateDoc: normalizing mesh fields', () => {
  const parse = (mesh: unknown): Layer => {
    const doc = migrateDoc({
      id: 'doc-1',
      name: 'n',
      width: 100,
      height: 100,
      background: 'white',
      activeLayerId: null,
      swatches: [],
      layers: [
        {
          id: 'r1',
          kind: 'raster',
          assetId: 'a',
          rev: 0,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          blend: 'normal',
          flipX: false,
          flipY: false,
          adjustments: [],
          filters: [],
          mesh,
        },
      ],
    });
    if (!doc) throw new Error('migrateDoc 返回 null');
    return doc.layers[0];
  };

  it('missing fields → no mesh', () => {
    expect(parse(undefined).mesh).toBeUndefined();
  });

  it('a valid mesh is kept and its offsets clamped', () => {
    const layer = parse({ cols: 2, rows: 2, points: [0.9, 0, 0, 0, 0, 0, 0, 0] });
    expect(layer.mesh?.points[0]).toBe(0.5);
  });

  it('an all-zero mesh is dropped (equivalent to no warp)', () => {
    expect(parse({ cols: 2, rows: 2, points: new Array(8).fill(0) }).mesh).toBeUndefined();
  });
});
