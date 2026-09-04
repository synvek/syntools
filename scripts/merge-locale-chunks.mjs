#!/usr/bin/env node
/**
 * Merge scripts/locale-chunks/{lang}-*.json into src/core/i18n/locales/{lang}.ts
 *
 * Usage:
 *   node scripts/merge-locale-chunks.mjs ja
 *   node scripts/merge-locale-chunks.mjs fr de
 *   node scripts/merge-locale-chunks.mjs --all
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHUNKS_DIR = path.join(ROOT, 'scripts/locale-chunks');
const OUT_DIR = path.join(ROOT, 'src/core/i18n/locales');

/** Top-level key order must match en.ts */
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

const LANG_META = {
  ja: { constName: 'ja', comment: 'Japanese translation resources' },
  fr: { constName: 'fr', comment: 'French translation resources' },
  de: { constName: 'de', comment: 'German translation resources' },
  it: { constName: 'it', comment: 'Italian translation resources' },
  es: { constName: 'es', comment: 'Spanish translation resources' },
  pt: { constName: 'pt', comment: 'Portuguese translation resources' },
  'zh-TW': { constName: 'zhTW', comment: 'Traditional Chinese (Taiwan) translation resources' },
};

function loadChunks(lang) {
  const out = {};
  for (const key of KEY_ORDER) {
    const file = path.join(CHUNKS_DIR, `${lang}-${key}.json`);
    if (!existsSync(file)) {
      throw new Error(`Missing chunk: ${file}`);
    }
    out[key] = JSON.parse(readFileSync(file, 'utf8'));
  }
  return out;
}

function emitTs(lang, resources) {
  const meta = LANG_META[lang];
  if (!meta) throw new Error(`Unknown lang meta for: ${lang}`);
  const body = JSON.stringify(resources, null, 2);
  return `import type { TranslationResources } from '../types';

/** ${meta.comment} */
const ${meta.constName} = ${body} satisfies TranslationResources;

export default ${meta.constName};
`;
}

function mergeOne(lang) {
  const resources = loadChunks(lang);
  const ts = emitTs(lang, resources);
  const outPath = path.join(OUT_DIR, `${lang}.ts`);
  writeFileSync(outPath, ts, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, outPath)}`);
}

function listAvailableLangs() {
  const files = readdirSync(CHUNKS_DIR);
  const langs = new Set();
  for (const f of files) {
    const m = f.match(/^([a-z]{2}(?:-[A-Z]{2})?)-app\.json$/);
    if (m && m[1] !== 'en') langs.add(m[1]);
  }
  return [...langs].sort();
}

const args = process.argv.slice(2);
const langs = args.includes('--all') ? listAvailableLangs() : args;

if (langs.length === 0) {
  console.error('Usage: node scripts/merge-locale-chunks.mjs <lang...> | --all');
  process.exit(1);
}

for (const lang of langs) mergeOne(lang);
