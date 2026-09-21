/**
 * Draw.io（.drawio / mxGraphModel XML）导入导出。
 * 复用已安装的 fast-xml-parser，零新增依赖即可与 Draw.io 互通基本图形。
 */

import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { activePageOf, toDocV2 } from '../model/migrate';
import { shapeSize } from '../model/shapes';
import { defaultData } from '../core';
import type { FlowDoc, FlowEdgeRec, FlowNodeRec, FlowNodeStyle, ShapeKind } from '../model/types';

const PARSER = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const BUILDER = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  suppressEmptyNode: true,
});

/** XML 解析后的宽松结构 */
type XmlNode = Record<string, unknown>;

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

/** 形状 → mxGraph 基础样式 token（不含颜色等通用样式） */
function shapeTokenOf(kind: ShapeKind): string {
  switch (kind) {
    case 'decision':
      return 'rhombus';
    case 'ellipse':
    case 'startEnd':
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
      return 'shape=cylinder';
    case 'document':
      return 'shape=document';
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

/** 形状 + 样式 → mxGraph style（保留填充/描边/线型/透明度/圆角） */
function styleOf(kind: ShapeKind, style?: Partial<FlowNodeStyle>): string {
  const parts = [shapeTokenOf(kind), 'whiteSpace=wrap', 'html=1'];
  if (style?.fill) parts.push(`fillColor=${style.fill}`);
  if (style?.stroke) parts.push(`strokeColor=${style.stroke}`);
  if (style?.strokeWidth) parts.push(`strokeWidth=${style.strokeWidth}`);
  if (style?.lineDash === 'dashed' || style?.lineDash === 'dotted') parts.push('dashed=1');
  if (style?.opacity !== undefined && style.opacity < 1) {
    parts.push(`opacity=${Math.round(style.opacity * 100)}`);
  }
  if (kind === 'roundRect' && style?.cornerRadius !== undefined) {
    parts.push(`arcSize=${Math.round((style.cornerRadius / 2) * 100) / 100}`);
  }
  return `${parts.join(';')};`;
}

/** mxGraph style → 形状（无法识别时按矩形处理） */
export function kindOfStyle(style: string | undefined): ShapeKind {
  if (!style) return 'rect';
  if (style.includes('swimlane')) {
    return style.includes('horizontal=0') ? 'swimlaneV' : 'swimlane';
  }
  if (style.includes('group')) return 'group';
  if (style.includes('rhombus')) return 'decision';
  if (style.includes('ellipse')) return 'startEnd';
  if (style.includes('cylinder')) return 'database';
  if (style.includes('document')) return 'document';
  if (style.includes('parallelogram')) return 'data';
  if (style.includes('triangle')) return 'triangle';
  if (style.includes('hexagon')) return 'hexagon';
  if (style.includes('star')) return 'star';
  if (style.includes('cloud')) return 'cloud';
  if (style.includes('note')) return 'note';
  if (style.includes('trapezoid')) return 'trapezoid';
  if (style.includes('rounded=1')) return 'roundRect';
  return 'rect';
}

export function toDrawioXml(doc: FlowDoc): string {
  const page = activePageOf(doc);
  if (!page) return '';

  const cells: XmlNode[] = [{ '@_id': '0' }, { '@_id': '1', '@_parent': '0' }];

  for (const n of page.nodes) {
    const def = shapeSize(n.data.kind);
    cells.push({
      '@_id': n.id,
      '@_value': n.data.label,
      '@_style': styleOf(n.data.kind, n.data.style),
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
      '@_style': 'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;',
      mxGeometry: { '@_relative': '1', '@_as': 'geometry' },
    };
    if (e.label) cell['@_value'] = e.label;
    cells.push(cell);
  }

  return BUILDER.build({
    mxfile: {
      '@_host': 'syntools',
      diagram: {
        '@_name': page.name,
        '@_id': page.id,
        mxGraphModel: {
          '@_dx': '0',
          '@_dy': '0',
          '@_grid': '1',
          '@_page': '1',
          root: { mxCell: cells },
        },
      },
    },
  }) as string;
}

/** 解析 .drawio XML → FlowDoc；失败或无法识别时返回 null */
export function parseDrawioXml(xml: string): FlowDoc | null {
  try {
    const parsed = PARSER.parse(xml) as XmlNode | undefined;
    const mxfile = parsed?.mxfile as XmlNode | undefined;
    const diagrams = asArray(mxfile?.diagram as XmlNode | XmlNode[] | undefined);
    const diagram = diagrams[0];
    const model = diagram?.mxGraphModel as XmlNode | undefined;
    const root = model?.root as XmlNode | undefined;
    const cells = asArray(root?.mxCell as XmlNode | XmlNode[] | undefined);
    if (cells.length === 0) return null;

    const nodes: FlowNodeRec[] = [];
    const edges: FlowEdgeRec[] = [];

    for (const cell of cells) {
      const id = attr(cell, '@_id');
      if (!id || id === '0' || id === '1') continue;
      if (attr(cell, '@_vertex') === '1') {
        const kind = kindOfStyle(attr(cell, '@_style'));
        const def = shapeSize(kind);
        const parent = attr(cell, '@_parent');
        nodes.push({
          id,
          type: 'shape',
          position: { x: geoNum(cell, '@_x', 0), y: geoNum(cell, '@_y', 0) },
          parentId: parent && parent !== '1' ? parent : null,
          width: geoNum(cell, '@_width', def.width),
          height: geoNum(cell, '@_height', def.height),
          data: defaultData(kind, attr(cell, '@_value') ?? ''),
        });
      } else if (attr(cell, '@_edge') === '1') {
        const source = attr(cell, '@_source');
        const target = attr(cell, '@_target');
        if (!source || !target) continue;
        edges.push({
          id,
          source,
          target,
          label: attr(cell, '@_value'),
        });
      }
    }

    return toDocV2(nodes, edges, attr(diagram ?? {}, '@_name') ?? 'Page-1');
  } catch {
    return null;
  }
}
