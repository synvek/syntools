import { alignBlocks } from './docxBlockAlign';

/**
 * Section breaks → page breaks, import side.
 *
 * Sections are merged on import (the editor's `sectionBreak` node is not written back by mammoth), but a
 * section break is *also* a page break in every layout Word produces except `continuous`. Dropping it
 * silently was visible: the table of contents ran into the cover page's date line instead of starting a
 * new page.
 *
 * `w:sectPr` lives in the *last* paragraph of a section, and mammoth emits nothing for that paragraph, so
 * the break is re-anchored to the next paragraph that has text — the first line of the new page.
 */

const PARAGRAPH_RE = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;

const normalizeText = (text: string): string =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function paragraphText(xml: string): string {
  let text = '';
  for (const match of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) text += match[1] ?? '';
  return normalizeText(text);
}

/** `continuous` sections do not start a new page; everything else (nextPage / oddPage / evenPage) does */
function startsNewPage(sectPr: string): boolean {
  const type = /<w:type\s+w:val="([^"]+)"/.exec(sectPr)?.[1] ?? 'nextPage';
  return type !== 'continuous';
}

export interface SectionBreakAnchors {
  /** Non-empty paragraph texts, in document order (the alignment key) */
  texts: string[];
  /** Index into `texts`: the paragraph that opens the page a section break starts */
  breakBefore: number[];
}

export function parseDocxSectionBreaks(documentXml: string): SectionBreakAnchors {
  const output: SectionBreakAnchors = { texts: [], breakBefore: [] };
  if (!documentXml.includes('sectPr')) return output;
  for (const match of documentXml.matchAll(PARAGRAPH_RE)) {
    const paragraph = match[0];
    const text = paragraphText(paragraph);
    if (text) output.texts.push(text);
    // A section may be written as `<w:sectPr/>` when it only inherits the defaults
    const sectPr = /<w:sectPr\b(?:[^>]*\/>|[\s\S]*?<\/w:sectPr>)/.exec(paragraph)?.[0];
    if (!sectPr || !startsNewPage(sectPr)) continue;
    // The paragraph carrying `sectPr` is usually empty, so `texts.length` is the index of the paragraph
    // that opens the new page (when the carrying paragraph had text it was already pushed above)
    const openAt = output.texts.length;
    if (openAt > 0) output.breakBefore.push(openAt);
  }
  return output;
}

const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li';

function leafBlocks(root: Element): Element[] {
  return Array.from(root.querySelectorAll(BLOCK_SELECTOR)).filter(
    (block) => !block.querySelector(BLOCK_SELECTOR),
  );
}

/**
 * Insert a page break before the paragraph that opens each new section.
 * Only top-level blocks are touched: a break inside a table cell is not a block the editor accepts.
 */
export function applyDocxPageBreaks(
  html: string,
  anchors: SectionBreakAnchors,
): { html: string; inserted: number } {
  if (anchors.breakBefore.length === 0 || typeof DOMParser === 'undefined') {
    return { html, inserted: 0 };
  }
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const blocks = leafBlocks(doc.body);
  const pairs = alignBlocks(
    anchors.texts,
    blocks.map((block) => normalizeText(block.textContent ?? '')),
  );

  let inserted = 0;
  for (const index of anchors.breakBefore) {
    const position = pairs.get(index);
    const target = position === undefined ? undefined : blocks[position];
    if (!target || target.parentElement !== doc.body) continue;
    if (target.previousElementSibling?.hasAttribute('data-page-break')) continue;
    const node = doc.createElement('div');
    node.setAttribute('data-page-break', 'true');
    node.className = 'rte-page-break-node';
    target.parentElement.insertBefore(node, target);
    inserted += 1;
  }
  return { html: inserted > 0 ? doc.body.innerHTML : html, inserted };
}
