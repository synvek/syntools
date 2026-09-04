import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { ToolResult } from '@/core/types';

/**
 * YAML ⇄ JSON ⇄ TOML 互转（Tasks T32）：
 * 以 JS 值为中间态，任意两种格式间互转。
 * 注意：TOML 不支持顶层数组/标量，此类输入序列化时报 STRINGIFY。
 * 错误码与文案解耦：core 返回语言无关错误码，UI 层经 i18n 翻译（T29 约定）。
 */

export type DataFormat = 'yaml' | 'json' | 'toml';
export type ConvertErrorCode = 'EMPTY' | 'PARSE' | 'STRINGIFY';

export const FORMATS: DataFormat[] = ['yaml', 'json', 'toml'];

/** 文本 → JS 值；语法错误返回 PARSE */
export function parseData(text: string, format: DataFormat): ToolResult<unknown> {
  try {
    switch (format) {
      case 'yaml':
        return { ok: true, value: parseYaml(text) };
      case 'json':
        return { ok: true, value: JSON.parse(text) };
      case 'toml':
        return { ok: true, value: parseToml(text) };
      default:
        return { ok: false, error: 'PARSE' };
    }
  } catch {
    return { ok: false, error: 'PARSE' };
  }
}

/** JS 值 → 文本；不可序列化的结构（如 TOML 顶层数组）返回 STRINGIFY */
export function stringifyData(value: unknown, format: DataFormat): ToolResult<string> {
  try {
    switch (format) {
      case 'yaml':
        return { ok: true, value: stringifyYaml(value) };
      case 'json':
        return { ok: true, value: JSON.stringify(value, null, 2) };
      case 'toml':
        return { ok: true, value: stringifyToml(value) };
      default:
        return { ok: false, error: 'STRINGIFY' };
    }
  } catch {
    return { ok: false, error: 'STRINGIFY' };
  }
}

/** 任意格式互转；空输入返回 EMPTY */
export function convert(text: string, from: DataFormat, to: DataFormat): ToolResult<string> {
  if (!text.trim()) return { ok: false, error: 'EMPTY' };
  const parsed = parseData(text, from);
  if (!parsed.ok) return parsed;
  return stringifyData(parsed.value, to);
}
