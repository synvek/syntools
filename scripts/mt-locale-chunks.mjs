#!/usr/bin/env node
/**
 * Fast MyMemory batch translator for locale chunks.
 * Collects unique strings, batches by newlines, applies to all keys.
 *
 * Usage:
 *   node scripts/mt-locale-chunks.mjs ja fr de
 *   node scripts/mt-locale-chunks.mjs ja --only tools,toolsMeta
 *   node scripts/mt-locale-chunks.mjs ja --skip-existing
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHUNKS_DIR = path.join(ROOT, 'scripts/locale-chunks');
const CACHE_DIR = path.join(ROOT, 'scripts/.mt-cache');

const KEY_ORDER = [
  'app',
  'header',
  'sidebar',
  'home',
  'search',
  'categories',
  'common',
  'io',
  'file',
  'tool',
  'notFound',
  'pdf',
  'toolsMeta',
  'tools',
];

const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const onlyKeys = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null;
const skipExisting = args.includes('--skip-existing');
const langs = args.filter(
  (a, i) => !a.startsWith('--') && !(onlyIdx >= 0 && (i === onlyIdx || i === onlyIdx + 1)),
);

if (langs.length === 0) {
  console.error('Usage: node scripts/mt-locale-chunks.mjs <lang...> [--only key,key] [--skip-existing]');
  process.exit(1);
}

mkdirSync(CACHE_DIR, { recursive: true });

function protect(text) {
  const tokens = [];
  const push = (m) => {
    const i = tokens.length;
    tokens.push(m);
    return `ZZPH${i}ZZ`;
  };
  const out = text
    .replace(/\{\{[^{}]+\}\}/g, push)
    .replace(/<\/?\d+>/g, push)
    .replace(/SynTools/g, push);
  return { out, tokens };
}

function restore(text, tokens) {
  return text
    .replace(/\s*ZZ\s*PH\s*(\d+)\s*ZZ\s*/gi, (_, n) => tokens[Number(n)] ?? _)
    .replace(/ZZPH(\d+)ZZ/gi, (_, n) => tokens[Number(n)] ?? _);
}

function loadCache(lang) {
  const p = path.join(CACHE_DIR, `${lang}.json`);
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, 'utf8'));
}

function saveCache(lang, cache) {
  writeFileSync(path.join(CACHE_DIR, `${lang}.json`), JSON.stringify(cache), 'utf8');
}

function collectLeaves(value, set = new Set()) {
  if (typeof value === 'string') set.add(value);
  else if (Array.isArray(value)) value.forEach((v) => collectLeaves(v, set));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectLeaves(v, set));
  return set;
}

function applyMap(value, map) {
  if (typeof value === 'string') return map[value] ?? value;
  if (Array.isArray(value)) return value.map((v) => applyMap(v, map));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = applyMap(v, map);
    return out;
  }
  return value;
}

function shouldSkipMt(text) {
  if (!/[A-Za-z\u00C0-\u024F]/.test(text)) return true;
  if (
    /^(PDF|JSON|JWT|UUID|CIDR|EXIF|TOTP|HMAC|SHA-?\d+|AES-GCM|Base64|XML|CSV|YAML|HTML|CSS|SQL|QR|BMI|MBTI|SVG|PNG|ICO|GIF|MD5|X\.509)$/i.test(
      text.trim(),
    )
  )
    return true;
  return false;
}

/** Build batches of protected strings, ~900 chars / ≤12 lines */
function buildBatches(texts) {
  const batches = [];
  let cur = [];
  let curLen = 0;
  for (const t of texts) {
    const { out } = protect(t);
    const add = out.length + 1;
    if (cur.length && (curLen + add > 900 || cur.length >= 12)) {
      batches.push(cur);
      cur = [];
      curLen = 0;
    }
    cur.push(t);
    curLen += add;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

async function translateBatch(texts, lang) {
  const protectedForms = texts.map((t) => protect(t));
  const q = protectedForms.map((p) => p.out).join('\n');
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', q);
  url.searchParams.set('langpair', `en|${lang}`);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url);
      const data = JSON.parse(Buffer.from(await res.arrayBuffer()).toString('utf8'));
      const raw = data.responseData?.translatedText;
      if (data.responseStatus === 200 && raw && raw !== 'INVALID EMAIL PROVIDED') {
        const lines = raw.split(/\r?\n/);
        // If MT collapsed lines, fall back to one-by-one for this batch
        if (lines.length !== texts.length) {
          console.warn(`  batch size mismatch (${lines.length}≠${texts.length}), falling back`);
          const out = [];
          for (let i = 0; i < texts.length; i++) {
            const one = await translateBatch([texts[i]], lang);
            out.push(one[0]);
            await sleep(100);
          }
          return out;
        }
        return lines.map((line, i) => restore(line.trim(), protectedForms[i].tokens));
      }
      if (data.quotaFinished) throw new Error('MyMemory quota finished');
    } catch (e) {
      if (String(e.message).includes('quota')) throw e;
    }
    await sleep(600 * (attempt + 1));
  }
  // last resort: return protected originals restored (i.e. English)
  return texts;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fillCache(lang, strings) {
  const cache = loadCache(lang);
  const need = [];
  for (const s of strings) {
    if (Object.prototype.hasOwnProperty.call(cache, s)) continue;
    if (shouldSkipMt(s)) {
      cache[s] = s;
      continue;
    }
    need.push(s);
  }
  console.log(`  unique=${strings.size}, cached=${strings.size - need.length}, todo=${need.length}`);
  const batches = buildBatches(need);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const translated = await translateBatch(batch, lang);
    for (let j = 0; j < batch.length; j++) cache[batch[j]] = translated[j];
    if ((i + 1) % 5 === 0 || i === batches.length - 1) {
      saveCache(lang, cache);
      console.log(`  batch ${i + 1}/${batches.length}`);
    }
    await sleep(150);
  }
  saveCache(lang, cache);
  return cache;
}

async function translateLang(lang) {
  const keys = onlyKeys ?? KEY_ORDER;
  console.log(`\n=== ${lang} (${keys.join(', ')}) ===`);

  const all = new Set();
  const sources = {};
  for (const key of keys) {
    const dest = path.join(CHUNKS_DIR, `${lang}-${key}.json`);
    if (skipExisting && existsSync(dest) && key !== 'tools' && key !== 'toolsMeta') {
      console.log(`  skip existing ${key}`);
      continue;
    }
    const src = path.join(CHUNKS_DIR, `en-${key}.json`);
    if (!existsSync(src)) throw new Error(`Missing ${src}`);
    sources[key] = JSON.parse(readFileSync(src, 'utf8'));
    collectLeaves(sources[key], all);
  }

  const cache = await fillCache(lang, all);

  for (const key of Object.keys(sources)) {
    const translated = applyMap(sources[key], cache);
    const dest = path.join(CHUNKS_DIR, `${lang}-${key}.json`);
    writeFileSync(dest, `${JSON.stringify(translated, null, 2)}\n`, 'utf8');
    console.log(`  wrote ${path.relative(ROOT, dest)}`);
  }
}

for (const lang of langs) await translateLang(lang);
console.log('\nDone.');
