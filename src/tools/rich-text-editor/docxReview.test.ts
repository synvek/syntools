import { describe, expect, it } from 'vitest';
import { exportDocxBlob, importDocx, type ImportedReview } from './docx';
import { DEFAULT_PAGE_SETUP } from './pageSetup';
import {
  applyDocumentReview,
  applyRevisionMarks,
  hasRevisions,
  parseDocumentReview,
  parseRevisionRuns,
} from './docxReview';

// jsdom lacks Blob.prototype.arrayBuffer; the docx round trip needs it (same shim as docxCompat.test.ts)
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error('READ_FAILED'));
      reader.readAsArrayBuffer(this);
    });
  };
}

/** P2-3.5：`w:ins` / `w:del` 回读 → 编辑器修订标记（mammoth 会丢掉两者语义，del 连文字都丢） */

const XML = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>第一段</w:t></w:r></w:p>
    <w:p>
      <w:r><w:t>旧词</w:t></w:r>
      <w:ins w:id="1" w:author="甲" w:date="2026-10-29T10:00:00Z"><w:r><w:t>新词</w:t></w:r></w:ins>
    </w:p>
    <w:p><w:del w:id="2" w:author="乙" w:date="2026-10-29T11:00:00Z"><w:r><w:delText>要删的</w:delText></w:r></w:del></w:p>
  </w:body>
</w:document>`;

describe('parseRevisionRuns', () => {
  it('reads runs in document order with their revision kind and author', () => {
    const runs = parseRevisionRuns(XML);
    expect(runs.map((run) => [run.kind, run.text, run.author])).toEqual([
      ['normal', '第一段', ''],
      ['normal', '旧词', ''],
      ['insert', '新词', '甲'],
      ['delete', '要删的', '乙'],
    ]);
    expect(hasRevisions(runs)).toBe(true);
  });

  it('merges runs of one edit inside the same paragraph but never across paragraphs', () => {
    const xml = `<w:document xmlns:w="w"><w:body>
      <w:p><w:ins w:id="1" w:author="甲"><w:r><w:t>甲</w:t></w:r></w:ins><w:ins w:id="2" w:author="甲"><w:r><w:t>乙</w:t></w:r></w:ins></w:p>
      <w:p><w:ins w:id="3" w:author="甲"><w:r><w:t>丙</w:t></w:r></w:ins></w:p>
    </w:body></w:document>`;
    // Same author + adjacent runs = one revision entry; the second paragraph stays separate
    expect(parseRevisionRuns(xml).map((run) => run.text)).toEqual(['甲乙', '丙']);
  });

  it('understands the run-property form of a revision (<w:rPr><w:ins/>)', () => {
    const xml = `<w:document xmlns:w="w"><w:body>
      <w:p><w:r><w:rPr><w:ins w:id="9" w:author="丙"/></w:rPr><w:t>插入</w:t></w:r></w:p>
    </w:body></w:document>`;
    const runs = parseRevisionRuns(xml);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ kind: 'insert', text: '插入', author: '丙' });
  });

  it('ignores broken or empty XML instead of throwing', () => {
    expect(parseRevisionRuns('')).toEqual([]);
    expect(parseRevisionRuns('<w:document><w:body>')).toEqual([]);
  });
});

describe('applyRevisionMarks', () => {
  it('wraps inserted text and inserts the deleted text where it was', () => {
    const html = '<p>第一段</p><p>旧词新词</p><p></p>';
    const result = applyRevisionMarks(html, parseRevisionRuns(XML), 1000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.html).toContain(
      '<ins data-track="insert" data-track-id="docx-ins-1">新词</ins>',
    );
    expect(result.value.html).toContain(
      '<del data-track="delete" data-track-id="docx-del-1">要删的</del>',
    );
    // The untouched text stays unmarked
    expect(result.value.html).toContain('旧词');
    expect(result.value.changes.map((change) => [change.kind, change.text, change.id])).toEqual([
      ['insert', '新词', 'docx-ins-1'],
      ['delete', '要删的', 'docx-del-1'],
    ]);
    // `w:date` is used when present so the panel shows the authoring time, not the import time
    expect(result.value.changes[0].createdAt).toBe(Date.parse('2026-10-29T10:00:00Z'));
  });

  it('gives up (instead of guessing) when the HTML text does not line up with the runs', () => {
    const result = applyRevisionMarks('<p>完全不同的内容</p>', parseRevisionRuns(XML), 1000);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('REVISION_MISMATCH');
  });

  it('returns the untouched html when there is nothing to mark', () => {
    const result = applyRevisionMarks('<p>正文</p>', parseRevisionRuns('<w:document/>'), 1000);
    expect(result).toEqual({ ok: true, value: { html: '<p>正文</p>', changes: [] } });
  });
});

describe('docx revision round trip', () => {
  it('re-imports a document with insertions and deletions as editable revisions', async () => {
    const exported = await exportDocxBlob(
      '<p>甲<ins data-track="insert">乙</ins><del data-track="delete">丙</del></p>',
      'revisions',
      DEFAULT_PAGE_SETUP,
      { author: '审阅人' },
    );
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    let review: {
      changes: { id: string; kind: string; text: string; author: string }[];
      degraded: boolean;
    } = { changes: [], degraded: false };
    const imported = await importDocx(
      new File([exported.value], 'revisions.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      {
        onReview: (info) => {
          review = info;
        },
      },
    );
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    expect(review.degraded).toBe(false);
    expect(review.changes.map((change) => [change.kind, change.text])).toEqual([
      ['insert', '乙'],
      ['delete', '丙'],
    ]);
    // The marks are editable again: ids survive the round trip, so per-change accept/reject still works
    expect(imported.value).toContain('data-track="insert"');
    expect(imported.value).toContain('data-track="delete"');
    expect(imported.value).toContain('丙');
  });
});

/** 帮后续用例读 document.xml，避免每个用例重复开 zip */
async function documentXmlOf(blob: Blob): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return (await zip.file('word/document.xml')?.async('string')) ?? '';
}

async function importWithReview(blob: Blob, name: string) {
  // Boxed: the callback runs after this frame, so a plain `let` would be narrowed to `null` by TS
  const box: { value: ImportedReview | null } = { value: null };
  const imported = await importDocx(
    new File([blob], name, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    {
      onReview: (info) => {
        box.value = info;
      },
    },
  );
  expect(imported.ok).toBe(true);
  return { html: imported.ok ? imported.value : '', review: box.value as ImportedReview | null };
}

describe('format revision round trip (w:pPrChange)', () => {
  it('writes the previous block kind as pPrChange and reads it back', async () => {
    const exported = await exportDocxBlob(
      '<h2><span data-track-format="paragraph" data-track-id="fmt-1">标题</span></h2>',
      'format',
      DEFAULT_PAGE_SETUP,
      { author: '甲' },
    );
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const xml = await documentXmlOf(exported.value);
    // The library writes w:pPrChange natively (`ParagraphOptions.revision`), no zip surgery involved
    expect(xml).toContain('<w:pPrChange');
    expect(xml).toContain('w:author="甲"');

    const { html, review } = await importWithReview(exported.value, 'format.docx');
    expect(review?.changes.map((change) => change.kind)).toEqual(['format']);
    // `paragraph` = 原来是普通段落；回填后 reject 才能把标题还原成段落
    expect(html).toContain('data-track-format="paragraph"');
    expect(html).toMatch(/<h2[^>]*>/);
  });

  it('keeps the heading level inside the target, so rejecting restores H2 (not H1)', async () => {
    const exported = await exportDocxBlob(
      '<p><span data-track-format="heading:2" data-track-id="fmt-2">正文</span></p>',
      'level',
      DEFAULT_PAGE_SETUP,
    );
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    // Heading level can only travel through the style name: `Heading2` is what Word understands
    expect(await documentXmlOf(exported.value)).toContain('Heading2');
    const { html } = await importWithReview(exported.value, 'level.docx');
    expect(html).toContain('data-track-format="heading:2"');
  });
});

describe('comment round trip (comments.xml)', () => {
  it('restores the anchor and the comment record', async () => {
    const exported = await exportDocxBlob(
      '<p>前文<span data-comment-id="c-1">待审</span>后文</p>',
      'comment',
      DEFAULT_PAGE_SETUP,
      {
        comments: [
          {
            id: 'c-1',
            quote: '待审',
            text: '这里需要补充来源',
            author: '审阅人',
            createdAt: 0,
            resolved: false,
          },
        ],
        author: '审阅人',
      },
    );
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const { html, review } = await importWithReview(exported.value, 'comment.docx');
    expect(review?.degraded).toBe(false);
    expect(review?.skippedComments).toBe(0);
    expect(review?.comments).toHaveLength(1);
    expect(review?.comments[0]).toMatchObject({
      quote: '待审',
      text: '这里需要补充来源',
      author: '审阅人',
    });
    // The mark comes back, so the comment highlights the same text and can be resolved/removed again.
    // Word numbers comments from 0, and the id is namespaced so a re-import cannot collide with editor ids.
    expect(html).toContain('data-comment-id="docx-cmt-0"');
    expect(html).toContain('待审');
  });

  it('imports a comment that crosses paragraphs as text and counts it', () => {
    const xml = `<w:document xmlns:w="w"><w:body>
      <w:p><w:commentRangeStart w:id="7"/><w:r><w:t>甲</w:t></w:r></w:p>
      <w:p><w:r><w:t>乙</w:t></w:r><w:commentRangeEnd w:id="7"/></w:p>
    </w:body></w:document>`;
    const parsed = parseDocumentReview(xml);
    expect(parsed.anchors).toEqual([{ docxId: '7', start: 0, end: 2 }]);

    const applied = applyDocumentReview(
      '<p>甲</p><p>乙</p>',
      parsed,
      [{ docxId: '7', author: 'A', date: null, quote: '', text: '跨段落批注' }],
      1000,
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    // A mark cannot span two paragraphs in the editor: keep the text, report the loss
    expect(applied.value.comments).toEqual([]);
    expect(applied.value.skippedComments).toBe(1);
    expect(applied.value.html).not.toContain('data-comment-id');
  });
});
