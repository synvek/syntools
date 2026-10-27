/**
 * Mind map tree operations (pure functions) over `MindNodeRec[]`, with no React Flow or layout
 * concerns. Every function returns a new array (never mutating its input) and returns the input
 * unchanged on failure, so the store can compose them freely.
 */

import { DEFAULT_THEME_ID } from './themes';
import type { MindDoc, MindNodeRec, MindSide } from './types';

let seq = 0;

/** Local unique id: timestamp + sequence counter, avoiding collisions under concurrency */
export function createId(prefix = 'm'): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

/**
 * Default English copy: a new node starts with readable text that typing replaces in edit mode.
 * Kept in the model layer (pure data) rather than i18n, so drafts / exports are independent of
 * the UI language.
 */
export const DEFAULT_ROOT_TEXT = 'Central Topic';
export const DEFAULT_CHILD_TEXT = 'Subtopic';
export const DEFAULT_SIBLING_TEXT = 'Topic';

/** Blank mind map containing only the central topic */
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

/** Child nodes (in array order, which is the display order among siblings) */
export function childrenOf(nodes: readonly MindNodeRec[], id: string): MindNodeRec[] {
  return nodes.filter((n) => n.parentId === id);
}

/** Children that take part in layout: collapsed nodes expose no subtree */
export function visibleChildrenOf(nodes: readonly MindNodeRec[], id: string): MindNodeRec[] {
  const self = findNode(nodes, id);
  if (self?.collapsed) return [];
  return childrenOf(nodes, id);
}

/** Whether `id` is a descendant of `ancestorId` (itself included; used for cycle detection) */
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

/** All node ids of a subtree (itself included) in pre-order */
export function subtreeIdsOf(nodes: readonly MindNodeRec[], id: string): string[] {
  const out: string[] = [];
  const walk = (nodeId: string) => {
    out.push(nodeId);
    for (const child of childrenOf(nodes, nodeId)) walk(child.id);
  };
  walk(id);
  return out;
}

/** Index where the subtree ends in the array (keeps subtrees contiguous when inserting) */
function subtreeEndIndex(nodes: readonly MindNodeRec[], id: string): number {
  const ids = new Set(subtreeIdsOf(nodes, id));
  let last = nodes.findIndex((n) => n.id === id);
  nodes.forEach((n, i) => {
    if (ids.has(n.id)) last = Math.max(last, i);
  });
  return last;
}

/** Insert a node after the anchor's subtree, keeping DFS order contiguous */
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

/** Index among siblings (0-based); the root returns 0 */
export function siblingIndexOf(nodes: readonly MindNodeRec[], id: string): number {
  const self = findNode(nodes, id);
  if (!self?.parentId) return 0;
  return childrenOf(nodes, self.parentId).findIndex((n) => n.id === id);
}

/** Previous sibling (the one right before it at the same level), or undefined */
export function prevSiblingOf(nodes: readonly MindNodeRec[], id: string): MindNodeRec | undefined {
  const self = findNode(nodes, id);
  if (!self?.parentId) return undefined;
  const siblings = childrenOf(nodes, self.parentId);
  const idx = siblings.findIndex((n) => n.id === id);
  return idx > 0 ? siblings[idx - 1] : undefined;
}

/** Add a child node: returns the new array and the new node id */
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
  // Expand a collapsed parent first, otherwise the new node would be invisible
  const opened = parent.collapsed
    ? nodes.map((n) => (n.id === parentId ? { ...n, collapsed: false } : n))
    : [...nodes];
  const next = last ? insertAfter(opened, last.id, rec) : [...opened, rec];
  return { nodes: next, id };
}

/** Add a sibling node; for the root this degrades to adding a child */
export function addSibling(
  nodes: readonly MindNodeRec[],
  id: string,
  text = DEFAULT_SIBLING_TEXT,
): { nodes: MindNodeRec[]; id: string } {
  const self = findNode(nodes, id);
  if (!self) return { nodes: [...nodes], id: '' };
  // The central topic has no siblings: add a child instead, reusing the caller's text
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

/** Delete a node and its subtree; the root cannot be deleted */
export function removeNode(nodes: readonly MindNodeRec[], id: string): MindNodeRec[] {
  const self = findNode(nodes, id);
  if (!self || self.parentId === null) return nodes as MindNodeRec[];
  const doomed = new Set(subtreeIdsOf(nodes, id));
  return nodes.filter((n) => !doomed.has(n.id));
}

/** Indent: become the last child of the previous sibling */
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

/** Outdent: become the next sibling of the parent; a no-op for the root */
export function outdentNode(nodes: readonly MindNodeRec[], id: string): MindNodeRec[] {
  const self = findNode(nodes, id);
  if (!self?.parentId) return nodes as MindNodeRec[];
  const parent = findNode(nodes, self.parentId);
  if (!parent || parent.parentId === null) return nodes as MindNodeRec[];
  const rest = nodes.filter((n) => n.id !== id);
  const moved: MindNodeRec = { ...self, parentId: parent.parentId, side: parent.side };
  return insertAfter(rest, parent.id, moved);
}

/** Move among siblings (dir: -1 up, 1 down) */
export function moveNode(nodes: readonly MindNodeRec[], id: string, dir: -1 | 1): MindNodeRec[] {
  const self = findNode(nodes, id);
  if (!self?.parentId) return nodes as MindNodeRec[];
  const siblings = childrenOf(nodes, self.parentId);
  const idx = siblings.findIndex((n) => n.id === id);
  const target = idx + dir;
  if (target < 0 || target >= siblings.length) return nodes as MindNodeRec[];
  const other = siblings[target];
  const rest = nodes.filter((n) => n.id !== id);
  // Move up: insert before the target sibling; move down: insert after its subtree
  if (dir < 0) {
    const at = rest.findIndex((n) => n.id === other.id);
    return [...rest.slice(0, at), self, ...rest.slice(at)];
  }
  return insertAfter(rest, other.id, self);
}

/** Reparent (drag and drop): never onto itself or one of its descendants */
export function reparent(
  nodes: readonly MindNodeRec[],
  id: string,
  newParentId: string,
): MindNodeRec[] {
  const self = findNode(nodes, id);
  if (!self || self.parentId === newParentId) return nodes as MindNodeRec[];
  if (self.parentId === null) return nodes as MindNodeRec[]; // the root cannot be moved
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

/** Duplicate a subtree under the same parent and return the new root id */
export function duplicateSubtree(
  nodes: readonly MindNodeRec[],
  id: string,
): { nodes: MindNodeRec[]; id: string } {
  const self = findNode(nodes, id);
  if (!self || self.parentId === null) return { nodes: [...nodes], id: '' };
  let next = [...nodes];
  const newIds = new Map<string, string>();
  // Copy in pre-order so parents are placed first
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

/** Collapse / expand */
export function toggleCollapse(nodes: readonly MindNodeRec[], id: string): MindNodeRec[] {
  return nodes.map((n) => (n.id === id ? { ...n, collapsed: !n.collapsed } : n));
}

/** Set the collapsed state of every node */
export function setAllCollapsed(nodes: readonly MindNodeRec[], collapsed: boolean): MindNodeRec[] {
  return nodes.map((n) => (n.parentId === null ? n : { ...n, collapsed }));
}

/** Patch node fields (style is shallow-merged) */
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

/** Side of the top-level branch (used by the both-sides layout) */
export function sideOfNode(
  nodes: readonly MindNodeRec[],
  id: string,
  fallback: MindSide = 'right',
): MindSide {
  const self = findNode(nodes, id);
  if (!self) return fallback;
  return self.side ?? fallback;
}

/** Node count (root included) and branch count (edge count) of the whole map */
export function countOf(nodes: readonly MindNodeRec[]): { nodes: number; edges: number } {
  const edges = nodes.filter((n) => n.parentId !== null).length;
  return { nodes: nodes.length, edges };
}
