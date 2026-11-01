import { describe, expect, it } from 'vitest';
import { createDoc, createSlide, createTextElement } from './factory';
import {
  buildSummarySlide,
  linkedElements,
  pruneSlideLinks,
  slideLinkIndex,
  summaryTiles,
} from './summary';
import type { SlideDoc, SlideElement } from './types';

/** Deck with `count` slides and section boundaries at the given indexes */
function deck(count: number, starts: number[] = [], names: string[] = []): SlideDoc {
  const doc = createDoc('summary');
  doc.slides = Array.from({ length: count }, () => createSlide());
  doc.sections = starts.map((index, position) => ({
    id: `sec-${position}`,
    name: names[position] ?? `S${position}`,
    startSlideId: doc.slides[index].id,
  }));
  return doc;
}

describe('summaryTiles', () => {
  it('uses sections as tiles: name, first slide and span', () => {
    const doc = deck(5, [0, 2], ['引言', '正文']);
    expect(summaryTiles(doc)).toEqual([
      { label: '引言', targetSlideId: doc.slides[0].id, span: 2 },
      { label: '正文', targetSlideId: doc.slides[2].id, span: 3 },
    ]);
  });

  it('falls back to one tile per slide, labelled with the slide title', () => {
    const doc = deck(2);
    const title = createTextElement(doc, '  第一季度  复盘 ') as SlideElement;
    doc.slides[0].elements = [title];
    expect(summaryTiles(doc)).toEqual([
      { label: '第一季度 复盘', targetSlideId: doc.slides[0].id, span: 1 },
      // No text at all: the slide number is the only locale-free label
      { label: '2', targetSlideId: doc.slides[1].id, span: 1 },
    ]);
  });

  it('truncates very long titles so a tile stays readable', () => {
    const doc = deck(1);
    doc.slides[0].elements = [createTextElement(doc, 'x'.repeat(80))];
    const [tile] = summaryTiles(doc);
    expect(tile.label).toHaveLength(41);
    expect(tile.label.endsWith('…')).toBe(true);
  });

  it('caps the tile count so the grid cannot collapse into slivers', () => {
    expect(summaryTiles(deck(30))).toHaveLength(24);
  });
});

describe('buildSummarySlide', () => {
  it('puts a title first and one linked shape per tile inside the slide bounds', () => {
    const doc = deck(4, [0, 2], ['引言', '正文']);
    const { slide, tiles } = buildSummarySlide(doc, '摘要');

    expect(tiles).toHaveLength(2);
    const [title, ...shapes] = slide.elements;
    expect(title.type).toBe('text');
    const titleText = title.type === 'text' ? title.body?.paragraphs[0].runs[0].text : undefined;
    expect(titleText).toBe('摘要');
    expect(shapes).toHaveLength(2);
    for (const [index, shape] of shapes.entries()) {
      expect(shape.type).toBe('shape');
      expect(shape.linkToSlideId).toBe(tiles[index].targetSlideId);
      // A tile must be clickable, i.e. fully on the slide
      expect(shape.x).toBeGreaterThanOrEqual(0);
      expect(shape.y).toBeGreaterThanOrEqual(0);
      expect(shape.x + shape.width).toBeLessThanOrEqual(doc.width);
      expect(shape.y + shape.height).toBeLessThanOrEqual(doc.height);
    }
    // The slide itself is not part of the document yet: the caller decides where to insert it
    expect(doc.slides.some((item) => item.id === slide.id)).toBe(false);
  });

  it('lays tiles out in rows when the deck has many sections', () => {
    const doc = deck(9, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const { slide } = buildSummarySlide(doc, '摘要');
    const shapes = slide.elements.filter((element) => element.type === 'shape');
    expect(shapes).toHaveLength(9);
    // 9 tiles → 3 columns → exactly 3 distinct x positions
    expect(new Set(shapes.map((shape) => shape.x)).size).toBe(3);
  });
});

describe('slide links', () => {
  it('resolves a link target and reports dangling ones', () => {
    const doc = deck(3);
    expect(slideLinkIndex(doc.slides, doc.slides[1].id)).toBe(1);
    expect(slideLinkIndex(doc.slides, 'deleted')).toBe(-1);
    expect(slideLinkIndex(doc.slides, undefined)).toBe(-1);
  });

  it('counts links on nested group children', () => {
    const doc = deck(2);
    const child = { ...createTextElement(doc, 'a'), linkToSlideId: doc.slides[1].id };
    const group: SlideElement = {
      id: 'g1',
      type: 'group',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      children: [child],
    };
    doc.slides[0].elements = [group];
    expect(linkedElements(doc.slides)).toHaveLength(1);
  });

  it('prunes links to deleted slides only, keeping the array reference when there is nothing to do', () => {
    const doc = deck(3);
    doc.slides[0].elements = [
      { ...createTextElement(doc, 'a'), linkToSlideId: doc.slides[1].id },
      { ...createTextElement(doc, 'b'), linkToSlideId: doc.slides[2].id },
    ];
    const removed = new Set([doc.slides[1].id]);

    expect(pruneSlideLinks(doc.slides, new Set())).toBe(doc.slides);
    const pruned = pruneSlideLinks(doc.slides, removed);
    expect(pruned[0].elements[0].linkToSlideId).toBeUndefined();
    expect(pruned[0].elements[1].linkToSlideId).toBe(doc.slides[2].id);
  });
});
