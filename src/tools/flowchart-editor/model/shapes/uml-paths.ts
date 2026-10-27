/**
 * Shared SVG path generators for UML shapes.
 *
 * Convention: `w` / `h` are the node's pixel size and `p` is the adjustable-parameter reader (defaults declared in `ShapeDef.adjust`);
 * every function guards against bad sizes (never produces NaN) and the output drops straight into `ShapeDef.path`,
 * rendered by the `path` branch of `nodes/shapeDraw.tsx`.
 */

import type { ParamGetter } from './adjust';

/** Actor (stick figure): head + torso + arms + legs */
export const actorPath = (w: number, h: number): string => {
  const cx = w / 2;
  const r = w * 0.13;
  return (
    `M${cx - r},${h * 0.16} a${r},${r} 0 1,1 ${r * 2},0 a${r},${r} 0 1,1 -${r * 2},0 ` +
    `M${cx},${h * 0.3} V${h * 0.6} ` +
    `M${w * 0.22},${h * 0.44} H${w * 0.78} ` +
    `M${w * 0.26},${h * 0.94} L${cx},${h * 0.6} L${w * 0.74},${h * 0.94}`
  );
};

/** Package: top-left tab + body rectangle (tabHeight adjustable) */
export const packagePath = (w: number, h: number, p: ParamGetter): string => {
  const th = p('tabHeight');
  return `M0,${th} V${h} H${w} V${th} H${w * 0.45} V0 H0 Z`;
};

/**
 * Lifeline: object box on top + a vertical dashed line downward.
 * The header box height `lifelineHeader` is fixed in pixels (40px by default) and no longer scales with the lifeline height.
 */
export const lifelinePath = (w: number, h: number, p: ParamGetter): string => {
  const hh = p('lifelineHeader');
  return `M${w * 0.2},0 H${w * 0.8} V${hh} H${w * 0.2} Z M${w * 0.5},${hh} V${h}`;
};

/** Full circle (two semicircular arcs), reused by circular icons that need no fill */
const circlePath = (cx: number, cy: number, r: number): string =>
  `M${cx - r},${cy} a${r},${r} 0 1,1 ${r * 2},0 a${r},${r} 0 1,1 -${r * 2},0`;

/** Boundary (analysis kind): circle + vertical line on the left + connecting stub */
export const boundaryPath = (w: number, h: number): string => {
  const r = Math.min(w, h) * 0.26;
  const cx = w * 0.62;
  const cy = h / 2;
  const lx = w * 0.32;
  return (
    `${circlePath(cx, cy, r)} ` +
    `M${lx},${cy - r * 1.15} V${cy + r * 1.15} M${lx},${cy} H${cx - r}`
  );
};

/** Control (analysis kind): circle + small arrow on top */
export const controlPath = (w: number, h: number): string => {
  const r = Math.min(w, h) * 0.26;
  const cx = w / 2;
  const cy = h * 0.62;
  const top = cy - r;
  return (
    `${circlePath(cx, cy, r)} ` +
    `M${cx},${top} V${top - r * 0.7} ` +
    `M${cx - r * 0.45},${top - r * 0.3} L${cx},${top - r * 0.7} L${cx + r * 0.45},${top - r * 0.3}`
  );
};

/** Entity (analysis kind): circle + horizontal line at the bottom + connecting vertical line */
export const entityPath = (w: number, h: number): string => {
  const r = Math.min(w, h) * 0.24;
  const cx = w / 2;
  const cy = h * 0.4;
  const base = h * 0.84;
  return (
    `${circlePath(cx, cy, r)} ` + `M${cx},${cy + r} V${base} ` + `M${w * 0.16},${base} H${w * 0.84}`
  );
};

/** Frame: outer rectangle + pentagon name tab at the top-left (tabHeight adjustable) */
export const framePath = (w: number, h: number, p: ParamGetter): string => {
  const tabW = Math.min(w * 0.42, 160);
  const tabH = p('tabHeight');
  const clip = tabH * 0.7;
  return `M0,0 H${w} V${h} H0 Z M0,0 H${tabW} L${tabW - clip},${tabH} H0 Z`;
};

/** System boundary / subject: rectangle with a name bar at the top-left (tabHeight adjustable) */
export const subjectPath = (w: number, h: number, p: ParamGetter): string => {
  const tabW = Math.min(w * 0.46, 180);
  const tabH = p('tabHeight');
  return `M0,0 H${tabW} V${tabH} H${w} V${h} H0 Z`;
};

/** Rounded rectangle (with an internal relation marker when it points with an arrow) */
const roundedRect = (w: number, h: number): string => {
  const r = Math.max(0, Math.min(12, w / 2, h / 2));
  return (
    `M${r},0 H${w - r} a${r},${r} 0 0 1 ${r},${r} V${h - r} ` +
    `a${r},${r} 0 0 1 -${r},${r} H${r} a${r},${r} 0 0 1 -${r},-${r} V${r} a${r},${r} 0 0 1 ${r},-${r} Z`
  );
};

/** Include relation: rounded rectangle + internal right arrow (dotted line controlled by the style's lineDash) */
export const includePath = (w: number, h: number): string => {
  const y = h / 2;
  return (
    `${roundedRect(w, h)} ` +
    `M${w * 0.32},${y} H${w * 0.66} ` +
    `M${w * 0.54},${y - h * 0.14} L${w * 0.66},${y} L${w * 0.54},${y + h * 0.14}`
  );
};

/** Extend relation: rounded rectangle + internal left arrow */
export const extendPath = (w: number, h: number): string => {
  const y = h / 2;
  return (
    `${roundedRect(w, h)} ` +
    `M${w * 0.68},${y} H${w * 0.34} ` +
    `M${w * 0.46},${y - h * 0.14} L${w * 0.34},${y} L${w * 0.46},${y + h * 0.14}`
  );
};

/** Active class: rectangle + double vertical lines on both sides (inset adjustable) */
export const activeClassPath = (w: number, h: number, p: ParamGetter): string => {
  const inset = p('activeClassInset');
  return `M0,0 H${w} V${h} H0 Z M${inset},0 V${h} M${w - inset},0 V${h}`;
};

/** Template class: rectangle + small dashed box at the top-right (tabHeight adjustable) */
export const templateClassPath = (w: number, h: number, p: ParamGetter): string => {
  const tw = Math.min(w * 0.34, 70);
  const th = p('tabHeight');
  return `M0,0 H${w} V${h} H0 Z ` + `M${w - tw - 4},4 H${w - 4} V${4 + th} H${w - tw - 4} Z`;
};

/** Component: body rectangle + two small nubs on the left (tabWidth adjustable) */
export const componentPath = (w: number, h: number, p: ParamGetter): string => {
  const tw = p('componentTab');
  const ty = h * 0.16;
  const t1a = h * 0.3;
  const t1b = h * 0.44;
  const t2a = h * 0.56;
  const t2b = h * 0.7;
  return (
    `M${tw},${ty} H${w} V${h - ty} H${tw} ` +
    `V${t2b} H0 V${t2a} H${tw} V${t1b} H0 V${t1a} H${tw} Z`
  );
};

/** Provided interface (ball): circle + dropline + horizontal line at the bottom */
export const providedInterfacePath = (w: number, h: number): string => {
  const r = Math.min(w, h) * 0.2;
  const cx = w / 2;
  const cy = r + 3;
  return (
    `${circlePath(cx, cy, r)} ` + `M${cx},${cy + r} V${h - 4} M${w * 0.18},${h - 4} H${w * 0.82}`
  );
};

/** Required interface (socket): semicircle opening to the right + dropline + horizontal line at the bottom */
export const requiredInterfacePath = (w: number, h: number): string => {
  const r = Math.min(w, h) * 0.2;
  const cx = w / 2;
  const cy = r + 3;
  return (
    `M${cx},${cy - r} A${r},${r} 0 0 0 ${cx},${cy + r} ` +
    `M${cx},${cy + r} V${h - 4} M${w * 0.18},${h - 4} H${w * 0.82}`
  );
};

/** Destroy marker: a thick cross (X polygon filled by the style) */
export const destroyPath = (w: number, h: number): string => {
  const t = Math.min(w, h) * 0.14;
  const cx = w / 2;
  const cy = h / 2;
  return (
    `M${cx - t},${cy - h * 0.34} L${cx},${cy - t} L${cx + t},${cy - h * 0.34} ` +
    `L${w * 0.78},${cy - h * 0.34} L${cx + t},${cy} L${w * 0.78},${cy + h * 0.34} ` +
    `L${cx + t},${cy + t} L${cx},${cy + h * 0.34} L${cx - t},${cy + t} ` +
    `L${w * 0.22},${cy + h * 0.34} L${cx - t},${cy} L${w * 0.22},${cy - h * 0.34} Z`
  );
};

/** Combined fragment / frame: outer box + pentagon tab with a cut corner at the top-left (tabHeight adjustable) */
export const combinedFragmentPath = (w: number, h: number, p: ParamGetter): string => {
  const tabW = Math.min(w * 0.4, 150);
  const tabH = p('tabHeight');
  const clip = tabH * 0.7;
  return `M0,0 H${w} V${h} H0 Z M0,0 H${tabW} L${tabW - clip},${tabH} H0 Z`;
};

/** Interaction use (ref): outer box + rectangular tab at the top-left (tabHeight adjustable) */
export const interactionUsePath = (w: number, h: number, p: ParamGetter): string => {
  const tabW = Math.min(w * 0.4, 150);
  const tabH = p('tabHeight');
  return `M0,0 H${w} V${h} H0 Z M0,0 H${tabW} V${tabH} H0 Z`;
};

/** Send signal: convex pentagon with a point on the right */
export const sendSignalPath = (w: number, h: number): string =>
  `M0,0 H${w * 0.7} L${w},${h / 2} L${w * 0.7},${h} H0 Z`;

/** Receive signal: pentagon with a concave notch on the left */
export const receiveSignalPath = (w: number, h: number): string =>
  `M${w * 0.3},0 H${w} V${h} H${w * 0.3} L0,${h / 2} Z`;

/** Activity partition: outer box + vertical divider on the left (left column width adjustable) */
export const activityPartitionPath = (w: number, h: number, p: ParamGetter): string => {
  const hw = p('partitionHeader');
  return `M0,0 H${w} V${h} H0 Z M${hw},0 V${h}`;
};

/** Deployment node: 3D cube (front/top/right faces; depth adjustable) */
export const nodePath = (w: number, h: number, p: ParamGetter): string => {
  const d = p('cubeDepth');
  return (
    `M0,${d} L${d},0 H${w} V${h - d} L${w - d},${h} H0 Z ` +
    `M0,${d} H${w - d} V${h} M${w - d},${d} L${w},0`
  );
};

/** Device: 3D cube + a horizontal line above the front face (distinguishing it from a plain node) */
export const devicePath = (w: number, h: number, p: ParamGetter): string => {
  const d = p('cubeDepth');
  return `${nodePath(w, h, p)} M0,${d + h * 0.18} H${w - d}`;
};

/** Execution environment: 3D cube + double horizontal lines below the front face */
export const executionEnvironmentPath = (w: number, h: number, p: ParamGetter): string => {
  const d = p('cubeDepth');
  return `${nodePath(w, h, p)} M0,${h * 0.66} H${w - d} M0,${h * 0.76} H${w - d}`;
};

/** Artifact: rectangle with a folded top-right corner (fold adjustable) */
export const artifactPath = (w: number, h: number, p: ParamGetter): string => {
  const c = p('foldSize');
  return `M0,0 H${w - c} L${w},${c} V${h} H0 Z M${w - c},0 V${c} H${w}`;
};
