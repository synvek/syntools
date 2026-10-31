import { PATTERN_DOT_SIZE, PATTERN_TILE, patternSpec, type PatternPreset } from '../model/patterns';
import type { Fill } from '../model/types';

/**
 * Pattern fill → a tiny repeating tile (P2-S4).
 *
 * DrawingML pattern fills are tiled by the renderer, not by the file: `a:pattFill` only names a
 * preset and two inks. So the canvas side has to synthesise the tile itself, and Konva can then
 * repeat it (`fillPatternImage` + `fillPatternRepeat('repeat')`).
 *
 * Tiles are cached per (preset, fg, bg): a slide with 20 patterned shapes otherwise builds 20
 * identical canvases on every re-render.
 */

const tiles = new Map<string, HTMLCanvasElement>();

function drawTile(prst: PatternPreset, fg: string, bg: string): HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = PATTERN_TILE;
  tile.height = PATTERN_TILE;
  const ctx = tile.getContext('2d');
  if (!ctx) return tile;

  // The background plate must be opaque white-ish, not transparent: PowerPoint paints bgClr as a
  // solid layer, and a transparent tile would let the slide background bleed through.
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, PATTERN_TILE, PATTERN_TILE);
  ctx.fillStyle = fg;
  ctx.strokeStyle = fg;
  ctx.lineWidth = 1;

  const spec = patternSpec(prst);
  for (const dot of spec.dots) {
    ctx.fillRect(dot.x, dot.y, PATTERN_DOT_SIZE, PATTERN_DOT_SIZE);
  }

  // Stripes are drawn one tile period past both edges so the 45° diagonals join up across tiles
  const { horiz, vert, dn, up } = spec.lines;
  ctx.beginPath();
  for (const y of horiz) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(PATTERN_TILE, y + 0.5);
  }
  for (const x of vert) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, PATTERN_TILE);
  }
  for (const offset of dn) {
    for (const shift of [-PATTERN_TILE, 0]) {
      ctx.moveTo(shift + offset, 0);
      ctx.lineTo(shift + offset + PATTERN_TILE, PATTERN_TILE);
    }
  }
  for (const offset of up) {
    for (const shift of [-PATTERN_TILE, 0]) {
      ctx.moveTo(shift + offset, PATTERN_TILE);
      ctx.lineTo(shift + offset + PATTERN_TILE, 0);
    }
  }
  ctx.stroke();
  return tile;
}

/** Canvas tile for a pattern fill; `undefined` without a DOM (ssr / unit tests / node export) */
export function patternTile(fill: Fill): HTMLCanvasElement | undefined {
  if (fill.type !== 'pattern') return undefined;
  if (typeof document === 'undefined') return undefined;
  const key = `${fill.prst}|${fill.fgColor}|${fill.bgColor}`;
  const cached = tiles.get(key);
  if (cached) return cached;
  const tile = drawTile(fill.prst, fill.fgColor, fill.bgColor);
  tiles.set(key, tile);
  return tile;
}

/** Representative color of a pattern fill (used where only one color fits, e.g. chart previews) */
export function patternToColor(fill: Fill): string | undefined {
  return fill.type === 'pattern' ? fill.fgColor : undefined;
}

const urls = new Map<string, string>();

/**
 * Data URL of the tile, for CSS previews (`background-repeat: repeat` + `background-size: 8px`).
 *
 * The picker shows 20 live swatches; going through canvas here keeps the preview pixel-identical
 * to what Konva paints, instead of maintaining a second hand-drawn CSS gradient per preset.
 */
export function patternTileUrl(prst: PatternPreset, fg: string, bg: string): string {
  const key = `${prst}|${fg}|${bg}`;
  const cached = urls.get(key);
  if (cached) return cached;
  const tile = patternTile({ type: 'pattern', prst, fgColor: fg, bgColor: bg });
  const url = tile ? tile.toDataURL() : '';
  urls.set(key, url);
  return url;
}
