import { describe, expect, it } from 'vitest';
import { booleanPolygons, pathArea, polygonArea, type BooleanOp } from './boolean';

/**
 * Shape boolean operations (P2-6.3).
 *
 * Assertions are **areas**, not vertex lists: the library is free to re-order/resample a contour
 * as long as the resulting region is the same, and pinning exact vertices would break on every
 * dependency bump while proving nothing extra.
 */

const square = (x: number, y: number, size: number): number[] => [
  x,
  y,
  x + size,
  y,
  x + size,
  y + size,
  x,
  y + size,
];

/** Elbow (concave, 6 vertices): 2×2 block with the top-right 1×1 quadrant removed → area 3 */
const elbow = (): number[] => [0, 0, 2, 0, 2, 1, 1, 1, 1, 2, 0, 2];

const areaOf = async (op: BooleanOp, ...polygons: number[][]): Promise<number> => {
  const [first, ...rest] = polygons;
  const commands = await booleanPolygons(op, first, ...rest);
  return Math.abs(pathArea(commands));
};

/** 每段子路径取绝对面积再相加（自相交拆片时绕向会相反，带符号相加会抵消） */
const absoluteArea = (commands: { c: string }[]): number => {
  let total = 0;
  let current: typeof commands = [];
  for (const command of commands) {
    current.push(command);
    if (command.c === 'Z') {
      total += Math.abs(pathArea(current as Parameters<typeof pathArea>[0]));
      current = [];
    }
  }
  return total;
};

const contourCount = async (op: BooleanOp, ...polygons: number[][]): Promise<number> => {
  const [first, ...rest] = polygons;
  const commands = await booleanPolygons(op, first, ...rest);
  return commands.filter((command) => command.c === 'M').length;
};

describe('polygonArea / pathArea 自洽', () => {
  it('平面图形面积', () => {
    expect(polygonArea(square(0, 0, 2))).toBeCloseTo(4, 6);
    expect(polygonArea(elbow())).toBeCloseTo(3, 6);
  });

  it('pathArea 对单轮廓等于 polygonArea', async () => {
    const commands = await booleanPolygons('union', square(0, 0, 2));
    expect(Math.abs(pathArea(commands))).toBeCloseTo(4, 6);
  });
});

describe('四种布尔运算', () => {
  // A = 2×2 @ (0,0)，B = 2×2 @ (1,0)：重叠区 1×2=2
  const a = square(0, 0, 2);
  const b = square(1, 0, 2);

  it('union：并集 = 两面积之和 - 重叠', async () => {
    expect(await areaOf('union', a, b)).toBeCloseTo(6, 6);
    expect(await contourCount('union', a, b)).toBe(1);
  });

  it('subtract：A 减去 B', async () => {
    expect(await areaOf('subtract', a, b)).toBeCloseTo(2, 6);
    // 反过来是 4 - 1×2… B 减 A 的可见部分同样是 2
    expect(await areaOf('subtract', b, a)).toBeCloseTo(2, 6);
  });

  it('intersect：交集只剩重叠区', async () => {
    expect(await areaOf('intersect', a, b)).toBeCloseTo(2, 6);
  });

  it('exclude：异或 = 并集 - 交集', async () => {
    expect(await areaOf('exclude', a, b)).toBeCloseTo(4, 6);
    // 真异或会把重叠区挖掉，因此是两个轮廓
    expect(await contourCount('exclude', a, b)).toBe(2);
  });

  it('不相交时 union 保留两个轮廓、intersect 为空', async () => {
    const far = square(10, 10, 2);
    expect(await contourCount('union', a, far)).toBe(2);
    expect(await booleanPolygons('intersect', a, far)).toEqual([]);
  });

  it('凹多边形（L 形）参与运算结果正确', async () => {
    // 肘形面积 3，与 1×1 的方块 @(1.5,1.5) 求交：该方块完全落在肘形的空缺里 → 空结果
    expect(await booleanPolygons('intersect', elbow(), square(1.5, 1.5, 1))).toEqual([]);
    // 与方块 @(0,0) 1×1 求并：肘形已包含它 → 面积仍为 3
    expect(await areaOf('union', elbow(), square(0, 0, 1))).toBeCloseTo(3, 6);
  });

  it('完全包含时 subtract 产生"外轮廓 + 洞"两段子路径，面积相减', async () => {
    const outer = square(0, 0, 4);
    const inner = square(1, 1, 2);
    const commands = await booleanPolygons('subtract', outer, inner);
    expect(commands.filter((command) => command.c === 'M')).toHaveLength(2);
    // 洞的方向相反，所以带符号面积相加正好是"带洞区域"的面积 16 - 4 = 12
    expect(pathArea(commands)).toBeCloseTo(12, 6);
  });

  it('自相交输入（蝴蝶结）不抛错，按 even-odd 拆成两片', async () => {
    const bowtie = [0, 0, 2, 2, 2, 0, 0, 2];
    const commands = await booleanPolygons('union', bowtie);
    // 两片三角形的绕向相反（带符号面积抵消），但渲染时 non-zero 规则会把两片都填上
    expect(commands.filter((command) => command.c === 'M')).toHaveLength(2);
    expect(absoluteArea(commands)).toBeCloseTo(2, 6);
  });
});

describe('退化输入', () => {
  it('顶点不足 3 个直接返回空', async () => {
    expect(await booleanPolygons('union', [0, 0, 1, 1])).toEqual([]);
    expect(await booleanPolygons('union', [])).toEqual([]);
  });

  it('重复顶点被折叠，不影响结果', async () => {
    const duplicated = [0, 0, 0, 0, 2, 0, 2, 2, 0, 2, 0, 2];
    expect(await areaOf('union', duplicated)).toBeCloseTo(4, 6);
  });

  it('非有限坐标被忽略', async () => {
    expect(await areaOf('union', [0, 0, Number.NaN, 0, 2, 0, 2, 2, 0, 2])).toBeCloseTo(4, 6);
  });

  it('没有 clipper 时 subtract/intersect/exclude 原样返回主体', async () => {
    for (const op of ['subtract', 'intersect', 'exclude'] as const) {
      expect(await areaOf(op, square(0, 0, 2))).toBeCloseTo(4, 6);
    }
  });
});
