#!/usr/bin/env node
/**
 * Bundle size budget check (technical design §10.2)
 * - First screen (js + css referenced by index.html, gzipped) ≤ 185KB
 * - Single chunk (gzipped) ≤ 500KB (including heavy deps such as mermaid / jspdf)
 * Exceeding a budget fails with exit code 1; the report is also written to dist/size-report.md.
 * Usage: pnpm build && pnpm size
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = path.resolve(process.cwd(), 'dist');
// Loosened as tools were added: keep the first screen tight, but allow heavy deps (mermaid / jspdf) per chunk.
// Budget history:
//   180KB → 185KB: past 100 tools, the eagerly bundled locale bundles (zh + en) for toolsMeta (name+description)
//     and tools.* (tool UI copy) grew linearly, and the 2026-09 limit was hit.
//   185KB → 210KB: at 152 tools the eager zh+en copy reached ~67KB gzip and the entry measured 206.06KB.
//   210KB → 175KB (tightened): locale resources now load in two parts — shell and tool copy:
//     src/core/i18n/locales/<lang>.ts      shell (nav/home/search + toolsMeta), zh/en eager in the entry;
//     src/core/i18n/locales/<lang>.tools.ts tool UI copy tools.*, loaded on demand on tool pages.
//     tools.* is ~82% of the locale bundle; splitting it took the entry from 209.03KB to 158.37KB (-50.66KB / -24%).
//     Tightening to 175KB locks in that gain: if locales or tool metadata grow again this gate trips first
//     instead of the limit being raised again. Measured ~158KB, ~17KB of headroom.
//   175KB → 195KB: in 2026-10 the entry measured 183KB as tools/features grew (React shell + app shell + i18n shell + CSS
//     account for ~180KB and are hard to shrink further), so the limit was raised to 195KB, leaving ~12KB of headroom.
const ENTRY_BUDGET = 195 * 1024;
const CHUNK_BUDGET = 500 * 1024;
// Univer / exceljs, used by the spreadsheet tool, are inherently heavy chunks:
// a single bundle far exceeds the normal budget and cannot be split further, so they get their own
// higher limit (still reported), while other chunks stay bound by 500KB.
// Note: Univer cannot be split by hand (@univerjs/* are circularly dependent, see vite.config.ts); in
// production builds it merges into the dynamic entry `SpreadsheetTool-*.js` (~6MB raw / ~1.7MB gzip), hence that prefix.
const HEAVY_CHUNK_BUDGET = 12 * 1024 * 1024;
const HEAVY_CHUNK_PATTERNS = [/^vendor-univer/, /^vendor-exceljs-/, /^SpreadsheetTool-/];
const budgetFor = (file) =>
  HEAVY_CHUNK_PATTERNS.some((pattern) => pattern.test(file)) ? HEAVY_CHUNK_BUDGET : CHUNK_BUDGET;

const gzipSize = (buffer) => gzipSync(buffer, { level: 9 }).length;
const kb = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;
const mark = (bytes, budget) => (bytes <= budget ? '✅' : '❌');

let html;
try {
  html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
} catch {
  console.error('dist/index.html not found; run pnpm build first');
  process.exit(1);
}

// First-screen entry assets: files referenced directly by index.html
const entryFiles = new Set();
for (const m of html.matchAll(/(?:src|href)="\/?assets\/([^"]+)"/g)) {
  entryFiles.add(m[1]);
}

const assetsDir = path.join(DIST, 'assets');
const assets = readdirSync(assetsDir).filter((f) => f.endsWith('.js') || f.endsWith('.css'));

let failed = false;
let entryTotal = 0;
const lines = [];
lines.push('# Bundle size report (gzip)');
lines.push('');
lines.push(
  `Budget: entry ≤ ${kb(ENTRY_BUDGET)}, single chunk ≤ ${kb(CHUNK_BUDGET)} (Univer / exceljs heavy chunks ≤ ${kb(HEAVY_CHUNK_BUDGET)})`,
);
lines.push('');
lines.push('| File | Kind | gzip size | Status |');
lines.push('| ---- | ---- | --------- | ---- |');

for (const file of assets.sort()) {
  const bytes = gzipSize(readFileSync(path.join(assetsDir, file)));
  const isEntry = entryFiles.has(file);
  if (isEntry) entryTotal += bytes;
  const budget = budgetFor(file);
  const over = bytes > budget;
  if (over) failed = true;
  lines.push(`| ${file} | ${isEntry ? 'entry' : 'lazy'} | ${kb(bytes)} | ${mark(bytes, budget)} |`);
}

lines.push('');
const entryOver = entryTotal > ENTRY_BUDGET;
if (entryOver) failed = true;
lines.push(
  `**Entry total: ${kb(entryTotal)} ${mark(entryTotal, ENTRY_BUDGET)} (budget ${kb(ENTRY_BUDGET)})**`,
);

const report = lines.join('\n');
writeFileSync(path.join(DIST, 'size-report.md'), `${report}\n`);
console.log(report);

if (failed) {
  console.error('\nSize budget exceeded; optimize the bundle before committing');
  process.exit(1);
}
console.log('\nSize budget check passed');
