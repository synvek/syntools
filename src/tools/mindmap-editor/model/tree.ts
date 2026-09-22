/**
 * 脑图树操作（纯函数）：只操作 MindNodeRec[]，不涉及 React Flow 与布局。
 * 所有函数返回新数组（不修改入参），失败时原样返回，供 store 组合使用。
 */

import { DEFAULT_THEME_ID } from './themes';
import type { MindDoc, MindNodeRec, MindSide } from './types';

let seq = 0;

/** 本地唯一 id：时间戳 + 自增序号，避免并发下重号 */
export function createId(prefix = 'm'): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

/**
 * 默认英文文案：新建即带可读文本，进入编辑态后直接输入即可覆盖。
 * 放在模型层（纯数据）而非 i18n，保证草稿 / 导出内容与界面语言无关。
 */
export const DEFAULT_ROOT_TEXT = 'Central Topic';
export const DEFAULT_CHILD_TEXT = 'Subtopic';
export const DEFAULT_SIBLING_TEXT = 'Topic';

/** 仅含中心主题的空白脑图 */
export function emptyDoc(themeId: string = DEFAULT_THEME_ID): MindDoc {
  const rootId = createId('root');
  return {
    version: 1,
    rootId,
    nodes: [{ id: rootId, parentId: null, text: DEFAULT_ROOT_TEXT }],
    direction: 'right',
    themeId,
  };
}

export function byIdOf(nodes: readonly MindNodeRec[]): Map<string, MindNodeRec> {
  return new Map(nodes.map((n) => [n.id, n]));
}

export function findNode(
  nodes: readonly MindNodeRec[],
  id: string | null,
): MindNodeRec | undefined {
  if (!id) return undefined;
  return nodes.find((n) => n.id === id);
}

/** 子节点（按数组顺序，即同级展示顺序） */
export function childrenOf(nodes: readonly MindNodeRec[], id: string): MindNodeRec[] {
  return nodes.filter((n) => n.parentId === id);
}

/** 参与布局的子节点：折叠的节点不返回子树 */
export function visibleChildrenOf(nodes: readonly MindNodeRec[], id: string): MindNodeRec[] {
  const self = findNode(nodes, id);
  if (self?.collapsed) return [];
  return childrenOf(nodes, id);
}

/** id 是否为 ancestorId 的后代（含自身，用于环检测） */
export function isDescendantOf(
  nodes: readonly MindNodeRec[],
  id: string,
  ancestorId: string,
): boolean {
  let cur = findNode(nodes, id);
  let guard = nodes.length + 1;
  while (cur && guard > 0) {
    if (cur.id === ancestorId) return true;
    guard -= 1;
    cur = cur.parentId ? findNode(nodes, cur.parentId) : undefined;
  }
  return false;
}

/** 子树全部节点 id（含自身），按树的先序排列 */
export function subtreeIdsOf(nodes: readonly MindNodeRec[], id: string): string[] {
  const out: string[] = [];
  const walk = (nodeId: string) => {
    out.push(nodeId);
    for (const child of childrenOf(nodes, nodeId)) walk(child.id);
  };
  walk(id);
  return out;
}

/** 子树在数组中的结束下标（用于插入时保持子树连续） */
function subtreeEndIndex(nodes: readonly MindNodeRec[], id: string): number {
  const ids = new Set(subtreeIdsOf(nodes, id));
  let last = nodes.findIndex((n) => n.id === id);
  nodes.forEach((n, i) => {
    if (ids.has(n.id)) last = Math.max(last, i);
  });
  return last;
}

/** 在 anchor 子树之后插入节点，保持 DFS 顺序连续 */
function insertAfter(
  nodes: readonly MindNodeRec[],
  anchorId: string,
  rec: MindNodeRec,
): MindNodeRec[] {
  const at = subtreeEndIndex(nodes, anchorId);
  if (at < 0) return [...nodes, rec];
  return [...nodes.slice(0, at + 1), rec, ...nodes.slice(at + 1)];
}

export function depthOf(nodes: readonly MindNodeRec[], id: string): number {
  let depth = 0;
  let cur = findNode(nodes, id);
  let guard = nodes.length + 1;
  while (cur?.parentId && guard > 0) {
    depth += 1;
    guard -= 1;
    cur = findNode(nodes, cur.parentId);
  }
  return depth;
}

/** 在同级中的序号（0 起）；根节点返回 0 */
export function siblingIndexOf(nodes: readonly MindNodeRec[], id: string): number {
  const self = findNode(nodes, id);
  if (!self?.parentId) return 0;
  return childrenOf(nodes, self.parentId).findIndex((n) => n.id === id);
}

/** 前序兄弟（同级中紧邻的上一个），无则 undefined */
export function prevSiblingOf(nodes: readonly MindNodeRec[], id: string): MindNodeRec | undefined {
  const self = findNode(nodes, id);
  if (!self?.parentId) return undefined;
  const siblings = childrenOf(nodes, self.parentId);
  const idx = siblings.findIndex((n) => n.id === id);
  return idx > 0 ? siblings[idx - 1] : undefined;
}

/** 新增子节点：返回新数组与新节点 id */
export function addChild(
  nodes: readonly MindNodeRec[],
  parentId: string,
  text = DEFAULT_CHILD_TEXT,
): { nodes: MindNodeRec[]; id: string } {
  const parent = findNode(nodes, parentId);
  if (!parent) return { nodes: [...nodes], id: '' };
  const id = createId();
  const siblings = childrenOf(nodes, parentId);
  const last = siblings[siblings.length - 1];
  const rec: MindNodeRec = {
    id,
    parentId,
    text,
    collapsed: false,
    side: parent.parentId === null ? (parent.side ?? 'right') : parent.side,
  };
  // 折叠的父节点先展开，否则新节点不可见
  const opened = parent.collapsed
    ? nodes.map((n) => (n.id === parentId ? { ...n, collapsed: false } : n))
    : [...nodes];
  const next = last ? insertAfter(opened, last.id, rec) : [...opened, rec];
  return { nodes: next, id };
}

/** 新增同级节点：根节点退化为新增子节点 */
export function addSibling(
  nodes: readonly MindNodeRec[],
  id: string,
  text = DEFAULT_SIBLING_TEXT,
): { nodes: MindNodeRec[]; id: string } {
  const self = findNode(nodes, id);
  if (!self) return { nodes: [...nodes], id: '' };
  // 中心主题没有同级：退化为新增子主题（沿用调用方传入的文案）
  if (!self.parentId) return addChild(nodes, id, text);
  const newId = createId();
  const rec: MindNodeRec = {
    id: newId,
    parentId: self.parentId,
    text,
    collapsed: false,
    side: self.side,
  };
  return { nodes: insertAfter(nodes, id, rec), id: newId };
}

/** 删除节点及其子树：根节点不可删 */
export function removeNode(nodes: readonly MindNodeRec[], id: string): MindNodeRec[] {
  const self = findNode(nodes, id);
  if (!self || self.parentId === null) return nodes as MindNodeRec[];
  const doomed = new Set(subtreeIdsOf(nodes, id));
  return nodes.filter((n) => !doomed.has(n.id));
}

/** 降级为子级：成为前序兄弟的最后一个子节点 */
export function indentNode(nodes: readonly MindNodeRec[], id: string): MindNodeRec[] {
  const self = findNode(nodes, id);
  if (!self?.parentId) return nodes as MindNodeRec[];
  const prev = prevSiblingOf(nodes, id);
  if (!prev) return nodes as MindNodeRec[];
  const rest = nodes.filter((n) => n.id !== id);
  const moved: MindNodeRec = { ...self, parentId: prev.id, collapsed: self.collapsed };
  const siblings = childrenOf(rest, prev.id);
  const last = siblings[siblings.length - 1];
  const opened = prev.collapsed
    ? rest.map((n) => (n.id === prev.id ? { ...n, collapsed: false } : n))
    : rest;
  return last ? insertAfter(opened, last.id, moved) : [...opened, moved];
}

/** 升级为同级：成为父节点的下一个兄弟；根节点无操作 */
export function outdentNode(nodes: readonly MindNodeRec[], id: string): MindNodeRec[] {
  const self = findNode(nodes, id);
  if (!self?.parentId) return nodes as MindNodeRec[];
  const parent = findNode(nodes, self.parentId);
  if (!parent || parent.parentId === null) return nodes as MindNodeRec[];
  const rest = nodes.filter((n) => n.id !== id);
  const moved: MindNodeRec = { ...self, parentId: parent.parentId, side: parent.side };
  return insertAfter(rest, parent.id, moved);
}

/** 同级上移 / 下移（dir: -1 上移，1 下移） */
export function moveNode(nodes: readonly MindNodeRec[], id: string, dir: -1 | 1): MindNodeRec[] {
  const self = findNode(nodes, id);
  if (!self?.parentId) return nodes as MindNodeRec[];
  const siblings = childrenOf(nodes, self.parentId);
  const idx = siblings.findIndex((n) => n.id === id);
  const target = idx + dir;
  if (target < 0 || target >= siblings.length) return nodes as MindNodeRec[];
  const other = siblings[target];
  const rest = nodes.filter((n) => n.id !== id);
  // 上移：插到目标兄弟之前；下移：插到目标兄弟子树之后
  if (dir < 0) {
    const at = rest.findIndex((n) => n.id === other.id);
    return [...rest.slice(0, at), self, ...rest.slice(at)];
  }
  return insertAfter(rest, other.id, self);
}

/** 改挂父节点（拖拽）：禁止挂到自身或自身后代 */
export function reparent(
  nodes: readonly MindNodeRec[],
  id: string,
  newParentId: string,
): MindNodeRec[] {
  const self = findNode(nodes, id);
  if (!self || self.parentId === newParentId) return nodes as MindNodeRec[];
  if (self.parentId === null) return nodes as MindNodeRec[]; // 根节点不可移动
  if (isDescendantOf(nodes, newParentId, id)) return nodes as MindNodeRec[];
  const parent = findNode(nodes, newParentId);
  if (!parent) return nodes as MindNodeRec[];
  const rest = nodes.filter((n) => n.id !== id);
  const moved: MindNodeRec = {
    ...self,
    parentId: newParentId,
    side: parent.parentId === null ? (self.side ?? 'right') : parent.side,
  };
  const opened = parent.collapsed
    ? rest.map((n) => (n.id === newParentId ? { ...n, collapsed: false } : n))
    : rest;
  const siblings = childrenOf(opened, newParentId);
  const last = siblings[siblings.length - 1];
  return last ? insertAfter(opened, last.id, moved) : [...opened, moved];
}

/** 复制子树：新子树挂在同一父级下，返回新根 id */
export function duplicateSubtree(
  nodes: readonly MindNodeRec[],
  id: string,
): { nodes: MindNodeRec[]; id: string } {
  const self = findNode(nodes, id);
  if (!self || self.parentId === null) return { nodes: [...nodes], id: '' };
  let next = [...nodes];
  const newIds = new Map<string, string>();
  // 先序复制，保证父节点先落位
  for (const oldId of subtreeIdsOf(nodes, id)) {
    const src = findNode(nodes, oldId);
    if (!src) continue;
    const newId = createId();
    newIds.set(oldId, newId);
    const parentId = oldId === id ? src.parentId : (newIds.get(src.parentId ?? '') ?? src.parentId);
    const rec: MindNodeRec = {
      ...src,
      id: newId,
      parentId,
      style: src.style ? { ...src.style } : undefined,
    };
    next = parentId ? insertAfter(next, parentId, rec) : [...next, rec];
  }
  return { nodes: next, id: newIds.get(id) ?? '' };
}

/** 折叠 / 展开 */
export function toggleCollapse(nodes: readonly MindNodeRec[], id: string): MindNodeRec[] {
  return nodes.map((n) => (n.id === id ? { ...n, collapsed: !n.collapsed } : n));
}

/** 设置全部节点的折叠状态 */
export function setAllCollapsed(nodes: readonly MindNodeRec[], collapsed: boolean): MindNodeRec[] {
  return nodes.map((n) => (n.parentId === null ? n : { ...n, collapsed }));
}

/** 局部更新节点字段（style 为浅合并） */
export function patchNode(
  nodes: readonly MindNodeRec[],
  id: string,
  patch: Partial<Omit<MindNodeRec, 'id'>>,
): MindNodeRec[] {
  return nodes.map((n) => {
    if (n.id !== id) return n;
    const next: MindNodeRec = { ...n };
    if (patch.text !== undefined) next.text = patch.text;
    if (patch.note !== undefined) next.note = patch.note;
    if (patch.collapsed !== undefined) next.collapsed = patch.collapsed;
    if (patch.side !== undefined) next.side = patch.side;
    if (patch.shape !== undefined) next.shape = patch.shape;
    if (patch.color !== undefined) next.color = patch.color;
    if (patch.style !== undefined) next.style = { ...n.style, ...patch.style };
    return next;
  });
}

/** 一级分支所在侧（左右分布布局用） */
export function sideOfNode(
  nodes: readonly MindNodeRec[],
  id: string,
  fallback: MindSide = 'right',
): MindSide {
  const self = findNode(nodes, id);
  if (!self) return fallback;
  return self.side ?? fallback;
}

/** 全图节点数（含根）与分支数（连线数） */
export function countOf(nodes: readonly MindNodeRec[]): { nodes: number; edges: number } {
  const edges = nodes.filter((n) => n.parentId !== null).length;
  return { nodes: nodes.length, edges };
}
