/**
 * Bidirectional conversion between the editor and Mermaid flowchart text.
 *
 * Export: structure and the expressible styles (classDef / class / linkStyle) are written out for pasting into Markdown and round-tripping.
 * Import: a purpose-built lightweight parser (no mermaid runtime, avoiding a ~500KB gzip dependency)
 * covering a common subset of `flowchart` / `graph`:
 * - direction: TD / TB / BT / LR / RL
 * - nodes: `id`, `id[rect]`, `id(rounded)`, `id([terminator])`, `id((circle))`, `id(((double circle)))`, `id{decision}`,
 * `id{{hexagon}}`, `id[(database)]`, `id[[predefined]]`, `id>asymmetric]`,
 * `id[/parallelogram/]`, `id[\parallelogram\]`, `id[/trapezoid\]`, `id[\trapezoid/]`
 * - edges: `-->` `---` `-.->` `-.-` `==>` `===` `--x` `--o`, labels as `|text|` or `-- text -->`
 * - styles: `classDef` definitions + `class` assignments + inline `style` + `linkStyle` (by edge index)
 * - containers: `subgraph name ... end` (mapped to group containers)
 * Other directives (click / direction / accTitle / accDescr, etc.) are ignored safely.
 * Since Mermaid carries no coordinates, an import always runs one dagre auto-layout pass.
 */

import { createId, defaultData } from '../core';
import { layoutGraph } from '../layout';
import { activePageOf, toDocV3 } from '../model/migrate';
import { shapeSize } from '../model/shapes';
import { normalizeEdgeStyle } from '../ops';
import {
  DEFAULT_EDGE_STYLE,
  type EdgeArrow,
  type EdgeDash,
  type FlowDoc,
  type FlowEdgeRec,
  type FlowEdgeStyle,
  type FlowNodeData,
  type FlowNodeRec,
  type FlowNodeStyle,
  type FlowPage,
  type ShapeKind,
} from '../model/types';

/* ------------------------------ Export ------------------------------ */

/** Strip characters that are sensitive in Mermaid syntax so the output stays a valid script */
function safe(text: string): string {
  return (
    text
      .replace(/[[\]{}()|"']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || ' '
  );
}

/** Shape → how it is wrapped in Mermaid text */
function bodyOf(kind: ShapeKind, label: string): string {
  const text = safe(label);
  switch (kind) {
    case 'decision':
      return `{${text}}`;
    case 'startEnd':
      return `([${text}])`;
    case 'data':
      return `[/${text}/]`;
    case 'database':
      return `[(${text})]`;
    case 'document':
    case 'predefined':
      return `[[${text}]]`;
    case 'parallelogram':
      return `[/${text}/]`;
    case 'trapezoid':
      return `[/${text}\\]`;
    case 'card':
    case 'note':
      return `>${text}]`;
    case 'roundRect':
      return `(${text})`;
    case 'hexagon':
      return `{{${text}}}`;
    case 'ellipse':
      return `((${text}))`;
    case 'rect':
    default:
      return `[${text}]`;
  }
}

/** Node style → classDef body; only properties differing from the shape defaults are emitted, keeping export lean */
function classBodyOf(kind: ShapeKind, style: FlowNodeStyle): string {
  const base = defaultData(kind).style;
  const parts: string[] = [];
  if (style.fill && style.fill !== base.fill) parts.push(`fill:${style.fill}`);
  if (style.stroke && style.stroke !== base.stroke) parts.push(`stroke:${style.stroke}`);
  if (style.strokeWidth !== undefined && style.strokeWidth !== base.strokeWidth) {
    parts.push(`stroke-width:${style.strokeWidth}px`);
  }
  if (style.textColor && style.textColor !== base.textColor) parts.push(`color:${style.textColor}`);
  if (style.fontSize !== undefined && style.fontSize !== base.fontSize) {
    parts.push(`font-size:${style.fontSize}px`);
  }
  const dash = style.lineDash ?? 'solid';
  if (dash !== 'solid') parts.push(`stroke-dasharray:${dash === 'dotted' ? '2 3' : '6 4'}`);
  return parts.join(',');
}

/** Edge style → linkStyle body; returns an empty string when everything is default (no linkStyle line emitted) */
function linkBodyOf(style: FlowEdgeStyle | undefined): string {
  if (!style) return '';
  const parts: string[] = [];
  if (style.stroke && style.stroke !== DEFAULT_EDGE_STYLE.stroke) {
    parts.push(`stroke:${style.stroke}`);
  }
  if (style.strokeWidth !== undefined && style.strokeWidth !== DEFAULT_EDGE_STYLE.strokeWidth) {
    parts.push(`stroke-width:${style.strokeWidth}px`);
  }
  if (style.dash === 'dashed' || style.dash === 'sketchDashed') {
    parts.push('stroke-dasharray:6 4');
  } else if (style.dash === 'dotted') {
    parts.push('stroke-dasharray:2 3');
  } else if (style.dash === 'dashdot') {
    parts.push('stroke-dasharray:4 2 1 2');
  }
  return parts.join(',');
}

/** Single page → Mermaid flowchart text (structure + styles restorable in Mermaid) */
function pageMermaidOf(page: FlowPage): string {
  if (page.nodes.length === 0) return '';
  const lines: string[] = ['flowchart TD'];

  // Deduplicate node styles into classDefs: identical bodies reuse the same class
  const classNameByBody = new Map<string, string>();
  const classBodies: string[] = [];
  const membersOfClass = new Map<string, string[]>();
  for (const node of page.nodes) {
    lines.push(`  ${node.id}${bodyOf(node.data.kind, node.data.label)}`);
    const body = classBodyOf(node.data.kind, node.data.style);
    if (!body) continue;
    let name = classNameByBody.get(body);
    if (!name) {
      name = `c${classBodies.length}`;
      classNameByBody.set(body, name);
      classBodies.push(body);
    }
    const members = membersOfClass.get(name) ?? [];
    members.push(node.id);
    membersOfClass.set(name, members);
  }

  // Edges + linkStyle (the index is the edge declaration order)
  const linkLines: string[] = [];
  page.edges.forEach((edge, index) => {
    const label = edge.label ? safe(edge.label) : '';
    const arrow = label ? `-->|${label}|` : '-->';
    lines.push(`  ${edge.source} ${arrow} ${edge.target}`);
    const body = linkBodyOf(edge.style);
    if (body) linkLines.push(`  linkStyle ${index} ${body};`);
  });

  for (let i = 0; i < classBodies.length; i += 1) {
    lines.push(`  classDef c${i} ${classBodies[i]};`);
  }
  for (const [name, ids] of membersOfClass) {
    lines.push(`  class ${ids.join(',')} ${name};`);
  }
  lines.push(...linkLines);
  return `${lines.join('\n')}\n`;
}

export interface MermaidExportOptions {
  /** `current` is the active page only (default); `all` covers every page (one flowchart block per page, each preceded by a `%% page:` comment with the page name) */
  pages?: 'current' | 'all';
}

export function toMermaid(doc: FlowDoc, options: MermaidExportOptions = {}): string {
  const pages: FlowPage[] =
    options.pages === 'all' ? doc.pages : ([activePageOf(doc)].filter(Boolean) as FlowPage[]);
  const multi = options.pages === 'all' && pages.length > 1;
  const chunks: string[] = [];
  for (const page of pages) {
    const body = pageMermaidOf(page);
    if (!body) continue;
    chunks.push(multi ? `%% page: ${page.name}\n${body}` : body);
  }
  return chunks.join('\n');
}

/* ------------------------------ Import ------------------------------ */

export type MermaidParseResult =
  | { ok: true; doc: FlowDoc }
  | { ok: false; error: 'MISSING_HEADER' | 'EMPTY' | 'INVALID_STATEMENT'; line?: number };

/** Shape wrapping syntax → shape catalog (order is priority: longer before shorter, compound before simple) */
const WRAPPERS: Array<[RegExp, ShapeKind]> = [
  [/^\(\(\(([\s\S]*)\)\)\)$/, 'ellipse'],
  [/^\(\(([\s\S]*)\)\)$/, 'ellipse'],
  [/^\(\[([\s\S]*)\]\)$/, 'startEnd'],
  [/^\{\{([\s\S]*)\}\}$/, 'hexagon'],
  [/^\(([\s\S]*)\)$/, 'roundRect'],
  [/^\{(.*)\}$/, 'decision'],
  [/^>([\s\S]*)\]$/, 'card'],
];

/**
 * `[...]` forms are resolved by their leading/trailing delimiters:
 * `[[x]]` predefined, `[(x)]` database, `[/x/]` and `[\x\]` parallelogram,
 * `[/x\]` and `[\x/]` trapezoid, `[x]` rectangle.
 */
function squareBracketShape(rest: string): { kind: ShapeKind; label: string } | null {
  if (!rest.startsWith('[') || !rest.endsWith(']')) return null;
  if (rest.startsWith('[[') && rest.endsWith(']]')) {
    return { kind: 'predefined', label: unquote(rest.slice(2, -2)) };
  }
  if (rest.startsWith('[(') && rest.endsWith(')]')) {
    return { kind: 'database', label: unquote(rest.slice(2, -2)) };
  }
  const inner = rest.slice(1, -1);
  if (inner.length >= 2) {
    const left = inner[0];
    const right = inner[inner.length - 1];
    const body = unquote(inner.slice(1, -1));
    if ((left === '/' && right === '/') || (left === '\\' && right === '\\')) {
      return { kind: 'data', label: body };
    }
    if ((left === '/' && right === '\\') || (left === '\\' && right === '/')) {
      return { kind: 'trapezoid', label: body };
    }
  }
  return { kind: 'rect', label: unquote(inner) };
}

/** Edge markers that may appear in a statement (with optional |label|) */
const LINK_SPLIT = /\s*((?:-->|---|-\.->|-\.-|==>|===|--x|--o)\s*(?:\|[^|]*\|)?)\s*/;

/** Normalize inline `-- text -->` / `-. text .->` / `== text ==>` to `-->|text|` */
function normalizeTextLinks(line: string): string {
  return line
    .replace(/--\s+(.+?)\s+-->/g, '-->|$1|')
    .replace(/-\.\s+(.+?)\s+\.->/g, '-.->|$1|')
    .replace(/==\s+(.+?)\s+==>/g, '==>|$1|')
    .replace(/--\s+(.+?)\s+---/g, '---|$1|');
}

function unquote(text: string): string {
  const trimmed = text.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

interface ParsedNodeExpr {
  id: string;
  kind?: ShapeKind;
  label?: string;
}

function parseNodeExpr(expr: string): ParsedNodeExpr | null {
  const trimmed = expr.trim().replace(/^&/, '').trim();
  if (!trimmed) return null;
  const m = /^([^\s([{\]"'>]+)([\s\S]*)$/.exec(trimmed);
  if (!m) return null;
  const id = m[1].replace(/#.*$/, '');
  const rest = (m[2] ?? '').trim();
  if (!id) return null;
  if (!rest) return { id };
  const square = squareBracketShape(rest);
  if (square) return { id, kind: square.kind, label: square.label };
  for (const [re, kind] of WRAPPERS) {
    const hit = re.exec(rest);
    if (hit) return { id, kind, label: unquote(hit[1]) };
  }
  // Leftover text that matches no wrapping syntax: treat it as a bare id instead of failing the whole line
  return { id };
}

/** Edge marker → line style */
function linkStyleOf(token: string): Partial<FlowEdgeStyle> {
  const raw = token.replace(/\|[^|]*\|/g, '').trim();
  const dashed = raw.includes('.');
  const thick = raw.includes('=');
  const head: EdgeArrow = raw.endsWith('x')
    ? 'bar'
    : raw.endsWith('o')
      ? 'circle'
      : raw.endsWith('>')
        ? 'arrowclosed'
        : 'none';
  const dash: EdgeDash = dashed ? 'dashed' : 'solid';
  return { dash, endArrow: head, startArrow: 'none', strokeWidth: thick ? 3 : 2 };
}

function linkLabelOf(token: string): string | undefined {
  const m = /\|([^|]*)\|/.exec(token);
  return m ? m[1].trim() || undefined : undefined;
}

/** Mermaid directive lines to ignore (style directives classDef / class / style / linkStyle are parsed separately) */
const IGNORED_DIRECTIVE = /^(?:click|direction|accTitle|accDescr)\b/;

/** `fill:#f00,stroke:#333` → Map (keys lowercased) */
function parseMermaidStyle(body: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const token of body.split(',')) {
    const colon = token.indexOf(':');
    if (colon < 0) continue;
    map.set(token.slice(0, colon).trim().toLowerCase(), token.slice(colon + 1).trim());
  }
  return map;
}

/** Numeric value with units such as `px` stripped */
function cssNum(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Mermaid style properties → node style (only expressible fields are taken) */
function nodeStyleFromMermaid(map: Map<string, string> | undefined): Partial<FlowNodeStyle> {
  if (!map || map.size === 0) return {};
  const out: Partial<FlowNodeStyle> = {};
  const fill = map.get('fill');
  if (fill && fill !== 'none') out.fill = fill;
  const stroke = map.get('stroke');
  if (stroke && stroke !== 'none') out.stroke = stroke;
  const sw = cssNum(map.get('stroke-width'));
  if (sw !== undefined) out.strokeWidth = sw;
  const color = map.get('color');
  if (color) out.textColor = color;
  const fs = cssNum(map.get('font-size'));
  if (fs !== undefined) out.fontSize = fs;
  const dash = map.get('stroke-dasharray');
  if (dash) out.lineDash = dash.startsWith('2') ? 'dotted' : 'dashed';
  return out;
}

/** Mermaid style properties → edge style (only expressible fields are taken) */
function edgeStyleFromMermaid(map: Map<string, string> | undefined): Partial<FlowEdgeStyle> {
  if (!map || map.size === 0) return {};
  const out: Partial<FlowEdgeStyle> = {};
  const stroke = map.get('stroke');
  if (stroke) out.stroke = stroke;
  const sw = cssNum(map.get('stroke-width'));
  if (sw !== undefined) out.strokeWidth = sw;
  const dash = map.get('stroke-dasharray');
  if (dash) out.dash = dash.startsWith('2') ? 'dotted' : 'dashed';
  return out;
}

/**
 * Parse a single `flowchart` block (one header plus the statements that follow).
 * On failure returns `{ ok:false, error, line }` so the UI can point at the offending line.
 */
function parseMermaidPage(text: string): MermaidParseResult {
  const lines = text.split(/\r?\n/);
  const nodeDefs = new Map<string, ParsedNodeExpr>();
  const nodeSub = new Map<string, string>();
  const edges: Array<{
    source: string;
    target: string;
    label?: string;
    style: Partial<FlowEdgeStyle>;
  }> = [];
  const subgraphs = new Map<string, { id: string; label: string; members: string[] }>();
  const subStack: string[] = [];
  // Style directives: classDef definitions / class assignments / inline style / linkStyle by edge index
  const classDefs = new Map<string, Map<string, string>>();
  const classOf = new Map<string, string>();
  const styleOfNode = new Map<string, Map<string, string>>();
  const linkStyles = new Map<number, Map<string, string>>();

  let sawHeader = false;
  let direction: 'TB' | 'LR' = 'TB';
  let subSeq = 0;

  const ensureNode = (expr: ParsedNodeExpr): void => {
    const existing = nodeDefs.get(expr.id);
    if (!existing) {
      nodeDefs.set(expr.id, expr);
    } else if (expr.kind || expr.label) {
      // A later shape/copy declaration overrides a bare id declaration
      nodeDefs.set(expr.id, { ...existing, ...expr });
    }
    const current = subStack[subStack.length - 1];
    if (current) nodeSub.set(expr.id, current);
  };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const lineNo = i + 1;
    const line = rawLine
      .replace(/%%\{[\s\S]*?\}%%/g, '')
      .split('%%')[0]
      .trim();
    if (!line) continue;

    if (!sawHeader) {
      const head = /^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/.exec(line);
      if (!head) return { ok: false, error: 'MISSING_HEADER', line: lineNo };
      direction = head[1] === 'LR' || head[1] === 'RL' ? 'LR' : 'TB';
      sawHeader = true;
      continue;
    }

    if (/^subgraph\b/.test(line)) {
      const body = line.replace(/^subgraph\s+/, '').trim();
      const parsed = parseNodeExpr(body);
      const id = parsed?.id || `sub${(subSeq += 1)}`;
      const label = parsed?.label ?? unquote(body);
      if (!subgraphs.has(id)) subgraphs.set(id, { id, label, members: [] });
      subStack.push(id);
      continue;
    }
    if (line === 'end') {
      subStack.pop();
      continue;
    }
    // Style directives: parse and buffer them, then merge into node / edge styles (the trailing semicolon is optional)
    if (/^classDef\b/.test(line)) {
      const m = /^classDef\s+([^\s;]+)\s+([\s\S]+?);?\s*$/.exec(line);
      if (m) classDefs.set(m[1], parseMermaidStyle(m[2]));
      continue;
    }
    if (/^class\b/.test(line)) {
      const m = /^class\s+([^\s;]+(?:\s*,\s*[^\s;]+)*)\s+([^\s;]+);?\s*$/.exec(line);
      if (m) {
        for (const id of m[1].split(',')) {
          const clean = id.trim();
          if (clean) classOf.set(clean, m[2]);
        }
      }
      continue;
    }
    if (/^style\b/.test(line)) {
      const m = /^style\s+([^\s;]+)\s+([\s\S]+?);?\s*$/.exec(line);
      if (m) styleOfNode.set(m[1], parseMermaidStyle(m[2]));
      continue;
    }
    if (/^linkStyle\b/.test(line)) {
      const m = /^linkStyle\s+([\d,\s]+?)\s+([\s\S]+?);?\s*$/.exec(line);
      if (m) {
        for (const token of m[1].split(',')) {
          const index = Number(token.trim());
          if (Number.isInteger(index) && index >= 0) linkStyles.set(index, parseMermaidStyle(m[2]));
        }
      }
      continue;
    }
    if (IGNORED_DIRECTIVE.test(line)) continue;

    const chunks = normalizeTextLinks(line).split(LINK_SPLIT);
    const exprs: ParsedNodeExpr[] = [];
    for (let c = 0; c < chunks.length; c += 1) {
      const chunk = chunks[c].trim();
      if (!chunk) continue;
      if (c % 2 === 1) continue; // edge marker
      const parsed = parseNodeExpr(chunk);
      if (!parsed) return { ok: false, error: 'INVALID_STATEMENT', line: lineNo };
      exprs.push(parsed);
    }
    if (exprs.length === 0) continue;

    for (let c = 0; c < chunks.length; c += 1) {
      const chunk = chunks[c];
      if (c % 2 === 1) {
        const link = chunk.trim();
        if (!link) continue;
        const left = exprs[(c - 1) / 2];
        const right = exprs[(c + 1) / 2];
        if (!left || !right) continue;
        edges.push({
          source: left.id,
          target: right.id,
          label: linkLabelOf(link),
          style: linkStyleOf(link),
        });
      }
    }
    for (const expr of exprs) ensureNode(expr);
  }

  if (!sawHeader) return { ok: false, error: 'MISSING_HEADER', line: 1 };
  if (nodeDefs.size === 0) return { ok: false, error: 'EMPTY' };

  /* 1) build flat nodes → dagre layout (Mermaid has no coordinates, so auto-layout is mandatory) */
  const flat: Array<{
    id: string;
    type: 'shape';
    position: { x: number; y: number };
    width: number;
    height: number;
    data: FlowNodeData;
  }> = [];
  /** Node style overrides: class assignments + inline style (inline wins) */
  const nodeStyleOverride = (id: string): Partial<FlowNodeStyle> => {
    const cls = classOf.get(id);
    const fromClass = cls ? classDefs.get(cls) : undefined;
    return {
      ...nodeStyleFromMermaid(fromClass),
      ...nodeStyleFromMermaid(styleOfNode.get(id)),
    };
  };

  for (const [id, def] of nodeDefs) {
    const kind: ShapeKind = def.kind ?? 'rect';
    const size = shapeSize(kind);
    const base = defaultData(kind, def.label ?? '');
    flat.push({
      id,
      type: 'shape',
      position: { x: 0, y: 0 },
      width: size.width,
      height: size.height,
      data: { ...base, style: { ...base.style, ...nodeStyleOverride(id) } },
    });
  }
  const laidOut = layoutGraph(
    flat,
    edges.map((e) => ({ id: `e_${e.source}_${e.target}`, source: e.source, target: e.target })),
    { direction, preserveContainers: false },
  );
  const posById = new Map(laidOut.map((n) => [n.id, n.position] as const));

  /* 2) subgraph → group container (built from the members' bounding box, with child coordinates made relative) */
  const recs: FlowNodeRec[] = [];
  const childIds = new Set<string>();
  for (const sub of subgraphs.values()) {
    sub.members = [...nodeDefs.keys()].filter((id) => nodeSub.get(id) === sub.id);
    if (sub.members.length === 0) continue;
    const boxes = sub.members.map((id) => {
      const node = flat.find((n) => n.id === id)!;
      const pos = posById.get(id) ?? { x: 0, y: 0 };
      return { x: pos.x, y: pos.y, width: node.width, height: node.height };
    });
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.width));
    const maxY = Math.max(...boxes.map((b) => b.y + b.height));
    const padX = 24;
    const padTop = 46;
    const padBottom = 20;
    const groupPos = { x: Math.round(minX - padX), y: Math.round(minY - padTop) };
    const groupId = createId('g');
    const size = shapeSize('group');
    recs.push({
      id: groupId,
      type: 'shape',
      position: groupPos,
      width: Math.max(size.width, Math.round(maxX - minX + padX * 2)),
      height: Math.max(size.height, Math.round(maxY - minY + padTop + padBottom)),
      data: defaultData('group', sub.label),
    });
    for (const id of sub.members) {
      childIds.add(id);
      const pos = posById.get(id) ?? { x: 0, y: 0 };
      const node = flat.find((n) => n.id === id)!;
      recs.push({
        id,
        type: 'shape',
        position: { x: Math.round(pos.x - groupPos.x), y: Math.round(pos.y - groupPos.y) },
        parentId: groupId,
        width: node.width,
        height: node.height,
        data: node.data,
      });
    }
  }

  for (const node of flat) {
    if (childIds.has(node.id)) continue;
    const pos = posById.get(node.id) ?? { x: 0, y: 0 };
    recs.push({
      id: node.id,
      type: 'shape',
      position: { x: Math.round(pos.x), y: Math.round(pos.y) },
      width: node.width,
      height: node.height,
      data: node.data,
    });
  }

  const edgeRecs: FlowEdgeRec[] = edges.map((e, index) => ({
    id: createId('e'),
    source: e.source,
    target: e.target,
    label: e.label,
    style: normalizeEdgeStyle({ ...e.style, ...edgeStyleFromMermaid(linkStyles.get(index)) }),
  }));

  return { ok: true, doc: toDocV3(recs, edgeRecs) };
}

/* ------------------------------ Multi-page entry ------------------------------ */

interface MermaidSegment {
  /** Page name declared by a `%% page: <name>` comment (optional) */
  name?: string;
  body: string;
}

/** Split multi-page text by `flowchart` / `graph` headers; comment lines before the first header are ignored */
function splitMermaidSegments(text: string): MermaidSegment[] {
  const lines = text.split(/\r?\n/);
  const collected: Array<{ name?: string; lines: string[] }> = [];
  let current: { name?: string; lines: string[] } | null = null;
  let pendingName: string | undefined;
  for (const line of lines) {
    const trimmed = line.trim();
    const named = /^%%\s*page:\s*(.+)$/.exec(trimmed);
    if (named) {
      pendingName = named[1].trim();
      continue;
    }
    if (/^(?:flowchart|graph)\s+(?:TD|TB|BT|LR|RL)\b/.test(trimmed)) {
      current = { name: pendingName, lines: [line] };
      pendingName = undefined;
      collected.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  return collected.map((item) => ({ name: item.name, body: item.lines.join('\n') }));
}

/**
 * Parse Mermaid text into a document.
 *
 * A single page behaves as before; multiple `flowchart` / `graph` headers
 * (e.g. output of `toMermaid(doc, { pages: 'all' })`) are merged into a multi-page document.
 * Error line numbers are relative to their block, which is enough to locate the problem.
 */
export function parseMermaidFlowchart(text: string): MermaidParseResult {
  const segments = splitMermaidSegments(text);
  if (segments.length === 0) return { ok: false, error: 'MISSING_HEADER', line: 1 };

  const docs: FlowDoc[] = [];
  for (const segment of segments) {
    const result = parseMermaidPage(segment.body);
    if (!result.ok) return result;
    const doc = segment.name
      ? { ...result.doc, pages: result.doc.pages.map((p) => ({ ...p, name: segment.name! })) }
      : result.doc;
    docs.push(doc);
  }

  if (docs.length === 1) return { ok: true, doc: docs[0] };
  const pages = docs.flatMap((doc) => doc.pages);
  return { ok: true, doc: { version: 3, pages, activePageId: pages[0].id } };
}
