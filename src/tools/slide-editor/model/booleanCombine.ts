import { booleanPolygons, polygonArea, type BooleanOp } from '../../../core/drawing/boolean';
import { commandsFromGeometry, commandsToSvg, scaleCommands } from '../../../core/drawing/custGeom';
import type { PathCommand } from '../../../core/drawing/geometry';
import { resolvePresetGeometry, starPoints } from '../../../core/drawing/shapeDefs';
import { createId } from './factory';
import type { ShapeElement } from './types';

/**
 * Boolean combine for slide shapes (P2-S5).
 *
 * The kernel (`core/drawing/boolean.ts`) works on flat polygons, so first every preset is expanded
 * into its absolute outline. Two approximations are deliberate and documented:
 * - corner radii of rounded rectangles are ignored (the sharp box is used);
 * - element rotation is ignored, so a rotated shape combines as if it were upright.
 * Both are visible only for rotated / heavily rounded shapes, and the alternative (exact curves in
 * the clipper) would need a different boolean backend.
 *
 * The result is a single shape carrying `custGeom` (normalized commands), which the renderer draws
 * as a path and the exporter writes as `a:custGeom` — the same channel hand-drawn paths already use.
 */

export type CombineFailure = 'too-few-shapes' | 'empty-result' | 'unsupported-geometry';

export interface CombineResult {
  element: ShapeElement;
}

/** Sample count for curves: enough for a smooth edge, cheap enough for a palette-level operation */
const CURVE_STEPS = 12;
const ELLIPSE_STEPS = 48;

/** Flatten path commands into closed rings (M starts a ring, Z closes it) */
function ringsOfCommands(commands: PathCommand[]): number[][] {
  const rings: number[][] = [];
  let current: number[] = [];
  const flush = () => {
    if (current.length >= 6) rings.push(current);
    current = [];
  };
  const cubicAt = (t: number, p0: number, p1: number, p2: number, p3: number): number => {
    const mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
  };
  const quadAt = (t: number, p0: number, p1: number, p2: number): number => {
    const mt = 1 - t;
    return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
  };

  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  for (const command of commands) {
    if (command.c === 'M') {
      flush();
      current = [command.x, command.y];
      cx = startX = command.x;
      cy = startY = command.y;
      continue;
    }
    if (command.c === 'L') {
      current.push(command.x, command.y);
      cx = command.x;
      cy = command.y;
      continue;
    }
    if (command.c === 'C') {
      for (let step = 1; step <= CURVE_STEPS; step += 1) {
        const t = step / CURVE_STEPS;
        current.push(
          cubicAt(t, cx, command.x1, command.x2, command.x),
          cubicAt(t, cy, command.y1, command.y2, command.y),
        );
      }
      cx = command.x;
      cy = command.y;
      continue;
    }
    if (command.c === 'Q') {
      for (let step = 1; step <= CURVE_STEPS; step += 1) {
        const t = step / CURVE_STEPS;
        current.push(quadAt(t, cx, command.x1, command.x), quadAt(t, cy, command.y1, command.y));
      }
      cx = command.x;
      cy = command.y;
      continue;
    }
    // Z: close the ring. An explicit closing point keeps the clipper happy about shared vertices
    if (current.length >= 4) {
      current.push(startX, startY);
      cx = startX;
      cy = startY;
    }
    flush();
  }
  // A path that forgets its final Z still describes a closed area once filled
  flush();
  return rings;
}

/** Closed outline(s) of a shape in absolute slide coordinates */
export function shapeOutlines(element: ShapeElement): number[][] {
  const { x, y, width, height } = element;
  // Explicit commands win over the preset: `custGeom` first, legacy SVG `path` second (a pen-drawn
  // shape must combine as its real outline, not as its bounding box)
  const own = commandsFromGeometry(element.geom);
  const geom =
    own.length >= 2 ? element.geom : resolvePresetGeometry(element.geom.prst, element.geom.adj);

  const explicit = own.length >= 2 ? own : commandsFromGeometry(geom);
  if (explicit.length >= 2) {
    const scaled = scaleCommands(explicit, width, height);
    return ringsOfCommands(scaled.map((command) => translateCommand(command, x, y)));
  }
  if (geom.kind === 'polygon' && geom.points) {
    const ring: number[] = [];
    for (let index = 0; index + 1 < geom.points.length; index += 2) {
      ring.push(x + geom.points[index] * width, y + geom.points[index + 1] * height);
    }
    return ring.length >= 6 ? [ring] : [];
  }
  if (geom.kind === 'ellipse') {
    const ring: number[] = [];
    for (let step = 0; step < ELLIPSE_STEPS; step += 1) {
      const angle = (step / ELLIPSE_STEPS) * Math.PI * 2;
      ring.push(
        x + width / 2 + (Math.cos(angle) * width) / 2,
        y + height / 2 + (Math.sin(angle) * height) / 2,
      );
    }
    return [ring];
  }
  if (geom.kind === 'star') {
    const count = Math.max(3, starPoints(geom.prst));
    const outer = Math.min(width, height) / 2;
    const inner = outer * (geom.innerRatio ?? 0.382);
    const ring: number[] = [];
    for (let step = 0; step < count * 2; step += 1) {
      const radius = step % 2 === 0 ? outer : inner;
      // Start at the top, like Konva's Star
      const angle = (step / (count * 2)) * Math.PI * 2 - Math.PI / 2;
      ring.push(
        x + width / 2 + Math.cos(angle) * radius,
        y + height / 2 + Math.sin(angle) * radius,
      );
    }
    return [ring];
  }
  // rect (corner radius ignored): the bounding box outline
  return [[x, y, x + width, y, x + width, y + height, x, y + height]];
}

function translateCommand(command: PathCommand, dx: number, dy: number): PathCommand {
  switch (command.c) {
    case 'M':
    case 'L':
      return { ...command, x: command.x + dx, y: command.y + dy };
    case 'C':
      return {
        ...command,
        x1: command.x1 + dx,
        y1: command.y1 + dy,
        x2: command.x2 + dx,
        y2: command.y2 + dy,
        x: command.x + dx,
        y: command.y + dy,
      };
    case 'Q':
      return {
        ...command,
        x1: command.x1 + dx,
        y1: command.y1 + dy,
        x: command.x + dx,
        y: command.y + dy,
      };
    case 'Z':
      return command;
  }
}

/** Bounding box of a set of path commands (control points included: never smaller than the result) */
function commandsBounds(commands: PathCommand[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (px: number, py: number) => {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  };
  for (const command of commands) {
    if (command.c === 'M' || command.c === 'L') visit(command.x, command.y);
    else if (command.c === 'C') {
      visit(command.x1, command.y1);
      visit(command.x2, command.y2);
      visit(command.x, command.y);
    } else if (command.c === 'Q') {
      visit(command.x1, command.y1);
      visit(command.x, command.y);
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 1, height: 1 };
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/**
 * Combine the shapes into one, in document order: the **first** shape is the subject, so
 * "subtract" removes the other shapes from the bottom-most one — the same rule PowerPoint uses.
 */
export async function combineShapes(
  op: BooleanOp,
  shapes: ShapeElement[],
): Promise<{ ok: true; element: ShapeElement } | { ok: false; reason: CombineFailure }> {
  const outlines = shapes
    .map((shape) => {
      const rings = shapeOutlines(shape);
      // A shape with several rings (a path with holes) contributes its largest ring: the clipper
      // has no notion of holes, and dropping the outer ring would erase the shape entirely
      return rings.sort((a, b) => polygonArea(b) - polygonArea(a))[0];
    })
    .filter((ring): ring is number[] => Boolean(ring) && ring.length >= 6);

  if (outlines.length < 2) return { ok: false, reason: 'unsupported-geometry' };

  const [subject, ...clippers] = outlines;
  const commands = await booleanPolygons(op, subject, ...clippers);
  if (commands.length === 0) return { ok: false, reason: 'empty-result' };

  const bounds = commandsBounds(commands);
  const normalized = commands.map((command) =>
    scaleNormalizedCommand(
      translateCommand(command, -bounds.x, -bounds.y),
      bounds.width,
      bounds.height,
    ),
  );

  return {
    ok: true,
    element: {
      ...shapes[0],
      id: createId('el'),
      // Rotation / flip were not part of the math, so the result must not claim them
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      rotation: 0,
      flipX: false,
      flipY: false,
      geom: {
        kind: 'path',
        prst: shapes[0].geom.prst,
        custGeom: normalized,
      },
    },
  };
}

/** Element-space commands → normalized (0~1) commands, the form `custGeom` is stored in */
function scaleNormalizedCommand(command: PathCommand, width: number, height: number): PathCommand {
  switch (command.c) {
    case 'M':
    case 'L':
      return { ...command, x: command.x / width, y: command.y / height };
    case 'C':
      return {
        ...command,
        x1: command.x1 / width,
        y1: command.y1 / height,
        x2: command.x2 / width,
        y2: command.y2 / height,
        x: command.x / width,
        y: command.y / height,
      };
    case 'Q':
      return {
        ...command,
        x1: command.x1 / width,
        y1: command.y1 / height,
        x: command.x / width,
        y: command.y / height,
      };
    case 'Z':
      return command;
  }
}

/** SVG preview of the combined geometry (used by tests and by the insert glyph) */
export function combinedPathData(element: ShapeElement): string {
  if (!element.geom.custGeom) return '';
  return commandsToSvg(scaleCommands(element.geom.custGeom, element.width, element.height));
}
