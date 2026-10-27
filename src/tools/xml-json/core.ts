import { XMLParser } from 'fast-xml-parser';
import type { ToolResult } from '@/core/types';

/**
 * XML → JSON: built on fast-xml-parser, attributes preserved with the @_ prefix.
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
    // Empty document, or an empty result object whose source has no tags → treat as failure
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)
    ) {
      // Allow an empty object only when the input is minimal valid XML such as an empty element; otherwise no < means PARSE
      if (!/<[A-Za-z_!?]/.test(input)) return { ok: false, error: 'PARSE' };
    }
    return { ok: true, value: JSON.stringify(value, null, indent) };
  } catch {
    return { ok: false, error: 'PARSE' };
  }
}
