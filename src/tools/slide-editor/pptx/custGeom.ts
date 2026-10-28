import { commandsToSvg } from '../model/custGeom';
import type { PathCommand, ShapeGeometry } from '../model/types';
import { attr, childOf, childrenNamed, childrenOf, localNameOf, type XmlNode } from './xml';

/**
 * DrawingML `a:custGeom` ↔ normalized path commands.
 *
 * OOXML expresses a path in an arbitrary `a:path@w/@h` space; every point is divided by that
 * extent on import and multiplied back on export, so the stored model stays resolution-free.
 */

/** DrawingML's usual path extent; used when a file omits w/h */
const DEFAULT_EXTENT = 100000;

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
  const width = Number(attr(pathNode, 'w') ?? DEFAULT_EXTENT) || DEFAULT_EXTENT;
  const height = Number(attr(pathNode, 'h') ?? DEFAULT_EXTENT) || DEFAULT_EXTENT;

  const commands: PathCommand[] = [];
  for (const node of childrenOf(pathNode)) {
    switch (localNameOf(node)) {
      case 'moveTo': {
        const point = pointOf(node, width, height);
        commands.push({ c: 'M', ...point });
        break;
      }
      case 'lnTo': {
        const point = pointOf(node, width, height);
        commands.push({ c: 'L', ...point });
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

function ptXml(x: number, y: number, extent: number): string {
  return `<a:pt x="${Math.round(x * extent)}" y="${Math.round(y * extent)}"/>`;
}

/** Normalized commands → `a:custGeom` XML */
export function custGeomXml(commands: PathCommand[], extent = DEFAULT_EXTENT): string {
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
