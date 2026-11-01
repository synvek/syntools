import { describe, expect, it } from 'vitest';
import { createDoc, createId, createSlide } from '../model/factory';
import type { SlideDoc } from '../model/types';
import { parseXml } from './xml';
import { readSections, sectionExtLstXml, sectionsFromStarts } from './sections';

/** Deck with `count` slides and boundaries at the given slide indexes */
function deck(count: number, starts: number[], names: string[] = []): SlideDoc {
  const doc = createDoc('sections');
  doc.slides = Array.from({ length: count }, () => createSlide());
  doc.sections = starts.map((index, position) => ({
    id: `sec-${position}`,
    name: names[position] ?? `S${position}`,
    startSlideId: doc.slides[index].id,
  }));
  return doc;
}

describe('sectionExtLstXml', () => {
  it('writes nothing for a flat deck or a single full-width section', () => {
    expect(sectionExtLstXml(deck(3, []), [256, 257, 258])).toBe('');
    expect(sectionExtLstXml(deck(3, [0]), [256, 257, 258])).toBe('');
  });

  it('writes one section per boundary, referencing the first slide id of each', () => {
    const xml = sectionExtLstXml(deck(4, [0, 2], ['引言', '正文']), [256, 257, 258, 259]);
    expect(xml).toContain('<p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}">');
    expect(xml.match(/<p14:section /g)).toHaveLength(2);
    expect(xml).toContain('name="引言"');
    expect(xml).toContain('name="正文"');
    expect(xml).toContain('<p14:sldId id="256"/>');
    expect(xml).toContain('<p14:sldId id="258"/>');
  });

  it('escapes names and derives stable GUIDs from the section id', () => {
    const doc = deck(2, [0, 1], ['A & B <c>']);
    const first = sectionExtLstXml(doc, [256, 257]);
    expect(first).toContain('name="A &amp; B &lt;c&gt;"');
    // Deterministic: the same document must export byte-identical section ids
    expect(sectionExtLstXml(doc, [256, 257])).toBe(first);
    expect(first).toMatch(/id="\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}"/);
  });
});

describe('readSections', () => {
  const PRESENTATION = `<p:presentation xmlns:p="p" xmlns:p14="p14"><p:sldIdLst/><p:notesSz/><p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"><p14:sectionLst><p14:section name="A &amp; B" id="{1}"><p14:sldIdLst><p14:sldId id="256"/></p14:sldIdLst></p14:section><p14:section name="C" id="{2}"><p14:sldIdLst><p14:sldId id="258"/></p14:sldIdLst></p14:section></p14:sectionLst></p:ext></p:extLst></p:presentation>`;

  it('resolves section boundaries through the p:sldId ids', () => {
    const node = parseXml(PRESENTATION)[0];
    const starts = readSections(
      node,
      new Map([
        [256, 0],
        [257, 1],
        [258, 2],
      ]),
    );
    expect(starts).toEqual([
      { name: 'A & B', slideIndex: 0 },
      { name: 'C', slideIndex: 2 },
    ]);
  });

  it('skips sections whose slide id is not in the deck', () => {
    const node = parseXml(PRESENTATION)[0];
    const starts = readSections(node, new Map([[256, 1]]));
    expect(starts).toEqual([{ name: 'A & B', slideIndex: 1 }]);
  });

  it('returns nothing when the deck has no section list', () => {
    const node = parseXml('<p:presentation xmlns:p="p"><p:notesSz/></p:presentation>')[0];
    expect(readSections(node, new Map())).toEqual([]);
  });
});

describe('sectionsFromStarts', () => {
  it('rebuilds boundaries, drops duplicates and supplies a default name', () => {
    const slides = Array.from({ length: 3 }, () => createSlide());
    const sections = sectionsFromStarts(
      [
        { name: '', slideIndex: 0 },
        { name: 'B', slideIndex: 2 },
      ],
      slides,
      createId,
      'Section',
    );
    expect(sections.map((item) => [item.name, item.startSlideId])).toEqual([
      ['Section', slides[0].id],
      ['B', slides[2].id],
    ]);
  });

  it('returns nothing when every start is out of range', () => {
    expect(
      sectionsFromStarts([{ name: 'A', slideIndex: 9 }], [createSlide()], createId, 'S'),
    ).toEqual([]);
  });
});
