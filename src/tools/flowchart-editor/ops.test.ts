import { describe, expect, it } from 'vitest';
import {
  commonValue,
  computeAlign,
  computeDistribute,
  dashArrayOf,
  dropCollinear,
  groupBounds,
  normalizeEdgeStyle,
  polylineMidpoint,
  polylinePath,
  reorderLayers,
  routeOrthogonal,
  type LayoutBox,
} from './ops';
import type { ShapeKind } from './model/types';

const A: LayoutBox = { id: 'a', x: 0, y: 0, width: 100, height: 50 };
const B: LayoutBox = { id: 'b', x: 200, y: 100, width: 100, height: 50 };
const C: LayoutBox = { id: 'c', x: 50, y: 300, width: 60, height: 40 };
const BOXES = [A, B, C];

describe('多选批量取值', () => {
  it('全部相同返回该值', () => {
    expect(commonValue(['a', 'a', 'a'])).toBe('a');
    expect(commonValue([2])).toBe(2);
  });

  it('存在差异或空集合返回 undefined', () => {
    expect(commonValue(['a', 'b'])).toBeUndefined();
    expect(commonValue([])).toBeUndefined();
    expect(commonValue([true, true])).toBe(true);
    expect(commonValue([true, false])).toBeUndefined();
  });
});

describe('折点与正交路由', () => {
  it('dropCollinear 去掉重复点与共线中间点', () => {
    expect(
      dropCollinear([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
    ]);
  });

  it('共线时不需要折点', () => {
    expect(routeOrthogonal({ x: 0, y: 0 }, { x: 100, y: 0 })).toEqual([]);
    expect(routeOrthogonal({ x: 0, y: 0 }, { x: 0, y: 100 })).toEqual([]);
  });

  it('无遮挡时生成 H-V-H 中点折线（两点折点）', () => {
    const points = routeOrthogonal({ x: 0, y: 0 }, { x: 100, y: 60 });
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({ x: 50, y: 0 });
    expect(points[1]).toEqual({ x: 50, y: 60 });
  });

  it('遇到障碍时绕行，路径不再穿过障碍包围盒', () => {
    const from = { x: 0, y: 0 };
    const target = { x: 200, y: 60 };
    const obstacle = { x: 60, y: -40, width: 80, height: 200 };
    const points = routeOrthogonal(from, target, [obstacle]);
    const path = [from, ...points, target];
    expect(path.length).toBeGreaterThan(2);
    // 折线不得穿过障碍物
    for (let i = 1; i < path.length; i += 1) {
      const a = path[i - 1];
      const b = path[i];
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      const hits =
        minX < obstacle.x + obstacle.width &&
        maxX > obstacle.x &&
        minY < obstacle.y + obstacle.height &&
        maxY > obstacle.y;
      expect(hits).toBe(false);
    }
  });

  it('polylinePath 生成折线（圆角半径 > 0 时使用二次贝塞尔）', () => {
    const sharp = polylinePath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(sharp.startsWith('M 0,0')).toBe(true);
    expect(sharp).toContain('L 10,0');
    expect(sharp).not.toContain('Q');

    const rounded = polylinePath(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
      ],
      8,
    );
    expect(rounded).toContain('Q');
  });

  it('polylineMidpoint 取折线长度中点', () => {
    const mid = polylineMidpoint([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(mid).toEqual({ x: 10, y: 0 });
  });
});

describe('对齐', () => {
  it('左对齐统一到集合最左边界', () => {
    const out = computeAlign(BOXES, 'left');
    expect(out.a.x).toBe(0);
    expect(out.b.x).toBe(0);
    expect(out.c.x).toBe(0);
  });

  it('右对齐按各自宽度靠右', () => {
    const out = computeAlign(BOXES, 'right');
    // 最右边界 = 300
    expect(out.a.x).toBe(200);
    expect(out.b.x).toBe(200);
    expect(out.c.x).toBe(240);
  });

  it('水平居中按各自宽度居中', () => {
    const out = computeAlign(BOXES, 'hcenter');
    expect(out.a.x).toBe(100);
    expect(out.b.x).toBe(100);
    expect(out.c.x).toBe(120);
  });

  it('顶/底/垂直居中分别对齐', () => {
    expect(computeAlign(BOXES, 'top').c.y).toBe(0);
    expect(computeAlign(BOXES, 'bottom').a.y).toBe(290);
    expect(computeAlign(BOXES, 'vcenter').b.y).toBe(145);
  });

  it('空集合返回空结果', () => {
    expect(computeAlign([], 'left')).toEqual({});
  });
});

describe('等距分布', () => {
  it('水平方向均匀分布', () => {
    const out = computeDistribute(BOXES, 'h');
    // 按 x 排序：a(0) c(50) b(200)，间距 20
    expect(out.a.x).toBe(0);
    expect(out.c.x).toBe(120);
    expect(out.b.x).toBe(200);
  });

  it('垂直方向均匀分布', () => {
    const out = computeDistribute(BOXES, 'v');
    // 按 y 排序：a(0) b(100) c(300)
    expect(out.a.y).toBe(0);
    expect(Object.keys(out)).toHaveLength(3);
  });

  it('少于三个节点不分布', () => {
    expect(computeDistribute([A, B], 'h')).toEqual({});
  });
});

describe('层级重排', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const sel = new Set(['b', 'c']);

  it('置顶把选中项移到最后', () => {
    expect(reorderLayers(items, sel, 'front').map((i) => i.id)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('置底把选中项移到最前', () => {
    expect(reorderLayers(items, sel, 'back').map((i) => i.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('上移一层与下移一层', () => {
    expect(reorderLayers(items, sel, 'forward').map((i) => i.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(reorderLayers(items, sel, 'backward').map((i) => i.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('未选中时保持原顺序', () => {
    expect(reorderLayers(items, new Set(), 'front').map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('编组边界与边样式', () => {
  it('计算整体包围盒', () => {
    expect(groupBounds(BOXES)).toEqual({ x: 0, y: 0, width: 300, height: 340 });
    expect(groupBounds([])).toBeNull();
  });

  it('边样式补齐默认值并限制线宽', () => {
    expect(normalizeEdgeStyle(null).type).toBe('smoothstep');
    expect(normalizeEdgeStyle({ type: 'bezier', stroke: '#f00' }).stroke).toBe('#f00');
    expect(normalizeEdgeStyle({ strokeWidth: 99 }).strokeWidth).toBe(8);
    expect(normalizeEdgeStyle({ strokeWidth: 0 }).strokeWidth).toBe(1);
  });

  it('虚线样式转为 dasharray', () => {
    expect(dashArrayOf('solid', 2)).toBeUndefined();
    expect(dashArrayOf('dashed', 2)).toBe('6 4');
    expect(dashArrayOf('dotted', 2)).toBe('2 2');
  });
});

describe('节点尺寸', () => {
  it('优先用户调整值，其次图形目录默认值', async () => {
    const { boxSizeOf } = await import('./ops');
    const mk = (width: number | undefined, kind: ShapeKind = 'rect') => ({ width, data: { kind } });
    expect(boxSizeOf(mk(undefined)).width).toBe(150);
    expect(boxSizeOf(mk(320)).width).toBe(320);
    expect(boxSizeOf(mk(undefined, 'swimlane')).width).toBe(760);
  });
});
