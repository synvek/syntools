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
import { normalizeRotation } from '../core';
import { createPage, toDocV3 } from '../model/migrate';
import { SHAPE_DEFS, adjustsFor, paramValue, shapeSize } from '../model/shapes';
import { normalizeTable } from '../model/table';
import type {
  Align,
  EdgeArrow,
  EdgeDash,
  EdgeLabelPosition,
  EdgeType,
  FlowDoc,
  FlowEdgeRec,
  FlowEdgeStyle,
  FlowNodeRec,
  FlowNodeStyle,
  FlowPage,
  ShapeKind,
  TableData,
  VerticalAlign,
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
  // 跳线：draw.io 使用 jumpStyle / jumpSize
  'jumpStyle',
  'jumpSize',
  'horizontal',
  'shape',
  // 节点镜像：由 FlowNodeStyle.flipH/flipV 承载，纳入已知键避免与 mxStyle 重复回写
  'flipH',
  'flipV',
  // 起止标签 / 标签位置：mxGraph 无对应概念，用自定义 token 承载
  'synSourceLabel',
  'synTargetLabel',
  'synLabelPos',
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

/** 取整到 2 位小数：旋转角度导出用，避免浮点尾数污染 XML */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
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

/** 大小写不敏感地取 style 值（不同工具写出的键名大小写可能不一致） */
function mapGetCI(map: Map<string, string>, key: string): string | undefined {
  const direct = map.get(key);
  if (direct !== undefined) return direct;
  const lower = key.toLowerCase();
  for (const [k, v] of map) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

/** 起止标签 / 标签位置的自定义 token 键 */
const SYN_SOURCE_LABEL = 'synSourceLabel';
const SYN_TARGET_LABEL = 'synTargetLabel';
const SYN_LABEL_POS = 'synLabelPos';

/** 表格节点的自定义 token 键：值做 URL 编码后可安全放在样式串中 */
const SYN_TABLE = 'synTable';

/** 表格节点 → mxGraph 样式 token（整表数据 URL 编码，drawio 打开时忽略即可） */
function tableTokenOf(table: TableData | undefined): string {
  return `${SYN_TABLE}=${encodeURIComponent(JSON.stringify(normalizeTable(table)))}`;
}

/** 从 mxGraph 样式串中还原表格数据（无该 token 时返回 undefined） */
function tableFromStyle(rawStyle: string | undefined): TableData | undefined {
  if (!rawStyle) return undefined;
  const eq = rawStyle.search(new RegExp(`${SYN_TABLE}=`, 'i'));
  if (eq < 0) return undefined;
  const from = rawStyle.indexOf('=', eq) + 1;
  const end = rawStyle.indexOf(';', from);
  const raw = rawStyle.slice(from, end < 0 ? undefined : end);
  try {
    return normalizeTable(JSON.parse(decodeURIComponent(raw)) as TableData);
  } catch {
    return undefined;
  }
}

/** 连线记录 → 自定义标签 token（值做 URL 编码，避免 `;` / `=` 破坏样式串） */
function edgeLabelTokens(e: FlowEdgeRec): string[] {
  const parts: string[] = [];
  if (e.sourceLabel) parts.push(`${SYN_SOURCE_LABEL}=${encodeURIComponent(e.sourceLabel)}`);
  if (e.targetLabel) parts.push(`${SYN_TARGET_LABEL}=${encodeURIComponent(e.targetLabel)}`);
  if (e.labelPosition && e.labelPosition !== 'center') {
    parts.push(`${SYN_LABEL_POS}=${e.labelPosition}`);
  }
  return parts;
}

/** 从 mxGraph style 还原起止标签与标签位置，并给出应从 mxStyle 兜底中剔除的键 */
function edgeLabelsFromMx(style: string | undefined): {
  sourceLabel?: string;
  targetLabel?: string;
  labelPosition?: EdgeLabelPosition;
  consumed: Set<string>;
} {
  const { map } = parseStyleMap(style);
  const consumed = new Set<string>();
  const out: {
    sourceLabel?: string;
    targetLabel?: string;
    labelPosition?: EdgeLabelPosition;
    consumed: Set<string>;
  } = { consumed };
  const decode = (raw: string | undefined): string | undefined => {
    if (!raw) return undefined;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  };
  const src = mapGetCI(map, SYN_SOURCE_LABEL);
  if (src !== undefined) {
    consumed.add(SYN_SOURCE_LABEL);
    const value = decode(src);
    if (value) out.sourceLabel = value;
  }
  const tgt = mapGetCI(map, SYN_TARGET_LABEL);
  if (tgt !== undefined) {
    consumed.add(SYN_TARGET_LABEL);
    const value = decode(tgt);
    if (value) out.targetLabel = value;
  }
  const pos = mapGetCI(map, SYN_LABEL_POS);
  if (pos !== undefined) {
    consumed.add(SYN_LABEL_POS);
    if (pos === 'nearSource' || pos === 'nearTarget') out.labelPosition = pos;
  }
  return out;
}

/** 从 mxStyle 兜底列表中剔除已语义化的 token */
function dropConsumedTokens(tokens: string[], consumed: Set<string>): string[] {
  if (consumed.size === 0) return tokens;
  const lower = new Set([...consumed].map((k) => k.toLowerCase()));
  return tokens.filter((t) => {
    const eq = t.indexOf('=');
    const key = (eq < 0 ? t : t.slice(0, eq)).trim().toLowerCase();
    return !lower.has(key);
  });
}

/* ------------------------------ 形状映射 ------------------------------ */

/**
 * draw.io 原生 token → 图形：仅登记「往返无歧义」的映射。
 *
 * 未登记（含 draw.io 无对应、或被其它 token 遮蔽）的图形统一走 `shape=syntools.<kind>`，
 * 由 `kindOfStyle` 反向精确还原。这样既最大化 draw.io 可读性，又保证本工具往返不丢形状
 * （不变量由 `io.test.ts` 的全量往返测试守护）。
 */
const DRAWIO_TOKEN: Partial<Record<ShapeKind, string>> = {
  roundRect: 'rounded=1',
  rect: 'rounded=0',
  decision: 'rhombus',
  data: 'parallelogram',
  display: 'shape=invParallelogram',
  document: 'document',
  predefined: 'shape=process',
  database: 'cylinder',
  note: 'note',
  star: 'star',
  cloud: 'cloud',
  card: 'card',
  callout: 'callout',
  triangle: 'triangle',
  hexagon: 'hexagon',
  ellipse: 'ellipse',
  umlActor: 'shape=umlActor',
  umlPackage: 'shape=folder',
  umlComponent: 'shape=component',
  swimlane: 'swimlane',
  swimlaneV: 'swimlane;horizontal=0',
  group: 'group',
  netServer: 'shape=server',
  netClient: 'shape=desktop',
  netRouter: 'shape=mxgraph.networks.router',
  netSwitch: 'shape=mxgraph.networks.switch',
  netFirewall: 'shape=mxgraph.networks.firewall',
  netLoadBalancer: 'shape=mxgraph.networks.load_balancer',
};

/** 形状 → mxGraph 基础样式 token（不含颜色等通用样式） */
function shapeTokenOf(kind: ShapeKind): string {
  return DRAWIO_TOKEN[kind] ?? exactTokenOf(kind);
}

/**
 * 精确形状 token 前缀。
 *
 * draw.io 没有覆盖本工具全部 84 个图形（尤其 UML 2.5 细分图形），
 * 且部分 draw.io 原生 token 之间互相歧义（如 `ellipse` 同时被椭圆与开始/结束使用）。
 * 因此对「无对应 / 有歧义」的图形，统一写出 `shape=syntools.<kind>`：
 * - 本工具往返 100% 精确（见 io.test 的往返不变量测试）；
 * - draw.io 打开时会退化为矩形（与其原有的未知形状行为一致），不会破坏文件。
 */
const SYNTOOLS_SHAPE_PREFIX = 'shape=syntools.';

/** 小写形状名 → 规范 kind（用于反解 `shape=syntools.<kind>`） */
const KINDS_BY_LOWER = new Map<string, ShapeKind>(
  (Object.keys(SHAPE_DEFS) as ShapeKind[]).map((k) => [k.toLowerCase(), k]),
);

/** 无 draw.io 对应（或有歧义）时的精确 token */
function exactTokenOf(kind: ShapeKind): string {
  return `${SYNTOOLS_SHAPE_PREFIX}${kind}`;
}

/** mxGraph style → 形状（无法识别时按矩形处理） */
export function kindOfStyle(style: string | undefined): ShapeKind {
  if (!style) return 'rect';
  const s = style.toLowerCase();
  // 本工具写出的精确 token 优先（避免与 draw.io 原生 token 的歧义）
  const at = s.indexOf(SYNTOOLS_SHAPE_PREFIX);
  if (at >= 0) {
    const name = s.slice(at + SYNTOOLS_SHAPE_PREFIX.length).split(/[;,\s]/)[0];
    const kind = KINDS_BY_LOWER.get(name);
    if (kind) return kind;
  }
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
  // 椭圆：draw.io 的 `ellipse` 字面映射为本工具的椭圆（开始/结束为胶囊，走精确 token）
  if (s.includes('ellipse')) return 'ellipse';
  if (s.includes('cylinder')) return 'database';
  if (s.includes('document')) return 'document';
  // 反斜切平行四边形需先于「平行四边形」判断，否则会被误判为数据
  if (s.includes('invparallelogram')) return 'display';
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

const MX_TO_VERTICAL: Record<VerticalAlign, string> = {
  top: 'top',
  middle: 'middle',
  bottom: 'bottom',
};
/** 解析：兼容 draw.io 与其它工具写出的 `center` 变体 */
const MX_VERTICAL_TO_STYLE: Record<string, VerticalAlign> = {
  top: 'top',
  middle: 'middle',
  center: 'middle',
  bottom: 'bottom',
};

/** 形状可调参数 → mxGraph token（含圆角 arcSize）；仅写用户显式设置过的项 */
function shapeParamTokens(kind: ShapeKind, style?: Partial<FlowNodeStyle>): string[] {
  const def = SHAPE_DEFS[kind];
  if (!def) return [];
  const sp = style?.shapeParams;
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const adj of adjustsFor(def)) {
    const mx = adj.mx;
    if (!mx || seen.has(mx.key)) continue;
    const explicit =
      sp?.[adj.key] !== undefined ||
      (adj.key === 'foldSize' && style?.foldSize !== undefined) ||
      (adj.key === 'cornerRadius' && style?.cornerRadius !== undefined);
    if (!explicit) continue;
    const value = paramValue(def, style, adj.key, def.size.width, def.size.height);
    seen.add(mx.key);
    if (mx.key === 'arcSize') parts.push('rounded=1');
    parts.push(`${mx.key}=${mx.to(value, def.size.width, def.size.height)}`);
  }
  return parts;
}

/** 形状 + 样式 → mxGraph style（保留填充/描边/线型/字号/透明度/圆角/阴影/可调参数） */
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
  if (style?.verticalAlign) parts.push(`verticalAlign=${MX_TO_VERTICAL[style.verticalAlign]}`);
  if (style?.flipH) parts.push('flipH=1');
  if (style?.flipV) parts.push('flipV=1');
  parts.push(...shapeParamTokens(kind, style));
  parts.push(...extra);
  return `${parts.filter(Boolean).join(';')};`;
}

/** mxGraph style → 节点样式（只写与默认不同的字段） */
function nodeStyleFromMx(
  style: string | undefined,
  kind?: ShapeKind,
  w?: number,
  h?: number,
): {
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
  const vertical = map.get('verticalAlign');
  if (vertical) {
    const mapped = MX_VERTICAL_TO_STYLE[vertical.toLowerCase()];
    // middle 是历史默认值，不写入字段，保持文档精简
    if (mapped && mapped !== 'middle') out.verticalAlign = mapped;
  }
  if (map.get('flipH') === '1') out.flipH = true;
  if (map.get('flipV') === '1') out.flipV = true;
  // 形状可调参数：把 size / arcSize 等 token 还原为 shapeParams（已消费的 token 不再进 mxStyle）
  const consumed = new Set<string>();
  const def = kind ? SHAPE_DEFS[kind] : undefined;
  if (def) {
    const dw = w ?? def.size.width;
    const dh = h ?? def.size.height;
    const params: Record<string, number> = {};
    for (const adj of adjustsFor(def)) {
      const mx = adj.mx;
      if (!mx || consumed.has(mx.key)) continue;
      const raw = map.get(mx.key);
      if (raw === undefined) continue;
      const value = mx.from(raw, dw, dh);
      if (value === null || !Number.isFinite(value)) continue;
      consumed.add(mx.key);
      params[adj.key] = value;
    }
    if (Object.keys(params).length > 0) out.shapeParams = params;
  }
  const mxStyle =
    consumed.size === 0
      ? unknown
      : unknown.filter((t) => {
          const eq = t.indexOf('=');
          const key = eq < 0 ? t : t.slice(0, eq).trim();
          return !consumed.has(key);
        });
  return { style: out, mxStyle };
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
  // 跳线：draw.io 的原生 token
  if (s.jumpStyle === 'arc') parts.push('jumpStyle=arc');
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

  const jumpToken = (map.get('jumpStyle') ?? '').toLowerCase();
  const style: FlowEdgeStyle = {
    type,
    stroke: map.get('strokeColor') || '#475569',
    strokeWidth: Number(map.get('strokeWidth')) || 2,
    dash,
    startArrow: arrowOf(map.get('startArrow'), map.get('startFill') !== '0'),
    endArrow: arrowOf(map.get('endArrow'), map.get('endFill') !== '0'),
    jumpStyle: jumpToken && jumpToken !== 'none' ? 'arc' : 'none',
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
      '@_style': styleOf(n.data.kind, n.data.style, [
        ...(n.type === 'table' ? [tableTokenOf(n.data.table)] : []),
        ...(n.mxStyle ?? []),
      ]),
      '@_vertex': '1',
      '@_parent': n.parentId ?? '1',
      mxGeometry: {
        '@_x': Math.round(n.position.x),
        '@_y': Math.round(n.position.y),
        '@_width': Math.round(n.width ?? def.width),
        '@_height': Math.round(n.height ?? def.height),
        // 旋转在 mxGraph 中是几何属性（绕包围盒中心），不是样式 token
        ...(n.data.style.rotation
          ? { '@_rotation': String(round2(normalizeRotation(n.data.style.rotation))) }
          : {}),
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
      '@_style': edgeStyleOf(e.style, [...edgeLabelTokens(e), ...(e.mxStyle ?? [])]),
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
      const width = geoNum(cell, '@_width', def.width);
      const height = geoNum(cell, '@_height', def.height);
      const { style: nodeStyle, mxStyle: nodeMxStyle } = nodeStyleFromMx(
        rawStyle,
        kind,
        width,
        height,
      );
      // 旋转存于 mxGeometry.rotation（绕包围盒中心），归一后写回 style
      const rotation = normalizeRotation(geoNum(cell, '@_rotation', 0));
      if (rotation !== 0) nodeStyle.rotation = rotation;
      // 表格节点：由自定义 token 还原整表数据（drawio 打开时退化为普通矩形）
      const table = tableFromStyle(rawStyle);
      const keptMxStyle = table
        ? dropConsumedTokens(nodeMxStyle, new Set([SYN_TABLE]))
        : nodeMxStyle;
      nodes.push({
        id,
        type: table ? 'table' : 'shape',
        position: { x: geoNum(cell, '@_x', 0), y: geoNum(cell, '@_y', 0) },
        parentId: parent && parent !== '1' ? parent : null,
        width,
        height,
        ...(keptMxStyle.length > 0 ? { mxStyle: keptMxStyle } : {}),
        data: {
          ...defaultData(kind, labelOf(cell, rawStyle)),
          ...(table ? { table } : {}),
          style: { ...defaultData(kind).style, ...nodeStyle },
        },
      });
    } else if (attr(cell, '@_edge') === '1') {
      const source = attr(cell, '@_source');
      const target = attr(cell, '@_target');
      if (!source || !target) continue;
      const rawStyle = attr(cell, '@_style');
      const { style: edgeStyle, mxStyle: edgeMxStyle } = edgeStyleFromMx(rawStyle);
      const labels = edgeLabelsFromMx(rawStyle);
      const keptMxStyle = dropConsumedTokens(edgeMxStyle, labels.consumed);
      const waypoints = pointsOf(cell.mxGeometry);
      edges.push({
        id,
        source,
        target,
        label: labelOf(cell, rawStyle) || undefined,
        ...(labels.sourceLabel ? { sourceLabel: labels.sourceLabel } : {}),
        ...(labels.targetLabel ? { targetLabel: labels.targetLabel } : {}),
        ...(labels.labelPosition ? { labelPosition: labels.labelPosition } : {}),
        style: edgeStyle,
        ...(waypoints.length > 0 ? { waypoints } : {}),
        ...(keptMxStyle.length > 0 ? { mxStyle: keptMxStyle } : {}),
      });
    }
  }

  const name = attr(diagram, '@_name') || `Page ${index + 1}`;
  const id = attr(diagram, '@_id');
  const page = createPage(name, id);
  return { ...page, nodes, edges };
}

/** 解析 .drawio XML → FlowDoc（多页）；失败或无法识别时返回 null */
/**
 * 取文档中的 diagram 列表。
 * draw.io 的剪贴板内容通常没有 `mxfile` 外壳，只有裸 `mxGraphModel`，
 * 这里统一包成单页，使粘贴与导入共用同一条解析路径。
 */
function diagramsOf(parsed: XmlNode | undefined): XmlNode[] {
  const mxfile = parsed?.mxfile as XmlNode | undefined;
  const bare = !mxfile && parsed?.mxGraphModel ? (parsed.mxGraphModel as XmlNode) : undefined;
  if (bare) return [{ '@_name': 'Page 1', '@_id': 'p1', mxGraphModel: bare }];
  return asArray(mxfile?.diagram as XmlNode | XmlNode[] | undefined);
}

/** 解析 .drawio XML → FlowDoc（多页）；失败或无法识别时返回 null */
export function parseDrawioXml(xml: string): FlowDoc | null {
  try {
    const parsed = PARSER.parse(xml) as XmlNode | undefined;
    const diagrams = diagramsOf(parsed);
    if (diagrams.length === 0) return null;

    const pages = diagrams.map((d, i) => buildPage(d, i)).filter((p) => p.nodes.length > 0);
    if (pages.length === 0) return null;
    if (pages.length === 1) {
      const only = pages[0];
      return toDocV3(only.nodes, only.edges, only.name);
    }
    return { version: 3, pages, activePageId: pages[0].id };
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
    const diagrams = diagramsOf(parsed);
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
