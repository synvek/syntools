#!/usr/bin/env node
/**
 * 生成拼写检查用的英文词表（public/dict/en-words.txt.gz）。
 *
 * 词表以「运行时按需 fetch 的静态资源」形式提供，不进打包产物、不进首屏：
 * 只有用户第一次开启拼写检查时才会下载并解压（gzip + DecompressionStream）。
 *
 * 用法：
 *   node scripts/build-wordlist.mjs                     # 默认读 /usr/share/dict/web2
 *   WORDLIST_SOURCE=./my-words.txt node scripts/build-wordlist.mjs
 *
 * 默认词源为 Webster's Second International（1934 年版权已失效，属公有领域），
 * 过滤规则：仅保留纯小写字母、长度 2–20 的单词，去重后按字典序输出。
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync, constants } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = process.env.WORDLIST_SOURCE ?? '/usr/share/dict/web2';
const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/dict/en-words.txt.gz');
const MIN_LENGTH = 2;
const MAX_LENGTH = 20;

function main() {
  let raw;
  try {
    raw = readFileSync(SOURCE, 'utf8');
  } catch (error) {
    console.error(`读取词源失败：${SOURCE}`);
    console.error('可通过 WORDLIST_SOURCE 指定自己的词表文件（每行一个单词）。');
    console.error(String(error));
    process.exitCode = 1;
    return;
  }

  const words = new Set();
  for (const line of raw.split('\n')) {
    const word = line.trim().toLowerCase();
    if (word.length < MIN_LENGTH || word.length > MAX_LENGTH) continue;
    if (!/^[a-z]+$/.test(word)) continue;
    words.add(word);
  }

  const sorted = [...words].sort();
  const text = `${sorted.join('\n')}\n`;
  const gz = gzipSync(Buffer.from(text, 'utf8'), { level: constants.Z_BEST_COMPRESSION });

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, gz);

  const kb = (value) => `${(value / 1024).toFixed(1)} KB`;
  console.log(`词源：${SOURCE}`);
  console.log(`词表：${sorted.length} 个单词`);
  console.log(`产物：${OUTPUT}（原始 ${kb(Buffer.byteLength(text))} → gzip ${kb(gz.length)}）`);
}

main();
