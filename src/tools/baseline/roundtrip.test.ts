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
import { blockingDrift, compareReports, describeDiff } from './compare';
import { docMetrics, sheetMetrics, slideMetrics } from './metrics';
import {
  docSamples,
  externalDocSamples,
  SAMPLE_COUNTS,
  sampleManifest,
  sheetSamples,
  slideSamples,
} from './samples';
import {
  EXTERNAL_PRODUCER_FAMILIES,
  REQUIRED_EXTERNAL_PRODUCERS,
  REQUIRED_EXTERNAL_SAMPLES,
  type ExternalDocSample,
} from './samples/external-doc';
import type {
  BaselineReport,
  Metrics,
  ReportDiff,
  SampleIssue,
  SamplePart,
  SampleResult,
} from './types';

/**
 * OOXML round-trip baseline (plan §5.2, decision D7 = generated samples).
 *
 * Always runs: every sample must export and re-import, including the real third-party .docx
 * binaries (import → export → import). The golden comparison is opt-in
 * (`pnpm baseline:roundtrip` → `BASELINE_REPORT=1`) because it writes files into `fixtures/`.
 * When enabled it is a release gate: regressions fail, improvements need `--update`.
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

/**
 * jsdom cannot decode images, so `measureImageSize` never settles for `blob:` URLs and every picture
 * sample degrades to a placeholder（`slide/image-1px` 曾因此在导入里永久 await，整份基线 120s 超时）。
 * A 2×2 stand-in makes the media path behave like a browser, so the sample really round-trips.
 */
class FakeImage {
  naturalWidth = 2;
  naturalHeight = 2;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

if (typeof Image !== 'undefined') {
  (globalThis as { Image?: unknown }).Image = FakeImage;
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

/** Count the OOXML parts a real .docx actually contains (P0-1.2: per-part fidelity) */
async function docxPartFacts(bytes: Uint8Array): Promise<Record<string, number>> {
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files);
  const read = async (name: string): Promise<string> => {
    const entry = zip.file(name);
    return entry ? await entry.async('string') : '';
  };
  const count = (xml: string, pattern: RegExp): number => (xml.match(pattern) ?? []).length;
  const [document, footnotes, endnotes, comments, styles, numbering, people] = await Promise.all([
    read('word/document.xml'),
    read('word/footnotes.xml'),
    read('word/endnotes.xml'),
    read('word/comments.xml'),
    read('word/styles.xml'),
    read('word/numbering.xml'),
    read('word/people.xml'),
  ]);
  return {
    sections: count(document, /<w:sectPr[\s>]/g),
    headers: names.filter((name) => /^word\/header\d+\.xml$/.test(name)).length,
    footers: names.filter((name) => /^word\/footer\d+\.xml$/.test(name)).length,
    footnotes: count(footnotes, /<w:footnote[\s>]/g),
    endnotes: count(endnotes, /<w:endnote[\s>]/g),
    comments: count(comments, /<w:comment[\s>]/g),
    revisions: count(document, /<w:(?:ins|del)[\s>]/g),
    fields: count(document, /<w:(?:fldChar|instrText)[\s>]/g),
    math: count(document, /<m:oMath[\s>]/g),
    shapes: count(document, /<wps:wsp[\s>]/g),
    images: names.filter((name) => /^word\/media\//.test(name)).length,
    styles: count(styles, /<w:style[\s>]/g),
    numbering: count(numbering, /<w:num[\s>]/g),
    people: count(people, /<w15:person[\s>]/g),
  };
}

function partStatuses(before: Record<string, number>, after: Record<string, number>): SamplePart[] {
  return Object.entries(before)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => {
      const remaining = after[name] ?? 0;
      const status: SamplePart['status'] =
        remaining >= count ? 'kept' : remaining > 0 ? 'degraded' : 'lost';
      return { name, before: count, after: remaining, status };
    });
}

/**
 * A real third-party file goes the other way round: import → export → import again.
 * Parts that do not survive are *reported* rather than thrown — exposing them is the whole point
 * of P0-1, and the gate only blocks when the golden baseline says they used to survive.
 */
async function runExternalDoc(sample: ExternalDocSample): Promise<SampleResult> {
  const fail = (error: string): SampleResult => ({
    ...failed(sample.id, 'docx', sample.title, error),
    source: 'external',
    producer: sample.producer,
    producerFamily: sample.producerFamily,
    parts: [],
  });
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(join(process.cwd(), sample.path)));
  } catch (error) {
    return fail(`read:${String(error)}`);
  }
  const beforeParts = await docxPartFacts(bytes);
  const imported = await importDocx(fakeFile(bytes, `${sample.id.replace(/\W+/g, '-')}.docx`));
  if (!imported.ok) return fail(`import:${imported.error}`);
  const exported = await exportDocxBlob(imported.value, sample.title, null);
  if (!exported.ok) return fail(`export:${exported.error}`);
  const exportedBytes = new Uint8Array(await exported.value.arrayBuffer());
  const afterParts = await docxPartFacts(exportedBytes);
  const reImported = await importDocx(fakeFile(exportedBytes, 'roundtrip.docx'));
  if (!reImported.ok) return fail(`reimport:${reImported.error}`);
  return {
    id: sample.id,
    tool: 'docx',
    title: sample.title,
    source: 'external',
    producer: sample.producer,
    producerFamily: sample.producerFamily,
    notes: sample.notes,
    ok: true,
    before: docMetrics(imported.value),
    after: docMetrics(reImported.value),
    issues: [],
    artifacts: await zipFacts(exportedBytes),
    parts: partStatuses(beforeParts, afterParts),
  };
}

function writeReport(report: BaselineReport): { lines: string[]; diff: ReportDiff | null } {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(join(FIXTURE_DIR, 'manifest.json'), `${JSON.stringify(sampleManifest, null, 2)}\n`);
  writeFileSync(join(FIXTURE_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

  const goldenPath = join(FIXTURE_DIR, 'report.golden.json');
  const hadGolden = existsSync(goldenPath);
  if (!hadGolden || process.env.BASELINE_UPDATE) {
    writeFileSync(goldenPath, `${JSON.stringify(report, null, 2)}\n`);
    return {
      lines: [hadGolden ? 'golden baseline updated' : 'golden baseline created'],
      diff: null,
    };
  }
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as BaselineReport;
  const diff = compareReports(golden, report);
  return { lines: describeDiff(diff).split('\n'), diff };
}

describe('OOXML round-trip baseline (generated + external samples)', () => {
  it('builds the planned sample set with unique ids', () => {
    expect(slideSamples).toHaveLength(SAMPLE_COUNTS.slide);
    expect(sheetSamples).toHaveLength(SAMPLE_COUNTS.sheet);
    expect(docSamples).toHaveLength(SAMPLE_COUNTS.docx);
    expect(externalDocSamples).toHaveLength(SAMPLE_COUNTS.externalDocx);
    const ids = sampleManifest.map((sample) => sample.id);
    expect(new Set(ids).size).toBe(ids.length);
    // 总数由分组数量派生：样例随能力扩展（S9 加页眉页脚、SH7 加图片），写死数字会立刻过期
    expect(sampleManifest).toHaveLength(
      SAMPLE_COUNTS.slide + SAMPLE_COUNTS.sheet + SAMPLE_COUNTS.docx + SAMPLE_COUNTS.externalDocx,
    );
  });

  /**
   * A replaced / re-exported binary must not silently invalidate its declared part list: the
   * manifest is only trustworthy if `expectedParts` still describes the bytes on disk. This also
   * asserts the four office-suite families required by plan §4.2 are actually represented.
   */
  it('keeps external sample registrations in sync with the checked-in OOXML bytes (P0-1)', async () => {
    const families = new Set<string>();
    for (const sample of externalDocSamples) {
      const path = join(process.cwd(), sample.path);
      expect(existsSync(path), `${sample.id}: missing ${sample.path}`).toBe(true);
      const bytes = new Uint8Array(readFileSync(path));
      const parts = await docxPartFacts(bytes);
      const present = Object.entries(parts)
        .filter(([, count]) => count > 0)
        .map(([name]) => name)
        .sort();
      expect(present, `${sample.id}: expectedParts no longer matches the file`).toEqual(
        [...sample.expectedParts].sort(),
      );
      if (sample.producerFamily !== 'other') families.add(sample.producerFamily);
    }
    expect([...families].sort()).toEqual([...EXTERNAL_PRODUCER_FAMILIES].sort());
  });

  it('exports and re-imports every sample without losing the document', async () => {
    const results: SampleResult[] = [];
    for (const sample of slideSamples) results.push(await runSlide(sample));
    for (const sample of sheetSamples) results.push(await runSheet(sample));
    for (const sample of docSamples) results.push(await runDoc(sample));
    for (const sample of externalDocSamples) results.push(await runExternalDoc(sample));

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
      externalSamples: externalDocSamples.length,
      externalProducers: EXTERNAL_PRODUCER_FAMILIES.filter((family) =>
        externalDocSamples.some((sample) => sample.producerFamily === family),
      ),
      samples: results,
    };
    (globalThis as { __baselineReport?: BaselineReport }).__baselineReport = report;
  }, 180_000);

  it('gates the golden baseline when BASELINE_REPORT is set (P0-1)', () => {
    if (!process.env.BASELINE_REPORT) return;
    const report = (globalThis as { __baselineReport?: BaselineReport }).__baselineReport;
    expect(report).toBeDefined();
    if (!report) return;
    const { lines, diff } = writeReport(report);
    for (const line of lines) console.log(`[baseline] ${line}`);
    const external = report.externalSamples ?? 0;
    const producers = report.externalProducers ?? [];
    console.log(`[baseline] external samples: ${external} / ${REQUIRED_EXTERNAL_SAMPLES}`);
    console.log(
      `[baseline] producer families: ${producers.length} / ${REQUIRED_EXTERNAL_PRODUCERS} (${producers.join(', ')})`,
    );
    // 样例数会随能力扩展（S9 加页眉页脚、SH7 加图片、P0-1 加真实样本），断言 manifest 而不是写死数字
    expect(report.total).toBe(sampleManifest.length);
    if (!diff) return; // golden created / explicitly updated
    const blockers = [...blockingDrift(diff)];
    if (process.env.BASELINE_REQUIRE_COVERAGE === '1') {
      if (external < REQUIRED_EXTERNAL_SAMPLES) {
        blockers.push(`external sample coverage: ${external} / ${REQUIRED_EXTERNAL_SAMPLES}`);
      }
      if (producers.length < REQUIRED_EXTERNAL_PRODUCERS) {
        blockers.push(
          `external producer coverage: ${producers.length} / ${REQUIRED_EXTERNAL_PRODUCERS} (${producers.join(', ')})`,
        );
      }
    }
    if (process.env.BASELINE_INFORMATIONAL === '1') {
      console.log(
        `[baseline] informational mode: ${blockers.length} blocker(s) reported, not failing`,
      );
      return;
    }
    expect(blockers).toEqual([]);
  });
});
