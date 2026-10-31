/**
 * Pattern fills (P2-S4): the 20 presets we support out of DrawingML's `ST_PresetPatternVal`.
 *
 * Why a curated subset: PowerPoint's list has ~50 presets, but more than half of them are subtle
 * density variants that nobody can tell apart in a 2px tile. The 20 here cover every *visual
 * family* — dots (10 densities), lines (horizontal / vertical / two diagonals × light & dark) and
 * the two cross-hatches — and every one of them survives a round-trip.
 *
 * The geometry is kept as **pure data on an 8×8 tile** so it can be unit tested without a canvas
 * (`render/patternTile.ts` is the only DOM consumer).
 */

export type PatternPreset =
  // Dots, light → dense
  | 'pct5'
  | 'pct10'
  | 'pct20'
  | 'pct25'
  | 'pct30'
  | 'pct40'
  | 'pct50'
  | 'pct60'
  | 'pct70'
  | 'pct75'
  // Lines
  | 'ltHorz'
  | 'dkHorz'
  | 'ltVert'
  | 'dkVert'
  | 'ltDnDiag'
  | 'dkDnDiag'
  | 'ltUpDiag'
  | 'dkUpDiag'
  | 'cross'
  | 'diagCross';

/** Tile edge in px. 8 divides every spacing used below, which is what keeps the tile seamless */
export const PATTERN_TILE = 8;

/** Dot side in px: a 1px dot disappears at edit zoom, a 3px dot turns "5%" into a polka dot */
const DOT_SIZE = 2;

/** Linear stripes on the tile; `dir` is the diagonal direction ('dn' = ↘, 'up' = ↗) */
export interface PatternLines {
  horiz: number[];
  vert: number[];
  dn: number[];
  up: number[];
}

export interface PatternSpec {
  prst: PatternPreset;
  /** Visual family, used for grouping in the picker and for the tooltip */
  family: 'dots' | 'lines' | 'hatch';
  /** Top-left corners of the filled squares on the tile */
  dots: { x: number; y: number }[];
  /** y / x / diagonal offsets for stripes (see `PatternLines`) */
  lines: PatternLines;
}

export const PATTERN_PRESETS: PatternPreset[] = [
  'pct5',
  'pct10',
  'pct20',
  'pct25',
  'pct30',
  'pct40',
  'pct50',
  'pct60',
  'pct70',
  'pct75',
  'ltHorz',
  'dkHorz',
  'ltVert',
  'dkVert',
  'ltDnDiag',
  'dkDnDiag',
  'ltUpDiag',
  'dkUpDiag',
  'cross',
  'diagCross',
];

/**
 * Scatter order for the dot densities.
 *
 * A row-major order makes low densities look like the top-left corner is dirty: the dots cluster in
 * one corner of every tile. A 4×4 bit-reversal order spreads them evenly, so `pct25` looks like a
 * sparse grid rather than a stripe.
 */
const DOT_ORDER: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 4, y: 4 },
  { x: 4, y: 0 },
  { x: 0, y: 4 },
  { x: 2, y: 2 },
  { x: 6, y: 6 },
  { x: 6, y: 2 },
  { x: 2, y: 6 },
  { x: 0, y: 2 },
  { x: 4, y: 6 },
  { x: 4, y: 2 },
  { x: 0, y: 6 },
  { x: 2, y: 0 },
  { x: 6, y: 4 },
  { x: 6, y: 0 },
  { x: 2, y: 4 },
];

/**
 * Number of dots for a density preset.
 *
 * Coverage is `count · DOT_SIZE² / 64`, so the panel's number is not the literal percentage — a 2px
 * dot on an 8px tile quantises to 6.25% steps. Matching PowerPoint's exact bitmap would need a
 * 64×64 table per preset; the visual difference at these sizes is not worth that table.
 */
function dotCount(prst: PatternPreset): number {
  const pct = Number(prst.slice(3));
  return Math.max(1, Math.min(DOT_ORDER.length, Math.round((pct / 100) * (64 / DOT_SIZE ** 2))));
}

const EMPTY_LINES: PatternLines = { horiz: [], vert: [], dn: [], up: [] };

/** Stripes at a given spacing, phase-shifted so the tile repeats seamlessly */
function stripes(spacing: number): number[] {
  const offsets: number[] = [];
  for (let offset = 0; offset < PATTERN_TILE; offset += spacing) offsets.push(offset);
  return offsets;
}

export function patternSpec(prst: PatternPreset): PatternSpec {
  switch (prst) {
    case 'ltHorz':
      return { prst, family: 'lines', dots: [], lines: { ...EMPTY_LINES, horiz: stripes(4) } };
    case 'dkHorz':
      return { prst, family: 'lines', dots: [], lines: { ...EMPTY_LINES, horiz: stripes(2) } };
    case 'ltVert':
      return { prst, family: 'lines', dots: [], lines: { ...EMPTY_LINES, vert: stripes(4) } };
    case 'dkVert':
      return { prst, family: 'lines', dots: [], lines: { ...EMPTY_LINES, vert: stripes(2) } };
    case 'ltDnDiag':
      return { prst, family: 'lines', dots: [], lines: { ...EMPTY_LINES, dn: stripes(4) } };
    case 'dkDnDiag':
      return { prst, family: 'lines', dots: [], lines: { ...EMPTY_LINES, dn: stripes(2) } };
    case 'ltUpDiag':
      return { prst, family: 'lines', dots: [], lines: { ...EMPTY_LINES, up: stripes(4) } };
    case 'dkUpDiag':
      return { prst, family: 'lines', dots: [], lines: { ...EMPTY_LINES, up: stripes(2) } };
    case 'cross':
      return {
        prst,
        family: 'hatch',
        dots: [],
        lines: { ...EMPTY_LINES, horiz: stripes(4), vert: stripes(4) },
      };
    case 'diagCross':
      return {
        prst,
        family: 'hatch',
        dots: [],
        lines: { ...EMPTY_LINES, dn: stripes(4), up: stripes(4) },
      };
    default:
      return {
        prst,
        family: 'dots',
        dots: DOT_ORDER.slice(0, dotCount(prst)).map((dot) => ({ ...dot })),
        lines: { ...EMPTY_LINES },
      };
  }
}

/** Dot square in tile coordinates, so the renderer doesn't have to know `DOT_SIZE` */
export const PATTERN_DOT_SIZE = DOT_SIZE;

const PRESET_SET = new Set<string>(PATTERN_PRESETS);

/** Guard for imported files: an unknown `prst` is downgraded instead of being written back verbatim */
export function isPatternPreset(value: string | undefined): value is PatternPreset {
  return value !== undefined && PRESET_SET.has(value);
}

/** Default fill when the user turns pattern on: invisible dots would look like a bug */
export function createPatternFill(
  prst: PatternPreset = 'pct20',
  fgColor = '#1F3864',
  bgColor = '#FFFFFF',
): { type: 'pattern'; prst: PatternPreset; fgColor: string; bgColor: string } {
  return { type: 'pattern', prst, fgColor, bgColor };
}
