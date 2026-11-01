import { normalizeSections, sectionRanges } from '../model/sections';
import type { SlideDoc, SlideSection } from '../model/types';
import {
  attr,
  childrenNamed,
  childOf,
  childrenOf,
  localNameOf,
  numAttr,
  type XmlNode,
} from './xml';

/**
 * PowerPoint sections (`p14:sectionLst`).
 *
 * Sections live in the presentation part's `p:extLst`, under a fixed Office extension URI. pptxgenjs
 * cannot write extension lists at all, so any document with sections is routed to the hand-written
 * channel (see `hasSections` in `export.ts`) — otherwise the grouping would vanish silently, exactly
 * like `p:timing` used to.
 */

/** Office extension URI for `p14:sectionLst` */
const SECTION_EXT_URI = '{521415D9-36F7-43E2-AB2F-B90AF26B5E84}';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** FNV-1a: tiny, dependency-free hash used to derive stable GUIDs from our section ids */
function fnv1a(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Stable GUID for a section id (four independent hash rounds = 128 bits).
 * Stable matters: re-exporting an unchanged deck must not produce a different file every time.
 */
function guidOf(id: string): string {
  const hex = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]
    .map((seed) => fnv1a(id, seed).toString(16).padStart(8, '0'))
    .join('')
    .toUpperCase();
  return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}}`;
}

/**
 * `p:extLst` carrying the sections, or `''` when the deck is flat.
 *
 * `slideIds` are the `p:sldId@id` values already written into `p:sldIdLst`, in slide order: the
 * section list must reference the same ids, and deriving them in two places would eventually drift.
 */
export function sectionExtLstXml(doc: SlideDoc, slideIds: readonly number[]): string {
  const sections = normalizeSections(doc.sections, doc.slides);
  const ranges = sectionRanges(sections, doc.slides);
  // A single section covers the whole deck and carries no grouping: writing it would only add noise
  if (ranges.length <= 1) return '';
  const body = ranges
    .map(({ section, from }) => {
      const sldId = slideIds[from];
      if (sldId === undefined) return '';
      return `<p14:section name="${escapeXml(section.name)}" id="${guidOf(section.id)}"><p14:sldIdLst><p14:sldId id="${sldId}"/></p14:sldIdLst></p14:section>`;
    })
    .join('');
  if (!body) return '';
  return `<p:extLst><p:ext uri="${SECTION_EXT_URI}"><p14:sectionLst>${body}</p14:sectionLst></p:ext></p:extLst>`;
}

/** Section name + the slide index its boundary falls on (resolved after the slides are parsed) */
export interface ImportedSectionStart {
  name: string;
  slideIndex: number;
}

/**
 * Read `p14:sectionLst` from the presentation part.
 *
 * Only each section's **first** slide matters: our model stores boundaries, and the remaining slides
 * follow from the next boundary. Unreferenced / out-of-range slide ids are skipped, so a damaged list
 * degrades to "fewer sections" instead of shifting every boundary.
 */
export function readSections(
  presentationXml: XmlNode,
  slideIndexById: ReadonlyMap<number, number>,
): ImportedSectionStart[] {
  const extLst = childrenOf(presentationXml).find((node) => localNameOf(node) === 'extLst');
  const sectionLst = extLst ? findSectionLst(extLst) : undefined;
  if (!sectionLst) return [];
  const out: ImportedSectionStart[] = [];
  for (const section of childrenNamed(sectionLst, 'section')) {
    const firstSlide = childrenNamed(childOf(section, 'sldIdLst'), 'sldId')[0];
    const slideId = numAttr(firstSlide, 'id');
    const slideIndex = slideId === undefined ? undefined : slideIndexById.get(slideId);
    if (slideIndex === undefined) continue;
    const name = attr(section, 'name')?.trim();
    out.push({ name: name || '', slideIndex });
  }
  return out;
}

/** `p:extLst > p:ext > p14:sectionLst` (the extension URI is the reliable marker) */
function findSectionLst(extLst: XmlNode): XmlNode | undefined {
  for (const ext of childrenNamed(extLst, 'ext')) {
    const found = childrenOf(ext).find((node) => localNameOf(node) === 'sectionLst');
    if (found) return found;
  }
  return undefined;
}

/** Section boundaries rebuilt from imported starts, ignoring ones without slides */
export function sectionsFromStarts(
  starts: readonly ImportedSectionStart[],
  slides: SlideDoc['slides'],
  createId: (prefix: string) => string,
  defaultName: string,
): SlideSection[] {
  const sorted = [...starts].sort((a, b) => a.slideIndex - b.slideIndex);
  const sections: SlideSection[] = [];
  for (const start of sorted) {
    const slide = slides[start.slideIndex];
    if (!slide) continue;
    sections.push({
      id: createId('section'),
      name: start.name || defaultName,
      startSlideId: slide.id,
    });
  }
  return normalizeSections(sections, slides, defaultName);
}
