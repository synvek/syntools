import { describe, expect, it } from 'vitest';
import { docxLossIssues, markdownLossIssues } from './fidelity';
import type { DocxExportLosses, MarkdownExportLosses } from './core';

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
