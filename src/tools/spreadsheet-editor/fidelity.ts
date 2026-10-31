import type { FidelityIssue } from '@/core/fidelity';
import { buildChartPlan } from './chartXml';
import { buildShapePlan } from './shapesXml';
import { buildPivotXlsxPlan } from './pivotXlsx';
import { countUnsupportedValidation } from './cfdv';
import { countSheetComments, readSheetComments } from './comments';
import { countExtras, readWorkbookExtras } from './xlsx-extras';
import type { WorkbookSnapshot } from './xlsx-io';

/**
 * Export-side fidelity for workbooks.
 *
 * Editor-created conditional formatting / data validation is converted to OOXML by `cfdv.ts`;
 * only the rules without an exceljs/OOXML equivalent are reported as warnings here.
 * Floating shapes are written as native `xdr:sp` (SHEET-02); pictures are still dropped on import.
 */
export function collectExportIssues(snapshot: WorkbookSnapshot): FidelityIssue[] {
  const issues: FidelityIssue[] = [];

  const charts = snapshot.syntoolsCharts ?? [];
  if (charts.length > 0) {
    const plan = buildChartPlan(snapshot);
    const planned = Object.values(plan.chartsBySheet).reduce((sum, list) => sum + list.length, 0);
    if (planned > 0) {
      issues.push({
        code: 'sheet.chartsKept',
        severity: 'info',
        count: planned,
        messageKey: 'tools.sheet.keptCharts',
      });
    }
    const dropped = charts.length - planned;
    if (dropped > 0) {
      issues.push({
        code: 'sheet.charts',
        severity: 'loss',
        count: dropped,
        messageKey: 'tools.sheet.lossCharts',
      });
    }
  }

  // 形状：写成原生 xdr:sp，Excel / WPS / LibreOffice 里可直接编辑
  const shapes = snapshot.syntoolsShapes ?? [];
  if (shapes.length > 0) {
    const shapePlan = buildShapePlan(snapshot);
    const plannedShapes = Object.values(shapePlan.shapesBySheet).reduce(
      (sum, list) => sum + list.length,
      0,
    );
    if (plannedShapes > 0) {
      issues.push({
        code: 'sheet.shapesKept',
        severity: 'info',
        count: plannedShapes,
        messageKey: 'tools.sheet.keptShapes',
      });
    }
  }

  // 透视表：能写成原生 part 的保持可刷新；只有退回静态值的那些需要告警（数值可用但刷新不了）
  const pivots = snapshot.syntoolsPivots ?? [];
  if (pivots.length > 0) {
    const native = buildPivotXlsxPlan(snapshot).items.length;
    const fallback = Math.max(0, pivots.length - native);
    if (fallback > 0) {
      issues.push({
        code: 'sheet.pivotSnapshot',
        severity: 'warning',
        count: fallback,
        messageKey: 'tools.sheet.pivotSnapshot',
      });
    }
  }

  const counts = countExtras(readWorkbookExtras(snapshot));
  if (counts.conditionalFormattings > 0) {
    issues.push({
      code: 'sheet.cfKept',
      severity: 'info',
      count: counts.conditionalFormattings,
      messageKey: 'tools.sheet.keptConditionalFormats',
    });
  }
  if (counts.dataValidations > 0) {
    issues.push({
      code: 'sheet.dvKept',
      severity: 'info',
      count: counts.dataValidations,
      messageKey: 'tools.sheet.keptDataValidations',
    });
  }

  // Rules that cannot be expressed in OOXML are counted, never silently dropped
  const unsupported = countUnsupportedValidation(snapshot);
  if (unsupported.conditionalFormattings > 0) {
    issues.push({
      code: 'sheet.cfUnsupported',
      severity: 'warning',
      count: unsupported.conditionalFormattings,
      messageKey: 'tools.sheet.cfUnsupported',
    });
  }
  if (unsupported.dataValidations > 0) {
    issues.push({
      code: 'sheet.dvUnsupported',
      severity: 'warning',
      count: unsupported.dataValidations,
      messageKey: 'tools.sheet.dvUnsupported',
    });
  }

  // Comment threads live in our own snapshot field only; xlsx has no counterpart here yet
  const comments = countSheetComments(readSheetComments(snapshot));
  if (comments > 0) {
    issues.push({
      code: 'sheet.comments',
      severity: 'warning',
      count: comments,
      messageKey: 'tools.sheet.lossComments',
    });
  }

  return issues;
}
