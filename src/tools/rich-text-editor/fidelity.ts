import type { FidelityIssue } from '@/core/fidelity';
import type { DocxExportLosses, MarkdownExportLosses } from './core';
import type { OoxmlIr } from './ooxmlIr';

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
      code: 'rte.shapes',
      severity: 'warning',
      count: losses.shapes ?? 0,
      messageKey: 'tools.richText.lossShapes',
    },
    {
      code: 'rte.mathAsImages',
      severity: 'warning',
      count: losses.mathAsImages,
      messageKey: 'tools.richText.lossMathAsImages',
    },
    {
      code: 'rte.xrefStatic',
      severity: 'warning',
      count: losses.staticXrefs ?? 0,
      messageKey: 'tools.richText.lossXrefStatic',
    },
  ];
  return issues.filter((issue) => issue.count > 0);
}

/**
 * Import-side adapter (P0-2.5): structured-IR losses → the shared fidelity report.
 * Codes are grouped by user-facing meaning so nine-language copy stays at three entries;
 * `detail` keeps the raw `code:count` pairs for diagnosis.
 */
const IR_LOSS_GROUPS: ReadonlyArray<{
  code: string;
  messageKey: string;
  codes: readonly string[];
  severity: FidelityIssue['severity'];
}> = [
  {
    code: 'rte.irStructure',
    severity: 'warning',
    messageKey: 'tools.richText.lossIrStructure',
    codes: ['ir.images', 'ir.shapes', 'ir.sections', 'ir.bookmarks'],
  },
  {
    code: 'rte.irReview',
    severity: 'warning',
    messageKey: 'tools.richText.lossIrReview',
    codes: [
      'ir.reviewIns',
      'ir.reviewDel',
      'ir.comments',
      'ir.unlinkedComments',
      'ir.unreferencedNotes',
      'ir.missingNotes',
    ],
  },
  {
    code: 'rte.irFields',
    severity: 'warning',
    messageKey: 'tools.richText.lossIrFields',
    codes: ['ir.fields', 'ir.math', 'ir.anchorMiss'],
  },
];

/** Only `losses` is needed, so callers (and tests) can build a minimal IR stub. */
export function importLossIssues(ir: Pick<OoxmlIr, 'losses'>): FidelityIssue[] {
  return IR_LOSS_GROUPS.flatMap((group) => {
    const matches = ir.losses.filter((loss) => group.codes.includes(loss.code));
    const count = matches.reduce((sum, loss) => sum + loss.count, 0);
    if (count === 0) return [];
    return [
      {
        code: group.code,
        severity: group.severity,
        count,
        messageKey: group.messageKey,
        detail: matches.map((loss) => `${loss.code}:${loss.count}`).join(', '),
      },
    ];
  });
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
