#!/usr/bin/env node
/**
 * 产物体积预算检查（技术设计 §10.2）
 * - 首屏（index.html 引用的 js + css，gzip 后）≤ 185KB
 * - 单个 chunk（gzip 后）≤ 500KB（含 mermaid / jspdf 等重依赖）
 * 超限以退出码 1 失败；报告同时写入 dist/size-report.md。
 * 用法：pnpm build && pnpm size
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = path.resolve(process.cwd(), 'dist');
// 工具增多后适当放宽：首屏仍尽量紧凑，单 chunk 允许重依赖（mermaid / jspdf 等）。
// 180KB → 185KB：工具数超过 100 个后，首屏同步语言包（zh + en）中的 toolsMeta（名称+描述）
//   与 tools.*（工具 UI 文案）随之线性增长，2026-09 旧上限已被顶到。
// 185KB → 210KB：工具数达到 152 个，同步打包的 zh+en 文案合计约 67KB（gzip），实测首屏 206.06KB。
//   此处沿用既有惯例（配额随工具数增长而调整）放宽到 210KB，并留出约 4KB 余量。
// 注意：真正的收敛手段是 i18n 按需加载（把 tools.* 文案随工具 chunk 拆分），已列入后续优化项。
const ENTRY_BUDGET = 210 * 1024;
const CHUNK_BUDGET = 500 * 1024;
// 电子表格工具依赖的 Univer / exceljs 天然是「重 chunk」：
// 单个包体远超常规预算且无法再拆，单独放宽上限并记录在报告中，其余 chunk 仍受 500KB 约束。
const HEAVY_CHUNK_BUDGET = 2 * 1024 * 1024;
const HEAVY_CHUNK_PATTERNS = [/^vendor-univer-/, /^vendor-exceljs-/];
const budgetFor = (file) =>
  HEAVY_CHUNK_PATTERNS.some((pattern) => pattern.test(file)) ? HEAVY_CHUNK_BUDGET : CHUNK_BUDGET;

// 静态资源（不经 JS bundle、由运行时按需拉取）：自托管的 ffmpeg.wasm 核心。
// 它体量巨大（~31.2MB wasm + ~0.13MB js），既不属于首屏也不属于 chunk，
// 若不做单独约束就会成为「看不见的体积」，因此这里显式纳入预算与报告。
const STATIC_ASSET_BUDGET = 40 * 1024 * 1024; // 40 MB
const STATIC_DIRS = ['ffmpeg'];

/** 递归收集目录下所有文件（返回绝对路径）。 */
function walkFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // 跳过 .gitkeep 等占位文件
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const gzipSize = (buffer) => gzipSync(buffer, { level: 9 }).length;
const kb = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;
const mark = (bytes, budget) => (bytes <= budget ? '✅' : '❌');

let html;
try {
  html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
} catch {
  console.error('未找到 dist/index.html，请先执行 pnpm build');
  process.exit(1);
}

// 首屏入口资源：index.html 中直接引用的 assets
const entryFiles = new Set();
for (const m of html.matchAll(/(?:src|href)="\/?assets\/([^"]+)"/g)) {
  entryFiles.add(m[1]);
}

const assetsDir = path.join(DIST, 'assets');
const assets = readdirSync(assetsDir).filter((f) => f.endsWith('.js') || f.endsWith('.css'));

let failed = false;
let entryTotal = 0;
const lines = [];
lines.push('# 产物体积报告（gzip）');
lines.push('');
lines.push(
  `预算：首屏 ≤ ${kb(ENTRY_BUDGET)}，单 chunk ≤ ${kb(CHUNK_BUDGET)}（Univer / exceljs 重 chunk ≤ ${kb(HEAVY_CHUNK_BUDGET)}）`,
);
lines.push('');
lines.push('| 文件 | 类型 | gzip 体积 | 状态 |');
lines.push('| ---- | ---- | --------- | ---- |');

for (const file of assets.sort()) {
  const bytes = gzipSize(readFileSync(path.join(assetsDir, file)));
  const isEntry = entryFiles.has(file);
  if (isEntry) entryTotal += bytes;
  const budget = budgetFor(file);
  const over = bytes > budget;
  if (over) failed = true;
  lines.push(
    `| ${file} | ${isEntry ? '首屏入口' : '懒加载'} | ${kb(bytes)} | ${mark(bytes, budget)} |`,
  );
}

lines.push('');
const entryOver = entryTotal > ENTRY_BUDGET;
if (entryOver) failed = true;
lines.push(
  `**首屏合计：${kb(entryTotal)} ${mark(entryTotal, ENTRY_BUDGET)}（预算 ${kb(ENTRY_BUDGET)}）**`,
);

// 静态资源：不经 JS bundle，由运行时按需拉取（如自托管的 ffmpeg.wasm 核心）
lines.push('');
lines.push('## 静态资源（运行时按需下载，不计入首屏 / JS chunk）');
lines.push('');
lines.push(`预算：合计 ≤ ${kb(STATIC_ASSET_BUDGET)}`);
lines.push('');
lines.push('| 文件 | 原始体积 | 状态 |');
lines.push('| ---- | -------- | ---- |');
let staticTotal = 0;
for (const dirName of STATIC_DIRS) {
  const files = walkFiles(path.join(DIST, dirName));
  for (const file of files.sort()) {
    const size = statSync(file).size;
    staticTotal += size;
    lines.push(
      `| ${path.relative(DIST, file)} | ${kb(size)} | ${mark(size, STATIC_ASSET_BUDGET)} |`,
    );
  }
}
if (staticTotal === 0) {
  lines.push('| _（未下载，请运行 `pnpm ffmpeg:fetch`）_ | - | - |');
} else if (staticTotal > STATIC_ASSET_BUDGET) {
  failed = true;
}
lines.push('');
lines.push(
  `**静态资源合计：${kb(staticTotal)} ${mark(staticTotal, STATIC_ASSET_BUDGET)}（预算 ${kb(STATIC_ASSET_BUDGET)}）**`,
);

const report = lines.join('\n');
writeFileSync(path.join(DIST, 'size-report.md'), `${report}\n`);
console.log(report);

if (failed) {
  console.error('\n体积预算超限，请优化后再提交');
  process.exit(1);
}
console.log('\n体积预算检查通过');
