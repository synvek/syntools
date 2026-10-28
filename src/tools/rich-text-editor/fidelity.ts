import type { FidelityIssue } from '@/core/fidelity';
import type { DocxExportLosses, MarkdownExportLosses } from './core';

/**
 * Adapters from the editor's own loss scanners to the shared fidelity report.
 * Kept separate from core.ts so the pure text layer stays free of presentation concerns,
 * and separate from the component so the mapping can be unit-tested.
 */

/** docx export: images that cannot be embedded, structures that get flattened */
export function docxLossIssues(losses: DocxExportLosses): FidelityIssue[] {
  const issues: FidelityIssue[] = [
    {
      code: 'rte.externalImages',
      severity: 'loss',
      count: losses.externalImages,
      messageKey: 'tools.richText.lossExternalImages',
    },
    {
      code: 'rte.webpImages',
      severity: 'loss',
      count: losses.webpImages,
      messageKey: 'tools.richText.lossWebpImages',
    },
    {
      code: 'rte.deepLists',
      severity: 'warning',
      count: losses.deepListItems,
      messageKey: 'tools.richText.lossDeepLists',
    },
    {
      code: 'rte.unlinkedComments',
      severity: 'warning',
      count: losses.unlinkedComments,
      messageKey: 'tools.richText.lossUnlinkedComments',
    },
    {
      code: 'rte.mathAsImages',
      severity: 'warning',
      count: losses.mathAsImages,
      messageKey: 'tools.richText.lossMathAsImages',
    },
  ];
  return issues.filter((issue) => issue.count > 0);
}

/** Markdown export: review metadata and page layout are not representable */
export function markdownLossIssues(losses: MarkdownExportLosses): FidelityIssue[] {
  const issues: FidelityIssue[] = [
    {
      code: 'rte.mdComments',
      severity: 'warning',
      count: losses.comments,
      messageKey: 'tools.richText.lossMdComments',
    },
    {
      code: 'rte.mdTrackedChanges',
      severity: 'warning',
      count: losses.trackedChanges,
      messageKey: 'tools.richText.lossMdTracked',
    },
    {
      code: 'rte.mdParagraphSpacing',
      severity: 'warning',
      count: losses.paragraphSpacing,
      messageKey: 'tools.richText.lossMdSpacing',
    },
    {
      code: 'rte.mdFloatingImages',
      severity: 'warning',
      count: losses.floatingImages,
      messageKey: 'tools.richText.lossMdFloating',
    },
    {
      code: 'rte.mdPageSetup',
      severity: 'warning',
      count: losses.pageSetupFields,
      messageKey: 'tools.richText.lossMdPageSetup',
    },
  ];
  return issues.filter((issue) => issue.count > 0);
}
