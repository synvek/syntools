import { describe, expect, it } from 'vitest';
import { buildAsciiTable, filterAsciiTable } from './core';

describe('ascii-table', () => {
  it('构建 128 行', () => {
    expect(buildAsciiTable()).toHaveLength(128);
    expect(buildAsciiTable(32, 32)[0].char).toBe(' ');
    expect(buildAsciiTable(65, 65)[0].char).toBe('A');
  });

  it('过滤', () => {
    const rows = buildAsciiTable();
    expect(filterAsciiTable(rows, 'LF')[0].dec).toBe(10);
    expect(filterAsciiTable(rows, '41').some((r) => r.hex === '41')).toBe(true);
  });
});
