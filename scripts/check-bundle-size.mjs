#!/usr/bin/env node
/**
 * 产物体积预算检查（技术设计 §10.2）
 * - 首屏（index.html 引用的 js + css，gzip 后）≤ 185KB
 * - 单个 chunk（gzip 后）≤ 500KB（含 mermaid / jspdf 等重依赖）
 * 超限以退出码 1 失败；报告同时写入 dist/size-report.md。
 * 用法：pnpm build && pnpm size
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = path.resolve(process.cwd(), 'dist');
// 工具增多后适当放宽：首屏仍尽量紧凑，单 chunk 允许重依赖（mermaid / jspdf 等）。
// 180KB → 185KB：工具数已超过 100 个，首屏语言包里的 toolsMeta（名称+描述）随之增长，
// 2026-09 实测基线 180.04KB 已顶到旧上限，新增幻灯片编辑器再涨约 0.3KB，故上调 5KB。
const ENTRY_BUDGET = 185 * 1024;
const CHUNK_BUDGET = 500 * 1024;
// 电子表格工具依赖的 Univer / exceljs 天然是「重 chunk」：
// 单个包体远超常规预算且无法再拆，单独放宽上限并记录在报告中，其余 chunk 仍受 500KB 约束。
const HEAVY_CHUNK_BUDGET = 2 * 1024 * 1024;
const HEAVY_CHUNK_PATTERNS = [/^vendor-univer-/, /^vendor-exceljs-/];
const budgetFor = (file) =>
  HEAVY_CHUNK_PATTERNS.some((pattern) => pattern.test(file)) ? HEAVY_CHUNK_BUDGET : CHUNK_BUDGET;

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

const report = lines.join('\n');
writeFileSync(path.join(DIST, 'size-report.md'), `${report}\n`);
console.log(report);

if (failed) {
  console.error('\n体积预算超限，请优化后再提交');
  process.exit(1);
}
console.log('\n体积预算检查通过');
