import { describe, expect, it } from 'vitest';
import {
  __resetIdCounter,
  absolutePositionOf,
  absoluteRectOf,
  computeHelperLines,
  createId,
  defaultData,
  deserializeDoc,
  normalizeColor,
  orderNodesByHierarchy,
  resolvePlacement,
  serializeDoc,
  validateDoc,
} from './core';
import { buildTemplate } from './model/templates';
import { isContainerKind, isVerticalLane } from './model/types';
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

describe('normalizeColor', () => {
  it('归一化 3 位与 6 位十六进制', () => {
    expect(normalizeColor('#ABC')).toBe('#aabbcc');
    expect(normalizeColor('#FF0000')).toBe('#ff0000');
    expect(normalizeColor('nope', '#000000')).toBe('#000000');
    expect(normalizeColor(undefined, '#123456')).toBe('#123456');
  });
});

describe('defaultData', () => {
  it('按形状给出默认标签与配色', () => {
    expect(defaultData('rect').label).toBe('过程');
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
