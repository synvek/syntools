import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { defaultData } from './core';
import { layoutGraph } from './layout';
import { shapeSize } from './model/shapes';
import type { FlowNodeData, ShapeKind } from './model/types';

function node(
  id: string,
  kind: ShapeKind,
  position = { x: 0, y: 0 },
  parentId?: string,
): Node<FlowNodeData> {
  const size = shapeSize(kind);
  return {
    id,
    type: 'shape',
    position,
    width: size.width,
    height: size.height,
    parentId,
    data: defaultData(kind, id),
  };
}

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target };
}

describe('自动布局（两段式）', () => {
  it('保留容器层级：子节点仍挂在泳道下且落在泳道包围盒内', () => {
    const nodes = [
      node('lane', 'swimlane', { x: 0, y: 0 }),
      node('a', 'rect', { x: 500, y: 400 }, 'lane'),
      node('b', 'rect', { x: 900, y: 700 }, 'lane'),
    ];
    const out = layoutGraph(nodes, [edge('a', 'b')], { direction: 'TB' });
    const lane = out.find((n) => n.id === 'lane')!;
    const a = out.find((n) => n.id === 'a')!;
    const b = out.find((n) => n.id === 'b')!;

    // 层级被保留（旧实现会解除泳道归属）
    expect(a.parentId).toBe('lane');
    expect(b.parentId).toBe('lane');
    // 子节点坐标是相对泳道的，必须落在容器内部
    for (const child of [a, b]) {
      expect(child.position.x).toBeGreaterThanOrEqual(0);
      expect(child.position.y).toBeGreaterThanOrEqual(0);
      expect(child.position.x + (child.width ?? 0)).toBeLessThanOrEqual(lane.width ?? Infinity);
      expect(child.position.y + (child.height ?? 0)).toBeLessThanOrEqual(lane.height ?? Infinity);
    }
    // TB 方向：b 在 a 下方
    expect(b.position.y).toBeGreaterThan(a.position.y);
  });

  it('容器按内容自适应尺寸（不小于图形默认值）', () => {
    const nodes = [
      node('lane', 'swimlane', { x: 0, y: 0 }),
      node('a', 'rect', { x: 0, y: 0 }, 'lane'),
      node('b', 'rect', { x: 0, y: 0 }, 'lane'),
      node('c', 'rect', { x: 0, y: 0 }, 'lane'),
    ];
    const def = shapeSize('swimlane');
    const lane = layoutGraph(nodes, [edge('a', 'b'), edge('b', 'c')], { direction: 'TB' }).find(
      (n) => n.id === 'lane',
    )!;
    expect(lane.width ?? 0).toBeGreaterThanOrEqual(def.width);
    expect(lane.height ?? 0).toBeGreaterThan(def.height);
  });

  it('方向参数影响排布轴向', () => {
    const nodes = [node('a', 'rect'), node('b', 'rect')];
    const edges = [edge('a', 'b')];
    const tb = layoutGraph(nodes, edges, { direction: 'TB' });
    expect(tb[1].position.y).toBeGreaterThan(tb[0].position.y);

    const lr = layoutGraph(nodes, edges, { direction: 'LR' });
    expect(lr[1].position.x).toBeGreaterThan(lr[0].position.x);
    expect(lr[1].position.y).toBe(lr[0].position.y);
  });

  it('间距预设影响层间距', () => {
    const nodes = [node('a', 'rect'), node('b', 'rect')];
    const edges = [edge('a', 'b')];
    const compact = layoutGraph(nodes, edges, { direction: 'TB', ranksep: 40 });
    const loose = layoutGraph(nodes, edges, { direction: 'TB', ranksep: 200 });
    const gap = (out: Node<FlowNodeData>[]) => out[1].position.y - out[0].position.y;
    expect(gap(loose)).toBeGreaterThan(gap(compact));
  });

  it('关闭层级保留时按扁平图整体重排', () => {
    const nodes = [
      node('lane', 'swimlane', { x: 0, y: 0 }),
      node('a', 'rect', { x: 10, y: 10 }, 'lane'),
      node('b', 'rect', { x: 20, y: 20 }, 'lane'),
    ];
    const out = layoutGraph(nodes, [edge('a', 'b')], {
      direction: 'TB',
      preserveContainers: false,
    });
    // 扁平布局下座标为绝对坐标，容器与子节点一起参与排版
    const a = out.find((n) => n.id === 'a')!;
    const lane = out.find((n) => n.id === 'lane')!;
    expect(a.position.x).not.toBe(10);
    expect(lane.position.y).toBeLessThanOrEqual(a.position.y);
  });

  it('空图直接返回原数组', () => {
    expect(layoutGraph([], [])).toEqual([]);
  });
});
