import { describe, expect, it } from 'vitest';
import { blockingDrift, compareReports, describeDiff } from './compare';
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

describe('release gate (P0-1)', () => {
  it('does not block an unchanged run', () => {
    expect(blockingDrift(compareReports(report([sample()]), report([sample()])))).toEqual([]);
  });

  it('does not block an improvement, even though it is printed as drift', () => {
    const golden = report([sample()]);
    const current = report([sample({ after: { elements: 4, custGeomPoints: 5 } })]);
    const diff = compareReports(golden, current);

    expect(diff.changed).toHaveLength(1);
    expect(describeDiff(diff)).toContain('after.elements: 3 → 4');
    expect(blockingDrift(diff)).toEqual([]);
  });

  it('blocks fewer metrics back, a changed fixture and a new degradation', () => {
    const golden = report([sample()]);
    const current = report([
      sample({
        before: { elements: 2, custGeomPoints: 5 },
        after: { elements: 2, custGeomPoints: 5 },
        issues: [{ code: 'slide.placeholders', count: 1 }],
      }),
    ]);

    const blockers = blockingDrift(compareReports(golden, current));
    expect(blockers.some((line) => line.includes('before.elements'))).toBe(true);
    expect(blockers.some((line) => line.includes('after.elements'))).toBe(true);
    expect(blockers).toContain('new degradation: slide/demo:slide.placeholders=1');
  });

  it('blocks added / removed samples until the golden is updated', () => {
    const golden = report([sample()]);
    const current = report([sample(), sample({ id: 'docx/new', tool: 'docx' })]);
    const blockers = blockingDrift(compareReports(golden, current));

    expect(blockers.some((line) => line.includes('docx/new'))).toBe(true);
    expect(
      blockingDrift(compareReports(current, golden)).some((line) =>
        line.includes('missing samples'),
      ),
    ).toBe(true);
  });

  it('blocks a part that used to survive and is now lost', () => {
    const golden = report([
      sample({
        source: 'external',
        parts: [{ name: 'footnotes', before: 3, after: 3, status: 'kept' }],
      }),
    ]);
    const current = report([
      sample({
        source: 'external',
        parts: [{ name: 'footnotes', before: 3, after: 0, status: 'lost' }],
      }),
    ]);
    const diff = compareReports(golden, current);

    expect(diff.changedParts).toEqual([
      { sample: 'slide/demo', part: 'footnotes', golden: 'kept', current: 'lost' },
    ]);
    expect(describeDiff(diff)).toContain('part slide/demo:footnotes: kept → lost');
    expect(blockingDrift(diff).some((line) => line.includes('footnotes'))).toBe(true);
  });

  it('does not block a part that was recovered', () => {
    const golden = report([
      sample({ parts: [{ name: 'endnotes', before: 2, after: 0, status: 'lost' }] }),
    ]);
    const current = report([
      sample({ parts: [{ name: 'endnotes', before: 2, after: 2, status: 'kept' }] }),
    ]);

    expect(blockingDrift(compareReports(golden, current))).toEqual([]);
  });

  it('blocks a structural change such as a metric disappearing', () => {
    const golden = report([sample()]);
    const current = report([sample({ after: { elements: 3 } })]);
    const diff = compareReports(golden, current);

    expect(diff.changed[0].current).toBeNaN();
    expect(blockingDrift(diff).length).toBeGreaterThan(0);
  });
});
