/**
 * Paragraph pagination control across a `.docx` round trip (plan P1-4, first slice).
 *
 * `keepNext` / `keepLines` / `widowControl` live in `w:pPr`, and mammoth — the converter behind the
 * import — throws `w:pPr` away (it only keeps the style name). So the export writes the flags and the
 * import re-reads them here, straight from `word/document.xml`, and stamps them back as the same
 * `data-*` attributes the editor already renders. Tab stops (`w:tabs`, P1-4 last slice) ride along on
 * the same pass: mammoth keeps `<w:tab/>` as a `\t` character but drops the stop list.
 *
 * Ordering is the whole risk: `w:p` elements can be matched reliably (they never nest), but the HTML
 * mammoth produces is not one-to-one when lists come into play (`<li>` replaces the paragraph wrapper).
 * The mapping therefore only runs when the two block counts agree exactly, and silently leaves the
 * document alone otherwise — a wrong flag on the wrong paragraph is worse than a lost flag.
 */

import { formatTabStops, normalizeTabStops, TAB_STOPS_ATTR, type TabStop } from './tabStops';

export interface DocxParagraphControl {
  keepNext: boolean;
  keepLines: boolean;
  /** `false` = widow control explicitly switched off; `null` = default (on) */
  widowControl: boolean | null;
  /**
   * Line spacing as a multiple of the font size (`w:spacing/@w:line` with `lineRule="auto"`, where
   * 240 = single). `null` when the paragraph has none, or when the rule is `exact` / `atLeast` —
   * those are absolute lengths in twips and cannot be expressed as a multiple.
   */
  lineHeight: number | null;
  /** P1-4 制表位 (`w:tabs`), converted from twips to CSS px */
  tabStops: TabStop[];
}

/** Every `w:p` in document order, including the ones inside table cells */
const PARAGRAPH_RE = /<w:p(?:\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/w:p>)/g;
/** Only the property block matters; `w:val="0"` is an explicit off switch for any toggle */
const PROPERTIES_RE = /<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/;
const SPACING_RE = /<w:spacing\b([^>]*)\/?>/;
const TABS_BLOCK_RE = /<w:tabs\b[^>]*>([\s\S]*?)<\/w:tabs>/;
const TAB_STOP_RE = /<w:tab\b([^>]*?)\/?>/g;

function toggleOn(properties: string, name: string): boolean {
  const match = new RegExp(`<w:${name}\\b([^>]*)/?>`).exec(properties);
  if (!match) return false;
  const value = /w:val="([^"]*)"/.exec(match[1] ?? '')?.[1];
  return value === undefined || (value !== '0' && value !== 'false');
}

function toggleOff(properties: string, name: string): boolean {
  const match = new RegExp(`<w:${name}\\b([^>]*)/?>`).exec(properties);
  if (!match) return false;
  return /w:val="(0|false)"/.test(match[1] ?? '');
}

/** Line spacing multiple of a paragraph, or null when absent / not a multiple (`exact`, `atLeast`) */
function lineHeightOf(properties: string): number | null {
  const attrs = SPACING_RE.exec(properties)?.[1];
  if (!attrs) return null;
  const rule = /w:lineRule="([^"]*)"/.exec(attrs)?.[1];
  // `auto` is also the default when the attribute is missing, so only other values disqualify
  if (rule && rule !== 'auto') return null;
  const line = Number.parseInt(/w:line="(\d+)"/.exec(attrs)?.[1] ?? '', 10);
  if (!Number.isFinite(line) || line <= 0) return null;
  return Math.round((line / 240) * 100) / 100;
}

/** `w:tabs` -> stops in CSS px (Word counts twips from the same text edge, 1px = 15twip) */
function tabStopsOf(properties: string): TabStop[] {
  const block = TABS_BLOCK_RE.exec(properties)?.[1];
  if (!block) return [];
  const stops: TabStop[] = [];
  for (const match of block.matchAll(TAB_STOP_RE)) {
    const attrs = match[1] ?? '';
    const pos = Number.parseInt(/w:pos="(-?\d+)"/.exec(attrs)?.[1] ?? '', 10);
    if (!Number.isFinite(pos) || pos < 0) continue;
    const value = /w:val="([^"]*)"/.exec(attrs)?.[1] ?? 'left';
    // `clear` removes an inherited stop and `bar` draws a vertical rule: neither is a stop we render
    if (value === 'clear' || value === 'bar') continue;
    stops.push({ pos: Math.round(pos / 15), align: value as TabStop['align'] });
  }
  return normalizeTabStops(stops);
}

export function parseDocxParagraphControls(xml: string): DocxParagraphControl[] {
  if (!xml.includes('<w:p')) return [];
  const controls: DocxParagraphControl[] = [];
  for (const match of xml.matchAll(PARAGRAPH_RE)) {
    const body = match[1] ?? '';
    const properties = PROPERTIES_RE.exec(body)?.[1] ?? '';
    controls.push({
      keepNext: toggleOn(properties, 'keepNext'),
      keepLines: toggleOn(properties, 'keepLines'),
      widowControl: toggleOff(properties, 'widowControl') ? false : null,
      lineHeight: lineHeightOf(properties),
      tabStops: tabStopsOf(properties),
    });
  }
  return controls;
}

/** Blocks mammoth emits in document order, one per Word paragraph (lists being the exception) */
const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li';

/**
 * Stamp the parsed flags onto the imported HTML.
 * Returns the HTML unchanged when the counts disagree — see the module comment for why.
 */
export function applyParagraphControls(
  html: string,
  controls: readonly DocxParagraphControl[],
): string {
  if (controls.length === 0) return html;
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks = Array.from(doc.body.querySelectorAll(BLOCK_SELECTOR));
  if (blocks.length !== controls.length) return html;
  blocks.forEach((block, index) => {
    const control = controls[index];
    if (!control) return;
    if (control.keepNext) block.setAttribute('data-keep-next', 'true');
    if (control.keepLines) block.setAttribute('data-keep-lines', 'true');
    if (control.widowControl === false) block.setAttribute('data-widow-control', 'off');
    if (control.tabStops.length > 0) {
      block.setAttribute(TAB_STOPS_ATTR, formatTabStops(control.tabStops));
    }
    if (control.lineHeight) {
      // Inline style, because line spacing *is* the CSS: the paragraph attribute parses it back
      const existing = block.getAttribute('style');
      block.setAttribute(
        'style',
        `${existing ? `${existing.replace(/;\s*$/, '')}; ` : ''}line-height: ${control.lineHeight}`,
      );
    }
  });
  return doc.body.innerHTML;
}
