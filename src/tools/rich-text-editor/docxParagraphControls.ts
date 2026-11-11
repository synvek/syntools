/**
 * Paragraph pagination control across a `.docx` round trip (plan P1-4, first slice).
 *
 * `keepNext` / `keepLines` / `widowControl` live in `w:pPr`, and mammoth — the converter behind the
 * import — throws `w:pPr` away (it only keeps the style name). So the export writes the flags and the
 * import re-reads them here, straight from `word/document.xml`, and stamps them back as the same
 * `data-*` attributes the editor already renders.
 *
 * Ordering is the whole risk: `w:p` elements can be matched reliably (they never nest), but the HTML
 * mammoth produces is not one-to-one when lists come into play (`<li>` replaces the paragraph wrapper).
 * The mapping therefore only runs when the two block counts agree exactly, and silently leaves the
 * document alone otherwise — a wrong flag on the wrong paragraph is worse than a lost flag.
 */

export interface DocxParagraphControl {
  keepNext: boolean;
  keepLines: boolean;
  /** `false` = widow control explicitly switched off; `null` = default (on) */
  widowControl: boolean | null;
}

/** Every `w:p` in document order, including the ones inside table cells */
const PARAGRAPH_RE = /<w:p(?:\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/w:p>)/g;
/** Only the property block matters; `w:val="0"` is an explicit off switch for any toggle */
const PROPERTIES_RE = /<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/;

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
  });
  return doc.body.innerHTML;
}
