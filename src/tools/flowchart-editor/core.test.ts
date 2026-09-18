import { describe, expect, it } from 'vitest';
import {
  __resetIdCounter,
  buildTemplate,
  computeHelperLines,
  createId,
  defaultData,
  deserializeDoc,
  normalizeColor,
  serializeDoc,
  validateDoc,
} from './core';

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

  it('序列化后字段被取整且不丢信息', () => {
    const doc = serializeDoc(nodes, edges, 3);
    expect(doc.version).toBe(3);
    expect(doc.nodes).toHaveLength(2);
    expect(doc.edges[0].source).toBe('n1');
    expect(doc.nodes[0].type).toBe('shape');
  });

  it('合法文档通过校验', () => {
    const doc = serializeDoc(nodes, edges, 1);
    expect(validateDoc(doc)).toBe(true);
    expect(deserializeDoc(doc).ok).toBe(true);
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
