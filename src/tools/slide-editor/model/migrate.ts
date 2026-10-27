import { normalizeBackground } from '../core';
import { SCHEMA_VERSION } from './factory';
import type {
  Slide,
  SlideBackground,
  SlideDoc,
  SlideElement,
  SlideLayout,
  SlideMaster,
} from './types';

/**
 * Document schema migration.
 *
 * What changed in v2 vs v1:
 * - slide/layout/master backgrounds went from a "solid color string" to `Fill` (gradient support);
 * - chart / formula / icon elements were added (v1 data simply has none, no conversion needed);
 * - run-level extras (letter spacing/baseline/highlight/hyperlink) and element-level hyperlink/shadow, all optional.
 *
 * Migration is **idempotent**: re-running it on normalized data changes nothing.
 * `.sld` project files and localStorage drafts share this entry point, so the read paths stay consistent.
 */

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION;

/** Background normalization on read: old string → SolidFill, invalid values dropped */
function migrateBackground(bg: SlideBackground | undefined): SlideBackground | undefined {
  if (bg === undefined || bg === null) return undefined;
  if (typeof bg !== 'string') return bg;
  // Discard invalid colors (e.g. 'transparent' written by older versions) and fall back to master inheritance
  return normalizeBackground(bg) ?? undefined;
}

/** Element-level migration: v1→v2 only needs to keep group children recursively consistent for now */
function migrateElement(element: SlideElement): SlideElement {
  if (element.type === 'group' && Array.isArray(element.children)) {
    return { ...element, children: element.children.map(migrateElement) };
  }
  return element;
}

function migrateElements(elements: SlideElement[] | undefined): SlideElement[] {
  if (!Array.isArray(elements)) return [];
  return elements.map(migrateElement);
}

function migrateSlide(slide: Slide): Slide {
  return {
    ...slide,
    background: migrateBackground(slide.background),
    elements: migrateElements(slide.elements),
  };
}

function migrateLayout(layout: SlideLayout): SlideLayout {
  return {
    ...layout,
    background: migrateBackground(layout.background),
    elements: migrateElements(layout.elements),
  };
}

function migrateMaster(master: SlideMaster): SlideMaster {
  return {
    ...master,
    background: migrateBackground(master.background),
    elements: migrateElements(master.elements),
  };
}

/**
 * Upgrade a SlideDoc from any historical version to the current schema.
 *
 * Minimal defenses against corrupt data: fill in empty containers when slides / masters / layouts / media
 * are missing, so the render layer can't crash on undefined (localStorage may hold half-written JSON).
 */
export function migrateDoc(input: SlideDoc): SlideDoc {
  if (!input || typeof input !== 'object') return input;
  if (input.schemaVersion === CURRENT_SCHEMA_VERSION) return input;

  return {
    ...input,
    width: input.width || 1280,
    height: input.height || 720,
    masters: Array.isArray(input.masters) ? input.masters.map(migrateMaster) : [],
    layouts: Array.isArray(input.layouts) ? input.layouts.map(migrateLayout) : [],
    slides: Array.isArray(input.slides) ? input.slides.map(migrateSlide) : [],
    media: input.media && typeof input.media === 'object' ? input.media : {},
    version: input.version || 1,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}
