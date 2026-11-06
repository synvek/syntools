import type { BaselineReport, PartStatus, ReportDiff } from './types';

/**
 * Golden comparison.
 *
 * `compareReports` only *describes* drift — sample order, timestamps, ids and byte sizes are
 * ignored so the report never churns. `blockingDrift` (P0-1) turns regressions into a release
 * gate: less content back, new degradations, changed fixtures or a worse per-part status fail.
 * Improvements stay non-blocking and are accepted by `--update`.
 */
export function compareReports(golden: BaselineReport, current: BaselineReport): ReportDiff {
  const goldenById = new Map(golden.samples.map((sample) => [sample.id, sample]));
  const currentById = new Map(current.samples.map((sample) => [sample.id, sample]));

  const addedSamples = [...currentById.keys()].filter((id) => !goldenById.has(id));
  const removedSamples = [...goldenById.keys()].filter((id) => !currentById.has(id));

  const changed: ReportDiff['changed'] = [];
  const addedIssues: string[] = [];
  const removedIssues: string[] = [];
  const changedParts: ReportDiff['changedParts'] = [];

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

    // A missing part is treated as `lost`: the exporter stopped writing that OOXML part entirely.
    const goldenParts = new Map((before.parts ?? []).map((part) => [part.name, part.status]));
    const currentParts = new Map((now.parts ?? []).map((part) => [part.name, part.status]));
    const partNames = new Set([...goldenParts.keys(), ...currentParts.keys()]);
    for (const name of partNames) {
      const previous = goldenParts.get(name) ?? 'lost';
      const present = currentParts.get(name) ?? 'lost';
      if (previous !== present)
        changedParts.push({ sample: id, part: name, golden: previous, current: present });
    }
  }

  return { addedSamples, removedSamples, changed, addedIssues, removedIssues, changedParts };
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
  for (const item of diff.changedParts) {
    lines.push(`~ part ${item.sample}:${item.part}: ${item.golden} → ${item.current}`);
  }
  if (lines.length === 0) lines.push('no drift against the golden baseline');
  return lines.join('\n');
}

const SEVERITY: Record<PartStatus, number> = { kept: 0, degraded: 1, lost: 2 };

/**
 * Regressions that must block a release (P0-1). Improvements — more content returned, fewer
 * issues, a part recovered — are still printed by `describeDiff` but do not block; they are
 * accepted by regenerating the golden baseline with `pnpm baseline:roundtrip --update`.
 */
export function blockingDrift(diff: ReportDiff): string[] {
  const blockers: string[] = [];
  if (diff.removedSamples.length > 0) {
    blockers.push(`missing samples (golden must be updated): ${diff.removedSamples.join(', ')}`);
  }
  if (diff.addedSamples.length > 0) {
    blockers.push(`new samples (golden must be updated): ${diff.addedSamples.join(', ')}`);
  }
  for (const item of diff.changed) {
    const structural = !Number.isFinite(item.golden) || !Number.isFinite(item.current);
    // `before.*` describes the fixture itself: a changed input invalidates the golden numbers.
    if (structural || item.key.startsWith('before.') || item.current < item.golden) {
      blockers.push(`${item.sample} ${item.key}: ${item.golden} → ${item.current}`);
    }
  }
  for (const issue of diff.addedIssues) blockers.push(`new degradation: ${issue}`);
  for (const part of diff.changedParts) {
    if (SEVERITY[part.current] > SEVERITY[part.golden]) {
      blockers.push(`${part.sample} part ${part.part}: ${part.golden} → ${part.current}`);
    }
  }
  return blockers;
}
