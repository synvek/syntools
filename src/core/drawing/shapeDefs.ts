import type { ShapeGeometry } from './geometry';

/**
 * Shape preset catalogue.
 *
 * A preset owns three things:
 * - the render outline builder (adjustment values → polygon/rect/star geometry)
 * - the adjustment handles (where PowerPoint shows its yellow diamonds)
 * - the grouping/label used by the insert panel
 *
 * Documents only persist `geom.prst` + `geom.adj`; everything here is derived, so
 * adding a preset never changes the file schema.
 *
 * It also carries the **static** `prst → geometry` table used when importing a file that
 * references a shape we have no adjustable definition for, plus `resolvePresetGeometry`
 * (adjustable definitions win, the static table is the fallback). Living in the shared
 * kernel (P2-6) means the rich-text / spreadsheet shape layers get the same 40+ outlines.
 */
export type ShapeGroup = 'basic' | 'arrow' | 'star' | 'flowchart' | 'callout' | 'math';

export interface ShapeAdjustSpec {
  /** DrawingML adjustment name (`adj1`, `adj2`…) */
  id: string;
  /** Default value, normalized 0~1 */
  value: number;
  min: number;
  max: number;
  /** Handle position in element-normalized coordinates (0~1) */
  at: (value: number) => { x: number; y: number };
  /** Value implied by a dragged handle position */
  from: (point: { x: number; y: number }) => number;
}

export interface ShapeDef {
  prst: string;
  group: ShapeGroup;
  labelKey: string;
  adjusts?: ShapeAdjustSpec[];
  outline: (adj: Record<string, number>) => ShapeGeometry;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const adjValue = (adj: Record<string, number>, id: string, fallback: number): number =>
  Number.isFinite(adj[id]) ? adj[id] : fallback;

const poly = (prst: string, points: number[][], adj?: Record<string, number>): ShapeGeometry => ({
  kind: 'polygon',
  points: points.flat(),
  prst,
  ...(adj ? { adj } : {}),
});

const rect = (prst: string, radius = 0, adj?: Record<string, number>): ShapeGeometry => ({
  kind: 'rect',
  radius,
  prst,
  ...(adj ? { adj } : {}),
});

const ellipse = (prst: string): ShapeGeometry => ({ kind: 'ellipse', prst });

const star = (prst: string, innerRatio: number, adj?: Record<string, number>): ShapeGeometry => ({
  kind: 'star',
  innerRatio,
  prst,
  ...(adj ? { adj } : {}),
});

/** Rotate a normalized point set: 0 = right, 1 = left, 2 = up, 3 = down */
function arrowPoints(direction: 0 | 1 | 2 | 3, shaft: number, head: number): number[][] {
  const thickness = clamp(shaft, 0.1, 0.9);
  const headLength = clamp(head, 0.1, 0.9);
  const y0 = (1 - thickness) / 2;
  const y1 = (1 + thickness) / 2;
  const base: number[][] = [
    [0, y0],
    [1 - headLength, y0],
    [1 - headLength, 0],
    [1, 0.5],
    [1 - headLength, 1],
    [1 - headLength, y1],
    [0, y1],
  ];
  if (direction === 0) return base;
  if (direction === 1) return base.map(([x, y]) => [1 - x, y]);
  if (direction === 2) return base.map(([x, y]) => [y, 1 - x]);
  return base.map(([x, y]) => [1 - y, x]);
}

function arrowGeometry(
  prst: string,
  direction: 0 | 1 | 2 | 3,
  adj: Record<string, number>,
): ShapeGeometry {
  const shaft = adjValue(adj, 'adj1', 0.5);
  const head = adjValue(adj, 'adj2', 0.4);
  return poly(prst, arrowPoints(direction, shaft, head), adj);
}

/** Shared shaft/head handles for the four one-direction arrows */
function arrowAdjusts(direction: 0 | 1 | 2 | 3): ShapeAdjustSpec[] {
  const shaftHandle = (value: number) => {
    if (direction === 2) return { x: (1 - value) / 2, y: 0.5 };
    if (direction === 3) return { x: (1 - value) / 2, y: 0.5 };
    return { x: 0.5, y: (1 - value) / 2 };
  };
  const shaftFrom = (point: { x: number; y: number }) => {
    if (direction === 2 || direction === 3) return clamp(1 - point.x * 2, 0.1, 0.9);
    return clamp(1 - point.y * 2, 0.1, 0.9);
  };
  const headHandle = (value: number) => {
    if (direction === 1) return { x: value, y: 0.5 };
    if (direction === 2) return { x: 0.5, y: value };
    if (direction === 3) return { x: 0.5, y: 1 - value };
    return { x: 1 - value, y: 0.5 };
  };
  const headFrom = (point: { x: number; y: number }) => {
    if (direction === 1) return clamp(point.x, 0.1, 0.9);
    if (direction === 2) return clamp(point.y, 0.1, 0.9);
    if (direction === 3) return clamp(1 - point.y, 0.1, 0.9);
    return clamp(1 - point.x, 0.1, 0.9);
  };
  return [
    { id: 'adj1', value: 0.5, min: 0.1, max: 0.9, at: shaftHandle, from: shaftFrom },
    { id: 'adj2', value: 0.4, min: 0.1, max: 0.9, at: headHandle, from: headFrom },
  ];
}

export const SHAPE_DEFS: ShapeDef[] = [
  // ---------------------------------------------------------------- basic
  {
    prst: 'rect',
    group: 'basic',
    labelKey: 'shapePresetRect',
    outline: () => rect('rect'),
  },
  {
    prst: 'roundRect',
    group: 'basic',
    labelKey: 'shapePresetRoundRect',
    adjusts: [
      {
        id: 'adj1',
        value: 0.167,
        min: 0,
        max: 0.5,
        at: (value) => ({ x: value, y: 0 }),
        from: (point) => clamp(point.x, 0, 0.5),
      },
    ],
    outline: (adj) => rect('roundRect', adjValue(adj, 'adj1', 0.167), adj),
  },
  {
    prst: 'snipRoundRect',
    group: 'basic',
    labelKey: 'shapePresetSnipRoundRect',
    adjusts: [
      {
        id: 'adj1',
        value: 0.167,
        min: 0,
        max: 0.5,
        at: (value) => ({ x: value, y: 0 }),
        from: (point) => clamp(point.x, 0, 0.5),
      },
    ],
    // P0 renders the rounded corner only; the snipped corner is kept as a prst export.
    outline: (adj) => rect('snipRoundRect', adjValue(adj, 'adj1', 0.167), adj),
  },
  {
    prst: 'ellipse',
    group: 'basic',
    labelKey: 'shapePresetEllipse',
    outline: () => ellipse('ellipse'),
  },
  {
    prst: 'triangle',
    group: 'basic',
    labelKey: 'shapePresetTriangle',
    adjusts: [
      {
        id: 'adj1',
        value: 0.5,
        min: 0,
        max: 1,
        at: (value) => ({ x: value, y: 0 }),
        from: (point) => clamp(point.x, 0, 1),
      },
    ],
    outline: (adj) => {
      const apex = clamp(adjValue(adj, 'adj1', 0.5), 0, 1);
      return poly(
        'triangle',
        [
          [apex, 0],
          [1, 1],
          [0, 1],
        ],
        adj,
      );
    },
  },
  {
    prst: 'rtTriangle',
    group: 'basic',
    labelKey: 'shapePresetRtTriangle',
    outline: () =>
      poly('rtTriangle', [
        [0, 0],
        [1, 1],
        [0, 1],
      ]),
  },
  {
    prst: 'isoTriangle',
    group: 'basic',
    labelKey: 'shapePresetIsoTriangle',
    outline: () =>
      poly('isoTriangle', [
        [0.5, 0],
        [1, 1],
        [0, 1],
      ]),
  },
  {
    prst: 'diamond',
    group: 'basic',
    labelKey: 'shapePresetDiamond',
    outline: () =>
      poly('diamond', [
        [0.5, 0],
        [1, 0.5],
        [0.5, 1],
        [0, 0.5],
      ]),
  },
  {
    prst: 'trapezoid',
    group: 'basic',
    labelKey: 'shapePresetTrapezoid',
    adjusts: [
      {
        id: 'adj1',
        value: 0.25,
        min: 0,
        max: 0.5,
        at: (value) => ({ x: value, y: 0 }),
        from: (point) => clamp(point.x, 0, 0.5),
      },
    ],
    outline: (adj) => {
      const inset = clamp(adjValue(adj, 'adj1', 0.25), 0, 0.5);
      return poly(
        'trapezoid',
        [
          [inset, 0],
          [1 - inset, 0],
          [1, 1],
          [0, 1],
        ],
        adj,
      );
    },
  },
  {
    prst: 'pentagon',
    group: 'basic',
    labelKey: 'shapePresetPentagon',
    outline: () =>
      poly('pentagon', [
        [0.5, 0],
        [1, 0.38],
        [0.82, 1],
        [0.18, 1],
        [0, 0.38],
      ]),
  },
  {
    prst: 'hexagon',
    group: 'basic',
    labelKey: 'shapePresetHexagon',
    adjusts: [
      {
        id: 'adj1',
        value: 0.25,
        min: 0,
        max: 0.5,
        at: (value) => ({ x: value, y: 0 }),
        from: (point) => clamp(point.x, 0, 0.5),
      },
    ],
    outline: (adj) => {
      const inset = clamp(adjValue(adj, 'adj1', 0.25), 0, 0.5);
      return poly(
        'hexagon',
        [
          [inset, 0],
          [1 - inset, 0],
          [1, 0.5],
          [1 - inset, 1],
          [inset, 1],
          [0, 0.5],
        ],
        adj,
      );
    },
  },
  {
    prst: 'octagon',
    group: 'basic',
    labelKey: 'shapePresetOctagon',
    adjusts: [
      {
        id: 'adj1',
        value: 0.2929,
        min: 0,
        max: 0.5,
        at: (value) => ({ x: value, y: 0 }),
        from: (point) => clamp(point.x, 0, 0.5),
      },
    ],
    outline: (adj) => {
      const cut = clamp(adjValue(adj, 'adj1', 0.2929), 0, 0.5);
      return poly(
        'octagon',
        [
          [cut, 0],
          [1 - cut, 0],
          [1, cut],
          [1, 1 - cut],
          [1 - cut, 1],
          [cut, 1],
          [0, 1 - cut],
          [0, cut],
        ],
        adj,
      );
    },
  },
  {
    prst: 'homePlate',
    group: 'basic',
    labelKey: 'shapePresetHomePlate',
    outline: () =>
      poly('homePlate', [
        [0.2, 0],
        [1, 0],
        [1, 1],
        [0.2, 1],
        [0, 0.5],
      ]),
  },
  {
    prst: 'parallelogram',
    group: 'basic',
    labelKey: 'shapePresetParallelogram',
    outline: () =>
      poly('parallelogram', [
        [0.25, 0],
        [1, 0],
        [0.75, 1],
        [0, 1],
      ]),
  },
  {
    prst: 'cross',
    group: 'basic',
    labelKey: 'shapePresetCross',
    outline: () =>
      poly('cross', [
        [0.35, 0],
        [0.65, 0],
        [0.65, 0.35],
        [1, 0.35],
        [1, 0.65],
        [0.65, 0.65],
        [0.65, 1],
        [0.35, 1],
        [0.35, 0.65],
        [0, 0.65],
        [0, 0.35],
        [0.35, 0.35],
      ]),
  },

  // ---------------------------------------------------------------- arrows
  {
    prst: 'rightArrow',
    group: 'arrow',
    labelKey: 'shapePresetRightArrow',
    adjusts: arrowAdjusts(0),
    outline: (adj) => arrowGeometry('rightArrow', 0, adj),
  },
  {
    prst: 'leftArrow',
    group: 'arrow',
    labelKey: 'shapePresetLeftArrow',
    adjusts: arrowAdjusts(1),
    outline: (adj) => arrowGeometry('leftArrow', 1, adj),
  },
  {
    prst: 'upArrow',
    group: 'arrow',
    labelKey: 'shapePresetUpArrow',
    adjusts: arrowAdjusts(2),
    outline: (adj) => arrowGeometry('upArrow', 2, adj),
  },
  {
    prst: 'downArrow',
    group: 'arrow',
    labelKey: 'shapePresetDownArrow',
    adjusts: arrowAdjusts(3),
    outline: (adj) => arrowGeometry('downArrow', 3, adj),
  },
  {
    prst: 'chevron',
    group: 'arrow',
    labelKey: 'shapePresetChevron',
    adjusts: [
      {
        id: 'adj1',
        value: 0.4,
        min: 0,
        max: 0.9,
        at: (value) => ({ x: value, y: 0.5 }),
        from: (point) => clamp(point.x, 0, 0.9),
      },
    ],
    outline: (adj) => {
      const depth = clamp(adjValue(adj, 'adj1', 0.4), 0, 0.9);
      return poly(
        'chevron',
        [
          [0, 0],
          [1 - depth, 0],
          [1, 0.5],
          [1 - depth, 1],
          [0, 1],
          [depth, 0.5],
        ],
        adj,
      );
    },
  },
  {
    prst: 'leftRightArrow',
    group: 'arrow',
    labelKey: 'shapePresetLeftRightArrow',
    outline: () =>
      poly('leftRightArrow', [
        [0, 0.5],
        [0.2, 0],
        [0.2, 0.3],
        [0.8, 0.3],
        [0.8, 0],
        [1, 0.5],
        [0.8, 1],
        [0.8, 0.7],
        [0.2, 0.7],
        [0.2, 1],
      ]),
  },
  {
    prst: 'upDownArrow',
    group: 'arrow',
    labelKey: 'shapePresetUpDownArrow',
    outline: () =>
      poly('upDownArrow', [
        [0.5, 0],
        [1, 0.2],
        [0.7, 0.2],
        [0.7, 0.8],
        [1, 0.8],
        [0.5, 1],
        [0, 0.8],
        [0.3, 0.8],
        [0.3, 0.2],
        [0, 0.2],
      ]),
  },
  {
    prst: 'quadArrow',
    group: 'arrow',
    labelKey: 'shapePresetQuadArrow',
    outline: () =>
      poly('quadArrow', [
        [0.4, 0],
        [0.6, 0],
        [0.6, 0.3],
        [0.7, 0.3],
        [0.7, 0.4],
        [1, 0.4],
        [1, 0.6],
        [0.7, 0.6],
        [0.7, 0.7],
        [0.6, 0.7],
        [0.6, 1],
        [0.4, 1],
        [0.4, 0.7],
        [0.3, 0.7],
        [0.3, 0.6],
        [0, 0.6],
        [0, 0.4],
        [0.3, 0.4],
        [0.3, 0.3],
        [0.4, 0.3],
      ]),
  },

  // ---------------------------------------------------------------- stars
  {
    prst: 'star',
    group: 'star',
    labelKey: 'shapePresetStar',
    adjusts: [
      {
        id: 'adj1',
        value: 0.382,
        min: 0.1,
        max: 0.9,
        at: (value) => ({ x: 0.5, y: 0.5 - value * 0.5 }),
        from: (point) => clamp((0.5 - point.y) * 2, 0.1, 0.9),
      },
    ],
    outline: (adj) => star('star', adjValue(adj, 'adj1', 0.382), adj),
  },
  {
    prst: 'star4',
    group: 'star',
    labelKey: 'shapePresetStar4',
    outline: () => star('star4', 0.382),
  },
  {
    prst: 'star6',
    group: 'star',
    labelKey: 'shapePresetStar6',
    outline: () => star('star6', 0.382),
  },
  {
    prst: 'star8',
    group: 'star',
    labelKey: 'shapePresetStar8',
    outline: () => star('star8', 0.382),
  },
  {
    prst: 'star12',
    group: 'star',
    labelKey: 'shapePresetStar12',
    outline: () => star('star12', 0.382),
  },
  {
    prst: 'star16',
    group: 'star',
    labelKey: 'shapePresetStar16',
    outline: () => star('star16', 0.382),
  },
  {
    prst: 'star24',
    group: 'star',
    labelKey: 'shapePresetStar24',
    outline: () => star('star24', 0.382),
  },
  {
    prst: 'star32',
    group: 'star',
    labelKey: 'shapePresetStar32',
    outline: () => star('star32', 0.382),
  },

  // ---------------------------------------------------------------- flowchart
  {
    prst: 'flowChartProcess',
    group: 'flowchart',
    labelKey: 'shapePresetFlowProcess',
    outline: () => rect('flowChartProcess'),
  },
  {
    prst: 'flowChartDecision',
    group: 'flowchart',
    labelKey: 'shapePresetFlowDecision',
    outline: () =>
      poly('flowChartDecision', [
        [0.5, 0],
        [1, 0.5],
        [0.5, 1],
        [0, 0.5],
      ]),
  },
  {
    prst: 'flowChartDocument',
    group: 'flowchart',
    labelKey: 'shapePresetFlowDocument',
    outline: () =>
      poly('flowChartDocument', [
        [0, 0],
        [1, 0],
        [1, 0.85],
        [0.85, 0.95],
        [0.7, 0.85],
        [0.55, 0.95],
        [0.4, 0.85],
        [0.25, 0.95],
        [0, 0.85],
      ]),
  },
  {
    prst: 'flowChartTerminator',
    group: 'flowchart',
    labelKey: 'shapePresetFlowTerminator',
    outline: () => rect('flowChartTerminator', 0.5),
  },
  {
    prst: 'flowChartConnector',
    group: 'flowchart',
    labelKey: 'shapePresetFlowConnector',
    outline: () => ellipse('flowChartConnector'),
  },

  // ---------------------------------------------------------------- callout
  {
    prst: 'wedgeRectCallout',
    group: 'callout',
    labelKey: 'shapePresetCallout',
    outline: () =>
      poly('wedgeRectCallout', [
        [0, 0],
        [1, 0],
        [1, 0.75],
        [0.45, 0.75],
        [0.25, 1],
        [0.3, 0.75],
        [0, 0.75],
      ]),
  },

  // ---------------------------------------------------------------- math
  {
    prst: 'mathPlus',
    group: 'math',
    labelKey: 'shapePresetMathPlus',
    outline: () =>
      poly('mathPlus', [
        [0.35, 0],
        [0.65, 0],
        [0.65, 0.35],
        [1, 0.35],
        [1, 0.65],
        [0.65, 0.65],
        [0.65, 1],
        [0.35, 1],
        [0.35, 0.65],
        [0, 0.65],
        [0, 0.35],
        [0.35, 0.35],
      ]),
  },
  {
    prst: 'mathMinus',
    group: 'math',
    labelKey: 'shapePresetMathMinus',
    outline: () =>
      poly('mathMinus', [
        [0, 0.4],
        [1, 0.4],
        [1, 0.6],
        [0, 0.6],
      ]),
  },
  {
    prst: 'mathMultiply',
    group: 'math',
    labelKey: 'shapePresetMathMultiply',
    outline: () =>
      poly('mathMultiply', [
        [0.15, 0],
        [0.5, 0.35],
        [0.85, 0],
        [1, 0.15],
        [0.65, 0.5],
        [1, 0.85],
        [0.85, 1],
        [0.5, 0.65],
        [0.15, 1],
        [0, 0.85],
        [0.35, 0.5],
        [0, 0.15],
      ]),
  },
];

const DEF_BY_PRST = new Map(SHAPE_DEFS.map((def) => [def.prst, def]));

export function shapeDef(prst: string | undefined): ShapeDef | undefined {
  return prst ? DEF_BY_PRST.get(prst) : undefined;
}

/** Adjustment specs for a preset (empty when the shape has no handles). */
export function shapeAdjustments(prst: string | undefined): ShapeAdjustSpec[] {
  return shapeDef(prst)?.adjusts ?? [];
}

/** Current adjustment values, falling back to the preset defaults. */
export function shapeAdjustValues(geom: {
  prst: string;
  adj?: Record<string, number>;
}): Record<string, number> {
  const specs = shapeAdjustments(geom.prst);
  const values: Record<string, number> = {};
  for (const spec of specs) {
    const raw = geom.adj?.[spec.id];
    values[spec.id] = clamp(
      Number.isFinite(raw) ? (raw as number) : spec.value,
      spec.min,
      spec.max,
    );
  }
  return values;
}

/**
 * Resolve a preset + adjustment values into render geometry.
 * Returns `undefined` for presets not covered here (the importer keeps a fallback table).
 */
export function resolveShapeGeometry(
  prst: string,
  adj?: Record<string, number>,
): ShapeGeometry | undefined {
  const def = shapeDef(prst);
  if (!def) return undefined;
  const stored = adj && Object.keys(adj).length > 0 ? { ...adj } : undefined;
  // Defaults feed the outline math, but only explicitly stored values are persisted (and
  // exported), so an untouched shape does not force the legacy export channel.
  const values = { ...shapeAdjustValues({ prst, adj: stored }), ...(stored ?? {}) };
  return { ...def.outline(values), adj: stored };
}
/* ------------------------- DrawingML preset geometry mapping ------------------------- */

/** Normalized polygon vertices (each point is [x,y], values 0~1) */
function flatPoints(points: number[][]): number[] {
  return points.flat();
}

const PRST_GEOMS: Record<string, ShapeGeometry> = {
  // Rectangle family
  rect: { kind: 'rect', prst: 'rect' },
  roundRect: { kind: 'rect', radius: 0.167, prst: 'roundRect' },
  snip1Rect: { kind: 'rect', prst: 'snip1Rect' },
  snipRoundRect: { kind: 'rect', radius: 0.083, prst: 'snipRoundRect' },
  frame: { kind: 'rect', prst: 'frame' },
  // Ellipse family
  ellipse: { kind: 'ellipse', prst: 'ellipse' },
  // Triangle family
  triangle: {
    kind: 'polygon',
    points: flatPoints([
      [0.5, 0],
      [1, 1],
      [0, 1],
    ]),
    prst: 'triangle',
  },
  rtTriangle: {
    kind: 'polygon',
    points: flatPoints([
      [0, 0],
      [1, 1],
      [0, 1],
    ]),
    prst: 'rtTriangle',
  },
  // Isosceles triangle (apex up). prst used to be mislabeled rtTriangle, which changed the shape on export
  isoTriangle: {
    kind: 'polygon',
    points: flatPoints([
      [0.5, 0],
      [1, 1],
      [0, 1],
    ]),
    prst: 'isoTriangle',
  },
  // Diamond / trapezoid
  diamond: {
    kind: 'polygon',
    points: flatPoints([
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ]),
    prst: 'diamond',
  },
  trapezoid: {
    kind: 'polygon',
    points: flatPoints([
      [0.2, 0],
      [0.8, 0],
      [1, 1],
      [0, 1],
    ]),
    prst: 'trapezoid',
  },
  // Regular pentagon (apex up, vertices on a circumcircle of radius 0.5)
  pentagon: {
    kind: 'polygon',
    points: flatPoints([
      [0.5, 0],
      [0.976, 0.345],
      [0.794, 0.905],
      [0.206, 0.905],
      [0.024, 0.345],
    ]),
    prst: 'pentagon',
  },
  // Home plate (DrawingML homePlate): previously mistaken for a pentagon geometry
  homePlate: {
    kind: 'polygon',
    points: flatPoints([
      [0.5, 0],
      [1, 0.38],
      [0.82, 1],
      [0.18, 1],
      [0, 0.38],
    ]),
    prst: 'homePlate',
  },
  hexagon: {
    kind: 'polygon',
    points: flatPoints([
      [0.25, 0],
      [0.75, 0],
      [1, 0.5],
      [0.75, 1],
      [0.25, 1],
      [0, 0.5],
    ]),
    prst: 'hexagon',
  },
  octagon: {
    kind: 'polygon',
    points: flatPoints([
      [0.29, 0],
      [0.71, 0],
      [1, 0.29],
      [1, 0.71],
      [0.71, 1],
      [0.29, 1],
      [0, 0.71],
      [0, 0.29],
    ]),
    prst: 'octagon',
  },
  // Arrow family
  rightArrow: {
    kind: 'polygon',
    points: flatPoints([
      [0, 0.25],
      [0.6, 0.25],
      [0.6, 0],
      [1, 0.5],
      [0.6, 1],
      [0.6, 0.75],
      [0, 0.75],
    ]),
    prst: 'rightArrow',
  },
  leftArrow: {
    kind: 'polygon',
    points: flatPoints([
      [1, 0.25],
      [0.4, 0.25],
      [0.4, 0],
      [0, 0.5],
      [0.4, 1],
      [0.4, 0.75],
      [1, 0.75],
    ]),
    prst: 'leftArrow',
  },
  upArrow: {
    kind: 'polygon',
    points: flatPoints([
      [0.5, 0],
      [1, 0.4],
      [0.75, 0.4],
      [0.75, 1],
      [0.25, 1],
      [0.25, 0.4],
      [0, 0.4],
    ]),
    prst: 'upArrow',
  },
  downArrow: {
    kind: 'polygon',
    points: flatPoints([
      [0.5, 1],
      [1, 0.6],
      [0.75, 0.6],
      [0.75, 0],
      [0.25, 0],
      [0.25, 0.6],
      [0, 0.6],
    ]),
    prst: 'downArrow',
  },
  chevron: {
    kind: 'polygon',
    points: flatPoints([
      [0, 0],
      [0.6, 0],
      [1, 0.5],
      [0.6, 1],
      [0, 1],
      [0.4, 0.5],
    ]),
    prst: 'chevron',
  },
  // Star family
  star5: { kind: 'star', innerRatio: 0.382, prst: 'star' },
  star: { kind: 'star', innerRatio: 0.382, prst: 'star' },
  star4: { kind: 'star', innerRatio: 0.4, prst: 'star4' },
  star6: { kind: 'star', innerRatio: 0.4, prst: 'star6' },
  star8: { kind: 'star', innerRatio: 0.45, prst: 'star8' },
  star12: { kind: 'star', innerRatio: 0.5, prst: 'star12' },
  star16: { kind: 'star', innerRatio: 0.5, prst: 'star16' },
  star24: { kind: 'star', innerRatio: 0.55, prst: 'star24' },
  star32: { kind: 'star', innerRatio: 0.6, prst: 'star32' },
};

/** prstGeom → render geometry; unknown shapes degrade to a same-size rect (keeping the original prst name) */
export function resolvePresetGeometry(prst: string, adj?: Record<string, number>): ShapeGeometry {
  return (
    resolveShapeGeometry(prst, adj) ?? {
      ...(PRST_GEOMS[prst] ?? { kind: 'rect' as const }),
      prst: prst || 'rect',
      ...(adj ? { adj } : {}),
    }
  );
}

/** Number of star points (prst: star5 → 5) */
export function starPoints(prst: string): number {
  const direct = /^star(\d+)$/.exec(prst);
  if (direct) return Math.max(3, Number(direct[1]));
  return 5;
}
