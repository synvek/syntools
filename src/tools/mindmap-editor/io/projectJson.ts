/**
 * 脑图工程文件（.json）序列化与解析。
 * 解析走「宽容 + 修复」策略：缺字段补默认、孤儿挂到根、多根合并，坏数据返回 null。
 */

import { DEFAULT_THEME_ID, MIND_THEME_IDS } from '../model/themes';
import { createId } from '../model/tree';
import type {
  MindDoc,
  MindLayoutDirection,
  MindNodeRec,
  MindNodeShape,
  MindNodeStyle,
  MindProject,
  MindSheet,
  MindSide,
} from '../model/types';

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asDirection(v: unknown): MindLayoutDirection {
  return v === 'both' || v === 'down' || v === 'right' ? v : 'right';
}

function asShape(v: unknown): MindNodeShape | undefined {
  return v === 'rounded' || v === 'pill' || v === 'underline' || v === 'rect' || v === 'ellipse'
    ? v
    : undefined;
}

function asSide(v: unknown): MindSide | undefined {
  return v === 'left' || v === 'right' ? v : undefined;
}

function asStyle(v: unknown): Partial<MindNodeStyle> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const raw = v as Record<string, unknown>;
  const style: Partial<MindNodeStyle> = {};
  if (typeof raw.fill === 'string') style.fill = raw.fill;
  if (typeof raw.stroke === 'string') style.stroke = raw.stroke;
  if (typeof raw.textColor === 'string') style.textColor = raw.textColor;
  if (typeof raw.fontSize === 'number') style.fontSize = raw.fontSize;
  if (typeof raw.bold === 'boolean') style.bold = raw.bold;
  if (typeof raw.italic === 'boolean') style.italic = raw.italic;
  if (raw.align === 'left' || raw.align === 'center' || raw.align === 'right') {
    style.align = raw.align;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

/** 规范化：补齐缺省字段、修复孤儿与多根，保证一定是「单根树」 */
export function migrateDoc(input: unknown): MindDoc | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.nodes)) return null;

  const nodes: MindNodeRec[] = [];
  for (const item of raw.nodes) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id = asString(rec.id);
    if (!id) continue;
    const parentId = typeof rec.parentId === 'string' ? rec.parentId : null;
    const node: MindNodeRec = {
      id,
      parentId,
      text: asString(rec.text),
      collapsed: asBool(rec.collapsed),
    };
    const note = asString(rec.note);
    if (note) node.note = note;
    const side = asSide(rec.side);
    if (side) node.side = side;
    const shape = asShape(rec.shape);
    if (shape) node.shape = shape;
    const color = asString(rec.color);
    if (color) node.color = color;
    const style = asStyle(rec.style);
    if (style) node.style = style;
    nodes.push(node);
  }
  if (nodes.length === 0) return null;

  // 单根：优先使用声明的 rootId，否则取第一个 parentId 为空的节点
  const declared = asString(raw.rootId);
  let root = nodes.find((n) => n.id === declared && n.parentId === null);
  if (!root) root = nodes.find((n) => n.parentId === null);
  if (!root) {
    root = nodes[0];
    root.parentId = null;
  }
  root.parentId = null;

  // 其余「无父」节点并入根，避免出现第二个根
  const idSet = new Set(nodes.map((n) => n.id));
  for (const n of nodes) {
    if (n !== root && (n.parentId === null || !idSet.has(n.parentId))) n.parentId = root.id;
  }

  // 断环：沿父链上溯，超过节点总数仍未到根的节点直接挂到根
  for (const n of nodes) {
    if (n === root) continue;
    let cur = n.parentId;
    let guard = nodes.length + 1;
    while (cur && cur !== root.id && guard > 0) {
      const parent = nodes.find((x) => x.id === cur);
      if (!parent) break;
      cur = parent.parentId;
      guard -= 1;
    }
    if (guard <= 0 || cur === null) n.parentId = root.id;
  }

  const themeId = asString(raw.themeId, DEFAULT_THEME_ID);
  const name = typeof raw.name === 'string' ? raw.name : undefined;
  return {
    version: 1,
    ...(name === undefined ? {} : { name }),
    rootId: root.id,
    nodes,
    direction: asDirection(raw.direction),
    themeId: MIND_THEME_IDS.includes(themeId) ? themeId : DEFAULT_THEME_ID,
  };
}

/** 深拷贝一份干净文档用于保存（丢弃内部字段） */
export function serializeDoc(doc: MindDoc): MindDoc {
  return {
    version: 1,
    ...(doc.name === undefined ? {} : { name: doc.name }),
    rootId: doc.rootId,
    nodes: doc.nodes.map((n) => ({
      id: n.id,
      parentId: n.parentId,
      text: n.text,
      ...(n.note ? { note: n.note } : {}),
      ...(n.collapsed ? { collapsed: true } : {}),
      ...(n.side ? { side: n.side } : {}),
      ...(n.shape ? { shape: n.shape } : {}),
      ...(n.color ? { color: n.color } : {}),
      ...(n.style ? { style: { ...n.style } } : {}),
    })),
    direction: doc.direction,
    themeId: doc.themeId,
  };
}

/** 导出为工程文件文本（缩进 JSON） */
export function toProjectJson(doc: MindDoc): string {
  return JSON.stringify(serializeDoc(doc), null, 2);
}

export function parseProjectJson(text: string): MindDoc | null {
  try {
    return migrateDoc(JSON.parse(text));
  } catch {
    return null;
  }
}

/** 重新分配 id（导入模板式内容时使用，避免与现有节点撞号） */
export function reassignIds(doc: MindDoc): MindDoc {
  const map = new Map<string, string>();
  for (const n of doc.nodes) map.set(n.id, createId());
  return {
    ...doc,
    rootId: map.get(doc.rootId) ?? doc.rootId,
    nodes: doc.nodes.map((n) => ({
      ...n,
      id: map.get(n.id) ?? n.id,
      parentId: n.parentId ? (map.get(n.parentId) ?? n.parentId) : null,
      style: n.style ? { ...n.style } : undefined,
    })),
  };
}

/** 取工程的活动画布内容（无活动标记时取第一张） */
export function activeSheetOf(project: MindProject): MindSheet {
  const id = project.activeSheetId;
  return (id ? project.sheets.find((s) => s.id === id) : project.sheets[0]) ?? project.sheets[0];
}

/** 规范化工程：兼容 v1 扁平文档与 v2 多画布，坏数据返回 null */
export function migrateProject(input: unknown): MindProject | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name : undefined;

  // v2 多画布
  if (Array.isArray(raw.sheets)) {
    const sheets: MindSheet[] = [];
    raw.sheets.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const rec = item as Record<string, unknown>;
      const doc = migrateDoc(rec.doc ?? rec); // 兼容 sheet.doc 嵌套或整段即 doc
      if (!doc) return;
      const id = asString(rec.id) || doc.rootId;
      const sheetName = asString(rec.name) || `画布 ${index + 1}`;
      sheets.push({ id, name: sheetName, doc });
    });
    if (sheets.length === 0) return null;
    const declared = asString(raw.activeSheetId);
    const activeSheetId = sheets.some((s) => s.id === declared) ? declared : sheets[0].id;
    return { version: 2, ...(name === undefined ? {} : { name }), sheets, activeSheetId };
  }

  // v1 扁平文档 → 单画布
  const doc = migrateDoc(raw);
  if (!doc) return null;
  return {
    version: 2,
    ...(name === undefined ? {} : { name }),
    sheets: [{ id: doc.rootId, name: '画布 1', doc }],
    activeSheetId: doc.rootId,
  };
}

/** 深拷贝一份干净工程用于保存（每张画布丢弃内部字段） */
export function serializeProject(project: MindProject): MindProject {
  return {
    version: 2,
    ...(project.name === undefined ? {} : { name: project.name }),
    ...(project.activeSheetId === undefined ? {} : { activeSheetId: project.activeSheetId }),
    sheets: project.sheets.map((s) => ({ id: s.id, name: s.name, doc: serializeDoc(s.doc) })),
  };
}

/** 导出为多画布工程文件文本（缩进 JSON） */
export function toProjectJsonV2(project: MindProject): string {
  return JSON.stringify(serializeProject(project), null, 2);
}

export function parseProjectJsonV2(text: string): MindProject | null {
  try {
    return migrateProject(JSON.parse(text));
  } catch {
    return null;
  }
}

/** 把单张扁平文档包装为单画布工程 */
export function singleSheetProject(doc: MindDoc): MindProject {
  return {
    version: 2,
    ...(doc.name === undefined ? {} : { name: doc.name }),
    sheets: [{ id: doc.rootId, name: '画布 1', doc }],
    activeSheetId: doc.rootId,
  };
}
