/**
 * Cross-product fidelity reporting.
 *
 * Import / export in every Office tool can degrade content (placeholders, dropped features,
 * flattened structures). Instead of each tool inventing its own banner, they adapt their local
 * loss information into this shared shape, and one dialog explains it.
 *
 * Pure logic only: no React, no tool imports, so every tool can depend on it cheaply.
 */

export type FidelityTool = 'slide' | 'rte' | 'sheet';
export type FidelityOperation = 'import' | 'export';

/** info = worth knowing, warning = degraded but usable, loss = content did not survive */
export type FidelitySeverity = 'info' | 'warning' | 'loss';

export interface FidelityIssue {
  /** Stable identifier such as 'slide.placeholders'; merged issues share it */
  code: string;
  severity: FidelitySeverity;
  count: number;
  /** i18n key (already namespaced, e.g. 'tools.slide.downgraded') */
  messageKey: string;
  /** Untranslated detail: element names, file names, counts */
  detail?: string;
}

export interface FidelityReport {
  tool: FidelityTool;
  operation: FidelityOperation;
  issues: FidelityIssue[];
}

export const SEVERITY_ORDER: FidelitySeverity[] = ['loss', 'warning', 'info'];

/** Drop empty / zero-count issues and merge duplicates that share code + severity */
export function mergeFidelityIssues(issues: FidelityIssue[]): FidelityIssue[] {
  const merged = new Map<string, FidelityIssue>();
  for (const issue of issues) {
    if (!issue || issue.count <= 0) continue;
    const key = `${issue.severity}:${issue.code}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...issue });
      continue;
    }
    existing.count += issue.count;
    if (!existing.detail && issue.detail) existing.detail = issue.detail;
    else if (issue.detail && existing.detail && !existing.detail.includes(issue.detail)) {
      existing.detail = `${existing.detail}, ${issue.detail}`;
    }
  }
  return Array.from(merged.values()).sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}

/** Build a normalized report (issues merged and filtered) */
export function createFidelityReport(
  tool: FidelityTool,
  operation: FidelityOperation,
  issues: FidelityIssue[],
): FidelityReport {
  return { tool, operation, issues: mergeFidelityIssues(issues) };
}

export interface FidelitySummary {
  loss: number;
  warning: number;
  info: number;
  total: number;
}

export function summarizeFidelity(report: FidelityReport | null): FidelitySummary {
  const summary: FidelitySummary = { loss: 0, warning: 0, info: 0, total: 0 };
  if (!report) return summary;
  for (const issue of report.issues) {
    summary[issue.severity] += issue.count;
    summary.total += issue.count;
  }
  return summary;
}

/** Whether the dialog is worth showing at all (no issues → stay out of the way) */
export function hasFidelityIssues(report: FidelityReport | null): boolean {
  return summarizeFidelity(report).total > 0;
}

/** "Don't show again" preference, scoped to this browser */
const MUTE_KEY = 'syntools.fidelity.muted';

export function isFidelityMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function muteFidelity(): void {
  try {
    localStorage.setItem(MUTE_KEY, '1');
  } catch {
    // Private mode / storage disabled: the preference simply does not persist
  }
}
