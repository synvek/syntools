import { describe, expect, it } from 'vitest';
import { createSlide } from './factory';
import {
  DEFAULT_SECTION_NAME,
  hasSections,
  normalizeSections,
  removeSection,
  renameSection,
  sectionIndexAt,
  sectionRanges,
  sectionStartingAt,
  splitSectionAt,
} from './sections';
import type { Slide, SlideSection } from './types';

/** Four slides with fixed ids so boundaries can be written by hand */
function slides(): Slide[] {
  return ['s1', 's2', 's3', 's4'].map((id) => ({ ...createSlide(), id }));
}

function section(id: string, startSlideId: string, name = id): SlideSection {
  return { id, name, startSlideId };
}

describe('normalizeSections', () => {
  it('returns nothing for a flat deck', () => {
    expect(normalizeSections([], slides())).toEqual([]);
    expect(normalizeSections(undefined, slides())).toEqual([]);
  });

  it('drops boundaries whose slide disappeared', () => {
    const normalized = normalizeSections(
      [section('a', 's1'), section('b', 'missing'), section('c', 's3')],
      slides(),
    );
    expect(normalized.map((item) => item.startSlideId)).toEqual(['s1', 's3']);
  });

  it('clamps the first section to the first slide instead of inventing a new one', () => {
    const normalized = normalizeSections(
      [section('b', 's2', '第二'), section('c', 's3', '第三')],
      slides(),
    );
    expect(normalized.map((item) => item.startSlideId)).toEqual(['s1', 's3']);
    expect(normalized[0].name).toBe('第二');
  });

  it('treats a lone section as a flat deck', () => {
    expect(normalizeSections([section('a', 's1')], slides())).toEqual([]);
  });

  it('orders boundaries by position and drops duplicates on the same slide', () => {
    const normalized = normalizeSections(
      [section('c', 's3'), section('a', 's1'), section('a2', 's1')],
      slides(),
    );
    expect(normalized.map((item) => item.id)).toEqual(['a', 'c']);
    expect(normalized.map((item) => item.startSlideId)).toEqual(['s1', 's3']);
  });

  it('falls back to a default name and regenerates a missing id, idempotently', () => {
    const once = normalizeSections(
      [{ id: '', name: '   ', startSlideId: 's2' } as SlideSection, section('c', 's4', '末节')],
      slides(),
    );
    expect(once[0].id).not.toBe('');
    expect(once[0].name).toBe(DEFAULT_SECTION_NAME);
    expect(normalizeSections(once, slides())).toEqual(once);
  });
});

describe('sectionRanges', () => {
  it('resolves boundaries into index ranges that cover the last slide', () => {
    const ranges = sectionRanges([section('a', 's1'), section('b', 's3')], slides());
    expect(ranges.map((range) => [range.from, range.to])).toEqual([
      [0, 2],
      [2, 4],
    ]);
  });

  it('resolves the owning section of a slide', () => {
    const sections = [section('a', 's1'), section('b', 's3')];
    expect(sectionIndexAt(sections, slides(), 0)).toBe(0);
    expect(sectionIndexAt(sections, slides(), 2)).toBe(1);
    expect(sectionIndexAt([], slides(), 2)).toBe(-1);
    expect(sectionStartingAt(sections, slides(), 2)?.id).toBe('b');
    expect(sectionStartingAt(sections, slides(), 1)).toBeUndefined();
  });
});

describe('splitSectionAt', () => {
  it('creates the implicit first section plus the new one on a flat deck', () => {
    const sections = splitSectionAt([], slides(), 2, '后半');
    expect(sections.map((item) => [item.name, item.startSlideId])).toEqual([
      [DEFAULT_SECTION_NAME, 's1'],
      ['后半', 's3'],
    ]);
    expect(hasSections(sections)).toBe(true);
  });

  it('ignores the first slide and an existing boundary', () => {
    expect(splitSectionAt([], slides(), 0, 'x')).toEqual([]);
    const existing = [section('a', 's1'), section('b', 's2')];
    expect(splitSectionAt(existing, slides(), 1, 'x')).toHaveLength(2);
  });
});

describe('renameSection / removeSection', () => {
  it('renames a section and ignores blank names', () => {
    const sections = [section('a', 's1'), section('b', 's3')];
    expect(renameSection(sections, 'b', '  结论  ')[1].name).toBe('结论');
    expect(renameSection(sections, 'b', '   ')[1].name).toBe('b');
  });

  it('merges the deleted section into the previous one', () => {
    const sections = [section('a', 's1'), section('b', 's2'), section('c', 's4')];
    const remaining = removeSection(sections, slides(), 'b');
    expect(remaining.map((item) => item.startSlideId)).toEqual(['s1', 's4']);
  });

  it('merges the deleted first section into the next one', () => {
    const sections = [section('a', 's1'), section('b', 's2'), section('c', 's4')];
    const remaining = removeSection(sections, slides(), 'a');
    // The next boundary is clamped to the first slide, so its slides absorb the removed section
    expect(remaining.map((item) => [item.id, item.startSlideId])).toEqual([
      ['b', 's1'],
      ['c', 's4'],
    ]);
  });

  it('collapses back to a flat deck when only one section would remain', () => {
    expect(removeSection([section('a', 's1'), section('b', 's3')], slides(), 'a')).toEqual([]);
  });
});
