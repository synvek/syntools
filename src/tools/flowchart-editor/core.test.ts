import { describe, expect, it } from 'vitest';
import {
  __resetIdCounter,
  absolutePositionOf,
  absoluteRectOf,
  angleFromCenter,
  cachedAbsoluteRectOf,
  computeHelperLines,
  createId,
  defaultData,
  deserializeDoc,
  nodeTransformCss,
  normalizeColor,
  normalizeRotation,
  orderNodesByHierarchy,
  resolvePlacement,
  safeLinkHref,
  scaleChildren,
  serializeDoc,
  snapRotation,
  validateDoc,
} from './core';
import { buildTemplate } from './model/templates';
import { isContainerKind, isVerticalLane, type ShapeKind } from './model/types';
import { activePageOf } from './model/migrate';

describe('createId', () => {
  it('生成唯一且带前缀的 id', () => {
    __resetIdCounter();
    const a = createId('n');
    const b = createId('n');
    expect(a).not.toBe(b);
    expect(a.startsWith('n_')).toBe(true);
  });
});

describe('容器缩放联动（scaleChildren）', () => {
  const child = {
    id: 'c1',
    kind: 'rect' as ShapeKind,
    position: { x: 20, y: 40 },
    width: 100,
    height: 50,
  };

  it('按比例换算子节点的相对坐标与尺寸', () => {
    const out = scaleChildren([child], { width: 200, height: 200 }, { width: 400, height: 400 });
    expect(out).toHaveLength(1);
    expect(out[0].position).toEqual({ x: 40, y: 80 });
    expect(out[0].width).toBe(200);
    expect(out[0].height).toBe(100);
  });

  it('非等比缩放时宽高各按自身比例换算', () => {
    const out = scaleChildren([child], { width: 200, height: 200 }, { width: 400, height: 100 });
    expect(out[0].position).toEqual({ x: 40, y: 20 });
    expect(out[0].width).toBe(200);
    // 50 * 0.5 = 25，低于 rect 的最小高度 32 → 夹取
    expect(out[0].height).toBe(32);
  });

  it('尺寸缩小时夹取到该形状的最小尺寸', () => {
    const out = scaleChildren([child], { width: 200, height: 200 }, { width: 20, height: 20 });
    expect(out[0].width).toBeGreaterThanOrEqual(48);
    expect(out[0].height).toBeGreaterThanOrEqual(32);
  });

  it('比例未变化或入参非法时返回空数组（调用方据此跳过写入）', () => {
    expect(
      scaleChildren([child], { width: 200, height: 200 }, { width: 200, height: 200 }),
    ).toEqual([]);
    expect(scaleChildren([child], { width: 0, height: 200 }, { width: 100, height: 200 })).toEqual(
      [],
    );
    expect(scaleChildren([], { width: 100, height: 100 }, { width: 200, height: 200 })).toEqual([]);
  });
});

describe('节点变换纯函数', () => {
  it('normalizeRotation 归一到 [0,360)', () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(370)).toBe(10);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(Number.NaN)).toBe(0);
  });

  it('snapRotation 吸附到步长倍数', () => {
    expect(snapRotation(47, 15)).toBe(45);
    expect(snapRotation(8, 15)).toBe(15);
    expect(snapRotation(47, 0)).toBe(47);
    expect(snapRotation(-1, 15)).toBe(0);
  });

  it('angleFromCenter 以正右方为 0 且顺时针增大', () => {
    expect(angleFromCenter(0, 0, 10, 0)).toBeCloseTo(0);
    expect(angleFromCenter(0, 0, 0, 10)).toBeCloseTo(90);
    expect(angleFromCenter(0, 0, -10, 0)).toBeCloseTo(180);
    expect(angleFromCenter(0, 0, 0, -10)).toBeCloseTo(270);
  });

  it('nodeTransformCss 无变换时返回 undefined', () => {
    expect(nodeTransformCss(undefined)).toBeUndefined();
    expect(nodeTransformCss({})).toBeUndefined();
    expect(nodeTransformCss({ rotation: 0, flipH: false, flipV: false })).toBeUndefined();
  });

  it('nodeTransformCss 组合旋转与镜像', () => {
    expect(nodeTransformCss({ rotation: 90 })).toBe('rotate(90deg)');
    expect(nodeTransformCss({ flipH: true })).toBe('scale(-1, 1)');
    expect(nodeTransformCss({ flipV: true })).toBe('scale(1, -1)');
    expect(nodeTransformCss({ rotation: 45, flipH: true, flipV: true })).toBe(
      'rotate(45deg) scale(-1, -1)',
    );
  });

  it('safeLinkHref 仅放行 http/https/mailto', () => {
    expect(safeLinkHref('https://example.com')).toBe('https://example.com');
    expect(safeLinkHref('example.com')).toBe('https://example.com');
    expect(safeLinkHref('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(safeLinkHref('javascript:alert(1)')).toBeUndefined();
    expect(safeLinkHref('data:text/html,x')).toBeUndefined();
    expect(safeLinkHref('')).toBeUndefined();
    expect(safeLinkHref(undefined)).toBeUndefined();
  });
});

describe('normalizeColor', () => {
  it('归一化 3 位与 6 位十六进制', () => {
    expect(normalizeColor('#ABC')).toBe('#aabbcc');
    expect(normalizeColor('#FF0000')).toBe('#ff0000');
    expect(normalizeColor('nope', '#000000')).toBe('#000000');
    expect(normalizeColor(undefined, '#123456')).toBe('#123456');
  });
});

describe('defaultData', () => {
  it('按形状给出基础配色，默认文本为空', () => {
    expect(defaultData('rect').label).toBe('');
    expect(defaultData('rect', '自定义').label).toBe('自定义');
    expect(defaultData('startEnd').style.stroke).toBe('#16A34A');
    expect(defaultData('decision').style.stroke).toBe('#D97706');
  });
});

describe('computeHelperLines', () => {
  const others = [{ x: 0, y: 0, width: 100, height: 50 }];

  it('左边缘对齐时吸附并产生竖直参考线', () => {
    const dragging = { x: 3, y: 200, width: 100, height: 50 };
    const lines = computeHelperLines(dragging, others, 5);
    expect(lines.x).toBe(0);
    expect(lines.vertical).toBe(0);
    expect(lines.horizontal).toBeUndefined();
  });

  it('无足够接近的参考线时不吸附', () => {
    const dragging = { x: 80, y: 300, width: 100, height: 50 };
    const lines = computeHelperLines(dragging, others, 5);
    expect(lines.x).toBeUndefined();
    expect(lines.y).toBeUndefined();
  });

  it('中心对齐时产生水平参考线', () => {
    const dragging = { x: 300, y: 23, width: 100, height: 50 };
    const lines = computeHelperLines(dragging, [{ x: 200, y: 0, width: 100, height: 50 }], 5);
    expect(lines.y).toBe(25);
    expect(lines.horizontal).toBe(25);
  });
});

describe('序列化 / 校验', () => {
  const nodes = [
    { id: 'n1', position: { x: 0, y: 0 }, data: defaultData('rect') },
    { id: 'n2', position: { x: 100, y: 0 }, data: defaultData('startEnd') },
  ];
  const edges = [{ id: 'e1', source: 'n1', target: 'n2' }];

  it('序列化为 v2 文档并保留字段', () => {
    const doc = serializeDoc(nodes, edges);
    expect(doc.version).toBe(2);
    expect(doc.pages).toHaveLength(1);
    const page = activePageOf(doc)!;
    expect(page.nodes).toHaveLength(2);
    expect(page.edges[0].source).toBe('n1');
    expect(page.nodes[0].type).toBe('shape');
  });

  it('合法文档通过校验并归一为 v2', () => {
    const doc = serializeDoc(nodes, edges);
    expect(validateDoc(doc)).toBe(true);
    const restored = deserializeDoc(doc);
    expect(restored.ok).toBe(true);
    expect(activePageOf(restored.doc!)!.nodes).toHaveLength(2);
  });

  it('旧版 v1 文档可迁移读取（草稿不丢）', () => {
    const v1 = { version: 1, nodes, edges };
    const restored = deserializeDoc(v1);
    expect(restored.ok).toBe(true);
    expect(restored.doc!.version).toBe(2);
    expect(activePageOf(restored.doc!)!.nodes).toHaveLength(2);
  });

  it('残缺文档被拒绝', () => {
    expect(validateDoc({ nodes: 'x' })).toBe(false);
    expect(deserializeDoc({ foo: 1 }).ok).toBe(false);
  });
});

describe('buildTemplate', () => {
  it('基础模板含 4 节点 3 连线', () => {
    const doc = buildTemplate('basic');
    expect(doc.nodes).toHaveLength(4);
    expect(doc.edges).toHaveLength(3);
    expect(validateDoc(doc)).toBe(true);
  });

  it('判断流程含分支', () => {
    const doc = buildTemplate('decision');
    expect(doc.edges.length).toBeGreaterThanOrEqual(4);
  });

  it('泳道与 BPMN 模板均合法', () => {
    expect(validateDoc(buildTemplate('swimlane'))).toBe(true);
    expect(validateDoc(buildTemplate('bpmn'))).toBe(true);
  });

  it('模板节点 id 唯一', () => {
    const doc = buildTemplate('basic');
    const ids = new Set(doc.nodes.map((n) => n.id));
    expect(ids.size).toBe(doc.nodes.length);
  });
});

describe('容器（泳道）层级', () => {
  const lane = {
    id: 'lane1',
    position: { x: 100, y: 100 },
    width: 760,
    height: 220,
    data: { kind: 'swimlane' as const },
  };
  const byId = new Map<string, typeof lane>([[lane.id, lane]]);

  it('元素中心落在泳道内 → 归属泳道并返回相对坐标', () => {
    const placement = resolvePlacement({ x: 200, y: 200, width: 150, height: 64 }, [
      { id: lane.id, rect: absoluteRectOf(lane, byId) },
    ]);
    expect(placement.parentId).toBe('lane1');
    expect(placement.position).toEqual({ x: 100, y: 100 });
  });

  it('元素中心在泳道外 → 保持绝对坐标且无父', () => {
    const placement = resolvePlacement({ x: 1000, y: 1000, width: 150, height: 64 }, [
      { id: lane.id, rect: absoluteRectOf(lane, byId) },
    ]);
    expect(placement.parentId).toBeUndefined();
    expect(placement.position).toEqual({ x: 1000, y: 1000 });
  });

  it('绝对坐标叠加父节点偏移', () => {
    const child = {
      id: 'c1',
      position: { x: 20, y: 30 },
      parentId: 'lane1',
      data: { kind: 'rect' as const },
    };
    const map = new Map<string, typeof lane | typeof child>([
      [lane.id, lane],
      [child.id, child],
    ]);
    expect(absolutePositionOf(child, map)).toEqual({ x: 120, y: 130 });
    expect(absoluteRectOf(child, map)).toEqual({ x: 120, y: 130, width: 150, height: 64 });
  });

  it('层级排序把泳道放底层、子节点放顶层', () => {
    const nodes = [
      { id: 'c', position: { x: 0, y: 0 }, parentId: 'lane1', data: { kind: 'rect' as const } },
      { id: 'top', position: { x: 0, y: 0 }, data: { kind: 'rect' as const } },
      { id: 'lane1', position: { x: 0, y: 0 }, data: { kind: 'swimlane' as const } },
    ];
    expect(orderNodesByHierarchy(nodes).map((n) => n.id)).toEqual(['lane1', 'top', 'c']);
  });

  it('泳道模板使用父子结构且父节点排在最前', () => {
    const doc = buildTemplate('swimlane');
    const laneNode = doc.nodes.find((n) => n.data.kind === 'swimlane');
    expect(laneNode).toBeDefined();
    expect(doc.nodes[0].id).toBe(laneNode!.id);
    expect(doc.nodes.filter((n) => n.parentId === laneNode!.id)).toHaveLength(4);
    expect(validateDoc(doc)).toBe(true);
  });

  it('序列化保留 parentId 并可往返', () => {
    const child = {
      id: 'c1',
      position: { x: 20, y: 30 },
      parentId: 'lane1',
      data: defaultData('rect'),
    };
    const doc = serializeDoc([child], []);
    expect(activePageOf(doc)!.nodes[0].parentId).toBe('lane1');
    const restored = deserializeDoc(doc);
    expect(restored.ok).toBe(true);
    expect(activePageOf(restored.doc!)!.nodes[0].parentId).toBe('lane1');
  });

  it('横向与纵向泳道都是容器', () => {
    expect(isContainerKind('swimlane')).toBe(true);
    expect(isContainerKind('swimlaneV')).toBe(true);
    expect(isContainerKind('rect')).toBe(false);
    expect(isVerticalLane('swimlaneV')).toBe(true);
    expect(isVerticalLane('swimlane')).toBe(false);
  });

  it('纵向泳道模板同样使用父子结构', () => {
    const doc = buildTemplate('swimlaneV');
    const laneNode = doc.nodes.find((n) => n.data.kind === 'swimlaneV');
    expect(laneNode).toBeDefined();
    expect(doc.nodes[0].id).toBe(laneNode!.id);
    expect(doc.nodes.filter((n) => n.parentId === laneNode!.id)).toHaveLength(4);
    expect(validateDoc(doc)).toBe(true);
  });
});

describe('cachedAbsoluteRectOf', () => {
  interface HN {
    id: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    parentId?: string;
    data: { kind: ShapeKind };
  }

  const parent: HN = {
    id: 'p',
    position: { x: 0, y: 0 },
    width: 100,
    height: 100,
    data: { kind: 'group' },
  };
  const child: HN = {
    id: 'c',
    position: { x: 10, y: 10 },
    parentId: 'p',
    width: 20,
    height: 20,
    data: { kind: 'rect' },
  };

  it('未变动时复用同一包围盒引用', () => {
    const byId = new Map([
      ['p', parent],
      ['c', child],
    ]);
    const first = cachedAbsoluteRectOf(child, byId);
    expect(cachedAbsoluteRectOf(child, byId)).toBe(first);
  });

  it('父节点移动后缓存失效并按新位置计算', () => {
    const byId = new Map([
      ['p', parent],
      ['c', child],
    ]);
    const before = cachedAbsoluteRectOf(child, byId);

    const movedParent: HN = { ...parent, position: { x: 50, y: 0 } };
    const nextById = new Map([
      ['p', movedParent],
      ['c', child],
    ]);
    const moved = cachedAbsoluteRectOf(child, nextById);
    expect(moved.x).toBe(60);
    expect(moved).not.toBe(before);
    // 同一父引用再次调用命中缓存
    expect(cachedAbsoluteRectOf(child, nextById)).toBe(moved);
  });
});
