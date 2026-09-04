import type { ToolResult } from '@/core/types';

/**
 * Markdown → 思维导图树（标题 / 列表），再布局为带主题的 SVG。
 */

export type MindmapError = 'EMPTY';

export interface MindNode {
  id: string;
  text: string;
  children: MindNode[];
}

export interface LaidOutNode {
  id: string;
  text: string;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  children: LaidOutNode[];
}

export interface MindmapLayout {
  root: LaidOutNode;
  width: number;
  height: number;
  links: Array<{ x1: number; y1: number; x2: number; y2: number; depth: number }>;
}

export type MindmapThemeId = 'sky' | 'forest' | 'sunset' | 'grape' | 'ocean' | 'mono';

export interface DepthStyle {
  fill: string;
  stroke: string;
  text: string;
}

export interface MindmapTheme {
  id: MindmapThemeId;
  background: string;
  link: string;
  linkSoft: string;
  depths: DepthStyle[];
  fontFamily: string;
}

export const MINDMAP_THEMES: MindmapTheme[] = [
  {
    id: 'sky',
    background: '#f8fafc',
    link: '#94a3b8',
    linkSoft: '#cbd5e1',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Noto Sans SC", sans-serif',
    depths: [
      { fill: '#1d4ed8', stroke: '#1e3a8a', text: '#ffffff' },
      { fill: '#dbeafe', stroke: '#3b82f6', text: '#1e3a8a' },
      { fill: '#eff6ff', stroke: '#60a5fa', text: '#1e40af' },
      { fill: '#ffffff', stroke: '#93c5fd', text: '#1e3a8a' },
    ],
  },
  {
    id: 'forest',
    background: '#f0fdf4',
    link: '#86efac',
    linkSoft: '#bbf7d0',
    fontFamily: 'ui-sans-serif, system-ui, "PingFang SC", "Noto Sans SC", sans-serif',
    depths: [
      { fill: '#15803d', stroke: '#14532d', text: '#ffffff' },
      { fill: '#dcfce7', stroke: '#22c55e', text: '#14532d' },
      { fill: '#f0fdf4', stroke: '#4ade80', text: '#166534' },
      { fill: '#ffffff', stroke: '#86efac', text: '#14532d' },
    ],
  },
  {
    id: 'sunset',
    background: '#fff7ed',
    link: '#fdba74',
    linkSoft: '#fed7aa',
    fontFamily: 'ui-sans-serif, system-ui, "PingFang SC", "Noto Sans SC", sans-serif',
    depths: [
      { fill: '#c2410c', stroke: '#7c2d12', text: '#ffffff' },
      { fill: '#ffedd5', stroke: '#f97316', text: '#9a3412' },
      { fill: '#fff7ed', stroke: '#fb923c', text: '#c2410c' },
      { fill: '#ffffff', stroke: '#fdba74', text: '#9a3412' },
    ],
  },
  {
    id: 'grape',
    background: '#faf5ff',
    link: '#d8b4fe',
    linkSoft: '#e9d5ff',
    fontFamily: 'ui-sans-serif, system-ui, "PingFang SC", "Noto Sans SC", sans-serif',
    depths: [
      { fill: '#7e22ce', stroke: '#581c87', text: '#ffffff' },
      { fill: '#f3e8ff', stroke: '#a855f7', text: '#581c87' },
      { fill: '#faf5ff', stroke: '#c084fc', text: '#6b21a8' },
      { fill: '#ffffff', stroke: '#d8b4fe', text: '#581c87' },
    ],
  },
  {
    id: 'ocean',
    background: '#ecfeff',
    link: '#67e8f9',
    linkSoft: '#a5f3fc',
    fontFamily: 'ui-sans-serif, system-ui, "PingFang SC", "Noto Sans SC", sans-serif',
    depths: [
      { fill: '#0e7490', stroke: '#164e63', text: '#ffffff' },
      { fill: '#cffafe', stroke: '#06b6d4', text: '#155e75' },
      { fill: '#ecfeff', stroke: '#22d3ee', text: '#0e7490' },
      { fill: '#ffffff', stroke: '#67e8f9', text: '#155e75' },
    ],
  },
  {
    id: 'mono',
    background: '#fafafa',
    link: '#a3a3a3',
    linkSoft: '#d4d4d4',
    fontFamily: 'ui-sans-serif, system-ui, "PingFang SC", "Noto Sans SC", sans-serif',
    depths: [
      { fill: '#171717', stroke: '#0a0a0a', text: '#fafafa' },
      { fill: '#e5e5e5', stroke: '#737373', text: '#171717' },
      { fill: '#f5f5f5', stroke: '#a3a3a3', text: '#262626' },
      { fill: '#ffffff', stroke: '#d4d4d4', text: '#404040' },
    ],
  },
];

export const DEFAULT_THEME_ID: MindmapThemeId = 'sky';

export function getMindmapTheme(id: string): MindmapTheme {
  return MINDMAP_THEMES.find((t) => t.id === id) ?? MINDMAP_THEMES[0];
}

export function isMindmapThemeId(v: string): v is MindmapThemeId {
  return MINDMAP_THEMES.some((t) => t.id === v);
}

const NODE_H_ROOT = 40;
const NODE_H = 32;
const NODE_PAD_X = 16;
const H_GAP = 56;
const V_GAP = 16;
const CHAR_W = 8.5;

function nodeHeight(depth: number): number {
  return depth === 0 ? NODE_H_ROOT : NODE_H;
}

function measureWidth(text: string, depth: number): number {
  let w = 0;
  for (const ch of text) {
    w += /[\u4e00-\u9fff]/.test(ch) ? CHAR_W * 1.55 : CHAR_W;
  }
  const min = depth === 0 ? 72 : 56;
  return Math.max(min, Math.ceil(w) + NODE_PAD_X * 2);
}

function parseListIndent(line: string): { level: number; text: string } | null {
  const m = /^(\s*)([-*+]|\d+\.)\s+(.+)$/.exec(line);
  if (!m) return null;
  const spaces = m[1].replace(/\t/g, '  ').length;
  return { level: Math.floor(spaces / 2), text: m[3].trim() };
}

function parseHeading(line: string): { level: number; text: string } | null {
  const m = /^(#{1,6})\s+(.+)$/.exec(line);
  if (!m) return null;
  return { level: m[1].length, text: m[2].trim() };
}

/** 将 Markdown 标题/列表解析为树；无标题时用「Root」作根 */
export function parseMarkdownTree(md: string): ToolResult<MindNode> {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  if (!lines.some((l) => l.trim())) return { ok: false, error: 'EMPTY' };

  let idSeq = 0;
  const nextId = () => `n${++idSeq}`;

  type Frame = { node: MindNode; depth: number };
  const root: MindNode = { id: nextId(), text: 'Root', children: [] };
  const stack: Frame[] = [{ node: root, depth: 0 }];
  let hasContent = false;
  let listBase = 0;

  for (const raw of lines) {
    const heading = parseHeading(raw);
    if (heading) {
      hasContent = true;
      listBase = heading.level;
      while (stack.length > 1 && stack[stack.length - 1].depth >= heading.level) {
        stack.pop();
      }
      const node: MindNode = { id: nextId(), text: heading.text || 'Untitled', children: [] };
      stack[stack.length - 1].node.children.push(node);
      stack.push({ node, depth: heading.level });
      continue;
    }

    const list = parseListIndent(raw);
    if (list) {
      hasContent = true;
      const depth = listBase + list.level + 1;
      while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
        stack.pop();
      }
      const node: MindNode = { id: nextId(), text: list.text || '…', children: [] };
      stack[stack.length - 1].node.children.push(node);
      stack.push({ node, depth });
      continue;
    }
  }

  if (!hasContent) return { ok: false, error: 'EMPTY' };

  if (root.children.length === 1 && root.text === 'Root') {
    return { ok: true, value: root.children[0] };
  }
  if (root.children.length === 0) return { ok: false, error: 'EMPTY' };
  return { ok: true, value: root };
}

function subtreeHeight(node: MindNode, depth: number): number {
  if (node.children.length === 0) return nodeHeight(depth);
  const kids = node.children.reduce((sum, c) => sum + subtreeHeight(c, depth + 1), 0);
  return Math.max(nodeHeight(depth), kids + V_GAP * (node.children.length - 1));
}

function layoutNode(
  node: MindNode,
  depth: number,
  x: number,
  yCenter: number,
  links: MindmapLayout['links'],
): LaidOutNode {
  const width = measureWidth(node.text, depth);
  const height = nodeHeight(depth);
  const laid: LaidOutNode = {
    id: node.id,
    text: node.text,
    depth,
    x,
    y: yCenter - height / 2,
    width,
    height,
    children: [],
  };

  if (node.children.length === 0) return laid;

  const totalH = subtreeHeight(node, depth);
  let cursor = yCenter - totalH / 2;
  const childX = x + width + H_GAP;

  for (const child of node.children) {
    const h = subtreeHeight(child, depth + 1);
    const cy = cursor + h / 2;
    const childLaid = layoutNode(child, depth + 1, childX, cy, links);
    laid.children.push(childLaid);
    links.push({
      x1: x + width,
      y1: yCenter,
      x2: childLaid.x,
      y2: childLaid.y + childLaid.height / 2,
      depth,
    });
    cursor += h + V_GAP;
  }
  return laid;
}

export function layoutMindmap(root: MindNode, padding = 32): MindmapLayout {
  const links: MindmapLayout['links'] = [];
  const totalH = subtreeHeight(root, 0);
  const laid = layoutNode(root, 0, padding, padding + totalH / 2, links);

  let maxX = 0;
  let maxY = 0;
  const walk = (n: LaidOutNode) => {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
    n.children.forEach(walk);
  };
  walk(laid);

  return {
    root: laid,
    width: Math.ceil(maxX + padding),
    height: Math.ceil(maxY + padding),
    links,
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function depthStyle(theme: MindmapTheme, depth: number): DepthStyle {
  return theme.depths[Math.min(depth, theme.depths.length - 1)];
}

export function renderMindmapSvg(
  layout: MindmapLayout,
  theme: MindmapTheme = getMindmapTheme(DEFAULT_THEME_ID),
): string {
  const filterId = 'mm-shadow';
  const nodes: string[] = [];
  const walk = (n: LaidOutNode) => {
    const style = depthStyle(theme, n.depth);
    const fontSize = n.depth === 0 ? 15 : 13;
    const fontWeight = n.depth === 0 ? 700 : 560;
    const rx = n.depth === 0 ? 12 : 10;
    nodes.push(
      `<g>`,
      `<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${rx}" ry="${rx}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${n.depth === 0 ? 2 : 1.5}" filter="url(#${filterId})"/>`,
      `<text x="${n.x + n.width / 2}" y="${n.y + n.height / 2}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-weight="${fontWeight}" font-family="${escapeXml(theme.fontFamily)}" fill="${style.text}">${escapeXml(n.text)}</text>`,
      `</g>`,
    );
    n.children.forEach(walk);
  };
  walk(layout.root);

  const paths = layout.links
    .map((l) => {
      const mx = (l.x1 + l.x2) / 2;
      const stroke = l.depth === 0 ? theme.link : theme.linkSoft;
      const width = l.depth === 0 ? 2 : 1.5;
      return `<path d="M${l.x1} ${l.y1} C${mx} ${l.y1}, ${mx} ${l.y2}, ${l.x2} ${l.y2}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`;
    })
    .join('\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">`,
    `<defs>`,
    `<filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">`,
    `<feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.12"/>`,
    `</filter>`,
    `</defs>`,
    `<rect width="100%" height="100%" fill="${theme.background}"/>`,
    paths,
    nodes.join('\n'),
    `</svg>`,
  ].join('\n');
}

export function markdownToMindmapSvg(
  md: string,
  themeId: MindmapThemeId | string = DEFAULT_THEME_ID,
): ToolResult<string> {
  const built = buildMindmap(md, themeId);
  if (!built.ok) return built;
  return { ok: true, value: built.value.svg };
}

export interface MindmapBuild {
  svg: string;
  width: number;
  height: number;
}

export function buildMindmap(
  md: string,
  themeId: MindmapThemeId | string = DEFAULT_THEME_ID,
): ToolResult<MindmapBuild> {
  const tree = parseMarkdownTree(md);
  if (!tree.ok) return tree;
  const layout = layoutMindmap(tree.value);
  return {
    ok: true,
    value: {
      svg: renderMindmapSvg(layout, getMindmapTheme(themeId)),
      width: layout.width,
      height: layout.height,
    },
  };
}

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.15;

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));
}
