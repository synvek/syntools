#!/usr/bin/env node
/**
 * Builds the English word list used by the spell checker (public/dict/en-words.txt.gz).
 *
 * The list ships as a static asset fetched on demand: it is not part of the bundle
 * or the first paint. It is only downloaded and inflated (gzip + DecompressionStream)
 * the first time a user enables spell checking.
 *
 * Usage:
 *   node scripts/build-wordlist.mjs                     # reads /usr/share/dict/web2 by default
 *   WORDLIST_SOURCE=./my-words.txt node scripts/build-wordlist.mjs
 *
 * The default source is Webster's Second International (copyright expired in 1934,
 * public domain). Filtering: keep lowercase-only words of length 2–20, deduplicate,
 * then emit in dictionary order.
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
    console.error(`Failed to read the word source: ${SOURCE}`);
    console.error('Use WORDLIST_SOURCE to point at your own word list (one word per line).');
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
  console.log(`Source: ${SOURCE}`);
  console.log(`Word list: ${sorted.length} words`);
  console.log(`Output: ${OUTPUT} (raw ${kb(Buffer.byteLength(text))} → gzip ${kb(gz.length)})`);
}

main();
