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
}

export type IrAnchorKind =
  'bookmark' | 'image' | 'shape' | 'math' | 'field' | 'revision' | 'comment';

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

export interface IrSection {
  index: number;
  headerRefs: string[];
  footerRefs: string[];
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

export interface IrField {
  /** Raw field instruction, e.g. `TOC \o "1-3"` or `REF bookmark \h` */
  code: string;
  blockIndex: number;
}

export interface IrMath {
  blockIndex: number;
  /** Filled by P0-2.3 (OMML → LaTeX); absent means the part is reported as a loss */
  latex?: string;
}

export interface IrImage {
  blockIndex: number;
  relationshipId?: string;
  /** `wp:anchor` vs `wp:inline`; wrapping offsets are added in P0-2.4 */
  floating: boolean;
}

export interface IrShape {
  blockIndex: number;
}

export interface IrBookmark {
  name: string;
  blockIndex: number;
}

export interface IrReview {
  insertions: number;
  deletions: number;
  commentIds: string[];
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

function parseSections(body: XmlNode): IrSection[] {
  return collect(body, 'sectPr').map((section, index) => {
    const refs = (tag: string): string[] =>
      collect(section, tag)
        .map((node) => relAttr(node, 'id'))
        .filter((id): id is string => Boolean(id));
    return {
      index,
      headerRefs: refs('headerReference'),
      footerRefs: refs('footerReference'),
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

function parseBody(body: XmlNode): ParsedBody {
  const result: ParsedBody = {
    blocks: [],
    sections: parseSections(body),
    fields: [],
    math: [],
    images: [],
    shapes: [],
    review: { insertions: 0, deletions: 0, commentIds: [] },
    bookmarks: [],
  };

  // Only direct body paragraphs get a block index: a table cannot be anchored block-wise by the
  // current HTML merge (same rule as extractDocxShapes). Its contents stay out of the IR for now.
  const paragraphs = childrenOf(body).filter((node) => localNameOf(node) === 'p');
  paragraphs.forEach((paragraph, blockIndex) => {
    const runs = collect(paragraph, 'r')
      .map(parseRun)
      .filter((run): run is IrRun => run !== null);
    const anchors: IrAnchor[] = [];

    for (const node of collect(paragraph, 'bookmarkStart')) {
      const name = idAttr(node, 'name');
      if (!name) continue;
      result.bookmarks.push({ name, blockIndex });
      anchors.push({ kind: 'bookmark', id: name });
    }
    for (const node of collect(paragraph, 'instrText')) {
      const code = textOf(node).trim();
      if (!code) continue;
      result.fields.push({ code, blockIndex });
      anchors.push({ kind: 'field', code });
    }
    collect(paragraph, 'oMath').forEach(() => {
      result.math.push({ blockIndex });
      anchors.push({ kind: 'math' });
    });
    for (const drawing of collect(paragraph, 'drawing')) {
      const floating = collect(drawing, 'anchor').length > 0;
      const blip = collect(drawing, 'blip')[0];
      const relationshipId = blip ? relAttr(blip, 'embed') : undefined;
      result.images.push({
        blockIndex,
        ...(relationshipId ? { relationshipId } : {}),
        floating,
      });
      anchors.push({ kind: 'image' });
    }
    collect(paragraph, 'wsp').forEach(() => {
      result.shapes.push({ blockIndex });
      anchors.push({ kind: 'shape' });
    });
    collect(paragraph, 'ins').forEach(() => {
      result.review.insertions += 1;
      anchors.push({ kind: 'revision', id: 'ins' });
    });
    collect(paragraph, 'del').forEach(() => {
      result.review.deletions += 1;
      anchors.push({ kind: 'revision', id: 'del' });
    });
    for (const node of collect(paragraph, 'commentRangeStart')) {
      const id = idAttr(node, 'id');
      if (!id) continue;
      result.review.commentIds.push(id);
      anchors.push({ kind: 'comment', id });
    }

    result.blocks.push({
      index: blockIndex,
      text: runs.map((run) => run.text).join(''),
      runs,
      anchors,
    });
  });

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
    ['ir.fields', ir.fields.length],
    ['ir.math', ir.math.length],
    ['ir.images', ir.images.length],
    ['ir.shapes', ir.shapes.length],
    ['ir.sections', ir.sections.length],
    ['ir.bookmarks', ir.bookmarks.length],
    ['ir.reviewIns', ir.review.insertions],
    ['ir.reviewDel', ir.review.deletions],
    ['ir.comments', ir.review.commentIds.length],
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

    const parsed = parseBody(body);
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
  return ir.blocks.map((block) => {
    const node: IrTiptapNode = {
      type: 'paragraph',
      attrs: { irBlockIndex: block.index },
    };
    if (block.runs.length > 0) {
      node.content = block.runs.flatMap((run) => {
        const nodes: IrTiptapNode[] = [];
        if (run.text) {
          const text: IrTiptapNode = { type: 'text', text: run.text };
          if (run.marks.length > 0) text.marks = run.marks;
          nodes.push(text);
        }
        const ref = run.noteRef;
        if (ref) {
          const note = ir.notes.find(
            (candidate) => candidate.kind === ref.kind && candidate.id === ref.id,
          );
          nodes.push({
            type: ref.kind === 'footnote' ? 'footnoteRef' : 'endnoteRef',
            attrs: { note: note?.text ?? '' },
          });
        }
        return nodes;
      });
    }
    return node;
  });
}

/** IR → a complete Tiptap `doc` node, ready for `editor.commands.setContent()` in later stages. */
export function irToTiptapDoc(ir: OoxmlIr): IrTiptapNode {
  return { type: 'doc', content: irToTiptapBlocks(ir) };
}
