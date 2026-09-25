#!/usr/bin/env node
/**
 * 批量注入工具文案到 9 个 locale 文件（避免逐个手工编辑）。
 *
 * 输入 JSON 结构（scripts/tool-locales/*.json）：
 * {
 *   "categories": { "file": { "zh": "文件工具", "en": "Files", ... } },
 *   "tools": {
 *     "ip-calc": {
 *       "meta": { "zh": { "name": "...", "description": "..." }, ... 9 语 },
 *       "ui":   { "zh": { "input": "输入", "fields.network": "网络地址" }, ... 9 语 }
 *     }
 *   }
 * }
 *
 * - meta → 注入 toolsMeta.<id>.{name,description}
 * - ui   → 注入 tools.<id>.*（支持 a.b.c 点号路径，自动展开为嵌套对象）
 * - categories → 注入 categories.<id>
 *
 * 行为：
 * - 新工具 id → 整块插入（沿用旧行为）。
 * - 已存在的 id → **合并模式**：只补充缺失的一级键；`meta` 的 name/description 会被刷新。
 *   这样可以为已上线的工具增补文案，而不会覆盖既有翻译。
 *
 * 注入后需运行 prettier 统一格式。
 * 用法：node scripts/inject-tool-locales.mjs scripts/tool-locales/xxx.json [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const LANGS = ['zh', 'en', 'zh-TW', 'ja', 'fr', 'de', 'it', 'es', 'pt'];
const LOCALE_DIR = path.resolve(process.cwd(), 'src/core/i18n/locales');

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const quoteKey = (k) => (IDENT.test(k) ? k : `'${String(k).replace(/'/g, "\\'")}'`);
const quoteStr = (s) =>
  `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

/** 点号路径展开为嵌套对象 */
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
  if (idx < 0) throw new Error(`未找到注入锚点：${anchor}`);
  return idx;
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 定位 `'<id>': {` 对象块（从 from 行开始搜索）。
 * 通过匹配「同级缩进的 `},` 收尾行」确定边界，避免解析字符串中的花括号。
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

/** 收集对象块内的一级键名 */
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
 * 合并一批键到已存在的对象块。
 * - 缺失的一级键 → 插入；
 * - `overwrite` 中的键 → 覆盖既有行（用于刷新 meta）。
 * 返回是否发生改动。
 */
function mergeObject(lines, range, obj, overwrite = []) {
  const existing = topLevelKeys(lines, range);
  const keyIndent = range.indent.length + 2;
  const inserts = [];
  let index = range.end;

  // 先按原位置覆盖，避免插入导致的位移
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
    console.error('用法：node scripts/inject-tool-locales.mjs <batch.json> [...]');
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
        // 仅在 categories 块内做去重判断，避免与 common.file 等同名键误判
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
          // 1) meta：已存在则刷新 name/description，否则整块插入
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

          // 2) ui：已存在则合并缺失键，否则整块插入
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
        console.log(`已注入 ${lang}.ts`);
      }
    }
  }
}

main();
