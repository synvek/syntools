import { describe, expect, it } from 'vitest';
import { docxLossIssues, importLossIssues, markdownLossIssues } from './fidelity';
import type { DocxExportLosses, MarkdownExportLosses } from './core';
import type { IrLoss } from './ooxmlIr';

/** Adapter tests: the editor's loss counters must map onto the shared fidelity vocabulary */

const docx = (patch: Partial<DocxExportLosses> = {}): DocxExportLosses => ({
  externalImages: 0,
  webpImages: 0,
  deepListItems: 0,
  unlinkedComments: 0,
  mathAsImages: 0,
  ...patch,
});

const markdown = (patch: Partial<MarkdownExportLosses> = {}): MarkdownExportLosses => ({
  comments: 0,
  trackedChanges: 0,
  paragraphSpacing: 0,
  floatingImages: 0,
  pageSetupFields: 0,
  ...patch,
});

describe('docxLossIssues', () => {
  it('emits only non-zero counters', () => {
    const issues = docxLossIssues(docx({ externalImages: 2, deepListItems: 1, mathAsImages: 3 }));
    expect(issues.map((issue) => issue.code)).toEqual([
      'rte.externalImages',
      'rte.deepLists',
      'rte.mathAsImages',
    ]);
  });

  it('treats dropped images as losses and flattened structures as warnings', () => {
    const issues = docxLossIssues(docx({ externalImages: 2, deepListItems: 1 }));
    expect(issues[0]).toMatchObject({
      severity: 'loss',
      count: 2,
      messageKey: 'tools.richText.lossExternalImages',
    });
    expect(issues[1]).toMatchObject({
      severity: 'warning',
      messageKey: 'tools.richText.lossDeepLists',
    });
  });

  it('returns nothing when the document exports cleanly', () => {
    expect(docxLossIssues(docx())).toEqual([]);
  });
});

describe('importLossIssues', () => {
  const ir = (losses: IrLoss[]) => ({ losses });

  it('groups raw IR codes into the three user-facing warnings', () => {
    const issues = importLossIssues(
      ir([
        { code: 'ir.images', count: 2 },
        { code: 'ir.shapes', count: 1 },
        { code: 'ir.reviewIns', count: 3 },
        { code: 'ir.comments', count: 2 },
        { code: 'ir.math', count: 4 },
      ]),
    );
    expect(issues.map((issue) => issue.code)).toEqual([
      'rte.irStructure',
      'rte.irReview',
      'rte.irFields',
    ]);
    expect(issues.map((issue) => issue.count)).toEqual([3, 5, 4]);
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
    expect(issues[0].messageKey).toBe('tools.richText.lossIrStructure');
  });

  it('keeps raw code counts in the detail trail', () => {
    const issues = importLossIssues(
      ir([
        { code: 'ir.images', count: 2 },
        { code: 'ir.bookmarks', count: 1 },
      ]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].detail).toBe('ir.images:2, ir.bookmarks:1');
  });

  it('skips groups without matching losses and ignores unknown codes', () => {
    expect(importLossIssues(ir([]))).toEqual([]);
    expect(importLossIssues(ir([{ code: 'ir.unknown', count: 9 }]))).toEqual([]);
  });
});

describe('markdownLossIssues', () => {
  it('maps review metadata and page setup to warnings', () => {
    const issues = markdownLossIssues(markdown({ comments: 3, pageSetupFields: 2 }));
    expect(issues.map((issue) => issue.code)).toEqual(['rte.mdComments', 'rte.mdPageSetup']);
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
    expect(issues[0].messageKey).toBe('tools.richText.lossMdComments');
  });

  it('returns nothing when Markdown keeps everything', () => {
    expect(markdownLossIssues(markdown())).toEqual([]);
  });
});
