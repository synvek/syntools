import { createId } from './factory';
import type { Slide, SlideSection } from './types';

/**
 * Sections (P2-S6).
 *
 * A section is stored as a **boundary**: its `startSlideId` plus the next section's start. That is what
 * PowerPoint writes too (`p14:sectionLst` lists the slides of each section, and the first one is the
 * boundary), but keeping only the boundary on our side means adding, deleting or reordering slides
 * cannot leave a stale id list behind — the grouping is derived at read time.
 *
 * Invariants enforced by `normalizeSections` (the only writer):
 * 1. sections are ordered by slide position;
 * 2. the first section always starts at the first slide (leading slides are absorbed, never dropped);
 * 3. a boundary whose slide disappeared is dropped (its slides merge into the previous section);
 * 4. one section or none means "no sections" — a single full-width section carries no information.
 */

/** A section with its resolved slide index range (`to` exclusive) */
export interface SectionRange {
  section: SlideSection;
  from: number;
  /** Exclusive */
  to: number;
}

/** Fallback name for sections synthesized while normalizing (imported / hand-edited data) */
export const DEFAULT_SECTION_NAME = 'Section';

/** `true` when the document actually groups slides (two sections or more) */
export function hasSections(sections: SlideSection[] | undefined): boolean {
  return (sections?.length ?? 0) > 1;
}

/**
 * Normalize stored boundaries against the current slide list.
 * Idempotent: normalizing already-normalized sections returns equal data.
 */
export function normalizeSections(
  sections: SlideSection[] | undefined,
  slides: Slide[],
  defaultName = DEFAULT_SECTION_NAME,
): SlideSection[] {
  if (!Array.isArray(sections) || sections.length === 0 || slides.length === 0) return [];
  const indexOf = new Map(slides.map((slide, index) => [slide.id, index]));
  const takenIds = new Set<string>();
  const seenIndexes = new Set<number>();
  const resolved: { section: SlideSection; index: number }[] = [];

  for (const section of sections) {
    if (!section || typeof section !== 'object') continue;
    const startIndex = indexOf.get(String(section.startSlideId));
    // Unknown start slide: the section lost its anchor (slide deleted or data corrupt) — drop the boundary
    if (startIndex === undefined || seenIndexes.has(startIndex)) continue;
    const id = typeof section.id === 'string' && section.id ? section.id : createId('section');
    if (takenIds.has(id)) continue;
    takenIds.add(id);
    seenIndexes.add(startIndex);
    const name =
      typeof section.name === 'string' && section.name.trim() ? section.name : defaultName;
    resolved.push({
      section: { id, name, startSlideId: slides[startIndex].id },
      index: startIndex,
    });
  }

  // Invariant 4: a lone section covers the whole deck, which is the flat representation
  if (resolved.length <= 1) return [];
  resolved.sort((a, b) => a.index - b.index);
  // Leading slides belong to the first section: clamp its boundary instead of inventing a new one
  resolved[0] = {
    ...resolved[0],
    section: { ...resolved[0].section, startSlideId: slides[0].id },
    index: 0,
  };
  return resolved.map((entry) => entry.section);
}

/** Resolve boundaries into slide index ranges; the last range always ends at the last slide */
export function sectionRanges(
  sections: SlideSection[] | undefined,
  slides: Slide[],
): SectionRange[] {
  const normalized = normalizeSections(sections, slides);
  if (normalized.length === 0) return [];
  const indexOf = new Map(slides.map((slide, index) => [slide.id, index]));
  return normalized.map((section, position) => {
    const from = indexOf.get(section.startSlideId) ?? 0;
    const next = normalized[position + 1];
    const to = next ? (indexOf.get(next.startSlideId) ?? slides.length) : slides.length;
    return { section, from, to };
  });
}

/** Offset of the section containing `slideIndex` (-1 when the document has no sections) */
export function sectionIndexAt(
  sections: SlideSection[] | undefined,
  slides: Slide[],
  slideIndex: number,
): number {
  const ranges = sectionRanges(sections, slides);
  return ranges.findIndex((range) => slideIndex >= range.from && slideIndex < range.to);
}

/** The section starting exactly at `slideIndex`, if any */
export function sectionStartingAt(
  sections: SlideSection[] | undefined,
  slides: Slide[],
  slideIndex: number,
): SlideSection | undefined {
  const slide = slides[slideIndex];
  if (!slide) return undefined;
  return (sections ?? []).find((section) => section.startSlideId === slide.id);
}

/**
 * Start a new section at `slideIndex`.
 *
 * The first slide cannot start a section (there is nothing to split off) and an existing boundary is a
 * no-op, so the caller can offer "new section from here" on every slide without special cases.
 */
export function splitSectionAt(
  sections: SlideSection[] | undefined,
  slides: Slide[],
  slideIndex: number,
  name: string,
): SlideSection[] {
  const current = normalizeSections(sections, slides);
  const slide = slides[slideIndex];
  if (!slide || slideIndex <= 0) return current;
  if (current.some((section) => section.startSlideId === slide.id)) return current;
  // No sections yet: the split creates the implicit first section plus the new one
  const base: SlideSection[] =
    current.length > 0
      ? current
      : [{ id: createId('section'), name: DEFAULT_SECTION_NAME, startSlideId: slides[0].id }];
  return normalizeSections(
    [...base, { id: createId('section'), name, startSlideId: slide.id }],
    slides,
  );
}

export function renameSection(
  sections: SlideSection[] | undefined,
  id: string,
  name: string,
): SlideSection[] {
  const trimmed = name.trim();
  if (!trimmed) return sections ?? [];
  return (sections ?? []).map((section) =>
    section.id === id ? { ...section, name: trimmed } : section,
  );
}

/**
 * Delete a section boundary: its slides join the previous section (the first section's slides join the
 * next one). Removing the last remaining pair leaves a flat document.
 */
export function removeSection(
  sections: SlideSection[] | undefined,
  slides: Slide[],
  id: string,
): SlideSection[] {
  const current = normalizeSections(sections, slides);
  const remaining = current.filter((section) => section.id !== id);
  if (remaining.length <= 1) return [];
  return normalizeSections(remaining, slides);
}
