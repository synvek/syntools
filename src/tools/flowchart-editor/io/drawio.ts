/**
 * Draw.io（.drawio / mxGraphModel XML）导入导出。
 * 复用已安装的 fast-xml-parser，零新增依赖即可与 Draw.io 互通。
 *
 * 往返能力：
 * - **多页**：`<mxfile>` 下的每个 `<diagram>` 都是一个页面，导入/导出都完整保留。
 * - **样式映射**：填充色 / 描边色 / 描边宽度 / 字号 / 文字色 / 对齐 / 圆角 / 虚线 / 透明度 / 阴影，
 *   连线线型 / 线性 / 起止箭头 / 折点。
 * - **无损兜底**：未识别的 mxGraph 样式 token 存入 `mxStyle`，导出时原样回写，减少往返丢失。
 * - **HTML 标签**：`html=1` 的 `<br>` / `<div>` 换行与实体在导入时还原为纯文本，导出时再转回。
 * - **压缩文件**：`<diagram>` 文本为 base64+deflate 的压缩形式由 `parseDrawioXmlAsync` 解码。
 */

import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { defaultData } from '../core';
import { normalizeEdgeStyle } from '../ops';
import { createPage, toDocV2 } from '../model/migrate';
import { shapeSize } from '../model/shapes';
import type {
  Align,
  EdgeArrow,
  EdgeDash,
  EdgeType,
  FlowDoc,
  FlowEdgeRec,
  FlowEdgeStyle,
  FlowNodeRec,
  FlowNodeStyle,
  FlowPage,
  ShapeKind,
  Waypoint,
} from '../model/types';

const PARSER = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const BUILDER = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  suppressEmptyNode: true,
});

/** XML 解析后的宽松结构 */
type XmlNode = Record<string, unknown>;

/** 已知的 mxGraph 样式键（其余 token 作为 `mxStyle` 原样保留） */
const KNOWN_STYLE_KEYS = new Set([
  'rounded',
  'whiteSpace',
  'html',
  'fillColor',
  'strokeColor',
  'strokeWidth',
  'fontSize',
  'fontColor',
  'align',
  'verticalAlign',
  'opacity',
  'shadow',
  'dashed',
  'dashPattern',
  'arcSize',
  'edgeStyle',
  'elbow',
  'curved',
  'startArrow',
  'startFill',
  'startSize',
  'endArrow',
  'endFill',
  'endSize',
  'jettySize',
  'orthogonalLoop',
  'horizontal',
  'shape',
]);

function attr(cell: XmlNode, key: string): string | undefined {
  const v = cell[key];
  return v === undefined || v === null ? undefined : String(v);
}

function geoNum(cell: XmlNode, key: string, fallback: number): number {
  const geo = cell.mxGeometry;
  if (!geo || typeof geo !== 'object') return fallback;
  const n = Number((geo as XmlNode)[key]);
  return Number.isFinite(n) ? n : fallback;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Draw.io 的 `html=1` 标签（HTML 片段）→ 纯文本。
 * 行内换行与块级边界转 \n，其余成对标签剥离，常见实体解码；
 * 仅匹配「像标签」的片段（`<` 后跟字母或 `/`），孤立的 `<` `>` 原样保留。
 */
export function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:div|p|li|tr)[^>]*>/gi, '\n')
    .replace(/<[a-zA-Z/][^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/\n{2,}/g, '\n')
    .replace(/^\n+|\n+$/g, '');
}

/** 纯文本标签 → Draw.io `html=1` 值（换行转 `<br>`；XML 实体转义交给 XMLBuilder） */
export function toMxHtmlLabel(label: string): string {
  return label.replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
}

/** 读取 cell 的显示文本：`html=1` 时按 HTML 解析回纯文本 */
function labelOf(cell: XmlNode, rawStyle: string | undefined): string {
  const raw = attr(cell, '@_value') ?? '';
  if (!raw) return '';
  return parseStyleMap(rawStyle).map.get('html') === '1' ? htmlToPlain(raw) : raw;
}

/** `k=v;k2=v2;bare;` → Map；键统一小写以便比较 */
function parseStyleMap(style: string | undefined): {
  map: Map<string, string>;
  bare: string[];
  unknown: string[];
} {
  const map = new Map<string, string>();
  const bare: string[] = [];
  const unknown: string[] = [];
  if (!style) return { map, bare, unknown };
  for (const token of style.split(';')) {
    const t = token.trim();
    if (!t) continue;
    const eq = t.indexOf('=');
    if (eq < 0) {
      bare.push(t.toLowerCase());
      continue;
    }
    const key = t.slice(0, eq).trim();
    map.set(key, t.slice(eq + 1).trim());
    if (!KNOWN_STYLE_KEYS.has(key)) unknown.push(t);
  }
  return { map, bare, unknown };
}

/* ------------------------------ 形状映射 ------------------------------ */

/** 形状 → mxGraph 基础样式 token（不含颜色等通用样式） */
function shapeTokenOf(kind: ShapeKind): string {
  switch (kind) {
    case 'decision':
      return 'rhombus';
    case 'ellipse':
    case 'startEnd':
    case 'terminator':
      return 'ellipse';
    case 'data':
      return 'parallelogram';
    case 'trapezoid':
      return 'trapezoid';
    case 'hexagon':
      return 'shape=hexagon';
    case 'triangle':
      return 'triangle';
    case 'star':
      return 'shape=star';
    case 'cloud':
    case 'netCloud':
      return 'shape=cloud';
    case 'note':
    case 'umlNote':
      return 'shape=note';
    case 'callout':
      return 'shape=callout';
    case 'card':
      return 'shape=card';
    case 'database':
    case 'netDatabase':
      return 'shape=cylinder';
    case 'document':
      return 'shape=document';
    case 'predefined':
      return 'shape=process';
    case 'manualInput':
      return 'shape=manualInput';
    case 'manualOperation':
      return 'shape=trapezoid;direction=north';
    case 'preparation':
      return 'shape=hexagon';
    case 'display':
      return 'shape=display';
    case 'onPageConnector':
      return 'ellipse';
    case 'offPageConnector':
      return 'shape=offPageConnector';
    case 'parallelMode':
      return 'shape=parallelMarker';
    case 'loopLimit':
      return 'shape=loopLimit';
    case 'umlActor':
      return 'shape=umlActor';
    case 'umlUseCase':
      return 'ellipse';
    case 'umlPackage':
      return 'shape=folder';
    case 'umlState':
    case 'umlActivity':
    case 'umlAction':
    case 'umlSendSignal':
    case 'umlReceiveSignal':
      return 'rounded=1';
    case 'umlComponent':
    case 'umlSubsystem':
      return 'shape=component';
    case 'umlNode':
    case 'umlDevice':
    case 'umlExecutionEnvironment':
      return 'shape=cube';
    case 'umlArtifact':
      return 'shape=note';
    case 'umlDecisionMerge':
    case 'umlChoice':
      return 'rhombus';
    case 'umlStateInitial':
    case 'umlStateFinal':
    case 'umlInitialNode':
    case 'umlActivityFinal':
    case 'umlFlowFinal':
    case 'umlJunction':
    case 'umlEntryPoint':
    case 'umlExitPoint':
    case 'umlHistory':
    case 'umlHistoryDeep':
    case 'umlBoundary':
    case 'umlControl':
    case 'umlEntity':
    case 'umlProvidedInterface':
    case 'umlRequiredInterface':
      return 'ellipse';
    case 'bpmnEventStart':
    case 'bpmnEventIntermediate':
    case 'bpmnEventEnd':
      return 'ellipse';
    case 'bpmnGatewayExclusive':
      return 'rhombus';
    case 'bpmnGatewayParallel':
      return 'rhombus';
    case 'bpmnGatewayInclusive':
      return 'rhombus';
    case 'bpmnTask':
      return 'rounded=1';
    case 'bpmnSubProcess':
      return 'rounded=1';
    case 'netServer':
      return 'shape=server';
    case 'netClient':
      return 'shape=desktop';
    case 'netRouter':
      return 'shape=mxgraph.networks.router';
    case 'netSwitch':
      return 'shape=mxgraph.networks.switch';
    case 'netFirewall':
      return 'shape=mxgraph.networks.firewall';
    case 'netLoadBalancer':
      return 'shape=mxgraph.networks.load_balancer';
    case 'netCdn':
      return 'cloud';
    case 'netStorage':
      return 'shape=cylinder';
    case 'mindCenter':
      return 'ellipse';
    case 'erEntity':
      return 'rounded=0';
    case 'erAttribute':
      return 'ellipse';
    case 'erRelationship':
      return 'rhombus';
    case 'roundRect':
      return 'rounded=1';
    case 'swimlane':
      return 'swimlane';
    case 'swimlaneV':
      return 'swimlane;horizontal=0';
    case 'group':
      return 'group';
    default:
      return 'rounded=0';
  }
}

/** mxGraph style → 形状（无法识别时按矩形处理） */
export function kindOfStyle(style: string | undefined): ShapeKind {
  if (!style) return 'rect';
  const s = style.toLowerCase();
  if (s.includes('swimlane')) {
    return s.includes('horizontal=0') ? 'swimlaneV' : 'swimlane';
  }
  if (s.includes('group')) return 'group';
  if (s.includes('umlactor')) return 'umlActor';
  if (s.includes('mxgraph.networks.router')) return 'netRouter';
  if (s.includes('mxgraph.networks.switch')) return 'netSwitch';
  if (s.includes('mxgraph.networks.firewall')) return 'netFirewall';
  if (s.includes('mxgraph.networks.load_balancer')) return 'netLoadBalancer';
  if (s.includes('shape=server')) return 'netServer';
  if (s.includes('shape=desktop')) return 'netClient';
  if (s.includes('shape=folder')) return 'umlPackage';
  if (s.includes('shape=component')) return 'umlComponent';
  if (s.includes('shape=cube')) return 'umlNode';
  if (s.includes('rhombus')) return 'decision';
  if (s.includes('ellipse')) return 'startEnd';
  if (s.includes('cylinder')) return 'database';
  if (s.includes('document')) return 'document';
  if (s.includes('parallelogram')) return 'data';
  if (s.includes('triangle')) return 'triangle';
  if (s.includes('hexagon')) return 'hexagon';
  if (s.includes('star')) return 'star';
  if (s.includes('cloud')) return 'cloud';
  if (s.includes('note')) return 'note';
  if (s.includes('trapezoid')) return 'trapezoid';
  if (s.includes('card')) return 'card';
  if (s.includes('callout')) return 'callout';
  if (s.includes('shape=process')) return 'predefined';
  if (s.includes('shape=display')) return 'display';
  if (s.includes('rounded=1')) return 'roundRect';
  return 'rect';
}

/* ------------------------------ 样式映射 ------------------------------ */

const ALIGN_TO_MX: Record<Align, string> = { left: 'left', center: 'center', right: 'right' };
const MX_TO_ALIGN: Record<string, Align> = { left: 'left', center: 'center', right: 'right' };

/** 形状 + 样式 → mxGraph style（保留填充/描边/线型/字号/透明度/圆角/阴影） */
function styleOf(kind: ShapeKind, style?: Partial<FlowNodeStyle>, extra: string[] = []): string {
  const parts = [shapeTokenOf(kind), 'whiteSpace=wrap', 'html=1'];
  if (style?.fill) parts.push(`fillColor=${style.fill}`);
  if (style?.stroke) parts.push(`strokeColor=${style.stroke}`);
  if (style?.strokeWidth !== undefined) parts.push(`strokeWidth=${style.strokeWidth}`);
  if (style?.lineDash === 'dashed') parts.push('dashed=1');
  if (style?.lineDash === 'dotted') parts.push('dashed=1;dashPattern=1 1');
  if (style?.fontSize !== undefined) parts.push(`fontSize=${style.fontSize}`);
  if (style?.textColor) parts.push(`fontColor=${style.textColor}`);
  if (style?.align) parts.push(`align=${ALIGN_TO_MX[style.align]}`);
  if (style?.opacity !== undefined && style.opacity < 1) {
    parts.push(`opacity=${Math.round(style.opacity * 100)}`);
  }
  if (style?.shadow) parts.push('shadow=1');
  if (style?.bold) parts.push('fontStyle=1');
  if (style?.italic) parts.push('fontStyle=2');
  if ((kind === 'roundRect' || kind === 'rect') && style?.cornerRadius !== undefined) {
    parts.push('rounded=1');
    parts.push(`arcSize=${Math.round((style.cornerRadius / 2) * 100) / 100}`);
  }
  parts.push(...extra);
  return `${parts.filter(Boolean).join(';')};`;
}

/** mxGraph style → 节点样式（只写与默认不同的字段） */
function nodeStyleFromMx(style: string | undefined): {
  style: Partial<FlowNodeStyle>;
  mxStyle: string[];
} {
  const { map, unknown } = parseStyleMap(style);
  const out: Partial<FlowNodeStyle> = {};
  const fill = map.get('fillColor');
  if (fill && fill !== 'none') out.fill = fill;
  const stroke = map.get('strokeColor');
  if (stroke && stroke !== 'none') out.stroke = stroke;
  const sw = Number(map.get('strokeWidth'));
  if (Number.isFinite(sw) && map.has('strokeWidth')) out.strokeWidth = sw;
  const fontSize = Number(map.get('fontSize'));
  if (Number.isFinite(fontSize) && fontSize > 0) out.fontSize = fontSize;
  const fontColor = map.get('fontColor');
  if (fontColor) out.textColor = fontColor;
  const align = map.get('align');
  if (align && MX_TO_ALIGN[align]) out.align = MX_TO_ALIGN[align];
  const opacity = Number(map.get('opacity'));
  if (Number.isFinite(opacity) && opacity > 0 && opacity < 100) out.opacity = opacity / 100;
  if (map.get('shadow') === '1') out.shadow = true;
  const fontStyle = Number(map.get('fontStyle'));
  if (Number.isFinite(fontStyle) && fontStyle > 0) {
    if (fontStyle === 1 || fontStyle === 3) out.bold = true;
    if (fontStyle === 2 || fontStyle === 3) out.italic = true;
  }
  const dashed = map.get('dashed') === '1';
  if (dashed) {
    out.lineDash = map.get('dashPattern') === '1 1' ? 'dotted' : 'dashed';
  }
  return { style: out, mxStyle: unknown };
}

const EDGE_STYLE_TOKEN: Record<EdgeType, string> = {
  straight: 'edgeStyle=none',
  smoothstep: 'edgeStyle=orthogonalEdgeStyle;rounded=1',
  step: 'edgeStyle=orthogonalEdgeStyle;rounded=0',
  bezier: 'curved=1',
};

const ARROW_TO_MX: Record<EdgeArrow, string | null> = {
  none: 'none',
  arrowclosed: 'classic',
  arrow: 'open',
  circle: 'oval',
  diamond: 'diamond',
  diamondHollow: 'diamond',
  triangle: 'block',
  square: 'box',
  bar: 'line',
};

/** 空心箭头（泛化 / 实现 / 聚合）：mxGraph 端以 fill=0 表达 */
function isHollowArrow(kind: EdgeArrow): boolean {
  return kind === 'arrow' || kind === 'triangle' || kind === 'diamondHollow';
}

/** 连线样式 → mxGraph style */
function edgeStyleOf(style: FlowEdgeStyle | undefined, extra: string[] = []): string {
  const s = normalizeEdgeStyle(style);
  const parts = [EDGE_STYLE_TOKEN[s.type], 'html=1'];
  if (s.dash === 'dashed' || s.dash === 'sketchDashed') parts.push('dashed=1');
  else if (s.dash === 'dotted') parts.push('dashed=1;dashPattern=1 1');
  else if (s.dash === 'dashdot') parts.push('dashed=1;dashPattern=4 2 1 2');
  if (s.stroke) parts.push(`strokeColor=${s.stroke}`);
  parts.push(`strokeWidth=${s.strokeWidth}`);
  const startToken = ARROW_TO_MX[s.startArrow];
  parts.push(`startArrow=${startToken ?? 'none'}`);
  parts.push(`startFill=${isHollowArrow(s.startArrow) ? 0 : 1}`);
  const endToken = ARROW_TO_MX[s.endArrow];
  parts.push(`endArrow=${endToken ?? 'none'}`);
  parts.push(`endFill=${isHollowArrow(s.endArrow) ? 0 : 1}`);
  parts.push(...extra);
  return `${parts.join(';')};`;
}

/** mxGraph edge style → 连线样式（含未识别 token） */
function edgeStyleFromMx(rawStyle: string | undefined): {
  style: FlowEdgeStyle;
  mxStyle: string[];
  rounded: boolean;
} {
  const { map, unknown } = parseStyleMap(rawStyle);
  const edgeToken = (map.get('edgeStyle') ?? '').toLowerCase();
  const rounded = map.get('rounded') !== '0';
  let type: EdgeType = 'smoothstep';
  if (map.get('curved') === '1') type = 'bezier';
  else if (edgeToken.includes('orthogonaledge')) type = rounded ? 'smoothstep' : 'step';
  else if (edgeToken.includes('elbow')) type = 'step';
  else if (edgeToken.includes('entityrelation')) type = 'straight';
  else if (edgeToken === 'none') type = 'straight';

  const dashed = map.get('dashed') === '1';
  const pattern = map.get('dashPattern');
  let dash: EdgeDash = 'solid';
  if (dashed) {
    if (pattern === '1 1') dash = 'dotted';
    else if (pattern && pattern.split(/\s+/).length >= 4) dash = 'dashdot';
    else dash = 'dashed';
  }

  const arrowOf = (token: string | undefined, filled: boolean | undefined): EdgeArrow => {
    const t = (token ?? '').toLowerCase();
    if (!t || t === 'none') return 'none';
    if (t.startsWith('open')) return 'arrow';
    if (t.startsWith('oval') || t.startsWith('ellipse')) return 'circle';
    if (t.startsWith('diamond')) return filled === false ? 'diamondHollow' : 'diamond';
    if (t.startsWith('box')) return 'square';
    if (t.startsWith('line') || t.startsWith('dash') || t.startsWith('async')) return 'bar';
    if (t.startsWith('block')) return filled === false ? 'triangle' : 'arrowclosed';
    if (t.startsWith('classic')) return filled === false ? 'arrow' : 'arrowclosed';
    return 'arrowclosed';
  };

  const style: FlowEdgeStyle = {
    type,
    stroke: map.get('strokeColor') || '#475569',
    strokeWidth: Number(map.get('strokeWidth')) || 2,
    dash,
    startArrow: arrowOf(map.get('startArrow'), map.get('startFill') !== '0'),
    endArrow: arrowOf(map.get('endArrow'), map.get('endFill') !== '0'),
  };
  return { style: normalizeEdgeStyle(style), mxStyle: unknown, rounded };
}

/* ------------------------------ 导出 ------------------------------ */

function pointsOf(mxGeometry: unknown): Waypoint[] {
  if (!mxGeometry || typeof mxGeometry !== 'object') return [];
  const arr = (mxGeometry as XmlNode).Array;
  if (!arr || typeof arr !== 'object') return [];
  const pts = asArray((arr as XmlNode).mxPoint as XmlNode | XmlNode[] | undefined);
  const out: Waypoint[] = [];
  for (const p of pts) {
    const x = Number(attr(p, '@_x'));
    const y = Number(attr(p, '@_y'));
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
  }
  return out;
}

function pageToCells(page: FlowPage): XmlNode[] {
  const cells: XmlNode[] = [{ '@_id': '0' }, { '@_id': '1', '@_parent': '0' }];

  for (const n of page.nodes) {
    const def = shapeSize(n.data.kind);
    cells.push({
      '@_id': n.id,
      '@_value': toMxHtmlLabel(n.data.label),
      '@_style': styleOf(n.data.kind, n.data.style, n.mxStyle ?? []),
      '@_vertex': '1',
      '@_parent': n.parentId ?? '1',
      mxGeometry: {
        '@_x': Math.round(n.position.x),
        '@_y': Math.round(n.position.y),
        '@_width': Math.round(n.width ?? def.width),
        '@_height': Math.round(n.height ?? def.height),
        '@_as': 'geometry',
      },
    });
  }

  for (const e of page.edges) {
    const cell: XmlNode = {
      '@_id': e.id,
      '@_edge': '1',
      '@_parent': '1',
      '@_source': e.source,
      '@_target': e.target,
      '@_style': edgeStyleOf(e.style, e.mxStyle ?? []),
      mxGeometry: {
        '@_relative': '1',
        '@_as': 'geometry',
        ...(e.waypoints && e.waypoints.length > 0
          ? {
              Array: {
                '@_as': 'points',
                mxPoint: e.waypoints.map((p) => ({ '@_x': p.x, '@_y': p.y })),
              },
            }
          : {}),
      },
    };
    if (e.label) cell['@_value'] = toMxHtmlLabel(e.label);
    cells.push(cell);
  }
  return cells;
}

export function toDrawioXml(doc: FlowDoc): string {
  if (doc.pages.length === 0) return '';
  const diagrams = doc.pages.map((page) => ({
    '@_name': page.name,
    '@_id': page.id,
    mxGraphModel: {
      '@_dx': '0',
      '@_dy': '0',
      '@_grid': '1',
      '@_page': '1',
      root: { mxCell: pageToCells(page) },
    },
  }));

  return BUILDER.build({
    mxfile: {
      '@_host': 'syntools',
      '@_type': 'device',
      diagram: diagrams,
    },
  }) as string;
}

/* ------------------------------ 导入 ------------------------------ */

type ParsedCell = XmlNode;

function cellsOfDiagram(diagram: XmlNode): ParsedCell[] {
  // 未压缩形式：mxGraphModel 是 diagram 的子节点。
  // 压缩形式（mxGraphModel 藏于文本、base64+deflate）走 `parseDrawioXmlAsync` 预处理后再进来。
  const model = diagram.mxGraphModel as XmlNode | undefined;
  const root = model?.root as XmlNode | undefined;
  return asArray(root?.mxCell as XmlNode | XmlNode[] | undefined);
}

function buildPage(diagram: XmlNode, index: number): FlowPage {
  const cells = cellsOfDiagram(diagram);
  const nodes: FlowNodeRec[] = [];
  const edges: FlowEdgeRec[] = [];

  for (const cell of cells) {
    const id = attr(cell, '@_id');
    if (!id || id === '0' || id === '1') continue;
    if (attr(cell, '@_vertex') === '1') {
      const rawStyle = attr(cell, '@_style');
      const kind = kindOfStyle(rawStyle);
      const def = shapeSize(kind);
      const parent = attr(cell, '@_parent');
      const { style: nodeStyle, mxStyle: nodeMxStyle } = nodeStyleFromMx(rawStyle);
      nodes.push({
        id,
        type: 'shape',
        position: { x: geoNum(cell, '@_x', 0), y: geoNum(cell, '@_y', 0) },
        parentId: parent && parent !== '1' ? parent : null,
        width: geoNum(cell, '@_width', def.width),
        height: geoNum(cell, '@_height', def.height),
        ...(nodeMxStyle.length > 0 ? { mxStyle: nodeMxStyle } : {}),
        data: {
          ...defaultData(kind, labelOf(cell, rawStyle)),
          style: { ...defaultData(kind).style, ...nodeStyle },
        },
      });
    } else if (attr(cell, '@_edge') === '1') {
      const source = attr(cell, '@_source');
      const target = attr(cell, '@_target');
      if (!source || !target) continue;
      const rawStyle = attr(cell, '@_style');
      const { style: edgeStyle, mxStyle: edgeMxStyle } = edgeStyleFromMx(rawStyle);
      const waypoints = pointsOf(cell.mxGeometry);
      edges.push({
        id,
        source,
        target,
        label: labelOf(cell, rawStyle) || undefined,
        style: edgeStyle,
        ...(waypoints.length > 0 ? { waypoints } : {}),
        ...(edgeMxStyle.length > 0 ? { mxStyle: edgeMxStyle } : {}),
      });
    }
  }

  const name = attr(diagram, '@_name') || `Page ${index + 1}`;
  const id = attr(diagram, '@_id');
  const page = createPage(name, id);
  return { ...page, nodes, edges };
}

/** 解析 .drawio XML → FlowDoc（多页）；失败或无法识别时返回 null */
export function parseDrawioXml(xml: string): FlowDoc | null {
  try {
    const parsed = PARSER.parse(xml) as XmlNode | undefined;
    const mxfile = parsed?.mxfile as XmlNode | undefined;
    const diagrams = asArray(mxfile?.diagram as XmlNode | XmlNode[] | undefined);
    if (diagrams.length === 0) return null;

    const pages = diagrams.map((d, i) => buildPage(d, i)).filter((p) => p.nodes.length > 0);
    if (pages.length === 0) return null;
    if (pages.length === 1) {
      const only = pages[0];
      return toDocV2(only.nodes, only.edges, only.name);
    }
    return { version: 2, pages, activePageId: pages[0].id };
  } catch {
    return null;
  }
}

/* ------------------------------ 压缩形式导入 ------------------------------ */

/** 解压原始 deflate 字节：优先原生 DecompressionStream，缺失/失败时回退 pako（动态加载） */
async function inflateRawBytes(bytes: Uint8Array): Promise<string | null> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream })
    .DecompressionStream;
  if (typeof DS === 'function' && typeof Response === 'function') {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DS('deflate-raw'));
      return await new Response(stream).text();
    } catch {
      // 落到 pako
    }
  }
  try {
    const { inflateRaw } = await import('pako');
    const out = inflateRaw(bytes);
    // pako v3 的 to:'string' 已不再生效，统一用 TextDecoder 解码
    return typeof out === 'string' ? out : new TextDecoder().decode(out);
  } catch {
    return null;
  }
}

/**
 * 解压压缩形式的 `<diagram>` 文本。
 * Draw.io 的压缩格式为 `base64(deflateRaw(encodeURIComponent(xml)))`。
 */
async function inflateDiagramText(encoded: string): Promise<string | null> {
  try {
    const binary = atob(encoded.replace(/\s+/g, ''));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const xml = await inflateRawBytes(bytes);
    return xml === null ? null : decodeURIComponent(xml);
  } catch {
    return null;
  }
}

/**
 * 解析 .drawio XML（支持未压缩与压缩两种形式）。
 *
 * 优先直接解析；若失败则按压缩形式处理：逐个解压 `<diagram>` 文本、
 * 重新拼成未压缩 XML 后再复用同步解析器。
 * 解压依赖仅在需要时动态加载（原生 DecompressionStream 优先，pako 兜底），
 * 避免把解析依赖并入工具主 chunk。
 */
export async function parseDrawioXmlAsync(xml: string): Promise<FlowDoc | null> {
  const direct = parseDrawioXml(xml);
  if (direct) return direct;

  try {
    const parsed = PARSER.parse(xml) as XmlNode | undefined;
    const mxfile = parsed?.mxfile as XmlNode | undefined;
    const diagrams = asArray(mxfile?.diagram as XmlNode | XmlNode[] | undefined);
    if (diagrams.length === 0) return null;

    const rebuilt: XmlNode[] = [];
    for (const diagram of diagrams) {
      const text = diagram['#text'];
      if (typeof text !== 'string' || !text.trim()) return null;
      const inner = await inflateDiagramText(text);
      if (!inner) return null;
      const innerParsed = PARSER.parse(inner) as XmlNode | undefined;
      const model = innerParsed?.mxGraphModel as XmlNode | undefined;
      if (!model) return null;
      rebuilt.push({
        ...(attr(diagram, '@_name') !== undefined ? { '@_name': attr(diagram, '@_name') } : {}),
        ...(attr(diagram, '@_id') !== undefined ? { '@_id': attr(diagram, '@_id') } : {}),
        mxGraphModel: model,
      });
    }
    return parseDrawioXml(BUILDER.build({ mxfile: { diagram: rebuilt } }) as string);
  } catch {
    return null;
  }
}
