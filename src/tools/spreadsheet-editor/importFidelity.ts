import type { FidelityIssue } from '@/core/fidelity';

/**
 * Import-side fidelity report (plan P0-4).
 *
 * The export side already told users what it could not write (`fidelity.ts`). The import side did
 * not: a workbook could arrive with macros stripped, chart sheets missing and threaded comments
 * gone, and the editor stayed silent until the user exported and compared by hand.
 *
 * Everything here is derived from **facts about the archive** plus what the import actually
 * produced, so it never claims a loss the code cannot prove:
 * - parts that exist in the file but have no counterpart in this editor (chartsheets,
 *   threaded comments, VBA) are `warning` — the data is gone after export;
 * - content that survives but cannot be edited (raw charts kept verbatim, pictures in formats the
 *   editor does not render) is `info`.
 */

export interface ImportFacts {
  /** Entry names of the imported archive */
  parts: readonly string[];
  /** Native chart parts kept verbatim because they could not be adopted as editable charts */
  rawChartCount: number;
}

/** Image formats `sheetImages.ts` can turn into an in-app picture */
const EDITABLE_MEDIA = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

const CHARTSHEET = /^xl\/chartsheets\/sheet\d+\.xml$/i;
const THREADED_COMMENT = /^xl\/threadedComments\//i;
const VBA_PART = /^xl\/vbaProject\.bin$/i;
const MEDIA_PART = /^xl\/media\/[^/]+$/i;

function countMatches(parts: readonly string[], pattern: RegExp): number {
  return parts.filter((part) => pattern.test(part)).length;
}

function extensionOf(part: string): string {
  const name = part.slice(part.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function collectImportIssues(facts: ImportFacts): FidelityIssue[] {
  const issues: FidelityIssue[] = [];

  if (facts.rawChartCount > 0) {
    issues.push({
      code: 'sheet.importChartsReadonly',
      severity: 'info',
      count: facts.rawChartCount,
      messageKey: 'tools.sheet.importChartsReadonly',
    });
  }

  const chartsheets = countMatches(facts.parts, CHARTSHEET);
  if (chartsheets > 0) {
    issues.push({
      code: 'sheet.importChartsheet',
      severity: 'warning',
      count: chartsheets,
      messageKey: 'tools.sheet.importChartsheet',
    });
  }

  const threaded = countMatches(facts.parts, THREADED_COMMENT);
  if (threaded > 0) {
    issues.push({
      code: 'sheet.importThreadedComments',
      severity: 'warning',
      count: threaded,
      messageKey: 'tools.sheet.importThreadedComments',
    });
  }

  if (countMatches(facts.parts, VBA_PART) > 0) {
    issues.push({
      code: 'sheet.importMacros',
      severity: 'warning',
      count: 1,
      messageKey: 'tools.sheet.importMacros',
    });
  }

  // Pictures in formats the editor cannot render are kept verbatim in the drawing part, so they
  // come back on export but show up as nothing in the grid.
  const foreignPictures = facts.parts.filter(
    (part) => MEDIA_PART.test(part) && !EDITABLE_MEDIA.has(extensionOf(part)),
  ).length;
  if (foreignPictures > 0) {
    issues.push({
      code: 'sheet.importPicturesReadonly',
      severity: 'info',
      count: foreignPictures,
      messageKey: 'tools.sheet.importPicturesReadonly',
    });
  }

  return issues;
}
