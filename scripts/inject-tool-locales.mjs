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
 * 已存在同名键则跳过（可重复执行）。注入后需运行 prettier 统一格式。
 *
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
      let content = readFileSync(localePath, 'utf8');
      let lines = content.split('\n');
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
          content = lines.join('\n');
          changed = true;
        }
      }

      if (data.tools) {
        for (const [id, entry] of Object.entries(data.tools)) {
          if (content.includes(`'${id}': {`)) continue;

          if (entry.meta?.[lang]) {
            const anchorIdx = findAnchor(lines, 'toolsMeta: {');
            const block = serialize({ [id]: entry.meta[lang] }, 4);
            lines.splice(anchorIdx + 1, 0, ...block);
            content = lines.join('\n');
            changed = true;
          }

          if (entry.ui?.[lang]) {
            const anchorIdx = findAnchor(lines, 'tools: {');
            const block = serialize({ [id]: nest(entry.ui[lang]) }, 4);
            lines.splice(anchorIdx + 1, 0, ...block);
            content = lines.join('\n');
            changed = true;
          }
        }
      }

      if (changed) {
        writeFileSync(localePath, content);
        console.log(`已注入 ${lang}.ts`);
      }
    }
  }
}

main();
