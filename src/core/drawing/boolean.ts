import type { PathCommand } from './geometry';

/**
 * Polygon boolean operations (P2-6.3).
 *
 * Contract:
 * - input/output are **closed polygons in one shared coordinate space** (normalized 0~1 when used
 *   for shapes); flat `[x0,y0,x1,y1,…]` in, `PathCommand[]` out, so the caller keeps its own unit;
 * - the heavy library (`polygon-clipping`, MIT) is imported **dynamically** — a deck that never
 *   merges shapes must not pay for it at startup;
 * - holes come back as extra subpaths with opposite winding, which is what a non-zero fill rule
 *   needs (Konva.Path, Canvas, SVG all default to non-zero). Nothing else about the result is
 *   normalized: same number of contours, same points, no re-fitting.
 */

export type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude';

/** Closed polygon outline: flat vertex list, `[x0,y0,x1,y1,…]` (>= 3 points, not repeated at the end) */
export type FlatPolygon = readonly number[];

/** Same point shape DrawingML uses: one ring of `[x, y]` pairs */
type Ring = [number, number][];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

interface PolygonClippingApi {
  union: (...geometries: MultiPolygon[]) => MultiPolygon;
  intersection: (...geometries: MultiPolygon[]) => MultiPolygon;
  difference: (...geometries: MultiPolygon[]) => MultiPolygon;
  xor: (...geometries: MultiPolygon[]) => MultiPolygon;
}

/** Thrown when the boolean backend cannot be loaded (offline chunk, CSP, test env without deps) */
export class BooleanBackendUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('shape boolean backend (polygon-clipping) is unavailable');
    this.name = 'BooleanBackendUnavailableError';
    this.cause = cause;
  }
}

const PRECISION = 5;

function toRing(flat: FlatPolygon): Ring {
  const ring: Ring = [];
  for (let index = 0; index + 1 < flat.length; index += 2) {
    const x = flat[index];
    const y = flat[index + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const previous = ring[ring.length - 1];
    // Dropping repeated vertices keeps the library's segment tests sane on hand-built outlines
    if (previous && previous[0] === x && previous[1] === y) continue;
    ring.push([x, y]);
  }
  return ring;
}

function toPolygon(flat: FlatPolygon): MultiPolygon {
  const ring = toRing(flat);
  if (ring.length < 3) return [];
  return [[ring]];
}

/** MultiPolygon → PathCommand[]; every contour becomes its own `M…Z` subpath (winding preserved) */
function toPath(multi: MultiPolygon): PathCommand[] {
  const commands: PathCommand[] = [];
  for (const polygon of multi) {
    for (const ring of polygon) {
      if (ring.length < 3) continue;
      const [first, ...rest] = ring;
      commands.push({ c: 'M', x: round(first[0]), y: round(first[1]) });
      for (const point of rest) commands.push({ c: 'L', x: round(point[0]), y: round(point[1]) });
      commands.push({ c: 'Z' });
    }
  }
  return commands;
}

function round(value: number): number {
  const fixed = Number(value.toFixed(PRECISION));
  return Object.is(fixed, -0) ? 0 : fixed;
}

async function loadBackend(): Promise<PolygonClippingApi> {
  try {
    const module: unknown = await import('polygon-clipping');
    const holder = module as { default?: PolygonClippingApi };
    const api = holder.default ?? (module as PolygonClippingApi);
    if (typeof api.union !== 'function') throw new Error('polygon-clipping shape mismatch');
    return api;
  } catch (error) {
    throw new BooleanBackendUnavailableError(error);
  }
}

/**
 * Combine closed outlines. `subtract` = subject minus every clipper, `intersect` = all at once,
 * `exclude` = XOR of all inputs (a shape cut by every other one, overlaps removed).
 *
 * Returns `[]` when the result is empty (e.g. subtracting a bigger shape), never throws for
 * geometry reasons — only `BooleanBackendUnavailableError` when the library itself cannot load.
 */
export async function booleanPolygons(
  op: BooleanOp,
  subject: FlatPolygon,
  ...clippers: FlatPolygon[]
): Promise<PathCommand[]> {
  const api = await loadBackend();
  const first = toPolygon(subject);
  if (first.length === 0) return [];
  const rest = clippers.map(toPolygon).filter((geometry) => geometry.length > 0);

  // No clipper: every op is the identity on the subject, but it still goes through `union` so a
  // self-intersecting outline is normalized (split into valid rings) instead of echoed as-is.
  if (rest.length === 0) return toPath(api.union(first));

  switch (op) {
    case 'union':
      return toPath(api.union(first, ...rest));
    case 'subtract':
      return toPath(api.difference(first, ...rest));
    case 'intersect':
      return toPath(api.intersection(first, ...rest));
    case 'exclude':
      return toPath(api.xor(first, ...rest));
  }
}

/** Area of a closed outline (shoelace, absolute) — handy for tests and "did it change" checks */
export function polygonArea(flat: FlatPolygon): number {
  const ring = toRing(flat);
  let sum = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Signed area of a `PathCommand[]` contour (positive = counter-clockwise) */
export function pathArea(commands: readonly PathCommand[]): number {
  let total = 0;
  let ring: [number, number][] = [];
  const flush = (): void => {
    if (ring.length < 3) {
      ring = [];
      return;
    }
    let sum = 0;
    for (let index = 0; index < ring.length; index += 1) {
      const [x1, y1] = ring[index];
      const [x2, y2] = ring[(index + 1) % ring.length];
      sum += x1 * y2 - x2 * y1;
    }
    total += sum / 2;
    ring = [];
  };
  for (const command of commands) {
    if (command.c === 'M' || command.c === 'L') ring.push([command.x, command.y]);
    else if (command.c === 'Z') flush();
  }
  flush();
  return total;
}
