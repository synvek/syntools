/**
 * Mermaid flowchart 文本的双向转换。
 *
 * 导出：便于粘贴到 Markdown / 文档 / GitHub；只导出结构（节点文本与连线），样式无法表达。
 * 导入：自研轻量解析器（不引入 mermaid 运行时，避免 ~500KB gzip 依赖），
 *      覆盖 `flowchart` / `graph` 的常用子集：
 *        - 方向：TD / TB / BT / LR / RL
 *        - 节点：`id`、`id[文本]`、`id(圆角)`、`id([终止])`、`id((圆形))`、`id{判断}`、
 *                `id{{六边形}}`、`id[(数据库)]`、`id[[预定义]]`、`id[/数据/]`、`id>非对称]`
 *        - 连线：`-->` `---` `-.->` `-.-` `==>` `===` `--x` `--o`，标签 `|文本|` 或 `-- 文本 -->`
 *        - 容器：`subgraph 名称 ... end`（映射为编组容器）
 *      未识别指令（classDef / style / linkStyle / click 等）安全忽略。
 *      由于 Mermaid 不携带坐标，导入后必然经过一次 dagre 自动布局。
 */

import { createId, defaultData } from '../core';
import { layoutGraph } from '../layout';
import { activePageOf, toDocV2 } from '../model/migrate';
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

/* ------------------------------ 导出 ------------------------------ */

/** 去掉 Mermaid 语法敏感字符，避免生成非法脚本 */
function safe(text: string): string {
  return (
    text
      .replace(/[[\]{}()|"']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || ' '
  );
}

/** 形状 → Mermaid 文本包裹方式 */
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
      return `[[${text}]]`;
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

/** 节点样式 → classDef 声明体；只输出与形状默认值不同的属性，保持导出精简 */
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

/** 连线样式 → linkStyle 声明体；全默认时返回空串（不产生 linkStyle 行） */
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

/** 单页 → Mermaid flowchart 文本（结构 + 可在 Mermaid 中还原的样式） */
function pageMermaidOf(page: FlowPage): string {
  if (page.nodes.length === 0) return '';
  const lines: string[] = ['flowchart TD'];

  // 节点样式去重为 classDef：body 相同即复用同一 class
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

  // 连线 + linkStyle（索引即连线声明顺序）
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
  /** 'current' 仅活动页（默认）；'all' 全部页（多段 flowchart，段前以 `%% page:` 注释标注页名） */
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

/* ------------------------------ 导入 ------------------------------ */

export type MermaidParseResult =
  | { ok: true; doc: FlowDoc }
  | { ok: false; error: 'MISSING_HEADER' | 'EMPTY' | 'INVALID_STATEMENT'; line?: number };

/** 形状包裹语法 → 图形目录（顺序即优先级，先长后短、先复合后简单） */
const WRAPPERS: Array<[RegExp, ShapeKind]> = [
  [/^\(\(([\s\S]*)\)\)$/, 'ellipse'],
  [/^\(\[([\s\S]*)\]\)$/, 'startEnd'],
  [/^\{\{([\s\S]*)\}\}$/, 'hexagon'],
  [/^\[\(([\s\S]*)\)\]$/, 'database'],
  [/^\[\[([\s\S]*)\]\]$/, 'predefined'],
  [/^\[\/([\s\S]*)\/\]$/, 'data'],
  [/^\[\\\\([\s\S]*)\\\\]$/, 'data'],
  [/^\[([\s\S]*)\]$/, 'rect'],
  [/^\(([\s\S]*)\)$/, 'roundRect'],
  [/^\{(.*)\}$/, 'decision'],
  [/^>([\s\S]*)\]$/, 'card'],
];

/** 语句中可出现的连线标记（含可选 |标签|） */
const LINK_SPLIT = /\s*((?:-->|---|-\.->|-\.-|==>|===|--x|--o)\s*(?:\|[^|]*\|)?)\s*/;

/** 行内 `-- 文本 -->` / `-. 文本 .->` / `== 文本 ==>` 归一为 `-->|文本|` */
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
  for (const [re, kind] of WRAPPERS) {
    const hit = re.exec(rest);
    if (hit) return { id, kind, label: unquote(hit[1]) };
  }
  // 有残留但无法识别包裹语法：按纯 id 处理，避免整行失败
  return { id };
}

/** 连线标记 → 线样式 */
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

/** 需要忽略的 Mermaid 指令行（样式指令 classDef / class / style / linkStyle 另行解析） */
const IGNORED_DIRECTIVE = /^(?:click|direction|accTitle|accDescr)\b/;

/** `fill:#f00,stroke:#333` → Map（键统一小写） */
function parseMermaidStyle(body: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const token of body.split(',')) {
    const colon = token.indexOf(':');
    if (colon < 0) continue;
    map.set(token.slice(0, colon).trim().toLowerCase(), token.slice(colon + 1).trim());
  }
  return map;
}

/** 去掉 `px` 等单位的数值 */
function cssNum(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Mermaid 样式属性 → 节点样式（只取可表达的字段） */
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

/** Mermaid 样式属性 → 连线样式（只取可表达的字段） */
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
 * 解析单个 `flowchart` 段落（一个 header + 其后的语句）。
 * 失败时返回 `{ ok:false, error, line }`，由 UI 提示具体行号。
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
  // 样式指令：classDef 定义 / class 指派 / style 内联 / linkStyle 按连线序号
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
      // 后声明的形状/文案覆盖裸 id 声明
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
    // 样式指令：解析并暂存，稍后并入节点 / 连线样式（行尾分号可有可无）
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
      if (c % 2 === 1) continue; // 连线标记
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

  /* 1) 建扁平节点 → dagre 布局（Mermaid 无坐标，必须自动排版） */
  const flat: Array<{
    id: string;
    type: 'shape';
    position: { x: number; y: number };
    width: number;
    height: number;
    data: FlowNodeData;
  }> = [];
  /** 节点样式覆盖：class 指派 + style 内联（内联优先） */
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

  /* 2) subgraph → 编组容器（按成员包围盒生成，并把子节点坐标转为相对） */
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

  return { ok: true, doc: toDocV2(recs, edgeRecs) };
}

/* ------------------------------ 多页入口 ------------------------------ */

interface MermaidSegment {
  /** `%% page: <name>` 注释声明的页名（可选） */
  name?: string;
  body: string;
}

/** 按 `flowchart` / `graph` header 切分多页文本；header 之前的注释行忽略 */
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
 * 解析 Mermaid 文本为文档。
 *
 * 单页时与历史行为一致；出现多个 `flowchart` / `graph` header 时
 * （例如 `toMermaid(doc, { pages: 'all' })` 的导出结果）合并为多页文档。
 * 错误行号为所在段落的相对行号，足以定位问题。
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
  return { ok: true, doc: { version: 2, pages, activePageId: pages[0].id } };
}
