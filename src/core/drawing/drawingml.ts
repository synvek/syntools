/**
 * DrawingML geometry fragments (P3-1.0): `ShapeGeometry` ↔ `a:prstGeom` / `a:custGeom` / `a:avLst`.
 *
 * The three carriers — pptx `p:sp`, xlsx `xdr:sp`, docx `wps:wsp` — wrap exactly the same
 * `a:spPr` subtree, so writing and reading it belongs in the kernel instead of one editor's
 * `pptx/` folder. Contract is unchanged from P2-6: pure functions, no `tools/**`, no DOM.
 */

import { commandsToSvg } from './custGeom';
import type { PathCommand, ShapeGeometry } from './geometry';
import { resolvePresetGeometry } from './shapeDefs';
import { attr, childOf, childrenNamed, childrenOf, localNameOf, type XmlNode } from './xmlNode';

/** DrawingML's usual path extent; used when a file omits `a:path@w/@h` */
export const DEFAULT_PATH_EXTENT = 100000;
/** Adjustment values and percentages share DrawingML's 100000 = 100% scale */
const ADJ_SCALE = 100000;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/* ------------------------------- Writing ------------------------------- */

/** `a:avLst` from normalized adjustment values (sorted so output is stable) */
export function avLstXml(adj: Record<string, number> | undefined): string {
  const entries = Object.entries(adj ?? {})
    .filter(([, value]) => Number.isFinite(value))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  if (entries.length === 0) return '<a:avLst/>';
  const gds = entries
    .map(
      ([name, value]) =>
        `<a:gd name="${escapeXml(name)}" fmla="val ${Math.round(value * ADJ_SCALE)}"/>`,
    )
    .join('');
  return `<a:avLst>${gds}</a:avLst>`;
}

/** `a:prstGeom` from a preset name plus normalized adjustment values */
export function prstGeomXml(prst: string, adj?: Record<string, number>): string {
  return `<a:prstGeom prst="${escapeXml(prst || 'rect')}">${avLstXml(adj)}</a:prstGeom>`;
}

function ptXml(x: number, y: number, extent: number): string {
  return `<a:pt x="${Math.round(x * extent)}" y="${Math.round(y * extent)}"/>`;
}

/** Normalized path commands → `a:custGeom` */
export function custGeomXml(commands: PathCommand[], extent = DEFAULT_PATH_EXTENT): string {
  const body = commands
    .map((command) => {
      switch (command.c) {
        case 'M':
          return `<a:moveTo>${ptXml(command.x, command.y, extent)}</a:moveTo>`;
        case 'L':
          return `<a:lnTo>${ptXml(command.x, command.y, extent)}</a:lnTo>`;
        case 'C':
          return `<a:cubicBezTo>${ptXml(command.x1, command.y1, extent)}${ptXml(
            command.x2,
            command.y2,
            extent,
          )}${ptXml(command.x, command.y, extent)}</a:cubicBezTo>`;
        case 'Q':
          return `<a:quadBezTo>${ptXml(command.x1, command.y1, extent)}${ptXml(
            command.x,
            command.y,
            extent,
          )}</a:quadBezTo>`;
        case 'Z':
          return '<a:close/>';
      }
    })
    .join('');
  return [
    '<a:custGeom>',
    '<a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/>',
    '<a:rect l="0" t="0" r="r" b="b"/>',
    `<a:pathLst><a:path w="${extent}" h="${extent}">${body}</a:path></a:pathLst>`,
    '</a:custGeom>',
  ].join('');
}

/**
 * Geometry for text boxes / pictures, where the frame is always a `rect` or `roundRect`:
 * `adj1` is the radius as a fraction of the shorter side (the convention `resolvePresetGeometry`
 * and the slide model's `cornerRadius` both use).
 */
export function frameGeomXml(width: number, height: number, cornerRadius = 0): string {
  const min = Math.min(width, height);
  const radius = min > 0 ? Math.min(0.5, Math.max(0, cornerRadius / min)) : 0;
  if (radius <= 0) return prstGeomXml('rect');
  return prstGeomXml('roundRect', { adj1: radius });
}

/** `a:prstGeom` / `a:custGeom` for a shape model (an explicit path always wins) */
export function geomXml(geom: ShapeGeometry): string {
  // An explicit path must survive a round-trip: writing prst would silently redraw the shape
  if (geom.custGeom && geom.custGeom.length > 0) return custGeomXml(geom.custGeom);
  return prstGeomXml(geom.prst || 'rect', geom.adj);
}

/* ------------------------------- Reading ------------------------------- */

function pointOf(node: XmlNode, width: number, height: number): { x: number; y: number } {
  const pt = childOf(node, 'pt');
  const x = Number(attr(pt, 'x') ?? 0);
  const y = Number(attr(pt, 'y') ?? 0);
  return {
    x: (Number.isFinite(x) ? x : 0) / width,
    y: (Number.isFinite(y) ? y : 0) / height,
  };
}

/** `a:custGeom` node → normalized commands (empty when the geometry carries no path) */
export function parseCustGeom(geomNode: XmlNode | undefined): PathCommand[] {
  const pathNode = childOf(childOf(geomNode, 'pathLst'), 'path');
  if (!pathNode) return [];
  const width = Number(attr(pathNode, 'w') ?? DEFAULT_PATH_EXTENT) || DEFAULT_PATH_EXTENT;
  const height = Number(attr(pathNode, 'h') ?? DEFAULT_PATH_EXTENT) || DEFAULT_PATH_EXTENT;

  const commands: PathCommand[] = [];
  for (const node of childrenOf(pathNode)) {
    switch (localNameOf(node)) {
      case 'moveTo': {
        commands.push({ c: 'M', ...pointOf(node, width, height) });
        break;
      }
      case 'lnTo': {
        commands.push({ c: 'L', ...pointOf(node, width, height) });
        break;
      }
      case 'cubicBezTo': {
        const points = childrenNamed(node, 'pt').map((pt) => {
          const x = Number(attr(pt, 'x') ?? 0);
          const y = Number(attr(pt, 'y') ?? 0);
          return {
            x: (Number.isFinite(x) ? x : 0) / width,
            y: (Number.isFinite(y) ? y : 0) / height,
          };
        });
        if (points.length >= 3) {
          commands.push({
            c: 'C',
            x1: points[0].x,
            y1: points[0].y,
            x2: points[1].x,
            y2: points[1].y,
            x: points[2].x,
            y: points[2].y,
          });
        }
        break;
      }
      case 'quadBezTo': {
        const points = childrenNamed(node, 'pt').map((pt) => {
          const x = Number(attr(pt, 'x') ?? 0);
          const y = Number(attr(pt, 'y') ?? 0);
          return {
            x: (Number.isFinite(x) ? x : 0) / width,
            y: (Number.isFinite(y) ? y : 0) / height,
          };
        });
        if (points.length >= 2) {
          commands.push({
            c: 'Q',
            x1: points[0].x,
            y1: points[0].y,
            x: points[1].x,
            y: points[1].y,
          });
        }
        break;
      }
      case 'close':
        commands.push({ c: 'Z' });
        break;
      default:
        break;
    }
  }
  return commands;
}

/** Build the render/export geometry for an imported custom shape */
export function geometryFromCustGeom(geomNode: XmlNode | undefined): ShapeGeometry | null {
  const commands = parseCustGeom(geomNode);
  if (commands.length < 2) return null;
  return {
    kind: 'path',
    prst: 'rect',
    path: commandsToSvg(commands),
    custGeom: commands,
  };
}

/**
 * `a:avLst` → normalized adjustment values (invalid formulas are skipped).
 * Accepts either the geometry node (`a:prstGeom`...) or its parent (`a:spPr`), because both
 * readers naturally hold one or the other.
 */
export function parseAdjLst(geomNode: XmlNode | undefined): Record<string, number> {
  const avLst =
    childOf(geomNode, 'avLst') ??
    childOf(childOf(geomNode, 'geom') ?? childOf(geomNode, 'prstGeom'), 'avLst');
  const adj: Record<string, number> = {};
  for (const gd of childrenNamed(avLst, 'gd')) {
    const name = attr(gd, 'name');
    const match = /^val\s+(-?\d+(?:\.\d+)?)$/.exec(attr(gd, 'fmla') ?? '');
    if (name && match) adj[name] = Number(match[1]) / ADJ_SCALE;
  }
  return adj;
}

/**
 * `a:geom` (legacy, xlsx/preset shapes) or `a:prstGeom` → preset name + adjustments.
 * Kept raw: resolving the preset into render geometry is `parseShapeGeometry`'s job.
 */
export function parseGeomXml(geomNode: XmlNode | undefined): {
  prst: string;
  adj?: Record<string, number>;
} {
  const node = childOf(geomNode, 'geom') ?? childOf(geomNode, 'prstGeom') ?? geomNode;
  const prst = attr(node, 'prst') ?? 'rect';
  const adj = parseAdjLst(node);
  return { prst, adj: Object.keys(adj).length > 0 ? adj : undefined };
}

/** `a:spPr` (or any node holding the geometry) → ShapeGeometry, custom geometry first */
export function parseShapeGeometry(spPrNode: XmlNode | undefined): ShapeGeometry {
  // Custom geometry wins: a shape with an explicit path must not be re-derived from prst
  const custom = geometryFromCustGeom(childOf(spPrNode, 'custGeom'));
  if (custom) return custom;
  const { prst, adj } = parseGeomXml(spPrNode);
  return resolvePresetGeometry(prst, adj);
}
