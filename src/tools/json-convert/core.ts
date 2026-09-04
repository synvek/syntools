import { stringify as stringifyYaml } from 'yaml';
import { XMLBuilder } from 'fast-xml-parser';
import type { ToolResult } from '@/core/types';

/**
 * JSON 解析并转换为 YAML / XML / CSV。
 * 错误码与文案解耦：core 返回语言无关错误码，UI 层经 i18n 翻译。
 */

export type JsonTarget = 'yaml' | 'xml' | 'csv';
export type JsonConvertError = 'EMPTY' | 'PARSE' | 'CONVERT';

export const TARGETS: JsonTarget[] = ['yaml', 'xml', 'csv'];

function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** 对象数组 → CSV；非数组或元素非对象时返回 null */
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

/** JS 值 → 简单 XML（根节点 root） */
export function jsonToXml(value: unknown): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    indentBy: '  ',
    suppressEmptyNode: true,
  });
  // 标量 / 数组需要包一层 root
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
