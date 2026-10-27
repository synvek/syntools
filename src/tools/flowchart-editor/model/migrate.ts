/**
 * Document migration and normalization: unify any historical / external document into the v3 (multi-page) structure.
 * Pure functions that never throw to callers; returns null when unrecognized so callers can fall back to an empty graph.
 * This keeps old v1 drafts ({version:1, nodes, edges}) and v2 documents readable instead of discarding them.
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
 * Placeholder for the default page name (language-neutral).
 * The store layer localizes new pages for the current language (`tools.flowchart.defaultPageName`);
 * this constant only serves legacy data that lacks a page name.
 */
export const DEFAULT_PAGE_NAME = 'Page 1';

let seq = 0;

/** Module-local id helper, avoiding a circular dependency with core */
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

/** Unknown/missing node types fall back to shape (so both legacy documents and dirty data open) */
function normalizeNodeType(value: unknown): FlowNodeType {
  return NODE_TYPES.includes(value as FlowNodeType) ? (value as FlowNodeType) : 'shape';
}

/** Normalize table data: row/column counts are at least 1 and invalid covered cells become null */
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

/** Create a new page */
export function createPage(name: string = DEFAULT_PAGE_NAME, id?: string): FlowPage {
  return { id: id ?? newId('page'), name, nodes: [], edges: [] };
}

/** Wrap single-page nodes/edges into a v3 document */
export function toDocV3(
  nodes: FlowNodeRec[],
  edges: FlowEdgeRec[],
  pageName: string = DEFAULT_PAGE_NAME,
): FlowDoc {
  const page = createPage(pageName);
  return { version: 3, pages: [{ ...page, nodes, edges }], activePageId: page.id };
}

/**
 * Normalize into a v3 document:
 * - v3 / v2 (with pages): fill in missing fields and activePageId
 * - v1 (with nodes/edges): wrap as a single page
 * - anything else: return null
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

/** Get the active page (falls back to the first page when out of range or missing) */
export function activePageOf(doc: FlowDoc | null | undefined): FlowPage | undefined {
  if (!doc || doc.pages.length === 0) return undefined;
  return doc.pages.find((p) => p.id === doc.activePageId) ?? doc.pages[0];
}
