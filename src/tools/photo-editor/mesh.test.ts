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
 * 网格变形（透视 / 扭曲 / 斜切 / 变形）与「再次变换」的纯逻辑测试。
 * 这一族的全部差异都收敛在 core 的纯函数里，绘制层只负责按网格重采样。
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

describe('网格基础', () => {
  it('模式全集：自由 / 透视 / 扭曲 / 斜切 / 变形', () => {
    expect(TRANSFORM_MODES).toEqual(['free', 'perspective', 'distort', 'skew', 'warp']);
  });

  it('新建网格全零，四角网格为 2×2', () => {
    const quad = createQuadMesh();
    expect(quad.cols).toBe(2);
    expect(quad.rows).toBe(2);
    expect(quad.points).toHaveLength(8);
    expect(meshIsIdentity(quad)).toBe(true);
    expect(meshIsIdentity(null)).toBe(true);
    expect(meshIsIdentity(undefined)).toBe(true);
  });

  it('4×4 变形网格共 32 个数（16 个控制点）', () => {
    const warp = createMesh(WARP_COLS, WARP_ROWS);
    expect(warp.points).toHaveLength(32);
  });

  it('位移钳制在 ±50%', () => {
    expect(MAX_MESH_OFFSET).toBe(0.5);
    expect(clampMeshOffset(0.9)).toBe(0.5);
    expect(clampMeshOffset(-0.9)).toBe(-0.5);
    expect(clampMeshOffset(Number.NaN)).toBe(0);
  });

  it('有一位非零即视为已变形', () => {
    const mesh = meshWith(2, 2, { 0: [0.1, 0] });
    expect(meshIsIdentity(mesh)).toBe(false);
    expect(meshSignature(mesh)).toContain('2x2');
    expect(meshSignature(createQuadMesh())).toBe('');
  });
});

describe('normalizeMesh：外部数据校验', () => {
  it('接受 2×2 与 4×4，并钳制位移', () => {
    const quad = normalizeMesh({ cols: 2, rows: 2, points: [0.9, 0, 0, 0, 0, 0, 0, 0] });
    expect(quad?.points[0]).toBe(0.5);
    const warp = normalizeMesh({
      cols: 4,
      rows: 4,
      points: new Array(32).fill(0).map((_, i) => (i === 0 ? 0.2 : 0)),
    });
    expect(warp?.cols).toBe(4);
  });

  it('拒绝其它规模（没有对应交互实现）', () => {
    expect(normalizeMesh({ cols: 3, rows: 3, points: new Array(18).fill(0.1) })).toBeUndefined();
    expect(normalizeMesh({ cols: 2, rows: 4, points: new Array(16).fill(0.1) })).toBeUndefined();
  });

  it('拒绝长度不符 / 非法值 / 全零', () => {
    expect(normalizeMesh({ cols: 2, rows: 2, points: [0.1] })).toBeUndefined();
    expect(normalizeMesh({ cols: 2, rows: 2, points: new Array(8).fill(0) })).toBeUndefined();
    expect(normalizeMesh(null)).toBeUndefined();
    expect(normalizeMesh('nope')).toBeUndefined();
  });
});

describe('meshControlPoints / meshParamAt：几何换算', () => {
  it('无变形时控制点就是盒子四角（行优先：左上 / 右上 / 左下 / 右下）', () => {
    const points = meshControlPoints(createQuadMesh(), box(), false);
    expect(points.map((p) => [p.x, p.y])).toEqual([
      [100, 50],
      [300, 50],
      [100, 150],
      [300, 150],
    ]);
  });

  it('位移按宽 / 高归一化后叠加', () => {
    const mesh = meshWith(2, 2, { 0: [-0.5, -0.5] });
    const points = meshControlPoints(mesh, box(), false);
    // -50% × 200 = -100，-50% × 100 = -50
    expect([points[0].x, points[0].y]).toEqual([0, 0]);
    expect([points[0].baseX, points[0].baseY]).toEqual([100, 50]);
  });

  it('rotated = true 时叠加图层旋转（覆盖层用）；false 时不叠加（Canvas2D 用）', () => {
    const rotated = meshControlPoints(createQuadMesh(), box({ rotation: 90 }), true);
    // 绕中心 (200,100) 旋转 90°：左上角 (100,50) → (250,0)
    expect(rotated[0].x).toBeCloseTo(250, 6);
    expect(rotated[0].y).toBeCloseTo(0, 6);
    const plain = meshControlPoints(createQuadMesh(), box({ rotation: 90 }), false);
    expect([plain[0].x, plain[0].y]).toEqual([100, 50]);
  });

  it('meshParamAt 与 meshControlPoints 互为逆运算（含旋转）', () => {
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

describe('dragMeshPoint：四种模式的拖拽约束', () => {
  it('distort：只动被拖的点', () => {
    const mesh = createQuadMesh();
    const next = dragMeshPoint(mesh, 0, 0.2, 0.3, 'distort');
    expect(next.points.slice(0, 2)).toEqual([0.2, 0.3]);
    expect(next.points.slice(2)).toEqual(mesh.points.slice(2));
  });

  it('perspective：相邻两点分别继承横向 / 纵向位移，对角不动', () => {
    const next = dragMeshPoint(createQuadMesh(), 0, 0.2, 0.3, 'perspective');
    expect(next.points.slice(0, 2)).toEqual([0.2, 0.3]); // 左上：完整位移
    expect(next.points.slice(2, 4)).toEqual([0.2, 0]); // 右上：只继承 dx
    expect(next.points.slice(4, 6)).toEqual([0, 0.3]); // 左下：只继承 dy
    expect(next.points.slice(6, 8)).toEqual([0, 0]); // 右下：不动
  });

  it('位移超过上限时按 ±50% 截断', () => {
    const next = dragMeshPoint(createQuadMesh(), 0, 5, 5, 'distort');
    expect(next.points.slice(0, 2)).toEqual([0.5, 0.5]);
  });

  it('索引越界时原样返回', () => {
    const mesh = createQuadMesh();
    expect(dragMeshPoint(mesh, 99, 0.2, 0.2, 'free')).toBe(mesh);
  });

  it('warp：4×4 网格上任意点自由移动，互不牵连', () => {
    const mesh = createMesh(WARP_COLS, WARP_ROWS);
    const next = dragMeshPoint(mesh, 5, 0.4, 0.6, 'warp');
    // 第 5 个点：col=1, row=1 → 基准 (1/3, 1/3)
    expect(next.points[10]).toBeCloseTo(0.4 - 1 / 3, 6);
    expect(next.points[11]).toBeCloseTo(0.6 - 1 / 3, 6);
    expect(next.points.filter((value) => value !== 0)).toHaveLength(2);
  });
});

describe('dragMeshEdge / meshEdgeAt：斜切', () => {
  it('拖上边：两个上角点同向平移，下边不动', () => {
    const next = dragMeshEdge(createQuadMesh(), 'top', 0.1, -0.2);
    expect(next.points.slice(0, 4)).toEqual([0.1, -0.2, 0.1, -0.2]);
    expect(next.points.slice(4)).toEqual([0, 0, 0, 0]);
  });

  it('拖左边：两个左角点移动，右边不动（垂直剪切）', () => {
    const next = dragMeshEdge(createQuadMesh(), 'left', 0, 0.25);
    expect(next.points.slice(0, 2)).toEqual([0, 0.25]);
    expect(next.points.slice(4, 6)).toEqual([0, 0.25]);
    expect(next.points.slice(2, 4)).toEqual([0, 0]);
  });

  it('4×4 网格的底边共 4 个点一起动', () => {
    const next = dragMeshEdge(createMesh(4, 4), 'bottom', 0.05, 0);
    const moved = next.points.filter((value, index) => index % 2 === 0 && value === 0.05);
    expect(moved).toHaveLength(4);
  });

  it('meshEdgeAt 只在容差内认边，内部返回 null', () => {
    expect(meshEdgeAt(0.5, 0.01, 0.05, 0.05)).toBe('top');
    expect(meshEdgeAt(0.5, 0.99, 0.05, 0.05)).toBe('bottom');
    expect(meshEdgeAt(0.01, 0.5, 0.05, 0.05)).toBe('left');
    expect(meshEdgeAt(0.99, 0.5, 0.05, 0.05)).toBe('right');
    expect(meshEdgeAt(0.5, 0.5, 0.05, 0.05)).toBeNull();
  });
});

describe('meshPadding：变形留白', () => {
  it('未变形不留白', () => {
    expect(meshPadding(null, 200, 100)).toBe(0);
    expect(meshPadding(createQuadMesh(), 200, 100)).toBe(0);
  });

  it('按最大位移与尺寸取较大者', () => {
    const mesh = meshWith(2, 2, { 0: [0.5, 0] });
    expect(meshPadding(mesh, 200, 100)).toBe(100);
    const tall = meshWith(2, 2, { 0: [0, 0.5] });
    expect(meshPadding(tall, 200, 100)).toBe(50);
  });
});

describe('transformOverlayFor：覆盖层显示什么', () => {
  const layer = (over: Record<string, unknown> = {}) => ({
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    rotation: 0,
    ...over,
  });

  it('自由变换模式显示常规变换框', () => {
    const overlay = transformOverlayFor(layer(), 'free');
    expect(overlay.transformBox).not.toBeNull();
    expect(overlay.meshGrid).toBeNull();
  });

  it('网格模式且网格已发生位移时显示控制点', () => {
    const mesh = meshWith(2, 2, { 0: [0.1, 0.1] });
    const overlay = transformOverlayFor(layer({ mesh }), 'perspective');
    expect(overlay.transformBox).toBeNull();
    expect(overlay.meshGrid?.points).toHaveLength(4);
  });

  it('全零网格等价于没有变形：网格模式回落为变换框', () => {
    const overlay = transformOverlayFor(layer({ mesh: createQuadMesh() }), 'perspective');
    expect(overlay.transformBox).not.toBeNull();
    expect(overlay.meshGrid).toBeNull();
  });

  it('网格模式但还没有网格时回落到变换框（不会出现空覆盖层）', () => {
    const overlay = transformOverlayFor(layer(), 'perspective');
    expect(overlay.transformBox).not.toBeNull();
    expect(overlay.meshGrid).toBeNull();
  });

  it('锁定图层不显示任何手柄', () => {
    const overlay = transformOverlayFor(
      layer({ locked: true, mesh: meshWith(2, 2, { 0: [0.1, 0] }) }),
      'warp',
    );
    expect(overlay.transformBox).toBeNull();
    expect(overlay.meshGrid).toBeNull();
  });
});

describe('applyTransformDelta / isIdentityDelta：再次变换', () => {
  it('平移直接叠加', () => {
    const next = applyTransformDelta(box(), { dx: 10, dy: -5, scaleX: 1, scaleY: 1, rotation: 0 });
    expect([next.x, next.y]).toEqual([110, 45]);
  });

  it('缩放以盒子中心为锚点', () => {
    const next = applyTransformDelta(box(), { dx: 0, dy: 0, scaleX: 0.5, scaleY: 2, rotation: 0 });
    // 原中心 (200,100)
    expect(next.width).toBe(100);
    expect(next.height).toBe(200);
    expect(next.x).toBe(150);
    expect(next.y).toBe(0);
    expect(next.x + next.width / 2).toBeCloseTo(200, 6);
    expect(next.y + next.height / 2).toBeCloseTo(100, 6);
  });

  it('旋转为累加', () => {
    const next = applyTransformDelta(box({ rotation: 30 }), {
      dx: 0,
      dy: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 15,
    });
    expect(next.rotation).toBe(45);
  });

  it('缩放不会把尺寸压到 0（保留最小尺寸）', () => {
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

  it('接近零的增量被视为「没有变换」', () => {
    expect(isIdentityDelta({ dx: 0, dy: 0, scaleX: 1, scaleY: 1, rotation: 0 })).toBe(true);
    expect(isIdentityDelta({ dx: 0.2, dy: 0, scaleX: 1, scaleY: 1, rotation: 0 })).toBe(true);
    expect(isIdentityDelta({ dx: 3, dy: 0, scaleX: 1, scaleY: 1, rotation: 0 })).toBe(false);
    expect(isIdentityDelta({ dx: 0, dy: 0, scaleX: 1.2, scaleY: 1, rotation: 0 })).toBe(false);
  });
});

describe('migrateDoc：网格字段归一', () => {
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

  it('缺字段 → 无网格', () => {
    expect(parse(undefined).mesh).toBeUndefined();
  });

  it('合法网格保留并钳制位移', () => {
    const layer = parse({ cols: 2, rows: 2, points: [0.9, 0, 0, 0, 0, 0, 0, 0] });
    expect(layer.mesh?.points[0]).toBe(0.5);
  });

  it('全零网格被丢弃（等价于没有变形）', () => {
    expect(parse({ cols: 2, rows: 2, points: new Array(8).fill(0) }).mesh).toBeUndefined();
  });
});
