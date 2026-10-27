import type { ToolResult } from '@/core/types';
import { MIN_COLUMN_COUNT, MIN_ROW_COUNT, excelSerialToDate } from './core';
import { createEmptySnapshot, type CellSnapshot, type WorkbookSnapshot } from './xlsx-io';

/**
 * CSV pure-logic layer: parsing / serialising / converting to and from workbook snapshots.
 * Depends on neither exceljs nor Univer, so it can be unit tested alone; data never leaves the
 * browser.
 */

/** Default delimiter (comma) */
export const CSV_DELIMITER = ',';

/**
 * Parse CSV (RFC 4180): quoted fields, delimiters and newlines inside fields, "" escapes,
 * CRLF / CR / LF, and a stripped BOM. Empty fields stay empty strings; a trailing newline does not
 * create a spurious blank row.
 */
export function parseCsv(text: string, delimiter = CSV_DELIMITER): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let index = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  for (; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  // Flush: only push a row when something is still pending, so a trailing newline adds no blank line
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function escapeCsvField(value: string, delimiter: string): string {
  const needsQuote = value.includes(delimiter) || /["\r\n]/.test(value) || value !== value.trim();
  return needsQuote ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialise CSV: quote fields containing the delimiter / quotes / newlines / surrounding whitespace */
export function serializeCsv(
  rows: readonly (readonly string[])[],
  delimiter = CSV_DELIMITER,
): string {
  return rows
    .map((row) => row.map((value) => escapeCsvField(value ?? '', delimiter)).join(delimiter))
    .join('\r\n');
}

/**
 * Text → cell: pure numbers become numeric values (so formulas and sums work).
 * Identifiers with leading zeros (e.g. 007), over-long digit strings and anything else stay textual.
 */
export function inferCellValue(text: string): CellSnapshot {
  const trimmed = text.trim();
  if (
    trimmed.length > 0 &&
    trimmed.length <= 15 &&
    /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)
  ) {
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return { v: numeric };
  }
  return { v: text };
}

/** CSV text → single-sheet workbook snapshot */
export function csvToSnapshot(
  text: string,
  name: string,
  locale: WorkbookSnapshot['locale'] = 'zhCN',
): ToolResult<WorkbookSnapshot> {
  const rows = parseCsv(text);
  const hasContent = rows.some((row) => row.some((value) => value !== ''));
  if (rows.length === 0 || !hasContent) return { ok: false, error: 'EMPTY' };

  const snapshot = createEmptySnapshot(name, locale);
  const sheetId = snapshot.sheetOrder[0];
  const sheet = snapshot.sheets[sheetId];
  let maxColumn = 0;

  rows.forEach((row, rowIndex) => {
    maxColumn = Math.max(maxColumn, row.length);
    const rowCells: Record<string, CellSnapshot> = {};
    row.forEach((value, colIndex) => {
      if (value === '') return;
      rowCells[String(colIndex)] = inferCellValue(value);
    });
    if (Object.keys(rowCells).length > 0) sheet.cellData[String(rowIndex)] = rowCells;
  });

  sheet.rowCount = Math.max(MIN_ROW_COUNT, rows.length + 20);
  sheet.columnCount = Math.max(MIN_COLUMN_COUNT, maxColumn + 4);
  return { ok: true, value: snapshot };
}

/** Cell → CSV text: dates (serial + year/month format) become readable dates instead of Excel serials */
export function formatCsvValue(cell: CellSnapshot | undefined): string {
  if (!cell) return '';
  const pattern = cell.s?.n?.pattern ?? '';
  if (typeof cell.v === 'number' && /[yY]/.test(pattern)) {
    const date = excelSerialToDate(cell.v);
    if (!Number.isNaN(date.getTime())) {
      const iso = date.toISOString();
      return iso.endsWith('T00:00:00.000Z')
        ? iso.slice(0, 10)
        : `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
    }
  }
  if (cell.v !== undefined && cell.v !== null) return String(cell.v);
  if (cell.f) return cell.f;
  return '';
}

/** Workbook snapshot → CSV text (single sheet; defaults to the first non-empty sheet) */
export function snapshotToCsv(
  snapshot: WorkbookSnapshot,
  sheetId?: string | null,
): ToolResult<string> {
  const order = snapshot.sheetOrder ?? [];
  const dimsOf = (id: string): { rows: number; cols: number } => {
    const sheet = snapshot.sheets?.[id];
    if (!sheet) return { rows: 0, cols: 0 };
    let rows = 0;
    let cols = 0;
    for (const [rowKey, rowCells] of Object.entries(sheet.cellData ?? {})) {
      const row = Number(rowKey);
      if (!Number.isFinite(row)) continue;
      rows = Math.max(rows, row + 1);
      for (const colKey of Object.keys(rowCells ?? {})) {
        const col = Number(colKey);
        if (Number.isFinite(col)) cols = Math.max(cols, col + 1);
      }
    }
    return { rows, cols };
  };

  const target =
    sheetId && snapshot.sheets?.[sheetId]
      ? sheetId
      : (order.find((id) => dimsOf(id).rows > 0) ?? order[0] ?? null);
  if (!target) return { ok: false, error: 'EMPTY' };
  const { rows: rowCount, cols: colCount } = dimsOf(target);
  if (rowCount === 0) return { ok: false, error: 'EMPTY' };
  const sheet = snapshot.sheets[target];

  const lines: string[][] = [];
  for (let row = 0; row < rowCount; row += 1) {
    const line: string[] = [];
    for (let col = 0; col < colCount; col += 1) {
      line.push(formatCsvValue(sheet.cellData?.[String(row)]?.[String(col)]));
    }
    lines.push(line);
  }
  return { ok: true, value: serializeCsv(lines) };
}
