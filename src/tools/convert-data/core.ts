import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { ToolResult } from '@/core/types';

/**
 * YAML ⇄ JSON ⇄ TOML conversion (Tasks T32):
 * A JS value is the intermediate representation, so any two formats convert directly.
 * Note: TOML has no top-level arrays or scalars, so such input reports STRINGIFY when serialized.
 * Error codes are decoupled from copy: core returns language-neutral codes that the UI translates via i18n (T29 convention).
 */

export type DataFormat = 'yaml' | 'json' | 'toml';
export type ConvertErrorCode = 'EMPTY' | 'PARSE' | 'STRINGIFY';

export const FORMATS: DataFormat[] = ['yaml', 'json', 'toml'];

/** Text → JS value; a syntax error returns PARSE */
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

/** JS value → text; unrepresentable structures (e.g. a top-level TOML array) return STRINGIFY */
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

/** Convert between any two formats; empty input returns EMPTY */
export function convert(text: string, from: DataFormat, to: DataFormat): ToolResult<string> {
  if (!text.trim()) return { ok: false, error: 'EMPTY' };
  const parsed = parseData(text, from);
  if (!parsed.ok) return parsed;
  return stringifyData(parsed.value, to);
}
