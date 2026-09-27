import { describe, expect, it } from 'vitest';
import { CSV_BOM } from './core';
import {
  csvToSnapshot,
  formatCsvValue,
  inferCellValue,
  parseCsv,
  serializeCsv,
  snapshotToCsv,
} from './csv';
import { createEmptySnapshot, type WorkbookSnapshot } from './xlsx-io';

describe('parseCsv', () => {
  it('基础分隔与行', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('引号包裹：分隔符、换行、双引号转义', () => {
    expect(parseCsv('"a,b",c\n"line1\nline2","he said ""hi"""')).toEqual([
      ['a,b', 'c'],
      ['line1\nline2', 'he said "hi"'],
    ]);
  });

  it('CRLF 与 BOM', () => {
    expect(parseCsv(`${CSV_BOM}a,b\r\nc,d\r\n`)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('末尾换行不产生多余空行', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
    expect(parseCsv('a,b')).toEqual([['a', 'b']]);
  });

  it('空字段保留为空字符串', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']]);
  });
});

describe('serializeCsv', () => {
  it('按需加引号并转义', () => {
    expect(
      serializeCsv([
        ['a,b', 'c"d'],
        ['x', 'y'],
      ]),
    ).toBe('"a,b","c""d"\r\nx,y');
  });

  it('首尾空白也加引号', () => {
    expect(serializeCsv([[' x ']])).toBe('" x "');
  });

  it('解析与序列化往返稳定', () => {
    const rows = [
      ['姓名', '备注'],
      ['张三', 'a,b'],
      ['李四', '多行\n内容'],
    ];
    expect(parseCsv(serializeCsv(rows))).toEqual(rows);
  });
});

describe('inferCellValue', () => {
  it('纯数字转为数值', () => {
    expect(inferCellValue('42')).toEqual({ v: 42 });
    expect(inferCellValue('-3.5')).toEqual({ v: -3.5 });
    expect(inferCellValue(' 7 ')).toEqual({ v: 7 });
  });

  it('前导 0 的编号 / 超长数字 / 其它内容保留为文本', () => {
    expect(inferCellValue('007')).toEqual({ v: '007' });
    expect(inferCellValue('1234567890123456789')).toEqual({ v: '1234567890123456789' });
    expect(inferCellValue('A1')).toEqual({ v: 'A1' });
  });
});

describe('csvToSnapshot', () => {
  it('构建单表快照并推断数值', () => {
    const result = csvToSnapshot('名称,数量\n苹果,3', 'fruit');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { sheetOrder, sheets, name } = result.value;
    expect(name).toBe('fruit');
    expect(sheetOrder).toHaveLength(1);
    const sheet = sheets[sheetOrder[0]];
    expect(sheet.name).toBe('Sheet1');
    expect(sheet.cellData['0']['0']).toEqual({ v: '名称' });
    expect(sheet.cellData['1']['1']).toEqual({ v: 3 });
    // 预留空白网格
    expect(sheet.rowCount).toBeGreaterThanOrEqual(200);
  });

  it('空内容返回 EMPTY', () => {
    expect(csvToSnapshot('', 'x')).toEqual({ ok: false, error: 'EMPTY' });
    expect(csvToSnapshot('\n,\n', 'x')).toEqual({ ok: false, error: 'EMPTY' });
  });
});

describe('snapshotToCsv', () => {
  const makeSnapshot = (): WorkbookSnapshot => {
    const snapshot = createEmptySnapshot('book');
    const id = snapshot.sheetOrder[0];
    snapshot.sheets[id].cellData = {
      '0': { '0': { v: '名称' }, '1': { v: '日期' } },
      '1': { '0': { v: '苹果' }, '1': { v: 45306, s: { n: { pattern: 'yyyy-mm-dd' } } } },
      '2': { '0': { f: '=SUM(B2:B2)' } },
    };
    return snapshot;
  };

  it('导出为 CSV，日期还原为可读文本，公式带前导 =', () => {
    const result = snapshotToCsv(makeSnapshot());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('名称,日期\r\n苹果,2024-01-15\r\n=SUM(B2:B2),');
  });

  it('CSV → 快照 → CSV 往返保持内容', () => {
    const imported = csvToSnapshot('a,b\n1,2', 't');
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    const exported = snapshotToCsv(imported.value);
    expect(exported).toEqual({ ok: true, value: 'a,b\r\n1,2' });
  });

  it('空快照返回 EMPTY', () => {
    expect(snapshotToCsv(createEmptySnapshot('empty'))).toEqual({ ok: false, error: 'EMPTY' });
  });
});

describe('formatCsvValue', () => {
  it('普通值 / 公式 / 空单元格', () => {
    expect(formatCsvValue({ v: 'x' })).toBe('x');
    expect(formatCsvValue({ f: '=A1' })).toBe('=A1');
    expect(formatCsvValue(undefined)).toBe('');
  });
});
