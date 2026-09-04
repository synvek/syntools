import { XMLParser } from 'fast-xml-parser';
import type { ToolResult } from '@/core/types';

/**
 * XML → JSON：基于 fast-xml-parser，保留属性（@_ 前缀）。
 */

export type XmlJsonError = 'EMPTY' | 'PARSE';
export type IndentSize = 2 | 4;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseTagValue: true,
  trimValues: true,
});

export function xmlToJson(input: string, indent: IndentSize = 2): ToolResult<string> {
  if (!input.trim()) return { ok: false, error: 'EMPTY' };
  try {
    const value = parser.parse(input);
    // 空文档或解析结果为空对象且原文不含标签 → 视为失败
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)
    ) {
      // 允许空对象仅当输入本身是空元素等极简合法 XML；否则若没有 < 则 PARSE
      if (!/<[A-Za-z_!?]/.test(input)) return { ok: false, error: 'PARSE' };
    }
    return { ok: true, value: JSON.stringify(value, null, indent) };
  } catch {
    return { ok: false, error: 'PARSE' };
  }
}
