import { describe, expect, it } from 'vitest';
import { importLossIssues } from './fidelity';
import { latexToAst } from './latex';
import {
  assignNoteNumbers,
  collectPartFacts,
  irBlockAnchors,
  irLosses,
  irNoteSummaries,
  irToTiptapDoc,
  parseOoxmlParts,
  resolveBlockAnchor,
  type IrBlock,
  type IrBlockAnchor,
  type OoxmlParts,
} from './ooxmlIr';

/**
 * P0-2.1–P0-2.4: inline OOXML only. No JSZip / Blob shim, no fixture files and no DOM are
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
      <w:r><w:fldChar w:fldCharType="begin"/></w:r>
      <w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r>
      <w:r><w:t>目录条目</w:t></w:r>
      <w:r><w:fldChar w:fldCharType="end"/></w:r>
      <w:commentRangeStart w:id="7"/>
      <w:ins w:id="9"><w:r><w:t>new</w:t></w:r></w:ins>
      <w:del w:id="10"><w:r><w:delText>old</w:delText></w:r></w:del>
    </w:p>
    <w:p>
      <w:r>
        <w:drawing>
          <wp:anchor behindDoc="1">
            <wp:extent cx="914400" cy="457200"/>
            <wp:positionH relativeFrom="column"><wp:posOffset>12700</wp:posOffset></wp:positionH>
            <wp:positionV relativeFrom="paragraph"><wp:posOffset>25400</wp:posOffset></wp:positionV>
            <wp:wrapSquare wrapText="bothSides"/>
            <a:graphic><a:graphicData><a:pic><a:blip r:embed="rId5"/></a:pic></a:graphicData></a:graphic>
          </wp:anchor>
        </w:drawing>
      </w:r>
      <w:r><m:oMath><m:r><m:t>x^2</m:t></m:r></m:oMath></w:r>
      <wps:wsp><wps:spPr/></wps:wsp>
      <w:pPr><w:sectPr>
        <w:headerReference r:id="rId1"/>
        <w:footerReference r:id="rId2"/>
        <w:pgSz w:w="11906" w:h="16838"/>
        <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
      </w:sectPr></w:pPr>
    </w:p>
  </w:body>
</w:document>`;

function sampleParts(): OoxmlParts {
  return {
    'word/document.xml': DOCUMENT,
    'word/_rels/document.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type=".../header" Target="header1.xml"/>
      <Relationship Id="rId2" Type=".../footer" Target="footer1.xml"/>
      <Relationship Id="rId5" Type=".../image" Target="media/image1.png"/>
    </Relationships>`,
    'word/header1.xml': '<w:hdr><w:p><w:r><w:t>Header A</w:t></w:r></w:p></w:hdr>',
    'word/footer1.xml': '<w:ftr><w:p><w:r><w:t>Footer A</w:t></w:r></w:p></w:ftr>',
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
  // One field = 3 fldChar markers + 1 instrText, matching the baseline `docxPartFacts` regex.
  fields: 4,
  math: 1,
  shapes: 1,
  images: 1,
  styles: 2,
  numbering: 1,
  people: 1,
};

function mathLatex(oMathXml: string): string | undefined {
  const parts: OoxmlParts = {
    'word/document.xml': `<w:document><w:body><w:p><w:r>${oMathXml}</w:r></w:p></w:body></w:document>`,
  };
  const result = parseOoxmlParts(parts);
  if (!result.ok) throw new Error('expected a parsed IR');
  return result.value.math[0]?.latex;
}

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
    // Deleted text, OMML `<m:t>` and the TOC field result never become body text.
    expect(ir.blocks[0].text).toBe('Hello IRnew');
    expect(ir.blocks[1].text).toBe('');
    expect(ir.blocks[0].anchors).toEqual([
      { kind: 'bookmark', id: 'intro' },
      { kind: 'toc' },
      { kind: 'revision', id: 'ins' },
      { kind: 'revision', id: 'del' },
      { kind: 'comment', id: '7' },
    ]);
    expect(ir.blocks[1].anchors).toEqual([{ kind: 'math' }, { kind: 'image' }, { kind: 'shape' }]);
  });

  it('collects notes, fields, sections, review, math and image relationships', () => {
    const result = parseOoxmlParts(sampleParts());
    if (!result.ok) throw new Error('expected a parsed IR');
    const ir = result.value;

    // P0-2.2: the referenced footnote gets number 1; the unreferenced endnote stays at 0.
    expect(ir.notes).toEqual([
      { kind: 'footnote', id: '2', text: 'Note A', number: 1 },
      { kind: 'endnote', id: '3', text: 'Note B', number: 0 },
    ]);
    expect(ir.fields).toEqual([
      { kind: 'toc', code: 'TOC \\o "1-3"', blockIndex: 0, display: '目录条目' },
    ]);
    expect(ir.bookmarks).toEqual([{ name: 'intro', blockIndex: 0 }]);
    expect(ir.review).toEqual({
      insertions: 1,
      deletions: 1,
      commentIds: ['7'],
      revisions: [
        { kind: 'insert', id: '9', blockIndex: 0, text: 'new' },
        { kind: 'delete', id: '10', blockIndex: 0, text: 'old' },
      ],
      comments: [{ id: '7', blockIndex: 0, text: 'Fix' }],
    });
    expect(ir.math).toEqual([{ blockIndex: 1, latex: 'x\\^{}2' }]);
    expect(ir.shapes).toEqual([{ blockIndex: 1 }]);
  });

  it('resolves page setup, margins, header/footer parts and image wrap (P0-2.4)', () => {
    const result = parseOoxmlParts(sampleParts());
    if (!result.ok) throw new Error('expected a parsed IR');
    const ir = result.value;

    expect(ir.sections).toEqual([
      {
        index: 0,
        headerRefs: ['rId1'],
        footerRefs: ['rId2'],
        headerParts: ['word/header1.xml'],
        footerParts: ['word/footer1.xml'],
        headerTexts: ['Header A'],
        footerTexts: ['Footer A'],
        page: { width: 11906, height: 16838, orientation: 'portrait' },
        margins: {
          top: 1440,
          right: 1440,
          bottom: 1440,
          left: 1440,
          header: 720,
          footer: 720,
          gutter: 0,
        },
        titlePage: false,
      },
    ]);
    expect(ir.images).toEqual([
      {
        blockIndex: 1,
        relationshipId: 'rId5',
        target: 'word/media/image1.png',
        floating: true,
        wrap: 'square',
        behindDoc: true,
        offsetX: 12700,
        offsetY: 25400,
        width: 914400,
        height: 457200,
      },
    ]);
  });

  it('reports only non-zero losses and stays JSON-serialisable', () => {
    const result = parseOoxmlParts(sampleParts());
    if (!result.ok) throw new Error('expected a parsed IR');
    const ir = result.value;

    expect(ir.losses).toEqual(irLosses(ir));
    expect(ir.losses.every((loss) => loss.count > 0)).toBe(true);
    expect(ir.losses.map((loss) => loss.code)).toEqual([
      'ir.unreferencedNotes',
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

  it('maps IR to Tiptap-shaped JSON including notes, TOC and references', () => {
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
        { type: 'tableOfContents' },
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
    expect(notes.map((note) => note.number)).toEqual([0, 0]);
  });
});

describe('TOC / REF fields and OMML → LaTeX (P0-2.3)', () => {
  it('restores a TOC field as a tableOfContents node and drops its cached result', () => {
    const parts: OoxmlParts = {
      'word/document.xml': `<w:document><w:body><w:p>
        <w:r><w:fldChar w:fldCharType="begin"/></w:r>
        <w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h </w:instrText></w:r>
        <w:r><w:fldChar w:fldCharType="separate"/></w:r>
        <w:r><w:t>1. Intro .... 1</w:t></w:r>
        <w:r><w:fldChar w:fldCharType="end"/></w:r>
      </w:p></w:body></w:document>`,
    };
    const result = parseOoxmlParts(parts);
    if (!result.ok) throw new Error('expected a parsed IR');
    expect(result.value.fields).toEqual([
      {
        kind: 'toc',
        code: 'TOC \\o "1-3" \\h',
        blockIndex: 0,
        display: '1. Intro .... 1',
      },
    ]);
    expect(result.value.blocks[0].text).toBe('');
    expect(result.value.blocks[0].anchors).toEqual([{ kind: 'toc' }]);
    expect(irToTiptapDoc(result.value)).toEqual({
      type: 'doc',
      content: [{ type: 'tableOfContents' }],
    });
  });

  it('restores REF / PAGEREF fields as xref nodes at their run position', () => {
    const parts: OoxmlParts = {
      'word/document.xml': `<w:document><w:body>
        <w:p>
          <w:r><w:t>见</w:t></w:r>
          <w:r><w:fldChar w:fldCharType="begin"/></w:r>
          <w:r><w:instrText> REF intro \\h </w:instrText></w:r>
          <w:r><w:fldChar w:fldCharType="separate"/></w:r>
          <w:r><w:t>1.2</w:t></w:r>
          <w:r><w:fldChar w:fldCharType="end"/></w:r>
          <w:r><w:t>节</w:t></w:r>
        </w:p>
        <w:p>
          <w:r><w:fldChar w:fldCharType="begin"/></w:r>
          <w:r><w:instrText> PAGEREF intro \\h </w:instrText></w:r>
          <w:r><w:fldChar w:fldCharType="separate"/></w:r>
          <w:r><w:t>3</w:t></w:r>
          <w:r><w:fldChar w:fldCharType="end"/></w:r>
        </w:p>
      </w:body></w:document>`,
    };
    const result = parseOoxmlParts(parts);
    if (!result.ok) throw new Error('expected a parsed IR');
    expect(result.value.fields).toEqual([
      {
        kind: 'ref',
        code: 'REF intro \\h',
        blockIndex: 0,
        target: 'intro',
        mode: 'text',
        display: '1.2',
      },
      {
        kind: 'ref',
        code: 'PAGEREF intro \\h',
        blockIndex: 1,
        target: 'intro',
        mode: 'page',
        display: '3',
      },
    ]);
    expect(result.value.blocks[0].runs).toEqual([
      { text: '见', marks: [] },
      { text: '', marks: [], xref: { target: 'intro', mode: 'text' } },
      { text: '节', marks: [] },
    ]);
    expect(irToTiptapDoc(result.value)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { irBlockIndex: 0 },
          content: [
            { type: 'text', text: '见' },
            { type: 'xref', attrs: { target: 'intro', mode: 'text' } },
            { type: 'text', text: '节' },
          ],
        },
        {
          type: 'paragraph',
          attrs: { irBlockIndex: 1 },
          content: [{ type: 'xref', attrs: { target: 'intro', mode: 'page' } }],
        },
      ],
    });
  });

  it('keeps unrecognised fields as `other` and reports them as a loss', () => {
    const parts: OoxmlParts = {
      'word/document.xml': `<w:document><w:body><w:p>
        <w:r><w:fldChar w:fldCharType="begin"/></w:r>
        <w:r><w:instrText> DATE \\@ "yyyy" </w:instrText></w:r>
        <w:r><w:fldChar w:fldCharType="separate"/></w:r>
        <w:r><w:t>2026</w:t></w:r>
        <w:r><w:fldChar w:fldCharType="end"/></w:r>
      </w:p></w:body></w:document>`,
    };
    const result = parseOoxmlParts(parts);
    if (!result.ok) throw new Error('expected a parsed IR');
    expect(result.value.fields).toEqual([
      { kind: 'other', code: 'DATE \\@ "yyyy"', blockIndex: 0, display: '2026' },
    ]);
    expect(result.value.losses).toEqual([{ code: 'ir.fields', count: 1 }]);
  });

  it.each([
    [
      'fraction',
      '<m:f><m:num><m:r><m:t>a</m:t></m:r></m:num><m:den><m:r><m:t>b</m:t></m:r></m:den></m:f>',
      '\\frac{a}{b}',
    ],
    [
      'superscript',
      '<m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup>',
      '{x}^{2}',
    ],
    [
      'subscript',
      '<m:sSub><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sub><m:r><m:t>i</m:t></m:r></m:sub></m:sSub>',
      '{x}_{i}',
    ],
    ['radical', '<m:rad><m:deg/><m:e><m:r><m:t>x</m:t></m:r></m:e></m:rad>', '\\sqrt{x}'],
    [
      'delimiter',
      '<m:d><m:dPr><m:begChr m:val="["/><m:endChr m:val="]"/></m:dPr><m:e><m:r><m:t>x</m:t></m:r></m:e></m:d>',
      '\\left[x\\right]',
    ],
    [
      'n-ary',
      '<m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub><m:r><m:t>i</m:t></m:r></m:sub><m:sup><m:r><m:t>n</m:t></m:r></m:sup><m:e><m:r><m:t>i</m:t></m:r></m:e></m:nary>',
      '\\sum_{i}^{n} i',
    ],
    [
      'accent',
      '<m:acc><m:accPr><m:chr m:val="̂"/></m:accPr><m:e><m:r><m:t>x</m:t></m:r></m:e></m:acc>',
      '\\hat{x}',
    ],
  ])('maps %s OMML to LaTeX', (name, omml, expected) => {
    const latex = mathLatex(`<m:oMath>${omml}</m:oMath>`);
    expect(latex).toBe(expected);
    // `latexToAst` has no accent command yet, so its round-trip is only asserted for the
    // constructs the forward exporter already supports (P0-2.4 tracks the accent gap).
    if (name !== 'accent') expect(latexToAst(latex ?? '')).not.toBeNull();
  });

  it('reports an unsupported OMML construct as a math loss instead of partial LaTeX', () => {
    const parts: OoxmlParts = {
      'word/document.xml': `<w:document><w:body><w:p><w:r><m:oMath>
        <m:unknown><m:r><m:t>x</m:t></m:r></m:unknown>
      </m:oMath></w:r></w:p></w:body></w:document>`,
    };
    const result = parseOoxmlParts(parts);
    if (!result.ok) throw new Error('expected a parsed IR');
    expect(result.value.math).toEqual([{ blockIndex: 0 }]);
    expect(result.value.losses).toEqual([{ code: 'ir.math', count: 1 }]);
  });
});

describe('multi-section page setup and image wrapping (P0-2.4)', () => {
  it('reads per-section page size, margins and header/footer text', () => {
    const parts: OoxmlParts = {
      'word/document.xml': `<w:document><w:body>
        <w:p><w:pPr><w:sectPr>
          <w:headerReference r:id="rId1"/>
          <w:pgSz w:w="11906" w:h="16838"/>
          <w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" w:header="720" w:footer="720" w:gutter="0"/>
        </w:sectPr></w:pPr></w:p>
        <w:p><w:pPr><w:sectPr>
          <w:headerReference r:id="rId3"/>
          <w:footerReference r:id="rId4"/>
          <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
          <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="120"/>
          <w:titlePg/>
        </w:sectPr></w:pPr></w:p>
      </w:body></w:document>`,
      'word/_rels/document.xml.rels': `<Relationships>
        <Relationship Id="rId1" Target="header1.xml"/>
        <Relationship Id="rId3" Target="/word/header2.xml"/>
        <Relationship Id="rId4" Target="footer2.xml"/>
      </Relationships>`,
      'word/header1.xml': '<w:hdr><w:p><w:r><w:t>First header</w:t></w:r></w:p></w:hdr>',
      'word/header2.xml': '<w:hdr><w:p><w:r><w:t>Landscape header</w:t></w:r></w:p></w:hdr>',
      'word/footer2.xml': '<w:ftr><w:p><w:r><w:t>Landscape footer</w:t></w:r></w:p></w:ftr>',
    };
    const result = parseOoxmlParts(parts);
    if (!result.ok) throw new Error('expected a parsed IR');
    expect(result.value.sections).toEqual([
      {
        index: 0,
        headerRefs: ['rId1'],
        footerRefs: [],
        headerParts: ['word/header1.xml'],
        footerParts: [],
        headerTexts: ['First header'],
        footerTexts: [],
        page: { width: 11906, height: 16838, orientation: 'portrait' },
        margins: {
          top: 1440,
          right: 1800,
          bottom: 1440,
          left: 1800,
          header: 720,
          footer: 720,
          gutter: 0,
        },
        titlePage: false,
      },
      {
        index: 1,
        headerRefs: ['rId3'],
        footerRefs: ['rId4'],
        headerParts: ['word/header2.xml'],
        footerParts: ['word/footer2.xml'],
        headerTexts: ['Landscape header'],
        footerTexts: ['Landscape footer'],
        page: { width: 16838, height: 11906, orientation: 'landscape' },
        margins: {
          top: 720,
          right: 720,
          bottom: 720,
          left: 720,
          header: 360,
          footer: 360,
          gutter: 120,
        },
        titlePage: true,
      },
    ]);
  });

  it('reads anchor wrap/layer/offsets and keeps inline images inline', () => {
    const parts: OoxmlParts = {
      'word/document.xml': `<w:document><w:body>
        <w:p><w:r><w:drawing><wp:anchor behindDoc="1">
          <wp:extent cx="100" cy="200"/>
          <wp:positionH><wp:posOffset>1000</wp:posOffset></wp:positionH>
          <wp:positionV><wp:posOffset>2000</wp:posOffset></wp:positionV>
          <wp:wrapTopAndBottom/>
          <a:graphic><a:graphicData><a:pic><a:blip r:embed="rId9"/></a:pic></a:graphicData></a:graphic>
        </wp:anchor></w:drawing></w:r></w:p>
        <w:p><w:r><w:drawing><wp:inline>
          <wp:extent cx="300" cy="400"/>
          <a:graphic><a:graphicData><a:pic><a:blip r:embed="rId10"/></a:pic></a:graphicData></a:graphic>
        </wp:inline></w:drawing></w:r></w:p>
      </w:body></w:document>`,
      'word/_rels/document.xml.rels': `<Relationships>
        <Relationship Id="rId9" Target="media/a.png"/>
        <Relationship Id="rId10" Target="media/b.png"/>
      </Relationships>`,
    };
    const result = parseOoxmlParts(parts);
    if (!result.ok) throw new Error('expected a parsed IR');
    expect(result.value.images).toEqual([
      {
        blockIndex: 0,
        relationshipId: 'rId9',
        target: 'word/media/a.png',
        floating: true,
        wrap: 'topAndBottom',
        behindDoc: true,
        offsetX: 1000,
        offsetY: 2000,
        width: 100,
        height: 200,
      },
      {
        blockIndex: 1,
        relationshipId: 'rId10',
        target: 'word/media/b.png',
        floating: false,
        wrap: 'inline',
        behindDoc: false,
        width: 300,
        height: 400,
      },
    ]);
  });

  it('degrades unresolved relationships without throwing', () => {
    const parts: OoxmlParts = {
      'word/document.xml': `<w:document><w:body>
        <w:p><w:r><w:drawing><wp:inline><a:graphic><a:pic><a:blip r:embed="rId7"/></a:pic></a:graphic></wp:inline></w:drawing></w:r></w:p>
        <w:p><w:pPr><w:sectPr><w:headerReference r:id="rId1"/></w:sectPr></w:pPr></w:p>
      </w:body></w:document>`,
    };
    const result = parseOoxmlParts(parts);
    if (!result.ok) throw new Error('expected a parsed IR');
    expect(result.value.images[0]).toEqual({
      blockIndex: 0,
      relationshipId: 'rId7',
      floating: false,
      wrap: 'inline',
      behindDoc: false,
    });
    expect(result.value.sections[0].headerParts).toEqual([]);
    expect(result.value.sections[0].headerTexts).toEqual([]);
  });
});

describe('anchored review and import fidelity (P0-2.5)', () => {
  it('marks comments without a body range as unlinked', () => {
    const parts: OoxmlParts = {
      'word/document.xml':
        '<w:document><w:body><w:p><w:r><w:t>Body</w:t></w:r></w:p></w:body></w:document>',
      'word/comments.xml': `<w:comments>
        <w:comment w:id="1"><w:t>Linked?</w:t></w:comment>
        <w:comment w:id="2"><w:t>Orphan</w:t></w:comment>
      </w:comments>`,
    };
    const result = parseOoxmlParts(parts);
    if (!result.ok) throw new Error('expected a parsed IR');
    expect(result.value.review.comments).toEqual([
      { id: '1', blockIndex: -1, text: 'Linked?' },
      { id: '2', blockIndex: -1, text: 'Orphan' },
    ]);
    expect(result.value.losses).toEqual([{ code: 'ir.unlinkedComments', count: 2 }]);
  });

  it('exposes block indexes and bookmark names as stable anchors', () => {
    const result = parseOoxmlParts(sampleParts());
    if (!result.ok) throw new Error('expected a parsed IR');
    expect(irBlockAnchors(result.value)).toEqual([
      { blockIndex: 0, bookmarks: ['intro'], text: 'Hello IRnew' },
      { blockIndex: 1, bookmarks: [], text: '' },
    ]);
  });

  it('resolves by block index and reports text drift instead of failing', () => {
    const block: IrBlockAnchor = { blockIndex: 1, bookmarks: ['intro'], text: 'Hello world' };
    expect(
      resolveBlockAnchor(block, [{ text: 'Other' }, { text: 'Hello   world' }, { text: 'x' }]),
    ).toEqual({ blockIndex: 1, matchedBy: 'index', drifted: false });
    expect(
      resolveBlockAnchor(block, [{ text: 'Other' }, { text: 'reflowed' }, { text: 'x' }]),
    ).toEqual({ blockIndex: 1, matchedBy: 'index', drifted: true });
  });

  it('falls back to a unique bookmark, then unique text, and rejects ambiguity', () => {
    const outOfRange: IrBlockAnchor = {
      blockIndex: 5,
      bookmarks: ['intro'],
      text: 'Hello world',
    };
    expect(
      resolveBlockAnchor(outOfRange, [
        { text: 'A', bookmarks: ['other'] },
        { text: 'B', bookmarks: ['intro'] },
      ]),
    ).toEqual({ blockIndex: 1, matchedBy: 'bookmark', drifted: false });
    expect(
      resolveBlockAnchor({ ...outOfRange, bookmarks: [] }, [
        { text: 'A' },
        { text: 'Hello  world' },
      ]),
    ).toEqual({ blockIndex: 1, matchedBy: 'text', drifted: false });
    expect(
      resolveBlockAnchor({ ...outOfRange, bookmarks: [], text: 'Hello world' }, [
        { text: 'Hello world' },
        { text: 'Hello world' },
      ]),
    ).toBeNull();
  });

  it('groups IR losses into three fidelity warnings with raw detail', () => {
    const result = parseOoxmlParts(sampleParts());
    if (!result.ok) throw new Error('expected a parsed IR');
    const issues = importLossIssues(result.value);
    expect(issues.map((issue) => issue.code)).toEqual(['rte.irStructure', 'rte.irReview']);
    expect(issues[0]).toMatchObject({
      severity: 'warning',
      count: 4,
      messageKey: 'tools.richText.lossIrStructure',
    });
    expect(issues[0].detail).toContain('ir.images:1');
    expect(issues[1]).toMatchObject({
      severity: 'warning',
      count: 4,
      messageKey: 'tools.richText.lossIrReview',
    });
    expect(importLossIssues({ ...result.value, losses: [] })).toEqual([]);
  });
});
