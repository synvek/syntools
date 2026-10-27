#!/usr/bin/env node
/**
 * Injects tool copy into the 9 locale files in bulk (instead of editing each one by hand).
 *
 * Input JSON shape (scripts/tool-locales/*.json):
 * {
 *   "categories": { "file": { "zh": "文件工具", "en": "Files", ... } },
 *   "tools": {
 *     "ip-calc": {
 *       "meta": { "zh": { "name": "...", "description": "..." }, ... all 9 languages },
 *       "ui":   { "zh": { "input": "输入", "fields.network": "网络地址" }, ... all 9 languages }
 *     }
 *   }
 * }
 *
 * - meta → writes toolsMeta.<id>.{name,description}
 * - ui   → writes tools.<id>.* (a.b.c dotted paths are expanded into nested objects)
 * - categories → writes categories.<id>
 *
 * Behaviour:
 * - New tool id → insert the whole block (as before).
 * - Existing id → **merge mode**: only add missing top-level keys; `meta` name/description are refreshed.
 *   This lets shipped tools gain copy without overwriting existing translations.
 *
 * Run prettier afterwards to normalize formatting.
 * Usage: node scripts/inject-tool-locales.mjs scripts/tool-locales/xxx.json [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const LANGS = ['zh', 'en', 'zh-TW', 'ja', 'fr', 'de', 'it', 'es', 'pt'];
const LOCALE_DIR = path.resolve(process.cwd(), 'src/core/i18n/locales');

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const quoteKey = (k) => (IDENT.test(k) ? k : `'${String(k).replace(/'/g, "\\'")}'`);
const quoteStr = (s) =>
  `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

/** Expands dotted paths into nested objects */
function nest(flat) {
  const root = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      cur[parts[i]] = cur[parts[i]] ?? {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return root;
}

function serialize(obj, indent) {
  const pad = ' '.repeat(indent);
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object') {
      lines.push(`${pad}${quoteKey(key)}: {`);
      lines.push(...serialize(value, indent + 2));
      lines.push(`${pad}},`);
    } else {
      lines.push(`${pad}${quoteKey(key)}: ${quoteStr(value)},`);
    }
  }
  return lines;
}

function findAnchor(lines, anchor) {
  const idx = lines.findIndex((l) => l.trim() === anchor);
  if (idx < 0) throw new Error(`Injection anchor not found: ${anchor}`);
  return idx;
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Locates the `'<id>': {` object block (searching from line `from`).
 * The bounds are found by matching the closing `},` at the same indent, so braces inside
 * strings are never parsed.
 */
function findObjectRange(lines, id, from = 0) {
  const openRe = new RegExp(`^(\\s*)'?${escapeRegExp(id)}'?: \\{$`);
  for (let i = from; i < lines.length; i += 1) {
    const m = lines[i].match(openRe);
    if (!m) continue;
    const indent = m[1];
    const closeLine = `${indent}},`;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j] === closeLine) return { start: i, end: j, indent };
    }
  }
  return null;
}

/** Collects the top-level key names inside an object block */
function topLevelKeys(lines, range) {
  const keys = new Set();
  const keyIndent = range.indent.length + 2;
  for (let i = range.start + 1; i < range.end; i += 1) {
    const line = lines[i];
    const lead = (line.match(/^(\s*)/) ?? ['', ''])[1].length;
    if (lead !== keyIndent) continue;
    const m = line.match(/^(?:\s*)(?:'([^']+)'|([A-Za-z_$][\w$]*)): /);
    if (m) keys.add(m[1] ?? m[2]);
  }
  return keys;
}

/**
 * Merges a set of keys into an existing object block.
 * - Missing top-level keys → inserted;
 * - Keys in `overwrite` → replace the existing line (used to refresh meta).
 * Returns whether anything changed.
 */
function mergeObject(lines, range, obj, overwrite = []) {
  const existing = topLevelKeys(lines, range);
  const keyIndent = range.indent.length + 2;
  const inserts = [];
  let index = range.end;

  // Overwrite in place first, so later inserts do not shift positions
  for (const key of overwrite) {
    if (!(key in obj) || !existing.has(key)) continue;
    const serialized = serialize({ [key]: obj[key] }, keyIndent)[0];
    for (let i = range.start + 1; i < index; i += 1) {
      const lead = (lines[i].match(/^(\s*)/) ?? ['', ''])[1].length;
      if (lead !== keyIndent) continue;
      const m = lines[i].match(/^(?:\s*)(?:'([^']+)'|([A-Za-z_$][\w$]*)): /);
      if ((m?.[1] ?? m?.[2]) === key) {
        lines[i] = serialized;
        break;
      }
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    if (overwrite.includes(key)) continue;
    if (existing.has(key)) continue;
    if (value && typeof value === 'object') {
      inserts.push(...serialize({ [key]: value }, keyIndent));
    } else {
      inserts.push(...serialize({ [key]: value }, keyIndent));
    }
  }

  if (inserts.length === 0) return false;
  lines.splice(range.start + 1, 0, ...inserts);
  return true;
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: node scripts/inject-tool-locales.mjs <batch.json> [...]');
    process.exit(1);
  }

  for (const file of files) {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    for (const lang of LANGS) {
      const localePath = path.join(LOCALE_DIR, `${lang}.ts`);
      const content = readFileSync(localePath, 'utf8');
      const lines = content.split('\n');
      let changed = false;

      if (data.categories) {
        const anchor = findAnchor(lines, 'categories: {');
        // Only dedupe inside the categories block, so keys like common.file are not mistaken for it
        let end = anchor + 1;
        while (end < lines.length && lines[end].trim() !== '},') end += 1;
        const section = lines.slice(anchor + 1, end).join('\n');
        const block = [];
        for (const [id, byLang] of Object.entries(data.categories)) {
          const value = byLang[lang] ?? byLang.en;
          if (!value) continue;
          if (section.includes(`${quoteKey(id)}:`)) continue;
          block.push(`    ${quoteKey(id)}: ${quoteStr(value)},`);
        }
        if (block.length) {
          lines.splice(anchor + 1, 0, ...block);
          changed = true;
        }
      }

      if (data.tools) {
        for (const [id, entry] of Object.entries(data.tools)) {
          // 1) meta: refresh name/description when present, otherwise insert the whole block
          if (entry.meta?.[lang]) {
            const metaAnchor = findAnchor(lines, 'toolsMeta: {');
            const range = findObjectRange(lines, id, metaAnchor);
            if (range) {
              if (mergeObject(lines, range, entry.meta[lang], ['name', 'description']))
                changed = true;
            } else {
              lines.splice(metaAnchor + 1, 0, ...serialize({ [id]: entry.meta[lang] }, 4));
              changed = true;
            }
          }

          // 2) ui: merge missing keys when present, otherwise insert the whole block
          if (entry.ui?.[lang]) {
            const toolsAnchor = findAnchor(lines, 'tools: {');
            const range = findObjectRange(lines, id, toolsAnchor);
            if (range) {
              if (mergeObject(lines, range, nest(entry.ui[lang]))) changed = true;
            } else {
              lines.splice(toolsAnchor + 1, 0, ...serialize({ [id]: nest(entry.ui[lang]) }, 4));
              changed = true;
            }
          }
        }
      }

      if (changed) {
        writeFileSync(localePath, lines.join('\n'));
        console.log(`Injected into ${lang}.ts`);
      }
    }
  }
}

main();
