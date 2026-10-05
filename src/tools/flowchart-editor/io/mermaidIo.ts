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
import type {
  EdgeArrow,
  EdgeDash,
  FlowDoc,
  FlowEdgeRec,
  FlowEdgeStyle,
  FlowNodeData,
  FlowNodeRec,
  ShapeKind,
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

export function toMermaid(doc: FlowDoc): string {
  const page = activePageOf(doc);
  if (!page || page.nodes.length === 0) return '';

  const lines = ['flowchart TD'];
  for (const node of page.nodes) {
    lines.push(`  ${node.id}${bodyOf(node.data.kind, node.data.label)}`);
  }
  for (const edge of page.edges) {
    const label = edge.label ? safe(edge.label) : '';
    const arrow = label ? `-->|${label}|` : '-->';
    lines.push(`  ${edge.source} ${arrow} ${edge.target}`);
  }
  return `${lines.join('\n')}\n`;
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

/** 需要忽略的 Mermaid 指令行 */
const IGNORED_DIRECTIVE = /^(?:classDef|class|style|linkStyle|click|direction|accTitle|accDescr)\b/;

/**
 * 解析 Mermaid flowchart 文本。
 * 失败时返回 `{ ok:false, error, line }`，由 UI 提示具体行号。
 */
export function parseMermaidFlowchart(text: string): MermaidParseResult {
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
  for (const [id, def] of nodeDefs) {
    const kind: ShapeKind = def.kind ?? 'rect';
    const size = shapeSize(kind);
    flat.push({
      id,
      type: 'shape',
      position: { x: 0, y: 0 },
      width: size.width,
      height: size.height,
      data: defaultData(kind, def.label ?? ''),
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

  const edgeRecs: FlowEdgeRec[] = edges.map((e) => ({
    id: createId('e'),
    source: e.source,
    target: e.target,
    label: e.label,
    style: normalizeEdgeStyle(e.style),
  }));

  return { ok: true, doc: toDocV2(recs, edgeRecs) };
}
