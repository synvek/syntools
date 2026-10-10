import { describe, expect, it } from 'vitest';
import { routeEdges, type Rect, type RoutePoint } from './routing';

function segments(
  from: RoutePoint,
  to: RoutePoint,
  waypoints: ReadonlyArray<RoutePoint>,
): Array<[RoutePoint, RoutePoint]> {
  const pts = [from, ...waypoints, to];
  const out: Array<[RoutePoint, RoutePoint]> = [];
  for (let i = 1; i < pts.length; i += 1) out.push([pts[i - 1], pts[i]]);
  return out;
}

function hits(a: RoutePoint, b: RoutePoint, r: Rect): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return minX < r.x + r.width && maxX > r.x && minY < r.y + r.height && maxY > r.y;
}

describe('正交避障布线', () => {
  it('同行直连时无折点', () => {
    const [result] = routeEdges({
      edges: [{ id: 'e1', from: { x: 0, y: 0 }, to: { x: 200, y: 0 } }],
      obstacles: [],
    });
    expect(result.routed).toBe(true);
    expect(result.waypoints).toEqual([]);
  });

  it('无遮挡的对角线给出单拐点 L 形', () => {
    const [result] = routeEdges({
      edges: [{ id: 'e1', from: { x: 0, y: 0 }, to: { x: 200, y: 120 } }],
      obstacles: [],
    });
    expect(result.routed).toBe(true);
    expect(result.waypoints).toHaveLength(1);
    expect(result.waypoints[0]).toEqual({ x: 200, y: 0 });
  });

  it('给出端点法线时走 Z 形（两端法线均为水平 → 两个折点）', () => {
    const [result] = routeEdges({
      edges: [
        {
          id: 'e1',
          from: { x: 0, y: 0 },
          to: { x: 200, y: 120 },
          fromSide: 'r',
          toSide: 'l',
        },
      ],
      obstacles: [],
    });
    expect(result.routed).toBe(true);
    expect(result.waypoints).toEqual([
      { x: 100, y: 0 },
      { x: 100, y: 120 },
    ]);
  });

  it('两端法线均为竖直时沿中位线折返', () => {
    const [result] = routeEdges({
      edges: [
        {
          id: 'e1',
          from: { x: 0, y: 0 },
          to: { x: 200, y: 120 },
          fromSide: 'b',
          toSide: 't',
        },
      ],
      obstacles: [],
    });
    expect(result.waypoints).toEqual([
      { x: 0, y: 60 },
      { x: 200, y: 60 },
    ]);
  });

  it('两条 L 形被同时挡住时，A* 绕开障碍且路径保持正交', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 320, y: 320 };
    // A 挡住水平直行段，B 挡住竖直直行段
    const blockerA: Rect = { x: 100, y: -24, width: 24, height: 48 };
    const blockerB: Rect = { x: -24, y: 100, width: 48, height: 24 };
    const [result] = routeEdges({
      edges: [{ id: 'e1', from, to }],
      obstacles: [blockerA, blockerB],
    });
    expect(result.routed).toBe(true);
    expect(result.waypoints.length).toBeGreaterThan(0);
    for (const [a, b] of segments(from, to, result.waypoints)) {
      // 每段必须是水平或竖直段
      expect(a.x === b.x || a.y === b.y).toBe(true);
      expect(hits(a, b, blockerA)).toBe(false);
      expect(hits(a, b, blockerB)).toBe(false);
    }
  });

  it('入参可覆盖栅格与间隙', () => {
    const [result] = routeEdges({
      edges: [{ id: 'e1', from: { x: 0, y: 0 }, to: { x: 100, y: 100 } }],
      obstacles: [],
      grid: 25,
      margin: 25,
      padding: 100,
    });
    expect(result.routed).toBe(true);
  });
});
