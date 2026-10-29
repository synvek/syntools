import { describe, expect, it } from 'vitest';
import { compareReports, describeDiff } from './compare';
import type { BaselineReport, SampleResult } from './types';

function sample(overrides: Partial<SampleResult> = {}): SampleResult {
  return {
    id: 'slide/demo',
    tool: 'slide',
    title: 'demo',
    ok: true,
    before: { elements: 3, custGeomPoints: 5 },
    after: { elements: 3, custGeomPoints: 5 },
    issues: [],
    artifacts: { bytes: 1000 },
    ...overrides,
  };
}

function report(samples: SampleResult[]): BaselineReport {
  return { generatedAt: 'ignored', generator: 'test', total: samples.length, samples };
}

describe('baseline report comparison', () => {
  it('reports no drift for identical runs (ignoring timestamps and byte sizes)', () => {
    const golden = report([sample()]);
    const current = report([sample({ artifacts: { bytes: 2000 } })]);
    const diff = compareReports(golden, current);

    expect(diff.changed).toEqual([]);
    expect(diff.addedSamples).toEqual([]);
    expect(diff.removedSamples).toEqual([]);
    expect(describeDiff(diff)).toBe('no drift against the golden baseline');
  });

  it('flags a metric that regressed — a silently dropped shape cannot pass', () => {
    const golden = report([sample()]);
    const current = report([
      sample({
        after: { elements: 2, custGeomPoints: 0 },
        issues: [{ code: 'slide.placeholders', count: 1 }],
      }),
    ]);
    const diff = compareReports(golden, current);

    expect(diff.changed).toEqual([
      { sample: 'slide/demo', key: 'after.elements', golden: 3, current: 2 },
      { sample: 'slide/demo', key: 'after.custGeomPoints', golden: 5, current: 0 },
    ]);
    expect(diff.addedIssues).toEqual(['slide/demo:slide.placeholders=1']);
  });

  it('flags added and removed samples', () => {
    const golden = report([sample(), sample({ id: 'sheet/gone', tool: 'sheet' })]);
    const current = report([sample(), sample({ id: 'docx/new', tool: 'docx' })]);
    const diff = compareReports(golden, current);

    expect(diff.addedSamples).toEqual(['docx/new']);
    expect(diff.removedSamples).toEqual(['sheet/gone']);
    expect(describeDiff(diff)).toContain('+ samples: docx/new');
    expect(describeDiff(diff)).toContain('- samples: sheet/gone');
  });

  it('flags disappeared issues too (a fixed degradation should show up)', () => {
    const golden = report([sample({ issues: [{ code: 'sheet.charts', count: 2 }] })]);
    const current = report([sample()]);

    expect(compareReports(golden, current).removedIssues).toEqual(['slide/demo:sheet.charts=2']);
  });
});
