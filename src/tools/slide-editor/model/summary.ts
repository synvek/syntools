import {
  createId,
  createParagraph,
  createSlide,
  createSolidFill,
  createStroke,
  rectGeometry,
} from './factory';
import { sectionRanges } from './sections';
import type { Slide, SlideDoc, SlideElement, TextBody } from './types';

/**
 * Summary page / section tiles (P2-S6.3).
 *
 * The page is ordinary content: a title text box plus one rounded rectangle per section, each
 * carrying `linkToSlideId` (internal jump). Presentation mode follows the link on click; export
 * cannot turn it into a hyperlink, which is reported instead of being silently dropped.
 *
 * Sessions are the source when the deck has them: a summary of "sections" is what users recognise.
 * A flat deck falls back to one tile per slide, labelled with the slide's own title text.
 */

/** Beyond this the tiles get too small to read (or hit) — the page stops being a summary */
const MAX_TILES = 24;

/** Tile colours: light indigo surface, visible on both light and dark slide backgrounds */
const TILE_FILL = '#EEF2FF';
const TILE_STROKE = '#C7D2FE';
const TILE_TEXT = '#1E293B';

export interface SummaryTileSpec {
  /** Text shown on the tile: section name, slide title, or the slide number as a last resort */
  label: string;
  /** Slide the tile jumps to */
  targetSlideId: string;
  /** How many slides this tile stands for (1 for section-less decks) */
  span: number;
}

/** Plain text of a text body, used as a tile label when the deck has no sections */
function bodyText(body: TextBody | undefined): string {
  return (body?.paragraphs ?? [])
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First non-empty text on the slide (title boxes are almost always the first element) */
function slideLabel(slide: Slide, index: number): string {
  for (const element of slide.elements) {
    // Placeholders carry only a label (their text lives in the original file), so they are skipped
    if (element.type !== 'text' && element.type !== 'shape') continue;
    const text = bodyText(element.body);
    if (text) return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  }
  // Locale-free fallback: the slide number reads the same everywhere
  return String(index + 1);
}

/** Tiles of the summary page: sections when the deck has them, else the slides themselves */
export function summaryTiles(doc: SlideDoc): SummaryTileSpec[] {
  const ranges = sectionRanges(doc.sections, doc.slides);
  const tiles =
    ranges.length > 1
      ? ranges.map(({ section, from, to }) => ({
          label: section.name,
          targetSlideId: doc.slides[from].id,
          span: to - from,
        }))
      : doc.slides.map((slide, index) => ({
          label: slideLabel(slide, index),
          targetSlideId: slide.id,
          span: 1,
        }));
  return tiles.slice(0, MAX_TILES);
}

/**
 * Build the summary slide: title on top, tiles in a grid.
 * Pure: the caller decides where to insert it (and can undo in one step).
 */
export function buildSummarySlide(
  doc: SlideDoc,
  title: string,
): { slide: Slide; tiles: SummaryTileSpec[] } {
  const tiles = summaryTiles(doc);
  const padding = Math.round(doc.width * 0.06);
  const titleHeight = 64;
  const gap = 20;
  const elements: SlideElement[] = [
    {
      id: createId('el'),
      type: 'text',
      x: padding,
      y: padding,
      width: doc.width - padding * 2,
      height: titleHeight,
      body: {
        paragraphs: [createParagraph(title, { size: 32, bold: true })],
        anchor: 'middle',
        wrap: true,
      },
    },
  ];

  const count = Math.max(1, tiles.length);
  // Square-ish grid: 9 tiles become 3×3 (not 4+4+1), capped at 4 columns so tiles stay wide enough
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / columns);
  const gridTop = padding + titleHeight + 16;
  const gridHeight = Math.max(80, doc.height - gridTop - padding);
  const tileWidth = (doc.width - padding * 2 - gap * (columns - 1)) / columns;
  const tileHeight = (gridHeight - gap * (rows - 1)) / rows;

  tiles.forEach((tile, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    elements.push({
      id: createId('el'),
      type: 'shape',
      name: tile.label,
      x: Math.round(padding + column * (tileWidth + gap)),
      y: Math.round(gridTop + row * (tileHeight + gap)),
      width: Math.round(tileWidth),
      height: Math.round(tileHeight),
      geom: { ...rectGeometry(), prst: 'roundRect', radius: 0.08 },
      fill: createSolidFill(TILE_FILL),
      stroke: createStroke({ color: TILE_STROKE, width: 1 }),
      body: {
        paragraphs: [createParagraph(tile.label, { size: 20, bold: true, color: TILE_TEXT })],
        anchor: 'middle',
        wrap: true,
        margins: { left: 12, top: 8, right: 12, bottom: 8 },
      },
      linkToSlideId: tile.targetSlideId,
    });
  });

  const slide = createSlide(doc.layouts[0]?.id);
  slide.elements = elements;
  return { slide, tiles };
}

/** Index of a link target, or -1 when the link is missing / dangling */
export function slideLinkIndex(slides: readonly Slide[], slideId: string | undefined): number {
  if (!slideId) return -1;
  return slides.findIndex((slide) => slide.id === slideId);
}

/** Every element carrying an internal jump (groups included) */
export function linkedElements(slides: readonly Slide[]): SlideElement[] {
  const out: SlideElement[] = [];
  const walk = (elements: SlideElement[]) => {
    for (const element of elements) {
      if (element.linkToSlideId) out.push(element);
      if (element.type === 'group') walk(element.children);
    }
  };
  for (const slide of slides) walk(slide.elements);
  return out;
}

/**
 * Clear links that point at slides which no longer exist (called when a slide is deleted).
 * Returns the same array reference when nothing changed, so store updates stay cheap.
 */
export function pruneSlideLinks(slides: Slide[], removedIds: ReadonlySet<string>): Slide[] {
  if (removedIds.size === 0) return slides;
  let changed = false;
  const prune = (elements: SlideElement[]): SlideElement[] => {
    let touched = false;
    const next = elements.map((element) => {
      let updated = element;
      if (updated.linkToSlideId && removedIds.has(updated.linkToSlideId)) {
        // Delete rather than set `undefined`: drafts are JSON, and a present-but-undefined key is noise
        const cleared = { ...updated };
        delete cleared.linkToSlideId;
        updated = cleared;
      }
      if (updated.type === 'group') {
        const children = prune(updated.children);
        if (children !== updated.children) {
          updated = { ...updated, children };
        }
      }
      if (updated !== element) touched = true;
      return updated;
    });
    return touched ? next : elements;
  };
  const nextSlides = slides.map((slide) => {
    const elements = prune(slide.elements);
    if (elements === slide.elements) return slide;
    changed = true;
    return { ...slide, elements };
  });
  return changed ? nextSlides : slides;
}
