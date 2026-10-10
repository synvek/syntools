/**
 * 文档迁移与归一化：把任意历史 / 外部文档统一成 v3（多页）结构。
 * 纯函数，不向调用方抛异常；无法识别时返回 null，由调用方降级为空图。
 * 这样旧的 v1 草稿（{version:1, nodes, edges}）与 v2 文档仍然可读，不会被丢弃。
 */

import type {
  FlowDoc,
  FlowEdgeRec,
  FlowNodeRec,
  FlowNodeType,
  FlowPage,
  TableCellData,
  TableData,
} from './types';

/**
 * 页面默认名占位符（语言中立）。
 * 新建页面时由 store 层按当前语言本地化（`tools.flowchart.defaultPageName`）；
 * 此常量仅用于兼容缺失页名的历史数据。
 */
export const DEFAULT_PAGE_NAME = 'Page 1';

let seq = 0;

/** 模块内自给 id，避免与 core 形成循环依赖 */
function newId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isNodeRec(v: unknown): v is FlowNodeRec {
  if (!isPlainObject(v)) return false;
  return (
    typeof v.id === 'string' &&
    isPlainObject(v.position) &&
    isPlainObject(v.data) &&
    typeof (v.data as { kind?: unknown }).kind === 'string'
  );
}

function isEdgeRec(v: unknown): v is FlowEdgeRec {
  if (!isPlainObject(v)) return false;
  return typeof v.id === 'string' && typeof v.source === 'string' && typeof v.target === 'string';
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const NODE_TYPES: FlowNodeType[] = ['shape', 'image', 'icon', 'formula', 'table'];

/** 未知/缺失的节点类型回退为 shape（保证旧文档与脏数据都能打开） */
function normalizeNodeType(value: unknown): FlowNodeType {
  return NODE_TYPES.includes(value as FlowNodeType) ? (value as FlowNodeType) : 'shape';
}

/** 归一表格数据：行列数至少为 1，非法的从属单元格记为 null */
function normalizeTable(table: unknown): TableData | undefined {
  if (!isPlainObject(table)) return undefined;
  const rows = Math.max(1, Math.round(num(table.rows) || 1));
  const cols = Math.max(1, Math.round(num(table.cols) || 1));
  const result: TableData = { rows, cols };
  if (Array.isArray(table.cells)) {
    result.cells = table.cells.map((row) =>
      Array.isArray(row)
        ? row.map((cell) => (isPlainObject(cell) ? (cell as TableCellData) : null))
        : [],
    );
  }
  if (Array.isArray(table.rowWeights)) result.rowWeights = table.rowWeights.map((w) => num(w));
  if (Array.isArray(table.colWeights)) result.colWeights = table.colWeights.map((w) => num(w));
  return result;
}

function normalizeNode(v: FlowNodeRec): FlowNodeRec {
  const table = normalizeTable((v.data as { table?: unknown }).table);
  return {
    ...v,
    type: normalizeNodeType(v.type),
    position: { x: num(v.position?.x), y: num(v.position?.y) },
    parentId: v.parentId ?? null,
    hidden: v.hidden === true,
    locked: v.locked === true,
    ...(table ? { data: { ...v.data, table } } : {}),
  };
}

function normalizeEdge(v: FlowEdgeRec): FlowEdgeRec {
  return {
    ...v,
    sourceHandle: v.sourceHandle ?? null,
    targetHandle: v.targetHandle ?? null,
  };
}

function normalizePage(v: Partial<FlowPage> & { id?: unknown; name?: unknown }): FlowPage {
  return {
    id: typeof v.id === 'string' && v.id ? v.id : newId('page'),
    name: typeof v.name === 'string' && v.name ? v.name : DEFAULT_PAGE_NAME,
    nodes: Array.isArray(v.nodes) ? v.nodes.filter(isNodeRec).map(normalizeNode) : [],
    edges: Array.isArray(v.edges) ? v.edges.filter(isEdgeRec).map(normalizeEdge) : [],
  };
}

/** 新建一页 */
export function createPage(name: string = DEFAULT_PAGE_NAME, id?: string): FlowPage {
  return { id: id ?? newId('page'), name, nodes: [], edges: [] };
}

/** 把单页 nodes/edges 包成 v3 文档 */
export function toDocV3(
  nodes: FlowNodeRec[],
  edges: FlowEdgeRec[],
  pageName: string = DEFAULT_PAGE_NAME,
): FlowDoc {
  const page = createPage(pageName);
  return { version: 3, pages: [{ ...page, nodes, edges }], activePageId: page.id };
}

/**
 * 归一为 v3 文档：
 * - v3 / v2（含 pages）：补齐缺失字段与 activePageId
 * - v1（含 nodes/edges）：包装成单页
 * - 其它：返回 null
 */
export function migrateDoc(raw: unknown): FlowDoc | null {
  if (!isPlainObject(raw)) return null;

  if (Array.isArray(raw.pages)) {
    const pages = raw.pages
      .filter((p): p is Record<string, unknown> => isPlainObject(p))
      .map((p) => normalizePage(p as Partial<FlowPage>));
    if (pages.length === 0) return null;
    const wanted = raw.activePageId;
    const active =
      typeof wanted === 'string' && pages.some((p) => p.id === wanted) ? wanted : pages[0].id;
    const name = typeof raw.name === 'string' ? raw.name : undefined;
    return {
      version: 3,
      ...(name === undefined ? {} : { name }),
      pages,
      activePageId: active,
    };
  }

  if (Array.isArray(raw.nodes)) {
    const nodes = raw.nodes.filter(isNodeRec).map(normalizeNode);
    const edges = Array.isArray(raw.edges) ? raw.edges.filter(isEdgeRec).map(normalizeEdge) : [];
    return toDocV3(nodes, edges);
  }

  return null;
}

/** 取当前活动页（越界或缺失时回退第一页） */
export function activePageOf(doc: FlowDoc | null | undefined): FlowPage | undefined {
  if (!doc || doc.pages.length === 0) return undefined;
  return doc.pages.find((p) => p.id === doc.activePageId) ?? doc.pages[0];
}
