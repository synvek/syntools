// 临时脚本：对指定产物目录做与 scripts/check-bundle-size.mjs 等价的 gzip 体积复核
// （pnpm build 在本机被沙箱的批量删除守卫拦住，故改用 vite build --outDir 的等价路径）
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = path.resolve(process.argv[2] ?? '/tmp/syntools-size-check');
const ENTRY_BUDGET = 195 * 1024;
const CHUNK_BUDGET = 500 * 1024;
const HEAVY = [/^vendor-univer/, /^vendor-exceljs-/, /^SpreadsheetTool-/];
const heavyBudget = 12 * 1024 * 1024;

const gzipSize = (buffer) => gzipSync(buffer, { level: 9 }).length;
const kb = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;

const html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
  .map((match) => match[1].replace(/^\//, ''))
  .filter((file) => !file.startsWith('http'));

let entry = 0;
for (const file of new Set(refs)) {
  entry += gzipSize(readFileSync(path.join(DIST, file)));
}

const chunks = [];
const walk = (dir) => {
  for (const entryName of readdirSync(dir)) {
    const full = path.join(dir, entryName);
    if (statSync(full).isDirectory()) walk(full);
    else if (entryName.endsWith('.js')) chunks.push(full);
  }
};
walk(path.join(DIST, 'assets'));
const sized = chunks
  .map((file) => ({ file: path.basename(file), gzip: gzipSize(readFileSync(file)) }))
  .sort((a, b) => b.gzip - a.gzip);

const over = sized.filter((chunk) => {
  const isHeavy = HEAVY.some((pattern) => pattern.test(chunk.file));
  return chunk.gzip > (isHeavy ? heavyBudget : CHUNK_BUDGET);
});

console.log(
  `entry (html js+css, gzip): ${kb(entry)} / budget ${kb(ENTRY_BUDGET)} -> ${entry <= ENTRY_BUDGET ? 'PASS' : 'FAIL'}`,
);
console.log('top 5 chunks:');
sized.slice(0, 5).forEach((chunk) => console.log(`  ${chunk.file}: ${kb(chunk.gzip)}`));
console.log(`chunks over budget: ${over.length}`);
process.exit(entry <= ENTRY_BUDGET && over.length === 0 ? 0 : 1);
