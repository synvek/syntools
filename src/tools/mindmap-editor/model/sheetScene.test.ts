import { describe, expect, it } from 'vitest';
import { fitScene } from '@/core/components/pageThumbnail';
import { sheetSceneOf } from './sheetScene';
import { emptyDoc } from './tree';
import type { MindDoc, MindNodeRec } from './types';

function doc(nodes: MindNodeRec[], overrides: Partial<MindDoc> = {}): MindDoc {
  const base = emptyDoc();
  return { ...base, rootId: nodes[0]?.id ?? base.rootId, nodes, ...overrides };
}

function rec(partial: Partial<MindNodeRec> & { id: string; parentId: string | null }): MindNodeRec {
  return { text: partial.id, ...partial } as MindNodeRec;
}

describe('画布缩略图场景（多画布浏览）', () => {
  it('只有根节点也有内容（不算空白画布）', () => {
    const scene = sheetSceneOf(doc([rec({ id: 'root', parentId: null })]));
    expect(scene).not.toBeNull();
    expect(scene!.nodes).toHaveLength(1);
    expect(scene!.nodes[0].depth).toBe(0);
    expect(scene!.edges).toHaveLength(0);
  });

  it('父子节点生成一条连线：父在左、子在右', () => {
    const scene = sheetSceneOf(
      doc([rec({ id: 'root', parentId: null }), rec({ id: 'child', parentId: 'root' })]),
    )!;
    expect(scene.nodes).toHaveLength(2);
    expect(scene.edges).toHaveLength(1);

    const root = scene.nodes.find((node) => node.id === 'root')!;
    const child = scene.nodes.find((node) => node.id === 'child')!;
    const edge = scene.edges[0];
    // 起点贴在父节点右边缘、终点贴在子节点左边缘
    expect(edge.x1).toBeCloseTo(root.x + root.width, 5);
    expect(edge.x2).toBeCloseTo(child.x, 5);
    expect(edge.y1).toBeCloseTo(root.y + root.height / 2, 5);
    expect(edge.y2).toBeCloseTo(child.y + child.height / 2, 5);
  });

  it('坐标平移到原点，包围盒覆盖全部节点', () => {
    const scene = sheetSceneOf(
      doc([rec({ id: 'root', parentId: null }), rec({ id: 'child', parentId: 'root' })]),
    )!;
    const minX = Math.min(...scene.nodes.map((node) => node.x));
    const minY = Math.min(...scene.nodes.map((node) => node.y));
    expect(minX).toBe(0);
    expect(minY).toBe(0);
    expect(scene.width).toBeGreaterThan(0);
    expect(scene.height).toBeGreaterThan(0);
    // 包围盒不小于任一节点
    for (const node of scene.nodes) {
      expect(node.x + node.width).toBeLessThanOrEqual(scene.width + 1e-6);
      expect(node.y + node.height).toBeLessThanOrEqual(scene.height + 1e-6);
    }
  });

  it('折叠节点自身保留、其子树不参与缩略图（与画布一致）', () => {
    const scene = sheetSceneOf(
      doc([
        rec({ id: 'root', parentId: null }),
        rec({ id: 'child', parentId: 'root', collapsed: true }),
        rec({ id: 'grand', parentId: 'child' }),
      ]),
    )!;
    expect(scene.nodes.map((node) => node.id)).toEqual(['root', 'child']);
    expect(scene.nodes.map((node) => node.id)).not.toContain('grand');
    expect(scene.edges).toHaveLength(1);
  });

  it('缩略图缩放把场景放进图框内', () => {
    const scene = sheetSceneOf(
      doc([
        rec({ id: 'root', parentId: null }),
        rec({ id: 'a', parentId: 'root' }),
        rec({ id: 'b', parentId: 'root' }),
        rec({ id: 'a1', parentId: 'a' }),
      ]),
    )!;
    const fit = fitScene(scene);
    expect(fit.scale).toBeGreaterThan(0);
    expect(fit.scale * scene.width).toBeLessThanOrEqual(168);
    expect(fit.scale * scene.height).toBeLessThanOrEqual(104);
  });
});
