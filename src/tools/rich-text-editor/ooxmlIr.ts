import { XMLParser } from 'fast-xml-parser';
import type { ToolResult } from '@/core/types';
import {
  attr,
  childOf,
  childrenOf,
  localNameOf,
  relAttr,
  tagOf,
  textOf,
  type XmlNode,
} from '../../core/drawing/xmlNode';
import { ommlToLatex } from './mathOmml';

/**
 * Structured import IR (implementation plan P0-2.1).
 *
 * This module is the *pure* boundary between OOXML parts and editor nodes: it only consumes
 * part-path → XML-string data and produces JSON-serialisable values. It never reads a File/Blob,
 * never opens a zip, never touches DOMParser/document, and never constructs a Tiptap editor.
 * `importDocx` still owns the mammoth → HTML main path; this IR is a side channel that later
 * P0-2.x sub-tasks will fill in and P0-2.6 will gate behind `USE_OOXML_IR`.
 *
 * The three stages are deliberately separate and independently testable:
 *   `collectPartFacts` (inventory) → `parseOoxmlParts` (part → IR) → `irToTiptapDoc` (IR → nodes).
 */

/** Part path → UTF-8 XML/text. Media entries only need their path, so the value may be empty. */
export type OoxmlParts = Record<string, string>;

/** The 14 part counters used by the P0-1 roundtrip baseline (`roundtrip.test.ts:222-237`). */
export interface OoxmlPartFacts {
  sections: number;
  headers: number;
  footers: number;
  footnotes: number;
  endnotes: number;
  comments: number;
  revisions: number;
  fields: number;
  math: number;
  shapes: number;
  images: number;
  styles: number;
  numbering: number;
  people: number;
}

export type IrMark = { type: 'bold' | 'italic' | 'underline' };
export type IrNoteKind = 'footnote' | 'endnote';

export interface IrRun {
  text: string;
  marks: IrMark[];
  noteRef?: { kind: IrNoteKind; id: string };
  /** REF / PAGEREF field at this position (P0-2.3): rendered as the `xref` atom node. */
  xref?: { target: string; mode: 'text' | 'page' };
}

export type IrAnchorKind =
  'bookmark' | 'image' | 'shape' | 'math' | 'field' | 'toc' | 'revision' | 'comment';

/** An OOXML feature attached to a paragraph, kept as data instead of being injected into HTML. */
export interface IrAnchor {
  kind: IrAnchorKind;
  id?: string;
  code?: string;
}

export interface IrBlock {
  /** Index among body paragraphs (including empty ones): the same boundary the HTML merge uses */
  index: number;
  text: string;
  runs: IrRun[];
  anchors: IrAnchor[];
}

export interface IrPageSetup {
  /** Twips (1/20 pt) as stored in `w:pgSz` */
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
}

/** Twips from `w:pgMar`; `header` / `footer` are the distances to the page edge. */
export interface IrMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
  header: number;
  footer: number;
  gutter: number;
}

export interface IrSection {
  index: number;
  headerRefs: string[];
  footerRefs: string[];
  /** Resolved part paths from `word/_rels/document.xml.rels` (P0-2.4) */
  headerParts: string[];
  footerParts: string[];
  /** Visible text of each referenced header / footer part */
  headerTexts: string[];
  footerTexts: string[];
  page: IrPageSetup;
  margins: IrMargins;
  titlePage: boolean;
}

export interface IrNote {
  kind: IrNoteKind;
  id: string;
  text: string;
  /**
   * 1-based display number, assigned from reference order (P0-2.2). Each kind numbers
   * independently, matching Word's footnotes.xml / endnotes.xml split. `0` means the part
   * exists but the body never references it.
   */
  number: number;
}

/** Ordered summary entry for the document-end list (`<ol>` in `notes.ts`'s renderNoteList). */
export interface IrNoteSummary {
  number: number;
  id: string;
  text: string;
}

export type IrFieldKind = 'toc' | 'ref' | 'other';

export interface IrField {
  kind: IrFieldKind;
  /** Raw field instruction, e.g. `TOC \o "1-3"` or `REF bookmark \h` */
  code: string;
  blockIndex: number;
  /** REF / PAGEREF target bookmark */
  target?: string;
  /** `REF` (text) vs `PAGEREF` (page number) */
  mode?: 'text' | 'page';
  /** Cached field result text between `fldCharType="separate"` and `"end"` */
  display?: string;
}

export interface IrMath {
  blockIndex: number;
  /** Filled by P0-2.3 (OMML → LaTeX); absent means the part is reported as a loss */
  latex?: string;
}

export type IrWrapMode = 'inline' | 'square' | 'tight' | 'through' | 'topAndBottom' | 'none';

export interface IrImage {
  blockIndex: number;
  relationshipId?: string;
  /** Media part path resolved through `word/_rels/document.xml.rels` */
  target?: string;
  /** `wp:anchor` vs `wp:inline` */
  floating: boolean;
  wrap: IrWrapMode;
  /** `wp:anchor/@behindDoc`: true = behind the text layer */
  behindDoc: boolean;
  /** EMU offsets from `wp:positionH/V/wp:posOffset` */
  offsetX?: number;
  offsetY?: number;
  /** EMU from `wp:extent/@cx` / `@cy` */
  width?: number;
  height?: number;
}

export interface IrShape {
  blockIndex: number;
  /** `wp:docPr/@name` when the shape lives inside a drawing */
  name?: string;
  /** EMU size from `wp:extent` */
  width?: number;
  height?: number;
}

export interface IrBookmark {
  name: string;
  blockIndex: number;
}

export type IrRevisionKind = 'insert' | 'delete' | 'format';

export interface IrRevision {
  kind: IrRevisionKind;
  /** `w:ins@w:id` / `w:del@w:id` / change id */
  id: string;
  blockIndex: number;
  /** Inserted visible text, or deleted `w:delText` content */
  text: string;
  author?: string;
  date?: string;
}

export interface IrComment {
  id: string;
  /** `-1` when comments.xml has the body but the document has no range start */
  blockIndex: number;
  text: string;
  author?: string;
  date?: string;
}

export interface IrReview {
  insertions: number;
  deletions: number;
  commentIds: string[];
  revisions: IrRevision[];
  comments: IrComment[];
}

/** A part that the current IR stage cannot yet put back into the editor (P0-2.5 → fidelity.ts). */
export interface IrLoss {
  code: string;
  count: number;
}

export interface OoxmlIr {
  version: 1;
  facts: OoxmlPartFacts;
  blocks: IrBlock[];
  sections: IrSection[];
  notes: IrNote[];
  fields: IrField[];
  math: IrMath[];
  images: IrImage[];
  shapes: IrShape[];
  review: IrReview;
  bookmarks: IrBookmark[];
  losses: IrLoss[];
}

/** Tiptap-compatible JSON shape, kept local so this module has no editor dependency. */
export interface IrTiptapNode {
  type: string;
  text?: string;
  marks?: IrMark[];
  attrs?: Record<string, string | number | boolean>;
  content?: IrTiptapNode[];
}

const DOCUMENT_PART = 'word/document.xml';

/** Same parser options as `docxShapeImport.ts`: preserve sibling order and namespace prefixes. */
const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: false,
  preserveOrder: true,
  attributeNamePrefix: '@_',
  // Word relies on `xml:space="preserve"` for leading/trailing spaces in w:t; trimming here would
  // silently change the visible text and break the equality checks used by the HTML merge.
  trimValues: false,
  parseTagValue: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

function parseXml(xml: string): XmlNode[] {
  return parser.parse(xml) as XmlNode[];
}

function findFirst(nodes: XmlNode[], tag: string): XmlNode | undefined {
  for (const node of nodes) {
    if (localNameOf(node) === tag) return node;
    const nested = findFirst(childrenOf(node), tag);
    if (nested) return nested;
  }
  return undefined;
}

function collect(node: XmlNode, tag: string, out: XmlNode[] = []): XmlNode[] {
  for (const child of childrenOf(node)) {
    if (localNameOf(child) === tag) out.push(child);
    collect(child, tag, out);
  }
  return out;
}

/** OOXML attributes may be spelled `w:id` or `id`; relationship ids use `r:id` / `r:embed`. */
function idAttr(node: XmlNode | undefined, name: string): string | undefined {
  return attr(node, `w:${name}`) ?? attr(node, name);
}

/** A toggle is on unless it explicitly says `0` / `false` / `off`. */
function toggleOn(node: XmlNode | undefined): boolean {
  if (!node) return false;
  const value = idAttr(node, 'val');
  return value !== '0' && value !== 'false' && value !== 'off';
}

function countMatches(xml: string, pattern: RegExp): number {
  return (xml.match(pattern) ?? []).length;
}

/**
 * Visible Word text only. `collect(..., 't')` ignores namespace prefixes, so `<m:t>` from an OMML
 * formula would otherwise leak into a paragraph as plain text.
 */
function visibleText(node: XmlNode): string {
  return collect(node, 't')
    .filter((item) => tagOf(item) === 'w:t' || tagOf(item) === 't')
    .map((item) => textOf(item))
    .join('');
}

/**
 * Inventory of the parts a .docx actually contains. Pure counterpart of the baseline's
 * `docxPartFacts(bytes)`: identical keys and regexes, but no JSZip and no I/O.
 */
export function collectPartFacts(parts: OoxmlParts): OoxmlPartFacts {
  const names = Object.keys(parts);
  const document = parts[DOCUMENT_PART] ?? '';
  return {
    sections: countMatches(document, /<w:sectPr[\s>]/g),
    headers: names.filter((name) => /^word\/header\d+\.xml$/.test(name)).length,
    footers: names.filter((name) => /^word\/footer\d+\.xml$/.test(name)).length,
    footnotes: countMatches(parts['word/footnotes.xml'] ?? '', /<w:footnote[\s>]/g),
    endnotes: countMatches(parts['word/endnotes.xml'] ?? '', /<w:endnote[\s>]/g),
    comments: countMatches(parts['word/comments.xml'] ?? '', /<w:comment[\s>]/g),
    revisions: countMatches(document, /<w:(?:ins|del)[\s>]/g),
    fields: countMatches(document, /<w:(?:fldChar|instrText)[\s>]/g),
    math: countMatches(document, /<m:oMath[\s>]/g),
    shapes: countMatches(document, /<wps:wsp[\s>]/g),
    images: names.filter((name) => /^word\/media\//.test(name)).length,
    styles: countMatches(parts['word/styles.xml'] ?? '', /<w:style[\s>]/g),
    numbering: countMatches(parts['word/numbering.xml'] ?? '', /<w:num[\s>]/g),
    people: countMatches(parts['word/people.xml'] ?? '', /<w15:person[\s>]/g),
  };
}

function parseNotes(parts: OoxmlParts): IrNote[] {
  const notes: IrNote[] = [];
  for (const [kind, part, rootTag, itemTag] of [
    ['footnote', 'word/footnotes.xml', 'footnotes', 'footnote'],
    ['endnote', 'word/endnotes.xml', 'endnotes', 'endnote'],
  ] as const) {
    const xml = parts[part];
    if (!xml) continue;
    const root = findFirst(parseXml(xml), rootTag);
    if (!root) continue;
    for (const item of childrenOf(root).filter((node) => localNameOf(node) === itemTag)) {
      // Word writes separator / continuationSeparator entries first; they are layout markers,
      // not user notes, and must not consume a display number.
      const type = idAttr(item, 'type');
      if (type === 'separator' || type === 'continuationSeparator') continue;
      notes.push({ kind, id: idAttr(item, 'id') ?? '', text: visibleText(item), number: 0 });
    }
  }
  return notes;
}

/**
 * Number notes from body reference order (P0-2.2). The ids in footnotes.xml / endnotes.xml are
 * relation targets, not display numbers: Word numbers the two kinds independently by the order
 * their references appear in the body. A repeated reference keeps its first number; an
 * unreferenced note stays at `0` and is reported through `irLosses`.
 */
export function assignNoteNumbers(blocks: IrBlock[], notes: IrNote[]): IrNote[] {
  const numbered = notes.map((note) => ({ ...note }));
  const byKey = new Map(numbered.map((note) => [`${note.kind}:${note.id}`, note]));
  const counters: Record<IrNoteKind, number> = { footnote: 0, endnote: 0 };
  for (const block of blocks) {
    for (const run of block.runs) {
      const ref = run.noteRef;
      if (!ref) continue;
      const note = byKey.get(`${ref.kind}:${ref.id}`);
      if (!note || note.number > 0) continue;
      counters[ref.kind] += 1;
      note.number = counters[ref.kind];
    }
  }
  return numbered;
}

/** Document-end list for one kind, ordered by display number (unreferenced notes excluded). */
export function irNoteSummaries(ir: OoxmlIr, kind: IrNoteKind): IrNoteSummary[] {
  return ir.notes
    .filter((note) => note.kind === kind && note.number > 0)
    .sort((left, right) => left.number - right.number)
    .map(({ number, id, text }) => ({ number, id, text }));
}

/** Stable block identity used by the anchor resolver (P0-2.5). */
export interface IrBlockAnchor {
  blockIndex: number;
  bookmarks: string[];
  text: string;
}

/** A rendered HTML block; `bookmarks` come from `<a id>` / `<a name>` when available. */
export interface AnchorCandidate {
  text: string;
  bookmarks?: string[];
}

export type AnchorMatch = 'index' | 'bookmark' | 'text';

export interface AnchorResolution {
  blockIndex: number;
  matchedBy: AnchorMatch;
  /** Matched by index but the normalized text differs: keep the anchor and report the drift. */
  drifted: boolean;
}

export function irBlockAnchors(ir: OoxmlIr): IrBlockAnchor[] {
  return ir.blocks.map((block) => ({
    blockIndex: block.index,
    bookmarks: block.anchors
      .filter((anchor) => anchor.kind === 'bookmark')
      .map((anchor) => anchor.id)
      .filter((id): id is string => Boolean(id)),
    text: block.text,
  }));
}

function normalizeAnchorText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Resolve an IR block to a rendered HTML block without requiring strict text equality (P0-2.5).
 *
 * Order: block index → bookmark → unique text. An index hit is authoritative even when the text
 * drifted, because the whole point is to stop discarding structures when mammoth reflows a block;
 * the drift is surfaced to the caller instead. Only ambiguous / missing matches return `null`,
 * and the caller reports those through `fidelity.ts`.
 */
export function resolveBlockAnchor(
  block: IrBlockAnchor,
  candidates: readonly AnchorCandidate[],
): AnchorResolution | null {
  const direct = candidates[block.blockIndex];
  if (direct) {
    return {
      blockIndex: block.blockIndex,
      matchedBy: 'index',
      drifted: normalizeAnchorText(direct.text) !== normalizeAnchorText(block.text),
    };
  }

  if (block.bookmarks.length > 0) {
    const byBookmark = candidates.flatMap((candidate, index) =>
      (candidate.bookmarks ?? []).some((name) => block.bookmarks.includes(name)) ? [index] : [],
    );
    if (byBookmark.length === 1) {
      return { blockIndex: byBookmark[0], matchedBy: 'bookmark', drifted: false };
    }
  }

  const normalized = normalizeAnchorText(block.text);
  const byText = candidates.flatMap((candidate, index) =>
    normalizeAnchorText(candidate.text) === normalized ? [index] : [],
  );
  if (byText.length === 1) return { blockIndex: byText[0], matchedBy: 'text', drifted: false };
  return null;
}

function numAttr(node: XmlNode | undefined, name: string): number | undefined {
  const raw = idAttr(node, name);
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** `media/image1.png` / `header1.xml` / `/word/...` → `word/...` */
function normalizePartTarget(target: string): string {
  const cleaned = target.replace(/^\.?\//, '');
  if (cleaned.startsWith('word/')) return cleaned;
  return `word/${cleaned}`;
}

function parseRelationships(parts: OoxmlParts): Record<string, string> {
  const xml = parts['word/_rels/document.xml.rels'];
  if (!xml) return {};
  const root = findFirst(parseXml(xml), 'Relationships');
  if (!root) return {};
  const relations: Record<string, string> = {};
  for (const node of childrenOf(root).filter((child) => localNameOf(child) === 'Relationship')) {
    const id = attr(node, 'Id') ?? attr(node, 'id');
    const target = attr(node, 'Target') ?? attr(node, 'target');
    if (id && target) relations[id] = normalizePartTarget(target);
  }
  return relations;
}

function partText(xml: string | undefined): string {
  if (!xml) return '';
  try {
    return parseXml(xml)
      .map((node) => visibleText(node))
      .join('');
  } catch {
    return '';
  }
}

const WRAP_MODES: Array<[string, IrWrapMode]> = [
  ['wrapSquare', 'square'],
  ['wrapTight', 'tight'],
  ['wrapThrough', 'through'],
  ['wrapTopAndBottom', 'topAndBottom'],
  ['wrapNone', 'none'],
];

function wrapModeOf(anchor: XmlNode): IrWrapMode {
  for (const [tag, mode] of WRAP_MODES) {
    if (childOf(anchor, tag)) return mode;
  }
  return 'none';
}

function offsetOf(position: XmlNode | undefined): number | undefined {
  const offset = position ? childOf(position, 'posOffset') : undefined;
  if (!offset) return undefined;
  const value = Number(textOf(offset));
  return Number.isFinite(value) ? value : undefined;
}

function parseImage(
  drawing: XmlNode,
  blockIndex: number,
  relations: Record<string, string>,
): IrImage {
  const anchor = childOf(drawing, 'anchor');
  const container = anchor ?? childOf(drawing, 'inline');
  const blip = collect(drawing, 'blip')[0];
  const relationshipId = blip ? relAttr(blip, 'embed') : undefined;
  const extent = container ? childOf(container, 'extent') : undefined;
  const offsetX = offsetOf(container ? childOf(container, 'positionH') : undefined);
  const offsetY = offsetOf(container ? childOf(container, 'positionV') : undefined);
  const behindDoc = anchor ? idAttr(anchor, 'behindDoc') : undefined;
  const width = numAttr(extent, 'cx');
  const height = numAttr(extent, 'cy');

  return {
    blockIndex,
    ...(relationshipId ? { relationshipId } : {}),
    ...(relationshipId && relations[relationshipId] ? { target: relations[relationshipId] } : {}),
    floating: Boolean(anchor),
    wrap: anchor ? wrapModeOf(anchor) : 'inline',
    behindDoc: behindDoc === '1' || behindDoc === 'true',
    ...(offsetX !== undefined ? { offsetX } : {}),
    ...(offsetY !== undefined ? { offsetY } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };
}

function parseSections(
  body: XmlNode,
  parts: OoxmlParts,
  relations: Record<string, string>,
): IrSection[] {
  return collect(body, 'sectPr').map((section, index) => {
    const refs = (tag: string): string[] =>
      collect(section, tag)
        .map((node) => relAttr(node, 'id'))
        .filter((id): id is string => Boolean(id));
    const headerRefs = refs('headerReference');
    const footerRefs = refs('footerReference');
    const resolve = (ids: string[]): string[] =>
      ids.map((id) => relations[id]).filter((path): path is string => Boolean(path));
    const headerParts = resolve(headerRefs);
    const footerParts = resolve(footerRefs);

    const pageSize = childOf(section, 'pgSz');
    const margins = childOf(section, 'pgMar');
    const orientation = idAttr(pageSize, 'orient');

    return {
      index,
      headerRefs,
      footerRefs,
      headerParts,
      footerParts,
      headerTexts: headerParts.map((path) => partText(parts[path])),
      footerTexts: footerParts.map((path) => partText(parts[path])),
      page: {
        width: numAttr(pageSize, 'w') ?? 0,
        height: numAttr(pageSize, 'h') ?? 0,
        orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
      },
      margins: {
        top: numAttr(margins, 'top') ?? 0,
        right: numAttr(margins, 'right') ?? 0,
        bottom: numAttr(margins, 'bottom') ?? 0,
        left: numAttr(margins, 'left') ?? 0,
        header: numAttr(margins, 'header') ?? 0,
        footer: numAttr(margins, 'footer') ?? 0,
        gutter: numAttr(margins, 'gutter') ?? 0,
      },
      titlePage: Boolean(childOf(section, 'titlePg')),
    };
  });
}

function parseRun(run: XmlNode): IrRun | null {
  const text = visibleText(run);
  const marks: IrMark[] = [];
  const properties = childOf(run, 'rPr');
  if (properties) {
    if (toggleOn(childOf(properties, 'b'))) marks.push({ type: 'bold' });
    if (toggleOn(childOf(properties, 'i'))) marks.push({ type: 'italic' });
    if (toggleOn(childOf(properties, 'u'))) marks.push({ type: 'underline' });
  }
  const footnote = collect(run, 'footnoteReference')[0];
  const endnote = collect(run, 'endnoteReference')[0];
  const noteRef = footnote
    ? { kind: 'footnote' as const, id: idAttr(footnote, 'id') ?? '' }
    : endnote
      ? { kind: 'endnote' as const, id: idAttr(endnote, 'id') ?? '' }
      : undefined;
  if (!text && marks.length === 0 && !noteRef) return null;
  return noteRef ? { text, marks, noteRef } : { text, marks };
}

function deletedText(node: XmlNode): string {
  return collect(node, 'delText')
    .map((item) => textOf(item))
    .join('');
}

function revisionOf(
  node: XmlNode,
  kind: IrRevisionKind,
  blockIndex: number,
  text: string,
): IrRevision {
  const author = idAttr(node, 'author');
  const date = idAttr(node, 'date');
  return {
    kind,
    id: idAttr(node, 'id') ?? '',
    blockIndex,
    text,
    ...(author ? { author } : {}),
    ...(date ? { date } : {}),
  };
}

interface IrCommentBody {
  text: string;
  author?: string;
  date?: string;
}

function parseCommentBodies(parts: OoxmlParts): Map<string, IrCommentBody> {
  const bodies = new Map<string, IrCommentBody>();
  const xml = parts['word/comments.xml'];
  if (!xml) return bodies;
  const root = findFirst(parseXml(xml), 'comments');
  if (!root) return bodies;
  for (const node of childrenOf(root).filter((child) => localNameOf(child) === 'comment')) {
    const id = idAttr(node, 'id');
    if (!id) continue;
    const author = idAttr(node, 'author');
    const date = idAttr(node, 'date');
    bodies.set(id, {
      text: visibleText(node),
      ...(author ? { author } : {}),
      ...(date ? { date } : {}),
    });
  }
  return bodies;
}

interface ScannedParagraph {
  runs: IrRun[];
  fields: IrField[];
}

/**
 * Walk a paragraph's runs once to separate three kinds of content (P0-2.3): field code
 * (`begin`…`separate`), field result (`separate`…`end`) and normal runs.
 *
 * Field results are dropped on purpose: a TOC result is the whole table of contents and a REF
 * result is the cached display value, both of which the editor re-renders from atom nodes.
 * Nested fields are skipped (only depth 1 is interpreted) so TOC entries cannot be double-counted.
 */
function scanParagraph(paragraph: XmlNode, blockIndex: number): ScannedParagraph {
  const runs: IrRun[] = [];
  const fields: IrField[] = [];
  let depth = 0;
  let phase: 'idle' | 'code' | 'result' = 'idle';
  let code = '';
  let display = '';

  const closeField = (): void => {
    const instruction = code.trim();
    if (!instruction) return;
    const parts = instruction.split(/\s+/);
    const name = (parts[0] ?? '').toUpperCase();
    const argument = parts.slice(1).find((part) => !part.startsWith('\\')) ?? '';
    const kind: IrFieldKind =
      name === 'TOC' ? 'toc' : name === 'REF' || name === 'PAGEREF' ? 'ref' : 'other';
    const mode = name === 'PAGEREF' ? ('page' as const) : ('text' as const);

    const field: IrField = { kind, code: instruction, blockIndex };
    if (kind === 'ref' && argument) {
      field.target = argument;
      field.mode = mode;
      // REF is inline: keep its position in the run sequence as a placeholder run.
      runs.push({ text: '', marks: [], xref: { target: argument, mode } });
    }
    if (display.trim()) field.display = display.trim();
    fields.push(field);
  };

  for (const run of collect(paragraph, 'r')) {
    const fieldChar = childOf(run, 'fldChar');
    if (fieldChar) {
      const type = idAttr(fieldChar, 'fldCharType');
      if (type === 'begin') {
        depth += 1;
        if (depth === 1) {
          phase = 'code';
          code = '';
          display = '';
        }
      } else if (type === 'separate') {
        if (depth === 1) phase = 'result';
      } else if (type === 'end') {
        if (depth === 1) {
          closeField();
          phase = 'idle';
        }
        depth = Math.max(0, depth - 1);
      }
      continue;
    }

    // Nested field internals stay out of the body text and out of the outer field's code.
    if (depth > 1) continue;

    if (phase === 'code') {
      const instruction = childOf(run, 'instrText');
      if (instruction) code += textOf(instruction);
      continue;
    }
    if (phase === 'result') {
      display += visibleText(run);
      continue;
    }

    const parsed = parseRun(run);
    if (parsed) runs.push(parsed);
  }

  return { runs, fields };
}

interface ParsedBody {
  blocks: IrBlock[];
  sections: IrSection[];
  fields: IrField[];
  math: IrMath[];
  images: IrImage[];
  shapes: IrShape[];
  review: IrReview;
  bookmarks: IrBookmark[];
}

function parseBody(
  body: XmlNode,
  parts: OoxmlParts,
  relations: Record<string, string>,
): ParsedBody {
  const commentRanges: Array<{ id: string; blockIndex: number }> = [];
  const result: ParsedBody = {
    blocks: [],
    sections: parseSections(body, parts, relations),
    fields: [],
    math: [],
    images: [],
    shapes: [],
    review: { insertions: 0, deletions: 0, commentIds: [], revisions: [], comments: [] },
    bookmarks: [],
  };

  // Only direct body paragraphs get a block index: a table cannot be anchored block-wise by the
  // current HTML merge (same rule as extractDocxShapes). Its contents stay out of the IR for now.
  const paragraphs = childrenOf(body).filter((node) => localNameOf(node) === 'p');
  paragraphs.forEach((paragraph, blockIndex) => {
    const scanned = scanParagraph(paragraph, blockIndex);
    const runs = scanned.runs;
    const anchors: IrAnchor[] = [];

    for (const node of collect(paragraph, 'bookmarkStart')) {
      const name = idAttr(node, 'name');
      if (!name) continue;
      result.bookmarks.push({ name, blockIndex });
      anchors.push({ kind: 'bookmark', id: name });
    }
    for (const field of scanned.fields) {
      result.fields.push(field);
      anchors.push(field.kind === 'toc' ? { kind: 'toc' } : { kind: 'field', code: field.code });
    }
    for (const node of collect(paragraph, 'oMath')) {
      const latex = ommlToLatex(node);
      result.math.push(latex ? { blockIndex, latex } : { blockIndex });
      anchors.push({ kind: 'math' });
    }
    for (const drawing of collect(paragraph, 'drawing')) {
      result.images.push(parseImage(drawing, blockIndex, relations));
      anchors.push({ kind: 'image' });
    }
    const shapeMeta = new Map<XmlNode, { name?: string; width?: number; height?: number }>();
    for (const drawing of collect(paragraph, 'drawing')) {
      const container = childOf(drawing, 'anchor') ?? childOf(drawing, 'inline');
      const extent = container ? childOf(container, 'extent') : undefined;
      const documentProperties = container ? childOf(container, 'docPr') : undefined;
      const name = documentProperties ? attr(documentProperties, 'name') : undefined;
      const width = numAttr(extent, 'cx');
      const height = numAttr(extent, 'cy');
      const meta = {
        ...(name ? { name } : {}),
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
      };
      for (const shape of collect(drawing, 'wsp')) shapeMeta.set(shape, meta);
    }
    for (const node of collect(paragraph, 'wsp')) {
      result.shapes.push({ blockIndex, ...(shapeMeta.get(node) ?? {}) });
      anchors.push({ kind: 'shape' });
    }
    for (const node of collect(paragraph, 'ins')) {
      result.review.insertions += 1;
      result.review.revisions.push(revisionOf(node, 'insert', blockIndex, visibleText(node)));
      anchors.push({ kind: 'revision', id: 'ins' });
    }
    for (const node of collect(paragraph, 'del')) {
      result.review.deletions += 1;
      result.review.revisions.push(revisionOf(node, 'delete', blockIndex, deletedText(node)));
      anchors.push({ kind: 'revision', id: 'del' });
    }
    for (const node of collect(paragraph, 'rPrChange')) {
      result.review.revisions.push(revisionOf(node, 'format', blockIndex, ''));
    }
    for (const node of collect(paragraph, 'commentRangeStart')) {
      const id = idAttr(node, 'id');
      if (!id) continue;
      result.review.commentIds.push(id);
      commentRanges.push({ id, blockIndex });
      anchors.push({ kind: 'comment', id });
    }

    result.blocks.push({
      index: blockIndex,
      text: runs.map((run) => run.text).join(''),
      runs,
      anchors,
    });
  });

  const commentBodies = parseCommentBodies(parts);
  result.review.comments = commentRanges.map(({ id, blockIndex }) => {
    const body = commentBodies.get(id);
    return {
      id,
      blockIndex,
      text: body?.text ?? '',
      ...(body?.author ? { author: body.author } : {}),
      ...(body?.date ? { date: body.date } : {}),
    };
  });
  for (const [id, body] of commentBodies) {
    if (commentRanges.some((range) => range.id === id)) continue;
    result.review.comments.push({
      id,
      blockIndex: -1,
      text: body.text,
      ...(body.author ? { author: body.author } : {}),
      ...(body.date ? { date: body.date } : {}),
    });
  }

  return result;
}

/** Body references whose target part entry is missing (e.g. a deleted footnote body). */
function missingNoteReferences(ir: OoxmlIr): number {
  const known = new Set(ir.notes.map((note) => `${note.kind}:${note.id}`));
  let missing = 0;
  for (const block of ir.blocks) {
    for (const run of block.runs) {
      if (run.noteRef && !known.has(`${run.noteRef.kind}:${run.noteRef.id}`)) missing += 1;
    }
  }
  return missing;
}

/**
 * Features present in the IR but not yet expressible as editor nodes. Only positive counts are
 * returned, matching `fidelity.ts`'s "filter zero" convention (P0-2.5 wires these into the report).
 * Referenced notes moved out of this list in P0-2.2: they now map to footnoteRef / endnoteRef.
 */
export function irLosses(ir: OoxmlIr): IrLoss[] {
  const entries: Array<[string, number]> = [
    ['ir.unreferencedNotes', ir.notes.filter((note) => note.number === 0).length],
    ['ir.missingNotes', missingNoteReferences(ir)],
    ['ir.fields', ir.fields.filter((field) => field.kind === 'other').length],
    ['ir.math', ir.math.filter((item) => item.latex === undefined).length],
    ['ir.images', ir.images.length],
    ['ir.shapes', ir.shapes.length],
    ['ir.sections', ir.sections.length],
    ['ir.bookmarks', ir.bookmarks.length],
    ['ir.reviewIns', ir.review.insertions],
    ['ir.reviewDel', ir.review.deletions],
    ['ir.comments', ir.review.commentIds.length],
    ['ir.unlinkedComments', ir.review.comments.filter((comment) => comment.blockIndex < 0).length],
  ];
  return entries.filter(([, count]) => count > 0).map(([code, count]) => ({ code, count }));
}

/**
 * OOXML part → IR. Failures use `ToolResult` instead of throwing, so the caller can fall back to
 * the mammoth path without a try/catch. P0-2.2…P0-2.5 deepen individual part parsers; this stage
 * records their anchors and reports what it cannot yet restore.
 */
export function parseOoxmlParts(parts: OoxmlParts): ToolResult<OoxmlIr> {
  const document = parts[DOCUMENT_PART];
  if (!document?.trim()) return { ok: false, error: 'IR_MISSING_DOCUMENT' };

  try {
    const body = findFirst(parseXml(document), 'body');
    if (!body) return { ok: false, error: 'IR_MISSING_BODY' };

    const relations = parseRelationships(parts);
    const parsed = parseBody(body, parts, relations);
    const ir: OoxmlIr = {
      version: 1,
      facts: collectPartFacts(parts),
      ...parsed,
      notes: assignNoteNumbers(parsed.blocks, parseNotes(parts)),
      losses: [],
    };
    ir.losses = irLosses(ir);
    return { ok: true, value: ir };
  } catch {
    return { ok: false, error: 'IR_PARSE_FAILED' };
  }
}

/** IR → Tiptap-shaped JSON nodes. No schema, editor or DOM is involved. */
export function irToTiptapBlocks(ir: OoxmlIr): IrTiptapNode[] {
  return ir.blocks.flatMap((block) => {
    const toc = block.anchors.some((anchor) => anchor.kind === 'toc');
    const nodes: IrTiptapNode[] = [];

    // Keep empty paragraphs (Word layout) unless the paragraph existed only for a TOC field.
    if (block.runs.length > 0 || !toc) {
      const paragraph: IrTiptapNode = {
        type: 'paragraph',
        attrs: { irBlockIndex: block.index },
      };
      if (block.runs.length > 0) {
        paragraph.content = block.runs.flatMap((run) => {
          const inline: IrTiptapNode[] = [];
          if (run.text) {
            const text: IrTiptapNode = { type: 'text', text: run.text };
            if (run.marks.length > 0) text.marks = run.marks;
            inline.push(text);
          }
          const ref = run.noteRef;
          if (ref) {
            const note = ir.notes.find(
              (candidate) => candidate.kind === ref.kind && candidate.id === ref.id,
            );
            inline.push({
              type: ref.kind === 'footnote' ? 'footnoteRef' : 'endnoteRef',
              attrs: { note: note?.text ?? '' },
            });
          }
          const xref = run.xref;
          if (xref) {
            inline.push({ type: 'xref', attrs: { target: xref.target, mode: xref.mode } });
          }
          return inline;
        });
      }
      nodes.push(paragraph);
    }

    if (toc) nodes.push({ type: 'tableOfContents' });
    return nodes;
  });
}

/** IR → a complete Tiptap `doc` node, ready for `editor.commands.setContent()` in later stages. */
export function irToTiptapDoc(ir: OoxmlIr): IrTiptapNode {
  return { type: 'doc', content: irToTiptapBlocks(ir) };
}
