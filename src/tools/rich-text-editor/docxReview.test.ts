import { describe, expect, it } from 'vitest';
import { exportDocxBlob, importDocx } from './docx';
import { DEFAULT_PAGE_SETUP } from './pageSetup';
import { applyRevisionMarks, hasRevisions, parseRevisionRuns } from './docxReview';

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
