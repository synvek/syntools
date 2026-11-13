import { alignBlocks } from './docxBlockAlign';

/**
 * Run-level formats ← `word/document.xml`, import side.
 *
 * mammoth maps bold / italic / underline / strike / vertical-align, and nothing else. Everything a
 * technical document actually uses to *point at* text is dropped: `w:highlight` (a marker), `w:em`
 * (Chinese 着重号, the dots under the characters) and character styles such as a monospace "Code" run
 * with a light background. The paragraph still imports — the emphasis just disappears, which reads as
 * "the importer ignored the formatting".
 *
 * Placement reuses the paragraph alignment used by the other import passes: the paragraph is matched by
 * text, then the run is spliced back at its character offset. Wrapping never changes the text length, so
 * offsets stay valid even with several runs in one paragraph.
 */

export interface RunFormat {
  /** Paragraph index, counted over every `w:p` in document order */
  block: number;
  /** Character offset inside that paragraph's visible text */
  start: number;
  end: number;
  /** `w:highlight` value (yellow / green / …) */
  highlight?: string;
  /** `w:em` value: `dot` is the Chinese emphasis mark */
  emphasis?: string;
  /** Character style with a monospace font or a shading fill */
  code?: boolean;
}

export interface DocxRunFormats {
  items: RunFormat[];
  /** Visible text of each paragraph, in the same order as `block` */
  texts: string[];
}

/** Word's named highlight colours; anything unknown falls back to yellow, like Word's own default */
const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: '#ffff00',
  green: '#00ff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  blue: '#0000ff',
  red: '#ff0000',
  darkBlue: '#000080',
  darkCyan: '#008080',
  darkGreen: '#008000',
  darkMagenta: '#800080',
  darkRed: '#800000',
  darkYellow: '#808000',
  darkGray: '#808080',
  lightGray: '#c0c0c0',
  black: '#000000',
  white: '#ffffff',
};

export function highlightColor(value: string): string {
  return HIGHLIGHT_COLORS[value] ?? HIGHLIGHT_COLORS.yellow ?? '#ffff00';
}

const PARAGRAPH_RE = /<w:p(?:\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/w:p>)/g;
const RUN_RE = /<w:r(?:\s[^>]*?)?(?:>([\s\S]*?)<\/w:r>|\/>)/g;

const normalizeText = (text: string): string =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Character styles that should come back as code: monospace font or a shading fill */
function codeStyleIds(stylesXml: string): Set<string> {
  const ids = new Set<string>();
  if (!stylesXml.includes('w:type="character"')) return ids;
  for (const match of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    if (!/w:type="character"/.test(match[1] ?? '')) continue;
    const id = /w:styleId="([^"]*)"/.exec(match[1] ?? '')?.[1];
    if (!id) continue;
    const body = match[2] ?? '';
    const fonts = /<w:rFonts\b([^>]*?)\/>/.exec(body)?.[1] ?? '';
    const monospace = /(consolas|courier|monaco|menlo|monospace)/i.test(fonts);
    const shaded = /<w:shd\b[^>]*w:fill="(?!auto)/.test(body);
    if (monospace || shaded) ids.add(id);
  }
  return ids;
}

function attribute(xml: string, name: string): string | null {
  return new RegExp(`${name}="([^"]*)"`).exec(xml)?.[1] ?? null;
}

/** One paragraph's runs with their visible-text offsets and the formats mammoth drops */
function readParagraph(
  body: string,
  block: number,
  codeIds: ReadonlySet<string>,
  output: DocxRunFormats,
): void {
  let text = '';
  /** Runs inside `w:del` are not visible: their text must not advance the offset */
  const deletions = body.indexOf('<w:del ');
  for (const match of body.matchAll(RUN_RE)) {
    const run = match[1] ?? '';
    const deleted = deletions >= 0 && isInsideDeletion(body, match.index ?? 0);
    const runText = Array.from(run.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
      .map((piece) => piece[1] ?? '')
      .join('');
    if (deleted) continue;
    if (!runText) continue;
    const properties = /<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/.exec(run)?.[1] ?? '';
    const highlight = attribute(/<w:highlight\b([^>]*?)\/>/.exec(properties)?.[1] ?? '', 'w:val');
    const emphasis = attribute(/<w:em\b([^>]*?)\/>/.exec(properties)?.[1] ?? '', 'w:val');
    const styleId = attribute(/<w:rStyle\b([^>]*?)\/>/.exec(properties)?.[1] ?? '', 'w:val');
    const code = styleId !== null && codeIds.has(styleId);
    const start = text.length;
    text += runText;
    if (!highlight && !emphasis && !code) continue;
    if (highlight === 'none' && !emphasis && !code) continue;
    output.items.push({
      block,
      start,
      end: text.length,
      ...(highlight && highlight !== 'none' ? { highlight } : {}),
      ...(emphasis && emphasis !== 'none' ? { emphasis } : {}),
      ...(code ? { code: true } : {}),
    });
  }
  output.texts[block] = text;
}

/** Whether a run starts inside a `w:del` element (walking back to the nearest unclosed `w:del`) */
function isInsideDeletion(body: string, index: number): boolean {
  let open = 0;
  const head = body.slice(0, index);
  for (const match of head.matchAll(/<\/?w:del\b[^>]*>/g)) {
    open += match[0].startsWith('</') ? -1 : 1;
  }
  return open > 0;
}

export function parseDocxRunFormats(documentXml: string, stylesXml: string): DocxRunFormats {
  const output: DocxRunFormats = { items: [], texts: [] };
  if (!documentXml.includes('<w:p')) return output;
  if (!/<w:highlight\b|<w:em\b|w:rStyle/.test(documentXml)) return output;
  const codeIds = codeStyleIds(stylesXml);
  for (const match of documentXml.matchAll(PARAGRAPH_RE)) {
    readParagraph(match[1] ?? '', output.texts.length, codeIds, output);
  }
  for (let index = 0; index < output.texts.length; index += 1) {
    if (output.texts[index] === undefined) output.texts[index] = '';
  }
  return output;
}

const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li';

function leafBlocks(root: Element): Element[] {
  return Array.from(root.querySelectorAll(BLOCK_SELECTOR)).filter(
    (block) => !block.querySelector(BLOCK_SELECTOR),
  );
}

interface Slot {
  node: Text;
  start: number;
  length: number;
}

function textSlots(element: Element): Slot[] {
  const slots: Slot[] = [];
  let offset = 0;
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    slots.push({ node, start: offset, length: node.data.length });
    offset += node.data.length;
  }
  return slots;
}

function wrapperFor(
  doc: Document,
  item: RunFormat,
  kind: 'highlight' | 'emphasis' | 'code',
): HTMLElement {
  if (kind === 'highlight') {
    const mark = doc.createElement('mark');
    mark.setAttribute('data-color', highlightColor(item.highlight ?? 'yellow'));
    mark.style.backgroundColor = highlightColor(item.highlight ?? 'yellow');
    return mark;
  }
  if (kind === 'emphasis') {
    const span = doc.createElement('span');
    span.setAttribute('data-emphasis', item.emphasis ?? 'dot');
    span.style.textEmphasis = `filled ${item.emphasis === 'comma' ? 'filled sesame' : 'dot'}`;
    span.style.textEmphasisPosition = 'under';
    return span;
  }
  const code = doc.createElement('code');
  code.className = 'rte-code-run';
  return code;
}

/**
 * Wrap every recorded run in the imported HTML.
 * Offsets are block-local and wrappers keep the text length, so one pass per block is enough.
 */
export function applyDocxRunFormats(
  html: string,
  formats: DocxRunFormats,
): { html: string; applied: number; skipped: number } {
  const { items, texts } = formats;
  if (items.length === 0) return { html, applied: 0, skipped: 0 };
  if (typeof DOMParser === 'undefined') return { html, applied: 0, skipped: items.length };

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const blocks = leafBlocks(doc.body);
  const pairs = alignBlocks(
    texts.map((text) => normalizeText(text)),
    blocks.map((block) => normalizeText(block.textContent ?? '')),
  );

  const byBlock = new Map<number, RunFormat[]>();
  for (const item of items) {
    const list = byBlock.get(item.block);
    if (list) list.push(item);
    else byBlock.set(item.block, [item]);
  }

  let applied = 0;
  let skipped = 0;
  for (const [blockIndex, blockItems] of byBlock) {
    const position = pairs.get(blockIndex);
    const element = position === undefined ? undefined : blocks[position];
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
    // Later ranges first: wrapping does not change lengths, but keeping the order makes the produced
    // markup deterministic (outer wrappers last)
    for (const item of [...blockItems].sort((a, b) => b.start - a.start)) {
      const kinds: ('highlight' | 'emphasis' | 'code')[] = [];
      if (item.highlight) kinds.push('highlight');
      if (item.emphasis) kinds.push('emphasis');
      if (item.code) kinds.push('code');
      for (const kind of kinds) {
        if (!wrapRange(doc, element, item.start, item.end, wrapperFor(doc, item, kind))) {
          skipped += 1;
          continue;
        }
        applied += 1;
      }
    }
  }

  return { html: applied > 0 ? doc.body.innerHTML : html, applied, skipped };
}

/** Wrap one block-local range; `false` when the range does not exist in the block */
function wrapRange(
  doc: Document,
  element: Element,
  start: number,
  end: number,
  wrapper: HTMLElement,
): boolean {
  const slots = textSlots(element);
  const startPos = locate(slots, start, false);
  const endPos = locate(slots, end, true);
  if (!startPos || !endPos) return false;
  const range = doc.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  if (range.collapsed) return false;
  wrapper.appendChild(range.extractContents());
  range.insertNode(wrapper);
  return true;
}

function locate(
  slots: Slot[],
  offset: number,
  isEnd: boolean,
): { node: Text; offset: number } | null {
  for (const slot of slots) {
    const inside = isEnd
      ? offset > slot.start && offset <= slot.start + slot.length
      : offset >= slot.start && offset < slot.start + slot.length;
    if (inside) return { node: slot.node, offset: offset - slot.start };
  }
  const last = slots[slots.length - 1];
  if (isEnd && last) return { node: last.node, offset: last.length };
  return null;
}
