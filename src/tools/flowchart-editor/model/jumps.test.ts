import { describe, expect, it } from 'vitest';
import { computeEdgeJumps, segmentIntersection, type JumpEdge, type JumpNode } from './jumps';
import type { FlowEdgeStyle } from './types';

const node = (id: string, x: number, y: number): JumpNode => ({
  id,
  position: { x, y },
  width: 100,
  height: 50,
  data: { kind: 'rect' },
});

const edge = (
  id: string,
  source: string,
  target: string,
  style?: Partial<FlowEdgeStyle>,
): JumpEdge => ({ id, source, target, data: { style } });

describe('segmentIntersection', () => {
  it('返回真交点', () => {
    const hit = segmentIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    );
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(5);
    expect(hit!.y).toBeCloseTo(5);
  });

  it('平行 / 共线 / 仅端点相接返回 null', () => {
    expect(
      segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }),
    ).toBeNull();
    expect(
      segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }),
    ).toBeNull();
  });
});

describe('computeEdgeJumps', () => {
  // 两条交叉的直线连线：e1 水平、e2 垂直，在 (200, 100) 附近相交
  const nodes: JumpNode[] = [
    node('a', 0, 80),
    node('b', 400, 80),
    node('c', 180, -100),
    node('d', 180, 260),
  ];

  it('后声明的连线跨过更早的连线：生成一处跳线标记', () => {
    const edges: JumpEdge[] = [
      edge('e1', 'a', 'b', { type: 'straight' }),
      edge('e2', 'c', 'd', { type: 'straight', jumpStyle: 'arc' }),
    ];
    const marks = computeEdgeJumps(nodes, edges);
    expect(marks).toHaveLength(1);
    // 弧线沿「跳线自身」的方向张弦：e2 为竖直连线，故角度为 π/2
    expect(marks[0].angle).toBeCloseTo(Math.PI / 2, 3);
    expect(marks[0].stroke).toBeTruthy();
  });

  it('更底层连线声明跳线时不绘制（避免双向重复）', () => {
    const edges: JumpEdge[] = [
      edge('e1', 'a', 'b', { type: 'straight', jumpStyle: 'arc' }),
      edge('e2', 'c', 'd', { type: 'straight' }),
    ];
    expect(computeEdgeJumps(nodes, edges)).toHaveLength(0);
  });

  it('未声明跳线 / 无交叉时不生成标记', () => {
    expect(
      computeEdgeJumps(nodes, [edge('e1', 'a', 'b', { type: 'straight' }), edge('e2', 'c', 'd')]),
    ).toHaveLength(0);
    const far = [node('a', 0, 0), node('b', 100, 0), node('c', 0, 500), node('d', 100, 500)];
    expect(
      computeEdgeJumps(far, [
        edge('e1', 'a', 'b', { type: 'straight' }),
        edge('e2', 'c', 'd', { type: 'straight', jumpStyle: 'arc' }),
      ]),
    ).toHaveLength(0);
  });

  it('连线上限触发整体降级', () => {
    const edges: JumpEdge[] = [
      edge('e1', 'a', 'b', { type: 'straight' }),
      edge('e2', 'c', 'd', { type: 'straight', jumpStyle: 'arc' }),
    ];
    expect(computeEdgeJumps(nodes, edges, 1)).toHaveLength(0);
  });

  it('无法精确复现路径的线型（无折点的曲线）不参与跳线', () => {
    const edges: JumpEdge[] = [
      edge('e1', 'a', 'b', { type: 'smoothstep' }),
      edge('e2', 'c', 'd', { type: 'smoothstep', jumpStyle: 'arc' }),
    ];
    expect(computeEdgeJumps(nodes, edges)).toHaveLength(0);
  });

  it('折点正交路由参与跳线计算', () => {
    const edges: JumpEdge[] = [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        data: { style: { type: 'smoothstep' }, waypoints: [{ x: 200, y: 100 }] },
      },
      edge('e2', 'c', 'd', { type: 'straight', jumpStyle: 'arc' }),
    ];
    expect(computeEdgeJumps(nodes, edges).length).toBeGreaterThanOrEqual(1);
  });
});
