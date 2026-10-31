import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { exportDocxBlob, importDocx } from '../rich-text-editor/docx';
import { scanDocxExportLosses } from '../rich-text-editor/core';
import { docxLossIssues } from '../rich-text-editor/fidelity';
import { exportPptx } from '../slide-editor/pptx/export';
import { importPptxFile } from '../slide-editor/pptx/import';
import { collectExportIssues } from '../spreadsheet-editor/fidelity';
import { exportSnapshotToBytes, importXlsxToSnapshot } from '../spreadsheet-editor/xlsx-io';
import { compareReports, describeDiff } from './compare';
import { docMetrics, sheetMetrics, slideMetrics } from './metrics';
import { docSamples, SAMPLE_COUNTS, sampleManifest, sheetSamples, slideSamples } from './samples';
import type { BaselineReport, Metrics, SampleIssue, SampleResult } from './types';

/**
 * OOXML round-trip baseline (plan §5.2, decision D7 = generated samples).
 *
 * Always runs: every sample must export and re-import. The golden comparison is opt-in
 * (`pnpm baseline:roundtrip` → `BASELINE_REPORT=1`) because it writes files into `fixtures/`,
 * and it never fails the suite — the report is reviewed by a human, exactly like a size budget.
 */

const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'ooxml-baseline');

// jsdom has no Blob.prototype.arrayBuffer; both the docx importer and our byte extraction need it
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error('READ_FAILED'));
      reader.readAsArrayBuffer(this);
    });
  };
}

/** Minimal File stand-in: the importers only touch name / size / arrayBuffer() */
function fakeFile(bytes: Uint8Array, name: string): File {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { name, size: bytes.byteLength, arrayBuffer: async () => buffer } as unknown as File;
}

function issuesOf(issues: { code: string; count?: number }[]): SampleIssue[] {
  return issues
    .filter((issue) => (issue.count ?? 0) > 0)
    .map((issue) => ({ code: issue.code, count: issue.count ?? 1 }));
}

async function zipFacts(bytes: Uint8Array): Promise<Record<string, number>> {
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files);
  return {
    bytes: bytes.byteLength,
    parts: names.length,
    slideParts: names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length,
    mediaParts: names.filter((name) => name.startsWith('ppt/media/')).length,
    chartParts: names.filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name)).length,
    headerParts: names.filter((name) => /^word\/header\d+\.xml$/.test(name)).length,
    footerParts: names.filter((name) => /^word\/footer\d+\.xml$/.test(name)).length,
    worksheets: names.filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).length,
    pivotParts: names.filter((name) => /^xl\/pivotTables\//.test(name)).length,
  };
}

function failed(
  id: string,
  tool: SampleResult['tool'],
  title: string,
  error: string,
): SampleResult {
  return {
    id,
    tool,
    title,
    ok: false,
    error,
    before: {},
    after: {},
    issues: [],
    artifacts: {},
  };
}

async function runSlide(sample: (typeof slideSamples)[number]): Promise<SampleResult> {
  const doc = sample.doc();
  const before: Metrics = slideMetrics(doc);
  const exported = await exportPptx(doc);
  if (!exported.ok) return failed(sample.id, 'slide', sample.title, `export:${exported.error}`);

  const artifacts = await zipFacts(exported.value);
  const imported = await importPptxFile(fakeFile(exported.value, `${sample.id}.pptx`));
  if (!imported.ok) return failed(sample.id, 'slide', sample.title, `import:${imported.error}`);

  return {
    id: sample.id,
    tool: 'slide',
    title: sample.title,
    ...(sample.notes ? { notes: sample.notes } : {}),
    ok: true,
    before,
    after: slideMetrics(imported.value.doc),
    issues: [
      { code: 'slide.placeholders', count: imported.value.report.placeholders },
      { code: 'slide.skipped', count: imported.value.report.skipped.length },
    ].filter((issue) => issue.count > 0),
    artifacts,
  };
}

async function runSheet(sample: (typeof sheetSamples)[number]): Promise<SampleResult> {
  const snapshot = sample.snapshot();
  const before: Metrics = sheetMetrics(snapshot);
  const exported = await exportSnapshotToBytes(snapshot);
  if (!exported.ok) return failed(sample.id, 'sheet', sample.title, `export:${exported.error}`);

  const artifacts = await zipFacts(exported.value);
  const imported = await importXlsxToSnapshot(fakeFile(exported.value, `${sample.id}.xlsx`));
  if (!imported.ok) return failed(sample.id, 'sheet', sample.title, `import:${imported.error}`);

  return {
    id: sample.id,
    tool: 'sheet',
    title: sample.title,
    ...(sample.notes ? { notes: sample.notes } : {}),
    ok: true,
    before,
    after: sheetMetrics(imported.value),
    issues: issuesOf(collectExportIssues(snapshot)),
    artifacts,
  };
}

async function runDoc(sample: (typeof docSamples)[number]): Promise<SampleResult> {
  const html = sample.html();
  const setup = sample.setup?.() ?? null;
  const before: Metrics = docMetrics(html);

  const losses = scanDocxExportLosses(html, []);
  const lossIssues = losses.ok ? issuesOf(docxLossIssues(losses.value)) : [];

  const exported = await exportDocxBlob(html, sample.title, setup);
  if (!exported.ok) return failed(sample.id, 'docx', sample.title, `export:${exported.error}`);

  const bytes = new Uint8Array(await exported.value.arrayBuffer());
  const artifacts = await zipFacts(bytes);
  const imported = await importDocx(fakeFile(bytes, `${sample.id}.docx`));
  if (!imported.ok) return failed(sample.id, 'docx', sample.title, `import:${imported.error}`);

  return {
    id: sample.id,
    tool: 'docx',
    title: sample.title,
    ...(sample.notes ? { notes: sample.notes } : {}),
    ok: true,
    before,
    after: docMetrics(imported.value),
    issues: lossIssues,
    artifacts,
  };
}

function writeReport(report: BaselineReport): string[] {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(join(FIXTURE_DIR, 'manifest.json'), `${JSON.stringify(sampleManifest, null, 2)}\n`);
  writeFileSync(join(FIXTURE_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

  const goldenPath = join(FIXTURE_DIR, 'report.golden.json');
  const hadGolden = existsSync(goldenPath);
  if (!hadGolden || process.env.BASELINE_UPDATE) {
    writeFileSync(goldenPath, `${JSON.stringify(report, null, 2)}\n`);
    return [hadGolden ? 'golden baseline updated' : 'golden baseline created'];
  }
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as BaselineReport;
  return describeDiff(compareReports(golden, report)).split('\n');
}

describe('OOXML round-trip baseline (generated samples)', () => {
  it('builds the planned 15 / 9 / 8 samples with unique ids', () => {
    expect(slideSamples).toHaveLength(SAMPLE_COUNTS.slide);
    expect(sheetSamples).toHaveLength(SAMPLE_COUNTS.sheet);
    expect(docSamples).toHaveLength(SAMPLE_COUNTS.docx);
    const ids = sampleManifest.map((sample) => sample.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(sampleManifest).toHaveLength(32);
  });

  it('exports and re-imports every sample without losing the document', async () => {
    const results: SampleResult[] = [];
    for (const sample of slideSamples) results.push(await runSlide(sample));
    for (const sample of sheetSamples) results.push(await runSheet(sample));
    for (const sample of docSamples) results.push(await runDoc(sample));

    const failures = results.filter((result) => !result.ok);
    expect(failures.map((result) => `${result.id}: ${result.error}`)).toEqual([]);

    // A round-trip that returns an empty document is a failure even if both calls "succeeded"
    const emptied = results.filter((result) => {
      const before = Object.values(result.before).reduce((sum, value) => sum + value, 0);
      const after = Object.values(result.after).reduce((sum, value) => sum + value, 0);
      return after === 0 && before > 0;
    });
    expect(emptied.map((result) => result.id)).toEqual([]);

    const report: BaselineReport = {
      generatedAt: new Date().toISOString(),
      generator: 'src/tools/baseline/roundtrip.test.ts',
      total: results.length,
      samples: results,
    };
    (globalThis as { __baselineReport?: BaselineReport }).__baselineReport = report;
  }, 120_000);

  it('compares against the golden baseline when BASELINE_REPORT is set', () => {
    if (!process.env.BASELINE_REPORT) return;
    const report = (globalThis as { __baselineReport?: BaselineReport }).__baselineReport;
    expect(report).toBeDefined();
    if (!report) return;
    for (const line of writeReport(report)) console.log(`[baseline] ${line}`);
    expect(report.total).toBe(30);
  });
});
