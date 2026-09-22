import { describe, expect, it } from 'vitest';
import {
  addChild,
  addSibling,
  childrenOf,
  countOf,
  depthOf,
  duplicateSubtree,
  emptyDoc,
  findNode,
  indentNode,
  isDescendantOf,
  moveNode,
  outdentNode,
  removeNode,
  reparent,
  subtreeIdsOf,
  toggleCollapse,
  visibleChildrenOf,
} from './tree';
import { layoutMindmap } from './layout';
import { buildMindTemplate } from './templates';
import type { MindDoc, MindNodeRec } from './types';

/** 构造 a(根) → b → c，b 另有子节点 d */
function sample(): { nodes: MindNodeRec[]; ids: Record<string, string> } {
  const doc = emptyDoc();
  const rootId = doc.rootId;
  const b = addChild(doc.nodes, rootId, 'B');
  const c = addChild(b.nodes, b.id, 'C');
  const d = addChild(c.nodes, b.id, 'D');
  return { nodes: d.nodes, ids: { root: rootId, b: b.id, c: c.id, d: d.id } };
}

function asDoc(nodes: MindNodeRec[], rootId: string): MindDoc {
  return { version: 1, rootId, nodes, direction: 'right', themeId: 'classic' };
}

describe('脑图树操作', () => {
  it('空白脑图只有一个中心主题', () => {
    const doc = emptyDoc();
    expect(doc.nodes).toHaveLength(1);
    expect(findNode(doc.nodes, doc.rootId)?.parentId).toBeNull();
  });

  it('默认文案为英文：中心主题 / 子主题 / 同级主题', () => {
    const doc = emptyDoc();
    expect(findNode(doc.nodes, doc.rootId)?.text).toBe('Central Topic');
    const child = addChild(doc.nodes, doc.rootId);
    expect(findNode(child.nodes, child.id)?.text).toBe('Subtopic');
    const sibling = addSibling(child.nodes, child.id);
    expect(findNode(sibling.nodes, sibling.id)?.text).toBe('Topic');
  });

  it('新增子节点挂在指定父级下，并排在同级末尾', () => {
    const { nodes, ids } = sample();
    const kids = childrenOf(nodes, ids.b);
    expect(kids.map((k) => k.text)).toEqual(['C', 'D']);
    const added = addChild(nodes, ids.b, 'E');
    expect(childrenOf(added.nodes, ids.b).map((k) => k.text)).toEqual(['C', 'D', 'E']);
    expect(depthOf(added.nodes, added.id)).toBe(2);
  });

  it('根节点新增同级退化为新增子节点', () => {
    const { nodes, ids } = sample();
    const res = addSibling(nodes, ids.root, 'X');
    expect(childrenOf(res.nodes, ids.root).map((k) => k.text)).toEqual(['B', 'X']);
  });

  it('删除节点连带子树，且根节点不可删除', () => {
    const { nodes, ids } = sample();
    const after = removeNode(nodes, ids.b);
    expect(after).toHaveLength(1);
    expect(removeNode(nodes, ids.root)).toHaveLength(nodes.length);
  });

  it('缩进：成为前序兄弟的最后一个子节点', () => {
    const { nodes, ids } = sample();
    const after = indentNode(nodes, ids.d);
    expect(findNode(after, ids.d)?.parentId).toBe(ids.c);
    expect(childrenOf(after, ids.c).map((k) => k.text)).toEqual(['D']);
  });

  it('升级：成为父级的兄弟，且根节点与一级节点不越级到根之上', () => {
    const { nodes, ids } = sample();
    const after = outdentNode(nodes, ids.c);
    expect(findNode(after, ids.c)?.parentId).toBe(ids.root);
    // 一级节点的父级是根，再升级无处可去
    expect(outdentNode(nodes, ids.b)).toEqual(nodes);
    expect(outdentNode(nodes, ids.root)).toEqual(nodes);
  });

  it('同级移动受边界约束', () => {
    const doc = emptyDoc();
    const one = addChild(doc.nodes, doc.rootId, '一');
    const two = addChild(one.nodes, doc.rootId, '二');
    const moved = moveNode(two.nodes, two.id, -1);
    expect(childrenOf(moved, doc.rootId).map((k) => k.text)).toEqual(['二', '一']);
    // 已在首位时上移无效
    expect(moveNode(moved, two.id, -1)).toEqual(moved);
  });

  it('改挂父节点拒绝挂到自身后代（环检测）', () => {
    const { nodes, ids } = sample();
    expect(reparent(nodes, ids.c, ids.c)).toEqual(nodes);
    expect(reparent(nodes, ids.b, ids.c)).toEqual(nodes);
    const ok = reparent(nodes, ids.c, ids.root);
    expect(findNode(ok, ids.c)?.parentId).toBe(ids.root);
  });

  it('复制子树：节点数按子树规模增加且挂在同一父级下', () => {
    const { nodes, ids } = sample();
    const before = nodes.length;
    const copied = duplicateSubtree(nodes, ids.b);
    expect(copied.nodes).toHaveLength(before + subtreeIdsOf(nodes, ids.b).length);
    expect(findNode(copied.nodes, copied.id)?.parentId).toBe(ids.root);
  });

  it('折叠后子树不再参与布局，但数据保留', () => {
    const { nodes, ids } = sample();
    const collapsed = toggleCollapse(nodes, ids.b);
    expect(visibleChildrenOf(collapsed, ids.b)).toHaveLength(0);
    expect(childrenOf(collapsed, ids.b)).toHaveLength(2);
    expect(isDescendantOf(collapsed, ids.c, ids.b)).toBe(true);
  });

  it('节点与分支计数正确', () => {
    const { nodes } = sample();
    expect(countOf(nodes)).toEqual({ nodes: 4, edges: 3 });
  });
});

describe('脑图布局', () => {
  it('向右布局：子节点在父节点右侧且不重叠', () => {
    const { nodes, ids } = sample();
    const out = layoutMindmap(asDoc(nodes, ids.root));
    const root = out.nodes.find((n) => n.id === ids.root)!;
    const b = out.nodes.find((n) => n.id === ids.b)!;
    expect(b.x).toBeGreaterThan(root.x + root.width - 1);
    const c = out.nodes.find((n) => n.id === ids.c)!;
    const d = out.nodes.find((n) => n.id === ids.d)!;
    const overlap =
      c.x < d.x + d.width && d.x < c.x + c.width && c.y < d.y + d.height && d.y < c.y + c.height;
    expect(overlap).toBe(false);
  });

  it('折叠节点的子树不参与布局', () => {
    const { nodes, ids } = sample();
    const collapsed = toggleCollapse(nodes, ids.b);
    const out = layoutMindmap(asDoc(collapsed, ids.root));
    expect(out.nodes).toHaveLength(2);
    expect(out.edges).toHaveLength(1);
  });

  it('左右分布：一级分支分列两侧', () => {
    const doc = buildMindTemplate('reading');
    const out = layoutMindmap({ ...doc, direction: 'both' });
    const root = out.nodes.find((n) => n.id === doc.rootId)!;
    const branches = out.nodes.filter((n) => n.depth === 1);
    const left = branches.filter((n) => n.x + n.width <= root.x);
    const right = branches.filter((n) => n.x >= root.x + root.width);
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBeGreaterThan(0);
  });

  it('向下布局：子节点在父节点下方', () => {
    const doc = buildMindTemplate('product');
    const out = layoutMindmap(doc);
    const root = out.nodes.find((n) => n.id === doc.rootId)!;
    const first = out.nodes.find((n) => n.depth === 1)!;
    expect(first.y).toBeGreaterThan(root.y + root.height - 1);
  });

  it('坐标归一化为非负起点', () => {
    const doc = buildMindTemplate('weekly');
    const out = layoutMindmap({ ...doc, direction: 'both' });
    expect(Math.min(...out.nodes.map((n) => n.x))).toBeGreaterThanOrEqual(0);
    expect(Math.min(...out.nodes.map((n) => n.y))).toBeGreaterThanOrEqual(0);
    expect(out.bounds.width).toBeGreaterThan(0);
  });
});
