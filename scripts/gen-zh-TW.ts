/**
 * 从简体 zh 生成繁体 zh-TW.ts（OpenCC 风格：chinese-conv tify）。
 * 用法：pnpm exec tsx scripts/gen-zh-TW.ts
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tify } from 'chinese-conv';
import zh from '../src/core/i18n/locales/zh.ts';

function deepTify(value: unknown): unknown {
  if (typeof value === 'string') return tify(value);
  if (Array.isArray(value)) return value.map(deepTify);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepTify(v);
    return out;
  }
  return value;
}

const zhTW = deepTify(zh);

const header = `import type { TranslationResources } from '../types';

/** Traditional Chinese (Taiwan) — generated from zh via chinese-conv tify */
const zhTW = `;

const footer = ` satisfies TranslationResources;

export default zhTW;
`;

const body = JSON.stringify(zhTW, null, 2)
  // JSON uses double quotes; convert to TS-ish by keeping JSON (valid in TS as const object via JSON.parse pattern)
  // Instead emit as TS object literal from JSON — valid: const x = { ... } 
  ;

const file = `${header}${body}${footer}`;
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/core/i18n/locales/zh-TW.ts');
writeFileSync(out, file, 'utf8');
console.log('Wrote', out);
