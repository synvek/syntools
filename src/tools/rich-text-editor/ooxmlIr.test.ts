import { describe, expect, it } from 'vitest';
import {
  assignNoteNumbers,
  collectPartFacts,
  irLosses,
  irNoteSummaries,
  irToTiptapDoc,
  parseOoxmlParts,
  type IrBlock,
  type OoxmlParts,
} from './ooxmlIr';

/**
 * P0-2.1 / P0-2.2: inline OOXML only. No JSZip / Blob shim, no fixture files and no DOM are
 * needed — the module under test consumes part strings and returns plain JSON.
 */
const DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <w:body>
    <w:p>
      <w:bookmarkStart w:id="1" w:name="intro"/>
      <w:r><w:rPr><w:b/><w:i w:val="0"/><w:u/></w:rPr><w:t xml:space="preserve">Hello </w:t></w:r>
      <w:r><w:t>IR</w:t><w:footnoteReference w:id="2"/></w:r>
      <w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" </w:instrText></w:r>
      <w:commentRangeStart w:id="7"/>
      <w:ins w:id="9"><w:r><w:t>new</w:t></w:r></w:ins>
      <w:del w:id="10"><w:r><w:delText>old</w:delText></w:r></w:del>
    </w:p>
    <w:p>
      <w:r>
        <w:drawing>
          <wp:anchor><a:graphic><a:graphicData><a:pic><a:blip r:embed="rId5"/></a:pic></a:graphicData></a:graphic></wp:anchor>
        </w:drawing>
      </w:r>
      <w:r><m:oMath><m:r><m:t>x^2</m:t></m:r></m:oMath></w:r>
      <wps:wsp><wps:spPr/></wps:wsp>
      <w:pPr><w:sectPr><w:headerReference r:id="rId1"/><w:footerReference r:id="rId2"/></w:sectPr></w:pPr>
    </w:p>
  </w:body>
</w:document>`;

function sampleParts(): OoxmlParts {
  return {
    'word/document.xml': DOCUMENT,
    'word/header1.xml': '<w:hdr/>',
    'word/footer1.xml': '<w:ftr/>',
    'word/footnotes.xml':
      '<w:footnotes><w:footnote w:id="2"><w:p><w:r><w:t>Note A</w:t></w:r></w:p></w:footnote></w:footnotes>',
    'word/endnotes.xml':
      '<w:endnotes><w:endnote w:id="3"><w:p><w:r><w:t>Note B</w:t></w:r></w:p></w:endnote></w:endnotes>',
    'word/comments.xml': '<w:comments><w:comment w:id="7"><w:t>Fix</w:t></w:comment></w:comments>',
    'word/styles.xml':
      '<w:styles><w:style w:styleId="Normal"/><w:style w:styleId="H1"/></w:styles>',
    'word/numbering.xml': '<w:numbering><w:num w:numId="1"/></w:numbering>',
    'word/people.xml': '<w15:people><w15:person w15:author="A"/></w15:people>',
    'word/media/image1.png': '',
  };
}

const EXPECTED_FACTS = {
  sections: 1,
  headers: 1,
  footers: 1,
  footnotes: 1,
  endnotes: 1,
  comments: 1,
  revisions: 2,
  fields: 1,
  math: 1,
  shapes: 1,
  images: 1,
  styles: 2,
  numbering: 1,
  people: 1,
};

describe('ooxmlIr (P0-2.1 pure part → IR → Tiptap boundary)', () => {
  it('collectPartFacts keeps the baseline 14 keys and their regex counts', () => {
    const facts = collectPartFacts(sampleParts());
    expect(facts).toEqual(EXPECTED_FACTS);
    expect(Object.keys(facts)).toEqual(Object.keys(EXPECTED_FACTS));
    expect(Object.values(collectPartFacts({}))).toEqual(new Array(14).fill(0));
  });

  it('returns ToolResult failures instead of throwing on missing parts or body', () => {
    expect(parseOoxmlParts({})).toEqual({ ok: false, error: 'IR_MISSING_DOCUMENT' });
    expect(parseOoxmlParts({ 'word/document.xml': '   ' })).toEqual({
      ok: false,
      error: 'IR_MISSING_DOCUMENT',
    });
    expect(
      parseOoxmlParts({ 'word/document.xml': '<w:document><w:metadata/></w:document>' }),
    ).toEqual({ ok: false, error: 'IR_MISSING_BODY' });
  });

  it('parses body text, marks, note references and per-part anchors', () => {
    const result = parseOoxmlParts(sampleParts());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ir = result.value;

    expect(ir.version).toBe(1);
    expect(ir.facts).toEqual(EXPECTED_FACTS);
    expect(ir.blocks).toHaveLength(2);
    expect(ir.blocks[0].runs).toEqual([
      { text: 'Hello ', marks: [{ type: 'bold' }, { type: 'underline' }] },
      { text: 'IR', marks: [], noteRef: { kind: 'footnote', id: '2' } },
      { text: 'new', marks: [] },
    ]);
    // Deleted text and OMML `<m:t>` must never become visible Word text.
    expect(ir.blocks[0].text).toBe('Hello IRnew');
    expect(ir.blocks[1].text).toBe('');
    expect(ir.blocks[0].anchors).toEqual([
      { kind: 'bookmark', id: 'intro' },
      { kind: 'field', code: 'TOC \\o "1-3"' },
      { kind: 'revision', id: 'ins' },
      { kind: 'revision', id: 'del' },
      { kind: 'comment', id: '7' },
    ]);
    expect(ir.blocks[1].anchors).toEqual([{ kind: 'math' }, { kind: 'image' }, { kind: 'shape' }]);
  });

  it('collects notes, fields, sections, review and image relationships', () => {
    const result = parseOoxmlParts(sampleParts());
    if (!result.ok) throw new Error('expected a parsed IR');
    const ir = result.value;

    // P0-2.2: the referenced footnote gets number 1; the unreferenced endnote stays at 0.
    expect(ir.notes).toEqual([
      { kind: 'footnote', id: '2', text: 'Note A', number: 1 },
      { kind: 'endnote', id: '3', text: 'Note B', number: 0 },
    ]);
    expect(ir.fields).toEqual([{ code: 'TOC \\o "1-3"', blockIndex: 0 }]);
    expect(ir.bookmarks).toEqual([{ name: 'intro', blockIndex: 0 }]);
    expect(ir.sections).toEqual([{ index: 0, headerRefs: ['rId1'], footerRefs: ['rId2'] }]);
    expect(ir.review).toEqual({ insertions: 1, deletions: 1, commentIds: ['7'] });
    expect(ir.math).toEqual([{ blockIndex: 1 }]);
    expect(ir.shapes).toEqual([{ blockIndex: 1 }]);
    expect(ir.images).toEqual([{ blockIndex: 1, relationshipId: 'rId5', floating: true }]);
  });

  it('reports only non-zero losses and stays JSON-serialisable', () => {
    const result = parseOoxmlParts(sampleParts());
    if (!result.ok) throw new Error('expected a parsed IR');
    const ir = result.value;

    expect(ir.losses).toEqual(irLosses(ir));
    expect(ir.losses.every((loss) => loss.count > 0)).toBe(true);
    expect(ir.losses.map((loss) => loss.code)).toEqual([
      'ir.unreferencedNotes',
      'ir.fields',
      'ir.math',
      'ir.images',
      'ir.shapes',
      'ir.sections',
      'ir.bookmarks',
      'ir.reviewIns',
      'ir.reviewDel',
      'ir.comments',
    ]);
    expect(JSON.parse(JSON.stringify(ir))).toEqual(ir);
  });

  it('is deterministic and does not mutate the input parts', () => {
    const parts = sampleParts();
    const snapshot = structuredClone(parts);
    const first = parseOoxmlParts(parts);
    expect(parts).toEqual(snapshot);
    expect(parseOoxmlParts(parts)).toEqual(first);
  });

  it('maps IR to Tiptap-shaped JSON including footnote / endnote references', () => {
    const result = parseOoxmlParts(sampleParts());
    if (!result.ok) throw new Error('expected a parsed IR');
    expect(irToTiptapDoc(result.value)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { irBlockIndex: 0 },
          content: [
            {
              type: 'text',
              text: 'Hello ',
              marks: [{ type: 'bold' }, { type: 'underline' }],
            },
            { type: 'text', text: 'IR' },
            { type: 'footnoteRef', attrs: { note: 'Note A' } },
            { type: 'text', text: 'new' },
          ],
        },
        { type: 'paragraph', attrs: { irBlockIndex: 1 } },
      ],
    });
  });

  it('an empty body yields an empty doc and no losses', () => {
    const result = parseOoxmlParts({
      'word/document.xml': '<w:document><w:body/></w:document>',
    });
    if (!result.ok) throw new Error('expected a parsed IR');
    expect(result.value.blocks).toEqual([]);
    expect(result.value.losses).toEqual([]);
    expect(result.value.facts.sections).toBe(0);
    expect(irToTiptapDoc(result.value)).toEqual({ type: 'doc', content: [] });
  });
});

describe('footnote / endnote numbering (P0-2.2)', () => {
  it('numbers notes by body reference order, not by part id', () => {
    const parts: OoxmlParts = {
      'word/document.xml': `<w:document><w:body>
        <w:p><w:r><w:footnoteReference w:id="5"/></w:r></w:p>
        <w:p><w:r><w:footnoteReference w:id="2"/></w:r></w:p>
        <w:p><w:r><w:footnoteReference w:id="5"/></w:r></w:p>
      </w:body></w:document>`,
      'word/footnotes.xml': `<w:footnotes>
        <w:footnote w:id="2"><w:p><w:r><w:t>second</w:t></w:r></w:p></w:footnote>
        <w:footnote w:id="5"><w:p><w:r><w:t>first</w:t></w:r></w:p></w:footnote>
      </w:footnotes>`,
    };
    const result = parseOoxmlParts(parts);
    if (!result.ok) throw new Error('expected a parsed IR');
    expect(result.value.notes).toEqual([
      { kind: 'footnote', id: '2', text: 'second', number: 2 },
      { kind: 'footnote', id: '5', text: 'first', number: 1 },
    ]);
  });

  it('ignores separator entries and reports unreferenced or missing notes', () => {
    const parts: OoxmlParts = {
      'word/document.xml': `<w:document><w:body>
        <w:p><w:r><w:footnoteReference w:id="9"/></w:r></w:p>
      </w:body></w:document>`,
      'word/footnotes.xml': `<w:footnotes>
        <w:footnote w:id="-1" w:type="separator"><w:p/></w:footnote>
        <w:footnote w:id="0" w:type="continuationSeparator"><w:p/></w:footnote>
        <w:footnote w:id="4"><w:p><w:r><w:t>orphan</w:t></w:r></w:p></w:footnote>
      </w:footnotes>`,
    };
    const result = parseOoxmlParts(parts);
    if (!result.ok) throw new Error('expected a parsed IR');
    expect(result.value.notes).toEqual([{ kind: 'footnote', id: '4', text: 'orphan', number: 0 }]);
    expect(result.value.losses).toEqual([
      { code: 'ir.unreferencedNotes', count: 1 },
      { code: 'ir.missingNotes', count: 1 },
    ]);
  });

  it('returns the ordered document-end list for one kind only', () => {
    const result = parseOoxmlParts(sampleParts());
    if (!result.ok) throw new Error('expected a parsed IR');
    expect(irNoteSummaries(result.value, 'footnote')).toEqual([
      { number: 1, id: '2', text: 'Note A' },
    ]);
    // P0-2.2 summary: an unreferenced endnote is not part of the list.
    expect(irNoteSummaries(result.value, 'endnote')).toEqual([]);
  });

  it('assignNoteNumbers keeps the first number for a repeated reference', () => {
    const notes = [
      { kind: 'footnote' as const, id: 'a', text: 'A', number: 0 },
      { kind: 'footnote' as const, id: 'b', text: 'B', number: 0 },
    ];
    const block = (index: number, id: string): IrBlock => ({
      index,
      text: '',
      runs: [{ text: '', marks: [], noteRef: { kind: 'footnote', id } }],
      anchors: [],
    });
    const numbered = assignNoteNumbers([block(0, 'b'), block(1, 'b'), block(2, 'a')], notes);
    expect(numbered.map((note) => note.number)).toEqual([2, 1]);
    // Pure: the input array keeps its zero numbers.
    expect(notes.map((note) => note.number)).toEqual([0, 0]);
  });
});
