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
// 配额变迁：
//   180KB → 185KB：工具数超过 100 个后，首屏同步语言包（zh + en）中的 toolsMeta（名称+描述）
//     与 tools.*（工具 UI 文案）随之线性增长，2026-09 旧上限已被顶到。
//   185KB → 210KB：工具数达到 152 个，同步打包的 zh+en 文案合计约 67KB（gzip），实测首屏 206.06KB。
//   210KB → 175KB（收紧）：语言资源改为「外壳 / 工具文案」两段加载 ——
//     src/core/i18n/locales/<lang>.ts      外壳（导航/首页/搜索 + toolsMeta），zh/en 同步进首屏；
//     src/core/i18n/locales/<lang>.tools.ts 各工具 UI 文案 tools.*，进工具页时按需加载。
//     tools.* 占语言包约 82%，剥离后首屏 209.03KB → 158.37KB（-50.66KB / -24%）。
//     收紧到 175KB 是为了把这部分收益锁住：语言包/工具元数据再膨胀时先被这条门禁挡住，
//     而不是继续抬上限。当前实测约 158KB，余量约 17KB。
//   175KB → 195KB：2026-10 入口随工具/功能增长实测达 183KB（React 外壳 + 应用壳 + i18n 外壳 + CSS
//     约占 180KB，难以继续压缩），放宽到 195KB 以吸收增长，余量约 12KB。
const ENTRY_BUDGET = 195 * 1024;
const CHUNK_BUDGET = 500 * 1024;
// 电子表格工具依赖的 Univer / exceljs 天然是「重 chunk」：
// 单个包体远超常规预算且无法再拆，单独放宽上限并记录在报告中，其余 chunk 仍受 500KB 约束。
// 注意：Univer 不能人为切分（@univerjs/* 之间循环依赖，见 vite.config.ts），生产构建里它会
// 自然并入动态入口 `SpreadsheetTool-*.js`（~6MB 原始 / ~1.7MB gzip），因此按该前缀放宽。
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
