import { describe, expect, it } from 'vitest';
import {
  createFidelityReport,
  hasFidelityIssues,
  isFidelityMuted,
  mergeFidelityIssues,
  muteFidelity,
  summarizeFidelity,
  type FidelityIssue,
} from './fidelity';

/** Shared fidelity report: merging, summary and the "don't show again" preference */

const issue = (patch: Partial<FidelityIssue> = {}): FidelityIssue => ({
  code: 'slide.placeholders',
  severity: 'loss',
  count: 1,
  messageKey: 'tools.slide.downgraded',
  ...patch,
});

describe('mergeFidelityIssues', () => {
  it('sums issues that share code and severity', () => {
    const merged = mergeFidelityIssues([issue({ count: 2 }), issue({ count: 3 })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].count).toBe(5);
  });

  it('keeps different codes / severities apart', () => {
    const merged = mergeFidelityIssues([
      issue({ count: 1 }),
      issue({ code: 'slide.notes', count: 1 }),
      issue({ code: 'slide.placeholders', severity: 'warning', count: 1 }),
    ]);
    expect(merged).toHaveLength(3);
  });

  it('drops zero-count issues', () => {
    expect(mergeFidelityIssues([issue({ count: 0 })])).toEqual([]);
  });

  it('merges details without duplicating them', () => {
    const merged = mergeFidelityIssues([
      issue({ detail: 'SmartArt' }),
      issue({ detail: 'OLE' }),
      issue({ detail: 'SmartArt' }),
    ]);
    expect(merged[0].detail).toBe('SmartArt, OLE');
  });

  it('orders loss → warning → info', () => {
    const merged = mergeFidelityIssues([
      issue({ code: 'a', severity: 'info' }),
      issue({ code: 'b', severity: 'loss' }),
      issue({ code: 'c', severity: 'warning' }),
    ]);
    expect(merged.map((item) => item.severity)).toEqual(['loss', 'warning', 'info']);
  });
});

describe('summarizeFidelity / hasFidelityIssues', () => {
  it('counts issues per severity', () => {
    const report = createFidelityReport('slide', 'import', [
      issue({ code: 'a', severity: 'loss', count: 2 }),
      issue({ code: 'b', severity: 'warning', count: 3 }),
      issue({ code: 'c', severity: 'info', count: 1 }),
    ]);
    expect(summarizeFidelity(report)).toEqual({ loss: 2, warning: 3, info: 1, total: 6 });
  });

  it('treats an empty report as nothing to show', () => {
    expect(hasFidelityIssues(null)).toBe(false);
    expect(hasFidelityIssues(createFidelityReport('sheet', 'export', []))).toBe(false);
  });

  it('shows a report as soon as one issue survives', () => {
    expect(hasFidelityIssues(createFidelityReport('rte', 'export', [issue()]))).toBe(true);
  });
});

describe('mute preference', () => {
  it('persists and reads back the preference', () => {
    localStorage.removeItem('syntools.fidelity.muted');
    expect(isFidelityMuted()).toBe(false);
    muteFidelity();
    expect(isFidelityMuted()).toBe(true);
    localStorage.removeItem('syntools.fidelity.muted');
  });
});
