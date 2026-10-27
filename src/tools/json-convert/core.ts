import { stringify as stringifyYaml } from 'yaml';
import { XMLBuilder } from 'fast-xml-parser';
import type { ToolResult } from '@/core/types';

/**
 * Parse JSON and convert it to YAML / XML / CSV.
 * Error codes are decoupled from copy: core returns language-neutral codes that the UI translates via i18n.
 */

export type JsonTarget = 'yaml' | 'xml' | 'csv';
export type JsonConvertError = 'EMPTY' | 'PARSE' | 'CONVERT';

export const TARGETS: JsonTarget[] = ['yaml', 'xml', 'csv'];

function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Array of objects → CSV; null when the value is not an array or holds non-object items */
export function jsonToCsv(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row))) {
    return null;
  }
  const rows = value as Record<string, unknown>[];
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  if (keys.length === 0) return null;
  const lines = [
    keys.map(escapeCsvCell).join(','),
    ...rows.map((row) => keys.map((k) => escapeCsvCell(row[k])).join(',')),
  ];
  return lines.join('\n');
}

/** JS value → simple XML (root element named root) */
export function jsonToXml(value: unknown): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    indentBy: '  ',
    suppressEmptyNode: true,
  });
  // Scalars and arrays need a root element wrapper
  const wrapped =
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { root: value };
  const xml = builder.build(wrapped);
  return typeof xml === 'string' ? xml.trim() : String(xml);
}

export function convertJson(input: string, target: JsonTarget): ToolResult<string> {
  if (!input.trim()) return { ok: false, error: 'EMPTY' };
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    return { ok: false, error: 'PARSE' };
  }
  try {
    switch (target) {
      case 'yaml':
        return { ok: true, value: stringifyYaml(value).trimEnd() };
      case 'xml':
        return { ok: true, value: jsonToXml(value) };
      case 'csv': {
        const csv = jsonToCsv(value);
        if (csv === null) return { ok: false, error: 'CONVERT' };
        return { ok: true, value: csv };
      }
      default:
        return { ok: false, error: 'CONVERT' };
    }
  } catch {
    return { ok: false, error: 'CONVERT' };
  }
}
