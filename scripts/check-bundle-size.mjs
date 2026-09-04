#!/usr/bin/env node
/**
 * 产物体积预算检查（技术设计 §10.2）
 * - 首屏（index.html 引用的 js + css，gzip 后）≤ 180KB
 * - 单个 chunk（gzip 后）≤ 500KB（含 mermaid / jspdf 等重依赖）
 * 超限以退出码 1 失败；报告同时写入 dist/size-report.md。
 * 用法：pnpm build && pnpm size
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = path.resolve(process.cwd(), 'dist');
// 工具增多后适当放宽：首屏仍尽量紧凑，单 chunk 允许重依赖（mermaid / jspdf 等）
const ENTRY_BUDGET = 180 * 1024;
const CHUNK_BUDGET = 500 * 1024;

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
lines.push(`预算：首屏 ≤ ${kb(ENTRY_BUDGET)}，单 chunk ≤ ${kb(CHUNK_BUDGET)}`);
lines.push('');
lines.push('| 文件 | 类型 | gzip 体积 | 状态 |');
lines.push('| ---- | ---- | --------- | ---- |');

for (const file of assets.sort()) {
  const bytes = gzipSize(readFileSync(path.join(assetsDir, file)));
  const isEntry = entryFiles.has(file);
  if (isEntry) entryTotal += bytes;
  const over = bytes > CHUNK_BUDGET;
  if (over) failed = true;
  lines.push(
    `| ${file} | ${isEntry ? '首屏入口' : '懒加载'} | ${kb(bytes)} | ${mark(bytes, CHUNK_BUDGET)} |`,
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
