import { XMLParser } from 'fast-xml-parser';
import { childrenOf, localNameOf, textOf, type XmlNode } from '../../core/drawing/xmlNode';
import { alignBlocks } from './docxBlockAlign';
import { ommlToLatex } from './mathOmml';

/**
 * Equations ← `word/document.xml` (`m:oMath` / `m:oMathPara`), import side.
 *
 * mammoth has no OMML support at all: an equation disappears from the HTML without a trace, so a
 * chapter made of formulas imports as empty paragraphs. The reverse converter already exists for the
 * export direction (`ommlToLatex`), so the work here is *placing* the formula again — mammoth left no
 * placeholder to anchor to.
 *
 * Placement is reconstructed from the paragraph: every equation records the paragraph it sits in and
 * how much non-equation text precedes it. The paragraph is then matched against the imported HTML the
 * same way paragraph properties and shapes are, and the formula is spliced back at that character
 * offset. A paragraph whose text moved is skipped rather than filled with a formula in the wrong spot.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: false,
  preserveOrder: true,
  attributeNamePrefix: '@_',
  // `m:t` values carry meaningful spaces ("E = mc2" is three runs), so nothing may be trimmed here
  trimValues: false,
  parseTagValue: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

export interface DocxMathItem {
  /** Paragraph index, counted over every `w:p` in document order (same base as the review pass) */
  block: number;
  /** How much non-equation text precedes the formula inside that paragraph */
  offset: number;
  /** `m:oMathPara`: Word renders it as its own centred line */
  display: boolean;
  latex: string;
}

export interface DocxMathImport {
  items: DocxMathItem[];
  /** Non-equation text of each paragraph, in the same order as `block` */
  texts: string[];
}

function findNode(nodes: XmlNode[], tag: string): XmlNode | undefined {
  for (const node of nodes) {
    if (localNameOf(node) === tag) return node;
    const deeper = findNode(childrenOf(node), tag);
    if (deeper) return deeper;
  }
  return undefined;
}

/** Every `w:p` in document order, including the ones inside tables */
function collectParagraphs(node: XmlNode, out: XmlNode[] = []): XmlNode[] {
  if (localNameOf(node) === 'p') out.push(node);
  for (const child of childrenOf(node)) collectParagraphs(child, out);
  return out;
}

/** Property containers (`w:pPr`, `m:rPr`, …) hold no visible text */
const isProperties = (name: string): boolean => name.endsWith('Pr');

function readParagraph(paragraph: XmlNode, block: number, output: DocxMathImport): void {
  let text = '';
  const scan = (node: XmlNode, display: boolean): void => {
    for (const child of childrenOf(node)) {
      const name = localNameOf(child);
      if (isProperties(name)) continue;
      if (name === 'oMathPara') {
        scan(child, true);
        continue;
      }
      if (name === 'oMath') {
        const latex = ommlToLatex(child);
        if (latex) output.items.push({ block, offset: text.length, display, latex });
        continue;
      }
      if (name === 't') {
        text += textOf(child);
        continue;
      }
      if (name === 'tab' || name === 'br' || name === 'cr') {
        // mammoth renders these as one character too, so the offset stays aligned
        text += ' ';
        continue;
      }
      scan(child, display);
    }
  };
  scan(paragraph, false);
  output.texts[block] = text;
}

/** Equations of `word/document.xml`, plus the paragraph text they have to be placed against */
export function parseDocxMath(documentXml: string): DocxMathImport {
  const output: DocxMathImport = { items: [], texts: [] };
  if (!documentXml.includes('oMath')) return output;
  try {
    const parsed = parser.parse(documentXml) as XmlNode[];
    const body = findNode(parsed, 'body');
    if (!body) return output;
    collectParagraphs(body).forEach((paragraph, index) => readParagraph(paragraph, index, output));
    // Paragraphs without text still occupy a slot; fill the gaps so `texts` is dense
    for (let index = 0; index < output.texts.length; index += 1) {
      if (output.texts[index] === undefined) output.texts[index] = '';
    }
    return output;
  } catch {
    return { items: [], texts: [] };
  }
}

const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li';

function leafBlocks(root: Element): Element[] {
  return Array.from(root.querySelectorAll(BLOCK_SELECTOR)).filter(
    (block) => !block.querySelector(BLOCK_SELECTOR),
  );
}

const normalizeText = (text: string): string =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The editor's inline math node, for a formula that shares its line with text.
 *
 * A `<div>` here would be hoisted out of the paragraph by the HTML parser, so a display formula that
 * sits *inside* a paragraph with text still has to stay inline; only a paragraph that holds nothing
 * but the formula can become a real block (see {@link mathBlockElement}).
 */
function mathSpan(doc: Document, item: DocxMathItem): HTMLElement {
  const node = doc.createElement('span');
  node.setAttribute('data-math', 'inline');
  node.setAttribute('data-latex', item.latex);
  return node;
}

/**
 * A block formula: mammoth left no paragraph at all, so the node is inserted as a sibling and the
 * schema turns it into `mathBlock` (a centred line of its own, exactly what `m:oMathPara` renders as).
 */
function mathBlockElement(doc: Document, item: DocxMathItem): HTMLElement {
  const node = doc.createElement('div');
  node.setAttribute('data-math', 'block');
  node.setAttribute('data-display', 'true');
  node.setAttribute('data-latex', item.latex);
  return node;
}

interface Slot {
  node: Text;
  start: number;
  length: number;
}

function textSlots(element: Element): Slot[] {
  const slots: Slot[] = [];
  let offset = 0;
  // Rooted at the block: the walker never leaves it, so offsets are block-local
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    slots.push({ node, start: offset, length: node.data.length });
    offset += node.data.length;
  }
  return slots;
}

/**
 * Splice every equation back into the imported HTML.
 * Only paragraphs whose text is byte-identical to Word's are touched: the offset is a character
 * index, and an approximated one would put the formula inside the wrong word.
 */
export function applyDocxMath(
  html: string,
  imported: DocxMathImport,
): { html: string; applied: number; skipped: number } {
  const { items, texts } = imported;
  if (items.length === 0) return { html, applied: 0, skipped: 0 };
  if (typeof DOMParser === 'undefined') return { html, applied: 0, skipped: items.length };

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const blocks = leafBlocks(doc.body);
  const pairs = alignBlocks(
    texts.map((text) => normalizeText(text)),
    blocks.map((block) => normalizeText(block.textContent ?? '')),
  );

  const byBlock = new Map<number, DocxMathItem[]>();
  for (const item of items) {
    const list = byBlock.get(item.block);
    if (list) list.push(item);
    else byBlock.set(item.block, [item]);
  }

  /** The next paragraph that did find a block: where an orphan equation is placed before */
  const nextPairedBlock = (blockIndex: number): Element | null => {
    let nearest = Number.POSITIVE_INFINITY;
    for (const key of pairs.keys()) {
      if (key > blockIndex && key < nearest) nearest = key;
    }
    const position = pairs.get(nearest);
    return position === undefined ? null : (blocks[position] ?? null);
  };

  let applied = 0;
  let skipped = 0;

  // A paragraph that only holds a formula has no text, so the text alignment cannot find it (several
  // empty paragraphs collapse onto the same key). Word puts it on its own line; it is re-created as
  // its own paragraph right before the next paragraph that *was* matched. Descending order keeps the
  // relative order of several consecutive formula paragraphs.
  const orphans = [...byBlock.keys()].filter((block) => !pairs.has(block)).sort((a, b) => b - a);
  for (const blockIndex of orphans) {
    const blockItems = byBlock.get(blockIndex) ?? [];
    const text = texts[blockIndex] ?? '';
    if (text.trim().length > 0) {
      skipped += blockItems.length;
      continue;
    }
    const anchor = nextPairedBlock(blockIndex);
    const parent = anchor?.parentElement;
    if (!anchor || !parent || ['TD', 'TH', 'TR', 'TABLE'].includes(parent.tagName)) {
      skipped += blockItems.length;
      continue;
    }
    for (const item of blockItems) {
      // A formula-only paragraph is where `m:oMathPara` lives, so it becomes a real block node; an
      // inline equation alone in its paragraph keeps a paragraph wrapper (a bare span at body level
      // would be wrapped in one by the parser anyway, but stays inline this way)
      const node = item.display
        ? mathBlockElement(doc, item)
        : (() => {
            const paragraph = doc.createElement('p');
            paragraph.appendChild(mathSpan(doc, item));
            return paragraph;
          })();
      parent.insertBefore(node, anchor);
      applied += 1;
    }
  }

  for (const [blockIndex, blockItems] of byBlock) {
    if (!pairs.has(blockIndex)) continue;
    const blockPosition = pairs.get(blockIndex);
    const element = blockPosition === undefined ? undefined : blocks[blockPosition];
    if (!element) {
      skipped += blockItems.length;
      continue;
    }
    const slots = textSlots(element);
    const full = slots.map((slot) => slot.node.data).join('');
    if (full !== texts[blockIndex]) {
      skipped += blockItems.length;
      continue;
    }
    // Back to front, so an insertion never shifts the offset of the one still to be placed
    for (const item of [...blockItems].sort((a, b) => b.offset - a.offset)) {
      const node = mathSpan(doc, item);
      const slot = slots.find((candidate) => item.offset <= candidate.start + candidate.length);
      if (slot) {
        const local = Math.max(0, Math.min(item.offset - slot.start, slot.node.data.length));
        const tail = slot.node.splitText(local);
        tail.parentNode?.insertBefore(node, tail);
      } else {
        element.appendChild(node);
      }
      applied += 1;
    }
  }

  return { html: applied > 0 ? doc.body.innerHTML : html, applied, skipped };
}
