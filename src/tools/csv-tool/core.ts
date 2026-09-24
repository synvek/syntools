import type { ToolResult } from '@/core/types';

export type CsvDelimiter = ',' | ';' | '\t' | '|';

export const CSV_DELIMITERS: { value: CsvDelimiter; label: string }[] = [
  { value: ',', label: 'Comma ,' },
  { value: ';', label: 'Semicolon ;' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe |' },
];

export interface CsvParseOptions {
  delimiter: CsvDelimiter;
  hasHeader: boolean;
}

/** 解析 RFC 4180 风格的 CSV 文本。 */
export function parseCsv(text: string, delimiter: CsvDelimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false;

  const pushField = () => {
    row.push(field);
    field = '';
    fieldStarted = false;
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      fieldStarted = true;
    } else if (c === delimiter) {
      pushField();
    } else if (c === '\n') {
      pushRow();
    } else if (c === '\r') {
      if (text[i + 1] === '\n') i += 1;
      pushRow();
    } else {
      field += c;
      fieldStarted = true;
    }
  }
  // 末尾仍有未提交的行（非空）
  if (fieldStarted || field !== '' || row.length > 0) pushRow();

  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function escapeField(value: string, delimiter: CsvDelimiter): string {
  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** 序列化为 CSV 文本。 */
export function serializeCsv(
  rows: (string | number | boolean | null)[][],
  delimiter: CsvDelimiter = ',',
): string {
  return rows
    .map((row) =>
      row
        .map((cell) =>
          escapeField(cell === null || cell === undefined ? '' : String(cell), delimiter),
        )
        .join(delimiter),
    )
    .join('\n');
}

/** CSV → JSON（对象数组或二维数组）。 */
export function csvToJson(text: string, options: CsvParseOptions): ToolResult<string> {
  if (!text.trim()) return { ok: false, error: 'EMPTY' };
  const rows = parseCsv(text, options.delimiter);
  if (rows.length === 0) return { ok: false, error: 'EMPTY' };

  if (!options.hasHeader) {
    return { ok: true, value: JSON.stringify(rows, null, 2) };
  }
  const [header, ...body] = rows;
  const objects = body.map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => {
      obj[key || `column${i + 1}`] = r[i] ?? '';
    });
    return obj;
  });
  return { ok: true, value: JSON.stringify(objects, null, 2) };
}

/** JSON → CSV。支持对象数组与二维数组。 */
export function jsonToCsv(text: string, delimiter: CsvDelimiter = ','): ToolResult<string> {
  if (!text.trim()) return { ok: false, error: 'EMPTY' };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'INVALID_JSON' };
  }
  if (!Array.isArray(data)) return { ok: false, error: 'NOT_ARRAY' };
  if (data.length === 0) return { ok: true, value: '' };

  if (Array.isArray(data[0])) {
    return { ok: true, value: serializeCsv(data as (string | number)[][], delimiter) };
  }
  if (typeof data[0] === 'object' && data[0] !== null) {
    const keys = Array.from(
      new Set(data.flatMap((item) => Object.keys(item as Record<string, unknown>))),
    );
    const header = keys;
    const body = data.map((item) => keys.map((k) => (item as Record<string, unknown>)[k] ?? ''));
    return {
      ok: true,
      value: serializeCsv([header, ...body] as (string | number)[][], delimiter),
    };
  }
  return { ok: false, error: 'NOT_ARRAY' };
}
