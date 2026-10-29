import type { BaselineReport, ReportDiff } from './types';

/**
 * Golden comparison.
 *
 * Deliberately *not* a pass/fail gate: the baseline is a ratchet that a human reviews
 * (`pnpm baseline:roundtrip` prints the diff). Only metric/issue changes count — sample order,
 * timestamps, ids and byte sizes are ignored so the report never churns.
 */
export function compareReports(golden: BaselineReport, current: BaselineReport): ReportDiff {
  const goldenById = new Map(golden.samples.map((sample) => [sample.id, sample]));
  const currentById = new Map(current.samples.map((sample) => [sample.id, sample]));

  const addedSamples = [...currentById.keys()].filter((id) => !goldenById.has(id));
  const removedSamples = [...goldenById.keys()].filter((id) => !currentById.has(id));

  const changed: ReportDiff['changed'] = [];
  const addedIssues: string[] = [];
  const removedIssues: string[] = [];

  for (const [id, now] of currentById) {
    const before = goldenById.get(id);
    if (!before) continue;

    for (const group of ['before', 'after'] as const) {
      const currentMetrics = now[group];
      const goldenMetrics = before[group];
      const keys = new Set([...Object.keys(goldenMetrics), ...Object.keys(currentMetrics)]);
      for (const key of keys) {
        const goldenValue = goldenMetrics[key];
        const currentValue = currentMetrics[key];
        if (goldenValue === undefined || currentValue === undefined) {
          changed.push({
            sample: id,
            key: `${group}.${key}`,
            golden: goldenValue ?? Number.NaN,
            current: currentValue ?? Number.NaN,
          });
          continue;
        }
        if (goldenValue !== currentValue) {
          changed.push({
            sample: id,
            key: `${group}.${key}`,
            golden: goldenValue,
            current: currentValue,
          });
        }
      }
    }

    const goldenIssues = new Map(before.issues.map((issue) => [issue.code, issue.count]));
    const currentIssues = new Map(now.issues.map((issue) => [issue.code, issue.count]));
    for (const [code, count] of currentIssues) {
      if (goldenIssues.get(code) !== count) addedIssues.push(`${id}:${code}=${count}`);
    }
    for (const [code, count] of goldenIssues) {
      if (!currentIssues.has(code)) removedIssues.push(`${id}:${code}=${count}`);
    }
  }

  return { addedSamples, removedSamples, changed, addedIssues, removedIssues };
}

/** Human-readable summary for the CLI output */
export function describeDiff(diff: ReportDiff): string {
  const lines: string[] = [];
  if (diff.addedSamples.length > 0) lines.push(`+ samples: ${diff.addedSamples.join(', ')}`);
  if (diff.removedSamples.length > 0) lines.push(`- samples: ${diff.removedSamples.join(', ')}`);
  for (const item of diff.changed) {
    lines.push(`~ ${item.sample} ${item.key}: ${item.golden} → ${item.current}`);
  }
  for (const item of diff.addedIssues) lines.push(`! issue added: ${item}`);
  for (const item of diff.removedIssues) lines.push(`! issue removed: ${item}`);
  if (lines.length === 0) lines.push('no drift against the golden baseline');
  return lines.join('\n');
}
