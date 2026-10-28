import type { PathCommand, ShapeGeometry } from './types';

/**
 * Custom geometry helpers.
 *
 * Commands are stored in normalized 0~1 space so a shape can be resized without touching the
 * path; rendering scales them to the element box and export multiplies them back into the
 * `a:path@w/h` space used by DrawingML.
 */

const PRECISION = 5;

function fmt(value: number): string {
  const rounded = Number(value.toFixed(PRECISION));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** Commands → SVG path string (absolute, ready for Konva.Path) */
export function commandsToSvg(commands: PathCommand[]): string {
  const parts: string[] = [];
  for (const command of commands) {
    switch (command.c) {
      case 'M':
        parts.push(`M ${fmt(command.x)} ${fmt(command.y)}`);
        break;
      case 'L':
        parts.push(`L ${fmt(command.x)} ${fmt(command.y)}`);
        break;
      case 'C':
        parts.push(
          `C ${fmt(command.x1)} ${fmt(command.y1)} ${fmt(command.x2)} ${fmt(command.y2)} ${fmt(
            command.x,
          )} ${fmt(command.y)}`,
        );
        break;
      case 'Q':
        parts.push(`Q ${fmt(command.x1)} ${fmt(command.y1)} ${fmt(command.x)} ${fmt(command.y)}`);
        break;
      case 'Z':
        parts.push('Z');
        break;
    }
  }
  return parts.join(' ');
}

/** Scale normalized commands onto the element box */
export function scaleCommands(
  commands: PathCommand[],
  width: number,
  height: number,
): PathCommand[] {
  return commands.map((command) => {
    switch (command.c) {
      case 'M':
      case 'L':
        return { ...command, x: command.x * width, y: command.y * height };
      case 'C':
        return {
          ...command,
          x1: command.x1 * width,
          y1: command.y1 * height,
          x2: command.x2 * width,
          y2: command.y2 * height,
          x: command.x * width,
          y: command.y * height,
        };
      case 'Q':
        return {
          ...command,
          x1: command.x1 * width,
          y1: command.y1 * height,
          x: command.x * width,
          y: command.y * height,
        };
      case 'Z':
        return command;
    }
  });
}

const TOKEN = /([MmLlHhVvCcQqZzSsTtAa])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;

/**
 * Parse an absolute or relative SVG path (`M/L/H/V/C/Q/Z`, plus `S/T/A` which are ignored) into
 * normalized commands. Used when a document carries only the SVG string (older docs, pasted
 * shapes) and needs to be written back as `a:custGeom`.
 */
export function svgToCommands(d: string): PathCommand[] {
  const tokens = d.match(TOKEN) ?? [];
  const out: PathCommand[] = [];
  let index = 0;
  let current = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  const num = (): number => {
    const value = Number(tokens[index]);
    index += 1;
    return Number.isFinite(value) ? value : 0;
  };

  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) {
      current = tokens[index];
      index += 1;
    }
    if (!current) break;
    const upper = current.toUpperCase();
    const relative = current !== upper;

    switch (upper) {
      case 'M': {
        const nx = num();
        const ny = num();
        x = relative ? x + nx : nx;
        y = relative ? y + ny : ny;
        startX = x;
        startY = y;
        out.push({ c: 'M', x, y });
        break;
      }
      case 'L': {
        const nx = num();
        const ny = num();
        x = relative ? x + nx : nx;
        y = relative ? y + ny : ny;
        out.push({ c: 'L', x, y });
        break;
      }
      case 'H': {
        const nx = num();
        x = relative ? x + nx : nx;
        out.push({ c: 'L', x, y });
        break;
      }
      case 'V': {
        const ny = num();
        y = relative ? y + ny : ny;
        out.push({ c: 'L', x, y });
        break;
      }
      case 'C': {
        const x1 = num();
        const y1 = num();
        const x2 = num();
        const y2 = num();
        const nx = num();
        const ny = num();
        const abs = {
          x1: relative ? x + x1 : x1,
          y1: relative ? y + y1 : y1,
          x2: relative ? x + x2 : x2,
          y2: relative ? y + y2 : y2,
        };
        x = relative ? x + nx : nx;
        y = relative ? y + ny : ny;
        out.push({ c: 'C', ...abs, x, y });
        break;
      }
      case 'Q': {
        const x1 = num();
        const y1 = num();
        const nx = num();
        const ny = num();
        const abs = { x1: relative ? x + x1 : x1, y1: relative ? y + y1 : y1 };
        x = relative ? x + nx : nx;
        y = relative ? y + ny : ny;
        out.push({ c: 'Q', ...abs, x, y });
        break;
      }
      case 'Z': {
        out.push({ c: 'Z' });
        x = startX;
        y = startY;
        break;
      }
      default:
        // Arc / smooth curves are not produced by this editor; skip instead of guessing
        while (index < tokens.length && !/^[A-Za-z]$/.test(tokens[index])) index += 1;
        break;
    }
  }
  return out;
}

/** Whether a shape carries an explicit path (and therefore must bypass prst resolution) */
export function hasCustomGeometry(geom: { custGeom?: PathCommand[] }): boolean {
  return (geom.custGeom?.length ?? 0) >= 2;
}

/** Read the editable commands of a shape: explicit `custGeom` first, legacy `path` string second */
export function commandsFromGeometry(geom: {
  custGeom?: PathCommand[];
  path?: string;
}): PathCommand[] {
  if ((geom.custGeom?.length ?? 0) >= 2) return geom.custGeom as PathCommand[];
  return geom.path ? svgToCommands(geom.path) : [];
}

export interface PointsGeometry {
  geom: ShapeGeometry;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Smallest box a pen drawing may collapse to (a straight line still needs a draggable target) */
const MIN_EXTENT = 2;

/**
 * Turn canvas-space points (page coordinates) into a closed custom geometry plus the element box.
 * The points are normalized into that box, so the resulting shape can be resized afterwards.
 */
export function geometryFromPoints(points: { x: number; y: number }[]): PointsGeometry | null {
  if (points.length < 2) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(Math.max(...xs) - minX, MIN_EXTENT);
  const height = Math.max(Math.max(...ys) - minY, MIN_EXTENT);

  const commands: PathCommand[] = points.map((point, index) =>
    index === 0
      ? { c: 'M', x: (point.x - minX) / width, y: (point.y - minY) / height }
      : { c: 'L', x: (point.x - minX) / width, y: (point.y - minY) / height },
  );
  commands.push({ c: 'Z' });

  return {
    geom: {
      kind: 'path',
      prst: 'rect',
      path: commandsToSvg(commands),
      custGeom: commands,
    },
    x: minX,
    y: minY,
    width,
    height,
  };
}

/* ------------------------------------------------------------------ *
 * Node editing (P1-1.4)
 *
 * Editable anchors are the `M/L/C/Q` commands; `Z` carries no point. Control handles are not
 * stored on the anchor: the out handle of anchor i lives in command i+1 (`x1/y1`) and the in
 * handle of anchor i lives in command i (`x2/y2`, or `x1/y1` for a quadratic). Everything here
 * is pure and works on normalized commands; rendering and the store only translate coordinates.
 * ------------------------------------------------------------------ */

export interface PathPoint {
  x: number;
  y: number;
}

export interface PathNodeView {
  /** Index of the command that ends at this anchor */
  index: number;
  x: number;
  y: number;
  /** Control point of the incoming segment */
  in?: PathPoint;
  /** Control point of the outgoing segment (absent when the next command is Z / none) */
  out?: PathPoint;
  /** Both handles exist and are collinear through the anchor */
  smooth: boolean;
}

const HANDLE_EPSILON = 1e-6;
/** 2% of the handle length may deviate from a straight line and still count as "smooth" */
const SMOOTH_TOLERANCE = 0.02;

function lengthOf(ax: number, ay: number): number {
  return Math.hypot(ax, ay);
}

function distance(a: PathPoint, b: PathPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function previousAnchor(commands: PathCommand[], index: number): PathPoint | undefined {
  for (let i = index - 1; i >= 0; i -= 1) {
    const command = commands[i];
    if (command.c !== 'Z') return { x: command.x, y: command.y };
  }
  return undefined;
}

function nextAnchor(commands: PathCommand[], index: number): PathPoint | undefined {
  for (let i = index + 1; i < commands.length; i += 1) {
    const command = commands[i];
    if (command.c !== 'Z') return { x: command.x, y: command.y };
  }
  return undefined;
}

function isSmoothNode(view: PathNodeView): boolean {
  if (!view.in || !view.out) return false;
  const ix = view.x - view.in.x;
  const iy = view.y - view.in.y;
  const ox = view.out.x - view.x;
  const oy = view.out.y - view.y;
  const li = lengthOf(ix, iy);
  const lo = lengthOf(ox, oy);
  if (li < HANDLE_EPSILON || lo < HANDLE_EPSILON) return false;
  const cross = Math.abs(ix * oy - iy * ox) / (li * lo);
  const dot = (ix * ox + iy * oy) / (li * lo);
  return cross <= SMOOTH_TOLERANCE && dot > 0;
}

/** Anchors of a path (one entry per `M/L/C/Q` command) with their control handles */
export function pathNodes(commands: PathCommand[]): PathNodeView[] {
  const nodes: PathNodeView[] = [];
  commands.forEach((command, index) => {
    if (command.c === 'Z') return;
    const view: PathNodeView = { index, x: command.x, y: command.y, smooth: false };
    if (command.c === 'C') view.in = { x: command.x2, y: command.y2 };
    if (command.c === 'Q') view.in = { x: command.x1, y: command.y1 };
    const next = commands[index + 1];
    // A quadratic's single control belongs to the segment, so it is exposed as the end anchor's in-handle only
    if (next?.c === 'C') view.out = { x: next.x1, y: next.y1 };
    view.smooth = isSmoothNode(view);
    nodes.push(view);
  });
  return nodes;
}

/** Move one anchor, carrying its adjacent control points so the curve keeps its shape */
export function movePathAnchor(
  commands: PathCommand[],
  index: number,
  x: number,
  y: number,
): PathCommand[] {
  const anchor = commands[index];
  if (!anchor || anchor.c === 'Z') return commands;
  const dx = x - anchor.x;
  const dy = y - anchor.y;
  if (Math.abs(dx) < HANDLE_EPSILON && Math.abs(dy) < HANDLE_EPSILON) return commands;

  const next = [...commands];
  // The anchor's in-handle lives on its own command, its out-handle on the following one
  next[index] =
    anchor.c === 'C'
      ? { ...anchor, x, y, x2: anchor.x2 + dx, y2: anchor.y2 + dy }
      : anchor.c === 'Q'
        ? { ...anchor, x, y, x1: anchor.x1 + dx, y1: anchor.y1 + dy }
        : { ...anchor, x, y };
  const segment = next[index + 1];
  if (segment?.c === 'C') {
    next[index + 1] = { ...segment, x1: segment.x1 + dx, y1: segment.y1 + dy };
  }
  return next;
}

/** Mirror the opposite handle of a smooth node so the point stays smooth while dragging */
function mirrorOppositeHandle(
  commands: PathCommand[],
  index: number,
  which: 'in' | 'out',
  moved: PathPoint,
  before?: PathNodeView,
): PathCommand[] {
  const anchor = commands[index];
  if (!anchor || anchor.c === 'Z') return commands;
  const opposite = which === 'in' ? before?.out : before?.in;
  if (!opposite) return commands;
  const keep = distance(anchor, opposite);
  const vx = anchor.x - moved.x;
  const vy = anchor.y - moved.y;
  const len = lengthOf(vx, vy);
  if (keep < HANDLE_EPSILON || len < HANDLE_EPSILON) return commands;
  const target: PathPoint = { x: anchor.x + (vx / len) * keep, y: anchor.y + (vy / len) * keep };

  const next = [...commands];
  if (which === 'in') {
    const segment = next[index + 1];
    if (segment?.c === 'C') next[index + 1] = { ...segment, x1: target.x, y1: target.y };
  } else if (anchor.c === 'C') {
    next[index] = { ...anchor, x2: target.x, y2: target.y };
  } else if (anchor.c === 'Q') {
    next[index] = { ...anchor, x1: target.x, y1: target.y };
  }
  return next;
}

/** Move one bezier control handle of an anchor (normalized coordinates) */
export function movePathControl(
  commands: PathCommand[],
  index: number,
  which: 'in' | 'out',
  x: number,
  y: number,
): PathCommand[] {
  const anchor = commands[index];
  if (!anchor || anchor.c === 'Z') return commands;
  const before = pathNodes(commands).find((node) => node.index === index);

  const next = [...commands];
  if (which === 'in') {
    if (anchor.c === 'C') next[index] = { ...anchor, x2: x, y2: y };
    else if (anchor.c === 'Q') next[index] = { ...anchor, x1: x, y1: y };
    else return commands;
  } else {
    const segment = next[index + 1];
    if (segment?.c !== 'C') return commands;
    next[index + 1] = { ...segment, x1: x, y1: y };
  }
  return before?.smooth ? mirrorOppositeHandle(next, index, which, { x, y }, before) : next;
}

/** Drop one anchor; a path always keeps at least two anchors */
export function removePathAnchor(commands: PathCommand[], index: number): PathCommand[] {
  const removed = commands[index];
  if (!removed || removed.c === 'Z') return commands;
  if (pathNodes(commands).length <= 2) return commands;

  const next = [...commands];
  next.splice(index, 1);
  const follow = next[index];
  if (removed.c === 'M') {
    // The path must still start with a move
    if (follow && follow.c !== 'Z') next[index] = { c: 'M', x: follow.x, y: follow.y };
  } else if (follow && (follow.c === 'C' || follow.c === 'Q')) {
    // The segment after a removed anchor becomes a straight line (its handles pointed at it)
    next[index] = { c: 'L', x: follow.x, y: follow.y };
  }
  return next;
}

/** Tangent through the anchor: previous→next when both exist, otherwise toward the only neighbor */
function tangentAt(anchor: PathPoint, before?: PathPoint, after?: PathPoint): PathPoint | null {
  const from = before ?? anchor;
  const to = after ?? anchor;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = lengthOf(dx, dy);
  if (len < HANDLE_EPSILON) return null;
  return { x: dx / len, y: dy / len };
}

/** Corner → smooth: both adjacent segments become curves with collinear handles */
function smoothPathNode(commands: PathCommand[], index: number): PathCommand[] {
  const anchorCommand = commands[index];
  if (!anchorCommand || anchorCommand.c === 'Z') return commands;
  const anchor: PathPoint = { x: anchorCommand.x, y: anchorCommand.y };
  const before = previousAnchor(commands, index);
  const after = nextAnchor(commands, index);
  const tangent = tangentAt(anchor, before, after);
  if (!tangent) return commands;

  const next = [...commands];
  if (anchorCommand.c !== 'M' && before) {
    const reach = distance(before, anchor) / 3;
    const inPoint: PathPoint = {
      x: anchor.x - tangent.x * reach,
      y: anchor.y - tangent.y * reach,
    };
    next[index] =
      anchorCommand.c === 'C'
        ? { ...anchorCommand, x2: inPoint.x, y2: inPoint.y }
        : {
            c: 'C',
            x1: before.x,
            y1: before.y,
            x2: inPoint.x,
            y2: inPoint.y,
            x: anchor.x,
            y: anchor.y,
          };
  }

  const segment = commands[index + 1];
  if (segment && segment.c !== 'Z' && after) {
    const reach = distance(anchor, after) / 3;
    const outPoint: PathPoint = {
      x: anchor.x + tangent.x * reach,
      y: anchor.y + tangent.y * reach,
    };
    next[index + 1] =
      segment.c === 'C'
        ? { ...segment, x1: outPoint.x, y1: outPoint.y }
        : {
            c: 'C',
            x1: outPoint.x,
            y1: outPoint.y,
            x2: after.x,
            y2: after.y,
            x: segment.x,
            y: segment.y,
          };
  }
  return next;
}

/** Smooth → corner: both adjacent segments become straight lines */
function straightenPathNode(commands: PathCommand[], index: number): PathCommand[] {
  const anchor = commands[index];
  if (!anchor || anchor.c === 'Z') return commands;
  const next = [...commands];
  if (anchor.c === 'C' || anchor.c === 'Q') next[index] = { c: 'L', x: anchor.x, y: anchor.y };
  const segment = next[index + 1];
  if (segment && (segment.c === 'C' || segment.c === 'Q')) {
    next[index + 1] = { c: 'L', x: segment.x, y: segment.y };
  }
  return next;
}

/** Toggle one anchor between smooth (curved, collinear handles) and corner (straight lines) */
export function togglePathNodeSmooth(commands: PathCommand[], index: number): PathCommand[] {
  const view = pathNodes(commands).find((node) => node.index === index);
  if (!view) return commands;
  return view.smooth ? straightenPathNode(commands, index) : smoothPathNode(commands, index);
}
