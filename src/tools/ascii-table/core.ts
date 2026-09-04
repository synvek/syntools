/**
 * ASCII 可打印字符表（32–126）及常用控制字符说明。
 */

export interface AsciiEntry {
  dec: number;
  hex: string;
  char: string;
  name: string;
}

const CONTROL_NAMES: Record<number, string> = {
  0: 'NUL',
  7: 'BEL',
  8: 'BS',
  9: 'TAB',
  10: 'LF',
  11: 'VT',
  12: 'FF',
  13: 'CR',
  27: 'ESC',
  32: 'SPACE',
  127: 'DEL',
};

export function buildAsciiTable(from = 0, to = 127): AsciiEntry[] {
  const start = Math.max(0, Math.min(127, from));
  const end = Math.max(start, Math.min(127, to));
  const rows: AsciiEntry[] = [];
  for (let i = start; i <= end; i++) {
    const printable = i >= 32 && i <= 126;
    rows.push({
      dec: i,
      hex: i.toString(16).toUpperCase().padStart(2, '0'),
      char: printable ? String.fromCharCode(i) : '',
      name: CONTROL_NAMES[i] ?? (printable ? '' : 'CTRL'),
    });
  }
  return rows;
}

export function filterAsciiTable(rows: AsciiEntry[], query: string): AsciiEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => {
    if (String(r.dec).includes(q)) return true;
    if (r.hex.toLowerCase().includes(q)) return true;
    if (r.char && r.char.toLowerCase() === q) return true;
    if (r.name.toLowerCase().includes(q)) return true;
    return false;
  });
}
