import type { ShapeGeometry } from './geometry';
import { commandsToSvg, scaleCommands, svgToCommands } from './custGeom';

/**
 * ShapeGeometry → SVG `path` in pixel space (P3-1.2, shared by RTE / spreadsheet).
 *
 * The kernel stores geometry normalized (0~1) because it is resolution-free and shared with xlsx /
 * pptx. The DOM renderer needs absolute pixels, and the conversion differs per kind:
 * `rect` → rounded-rect arcs, `ellipse` → two arcs, `star`/`polygon` → explicit vertices,
 * `path` → scaled custom geometry (or a parsed SVG string).
 */

function fmt(value: number): string {
  return String(Number(value.toFixed(3)));
}

function roundedRectPath(width: number, height: number, radius: number): string {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  if (r <= 0) return `M 0 0 L ${fmt(w)} 0 L ${fmt(w)} ${fmt(h)} L 0 ${fmt(h)} Z`;
  return [
    `M ${fmt(r)} 0`,
    `L ${fmt(w - r)} 0`,
    `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(w)} ${fmt(r)}`,
    `L ${fmt(w)} ${fmt(h - r)}`,
    `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(w - r)} ${fmt(h)}`,
    `L ${fmt(r)} ${fmt(h)}`,
    `A ${fmt(r)} ${fmt(r)} 0 0 1 0 ${fmt(h - r)}`,
    `L 0 ${fmt(r)}`,
    `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(r)} 0`,
    'Z',
  ].join(' ');
}

function ellipsePath(width: number, height: number): string {
  const rx = Math.max(1, width) / 2;
  const ry = Math.max(1, height) / 2;
  return [
    `M 0 ${fmt(ry)}`,
    `A ${fmt(rx)} ${fmt(ry)} 0 0 1 ${fmt(rx * 2)} ${fmt(ry)}`,
    `A ${fmt(rx)} ${fmt(ry)} 0 0 1 0 ${fmt(ry)}`,
    'Z',
  ].join(' ');
}

function starPath(width: number, height: number, points: number, innerRatio: number): string {
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.min(width, height) / 2;
  const inner = outer * Math.max(0.01, Math.min(1, innerRatio));
  const count = Math.max(3, Math.round(points));
  const parts: string[] = [];
  for (let index = 0; index < count * 2; index += 1) {
    // Start at the top vertex, like PowerPoint's star presets
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI * index) / count - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    parts.push(`${index === 0 ? 'M' : 'L'} ${fmt(x)} ${fmt(y)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

function polygonPath(geometry: ShapeGeometry, width: number, height: number): string {
  const points = geometry.points ?? [];
  if (points.length < 6) return '';
  const parts: string[] = [];
  for (let index = 0; index + 1 < points.length; index += 2) {
    const x = points[index] * width;
    const y = points[index + 1] * height;
    parts.push(`${index === 0 ? 'M' : 'L'} ${fmt(x)} ${fmt(y)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/** Absolute SVG path for a shape, never empty (an unknown preset degrades to a rectangle) */
export function shapePathD(geometry: ShapeGeometry, width: number, height: number): string {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  switch (geometry.kind) {
    case 'ellipse':
      return ellipsePath(w, h);
    case 'star':
      return starPath(
        w,
        h,
        Number(/\d+$/.exec(geometry.prst)?.[0] ?? 5),
        geometry.innerRatio ?? 0.38,
      );
    case 'polygon': {
      const path = polygonPath(geometry, w, h);
      return path || roundedRectPath(w, h, 0);
    }
    case 'path': {
      const commands =
        geometry.custGeom && geometry.custGeom.length > 0
          ? geometry.custGeom
          : svgToCommands(geometry.path ?? '');
      const scaled = scaleCommands(commands, w, h);
      const path = scaled.length > 0 ? commandsToSvg(scaled) : '';
      return path || roundedRectPath(w, h, 0);
    }
    default:
      return roundedRectPath(w, h, (geometry.radius ?? 0) * Math.min(w, h));
  }
}
