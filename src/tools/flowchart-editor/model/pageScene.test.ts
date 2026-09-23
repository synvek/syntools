import { describe, expect, it } from 'vitest';
import { fitScene } from '@/core/components/pageThumbnail';
import { pageSceneOf } from './pageScene';
import { defaultData, DEFAULT_STYLE } from '../core';
import type { FlowNodeRec, FlowPage } from './types';

function node(partial: Partial<FlowNodeRec> & { id: string }): FlowNodeRec {
  return {
    type: 'shape',
    position: { x: 0, y: 0 },
    data: defaultData('rect', partial.id),
    width: 100,
    height: 60,
    ...partial,
  } as FlowNodeRec;
}

function page(nodes: FlowNodeRec[], edges: FlowPage['edges'] = []): FlowPage {
  return { id: 'p1', name: '页面 1', nodes, edges };
}

describe('页面缩略图场景（多页浏览）', () => {
  it('空页返回 null，交给 UI 显示「空白页」', () => {
    expect(pageSceneOf(page([]))).toBeNull();
  });

  it('隐藏节点不参与缩略图；全隐藏也视为空页', () => {
    expect(pageSceneOf(page([node({ id: 'a', hidden: true })]))).toBeNull();
  });

  it('把内容平移到原点并算出包围盒', () => {
    const scene = pageSceneOf(
      page([
        node({ id: 'a', position: { x: 200, y: 120 }, width: 100, height: 60 }),
        node({ id: 'b', position: { x: 420, y: 300 }, width: 80, height: 40 }),
      ]),
    );
    expect(scene).not.toBeNull();
    // 包围盒：x 200→500，y 120→340
    expect(scene!.width).toBe(300);
    expect(scene!.height).toBe(220);
    // 第一个节点被平移到 (0,0)
    expect(scene!.nodes[0]).toMatchObject({ x: 0, y: 0 });
    expect(scene!.nodes[1]).toMatchObject({ x: 220, y: 180 });
  });

  it('泳道内的子节点坐标按父节点绝对化', () => {
    const scene = pageSceneOf(
      page([
        node({ id: 'lane', position: { x: 50, y: 40 }, width: 400, height: 200 }),
        node({ id: 'child', parentId: 'lane', position: { x: 30, y: 60 }, width: 100, height: 50 }),
      ]),
    )!;
    // 子节点绝对坐标 = (80, 100)；平移后相对 lane(50,40) 为 (30,60)
    expect(scene.nodes.find((item) => item.id === 'child')).toMatchObject({ x: 30, y: 60 });
    expect(scene.nodes.find((item) => item.id === 'lane')).toMatchObject({ x: 0, y: 0 });
  });

  it('连线用节点中心相连，虚线样式保留', () => {
    const scene = pageSceneOf(
      page(
        [
          node({ id: 'a', position: { x: 0, y: 0 }, width: 100, height: 60 }),
          node({ id: 'b', position: { x: 300, y: 0 }, width: 100, height: 60 }),
        ],
        [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'a', style: { ...DEFAULT_STYLE, dash: 'dashed' } },
        ] as FlowPage['edges'],
      ),
    )!;
    expect(scene.edges).toHaveLength(2);
    expect(scene.edges[0]).toMatchObject({ x1: 50, y1: 30, x2: 350, y2: 30, dashed: false });
    expect(scene.edges[1].dashed).toBe(true);
  });

  it('端点节点缺失的连线被忽略', () => {
    const scene = pageSceneOf(
      page([node({ id: 'a' })], [{ id: 'e1', source: 'a', target: 'ghost' }] as FlowPage['edges']),
    )!;
    expect(scene.edges).toHaveLength(0);
  });

  it('缩略图缩放：内容等比放进图框且居中，最高 1 倍', () => {
    const big = fitScene({ width: 800, height: 400 });
    expect(big.scale).toBeLessThan(1);
    expect(big.y).toBeGreaterThan(0);

    const small = fitScene({ width: 10, height: 10 });
    expect(small.scale).toBe(1);
    expect(small.x).toBeGreaterThan(0);
  });
});
