import type { ConnectorEnd, LineElement, SlideElement } from './types';

/**
 * Connector geometry.
 *
 * A bound endpoint follows a shape's connection site; a free endpoint keeps its absolute
 * position. The line element stores a normalized bounding box plus `points` relative to it,
 * which is what Konva and the transformer expect.
 */

/** Connection sites, clockwise from the top edge. 0/2/4/6 are edge midpoints, odd values corners. */
export const CONNECTOR_SITES: { x: number; y: number }[] = [
  { x: 0.5, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 0.5 },
  { x: 1, y: 1 },
  { x: 0.5, y: 1 },
  { x: 0, y: 1 },
  { x: 0, y: 0.5 },
  { x: 0, y: 0 },
];

export interface ConnectorSiteHit {
  shapeId: string;
  site: number;
  x: number;
  y: number;
  distance: number;
}

export function connectorSitePoint(
  element: SlideElement,
  site: number | undefined,
): { x: number; y: number } {
  const normalized = CONNECTOR_SITES[(site ?? 0) % CONNECTOR_SITES.length];
  return {
    x: element.x + normalized.x * element.width,
    y: element.y + normalized.y * element.height,
  };
}

/** Nearest connection site on any non-line element, used while dragging a connector endpoint. */
export function nearestConnectorSite(
  elements: SlideElement[],
  point: { x: number; y: number },
  excludeId?: string,
  threshold = 14,
): ConnectorSiteHit | null {
  let best: ConnectorSiteHit | null = null;
  for (const element of elements) {
    if (element.id === excludeId) continue;
    if (element.type === 'line' || element.type === 'group') continue;
    for (let site = 0; site < CONNECTOR_SITES.length; site += 1) {
      const candidate = connectorSitePoint(element, site);
      const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      if (distance > threshold) continue;
      if (!best || distance < best.distance) {
        best = { shapeId: element.id, site, x: candidate.x, y: candidate.y, distance };
      }
    }
  }
  return best;
}

/** Absolute endpoints, respecting bound sides and falling back to the stored free point. */
export function connectorEndpoints(
  line: LineElement,
  byId: Map<string, SlideElement>,
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const first = line.points[0] ?? 0;
  const second = line.points[1] ?? 0;
  const lastX = line.points[line.points.length - 2] ?? line.width;
  const lastY = line.points[line.points.length - 1] ?? line.height;

  const startShape = line.startCxn?.shapeId ? byId.get(line.startCxn.shapeId) : undefined;
  const endShape = line.endCxn?.shapeId ? byId.get(line.endCxn.shapeId) : undefined;

  return {
    start: startShape
      ? connectorSitePoint(startShape, line.startCxn?.site)
      : { x: line.x + first, y: line.y + second },
    end: endShape
      ? connectorSitePoint(endShape, line.endCxn?.site)
      : { x: line.x + lastX, y: line.y + lastY },
  };
}

/** Elbow route with one bend, matching PowerPoint's default orthogonal connector. */
function routePoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
  route: LineElement['route'],
): number[] {
  if (route !== 'elbow') return [start.x, start.y, end.x, end.y];
  if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
    const mid = (start.x + end.x) / 2;
    return [start.x, start.y, mid, start.y, mid, end.y, end.x, end.y];
  }
  const mid = (start.y + end.y) / 2;
  return [start.x, start.y, start.x, mid, end.x, mid, end.x, end.y];
}

/** Normalize two absolute endpoints into a line element's box + relative points. */
export function lineGeometryFromPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
  route: LineElement['route'],
): Pick<LineElement, 'x' | 'y' | 'width' | 'height' | 'points' | 'rotation' | 'flipX' | 'flipY'> {
  const absolute = routePoints(start, end, route);
  const xs = absolute.filter((_, index) => index % 2 === 0);
  const ys = absolute.filter((_, index) => index % 2 === 1);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(1, Math.max(...xs) - minX);
  const height = Math.max(1, Math.max(...ys) - minY);
  const points = absolute.map((value, index) => (index % 2 === 0 ? value - minX : value - minY));
  return {
    x: minX,
    y: minY,
    width,
    height,
    points,
    rotation: 0,
    flipX: false,
    flipY: false,
  };
}

/**
 * Recompute a connector's box/points. Returns null when the line has no bound sides, so
 * callers can skip free lines entirely.
 */
export function resolveConnectorGeometry(
  line: LineElement,
  byId: Map<string, SlideElement>,
): Pick<
  LineElement,
  'x' | 'y' | 'width' | 'height' | 'points' | 'rotation' | 'flipX' | 'flipY'
> | null {
  if (!line.startCxn?.shapeId && !line.endCxn?.shapeId) return null;
  const { start, end } = connectorEndpoints(line, byId);
  return lineGeometryFromPoints(start, end, line.route);
}

/**
 * Recompute every bound connector after a shape moved/resized.
 * Untouched lines are returned by reference so shallow comparisons keep working.
 */
export function withResolvedConnectors(elements: SlideElement[]): SlideElement[] {
  const byId = new Map(elements.map((element) => [element.id, element]));
  let changed = false;
  const next = elements.map((element) => {
    if (element.type !== 'line') return element;
    const geometry = resolveConnectorGeometry(element, byId);
    if (!geometry) return element;
    changed = true;
    return { ...element, ...geometry };
  });
  return changed ? next : elements;
}

/** Endpoint position in absolute page coordinates, for drawing endpoint handles. */
export function lineEndpoint(line: LineElement, which: 'start' | 'end'): { x: number; y: number } {
  if (which === 'start') {
    return { x: line.x + (line.points[0] ?? 0), y: line.y + (line.points[1] ?? 0) };
  }
  return {
    x: line.x + (line.points[line.points.length - 2] ?? line.width),
    y: line.y + (line.points[line.points.length - 1] ?? line.height),
  };
}

export type { ConnectorEnd };
