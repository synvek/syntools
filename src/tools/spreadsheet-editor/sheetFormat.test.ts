import { describe, expect, it } from 'vitest';
import {
  EMPTY_SHEET_FORMAT,
  buildAutoSum,
  parseClipboardMatrix,
  rangeLabel,
  readSheetFormat,
  shiftDecimals,
  toggleThousandSeparator,
} from './sheetFormat';

/**
 * The ribbon reads its pressed state from these mappings. They are pure functions over the exact
 * `IStyleData` keys Univer 0.25.1 uses, so a dependency bump that renames a key fails here instead of
 * silently greying out every toggle.
 */
describe('read sheet format', () => {
  it('returns the neutral state without styles', () => {
    expect(readSheetFormat([])).toEqual(EMPTY_SHEET_FORMAT);
    expect(readSheetFormat([], true).merged).toBe(true);
  });

  it('reads every toggle from the style keys', () => {
    const state = readSheetFormat([
      {
        bl: 1,
        it: 1,
        ul: { s: 1 },
        st: { s: 1 },
        ff: 'Arial',
        fs: 14,
        cl: { rgb: '#ff0000' },
        bg: { rgb: '#00ff00' },
        ht: 2,
        vt: 1,
        tb: 3,
        n: { pattern: '0.00%' },
      },
    ]);
    expect(state).toMatchObject({
      bold: true,
      italic: true,
      underline: true,
      strike: true,
      fontFamily: 'Arial',
      fontSize: 14,
      color: '#ff0000',
      fill: '#00ff00',
      hAlign: 'center',
      vAlign: 'top',
      wrap: true,
      numberFormat: '0.00%',
    });
  });

  it('reports mixed state when the sampled cells disagree', () => {
    const state = readSheetFormat([
      { bl: 1, fs: 11, ht: 1 },
      { bl: 0, fs: 12, ht: 2 },
    ]);
    expect(state.bold).toBe('mixed');
    expect(state.fontSize).toBeNull();
    expect(state.hAlign).toBe('mixed');
  });

  it('keeps unset alignment at the defaults', () => {
    const state = readSheetFormat([{}]);
    expect(state.hAlign).toBe('general');
    expect(state.vAlign).toBe('bottom');
    expect(state.wrap).toBe(false);
  });
});

describe('border read-back (P1-4 format painter)', () => {
  it('no border data means no border to paint', () => {
    expect(readSheetFormat([{}]).border).toBeNull();
  });

  it('reads presence and colour, with a side-less style fallback', () => {
    const state = readSheetFormat([{ bd: { b: { s: 1, cl: { rgb: '#ff0000' } } } }]);
    expect(state.border).toEqual({ style: 'thin', color: '#ff0000' });
  });

  it('a side with no weight counts as "no border"', () => {
    expect(readSheetFormat([{ bd: { t: { s: 0 } } }]).border).toBeNull();
  });

  it('mixed colours across the selection collapse to no border (do not guess)', () => {
    const state = readSheetFormat([
      { bd: { t: { s: 1, cl: { rgb: '#ff0000' } } } },
      { bd: { t: { s: 1, cl: { rgb: '#00ff00' } } } },
    ]);
    expect(state.border).toBeNull();
  });
});

describe('number format helpers', () => {
  it('adds and removes decimal places on the first placeholder', () => {
    expect(shiftDecimals('#,##0.00', 1)).toBe('#,##0.000');
    expect(shiftDecimals('#,##0.00', -1)).toBe('#,##0.0');
    expect(shiftDecimals('#,##0.00', -2)).toBe('#,##0');
    expect(shiftDecimals('0', 2)).toBe('0.00');
    expect(shiftDecimals('0.00%', 1)).toBe('0.000%');
    // No numeric placeholder (text format): left untouched instead of being destroyed
    expect(shiftDecimals('@', 1)).toBe('@');
  });

  it('toggles the thousands separator', () => {
    expect(toggleThousandSeparator('#,##0')).toBe('#0');
    expect(toggleThousandSeparator('0.00')).toBe('#,##0.00');
  });
});

describe('clipboard matrix', () => {
  it('splits TSV and drops the trailing empty row', () => {
    expect(parseClipboardMatrix('a\tb\n1\t2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('normalizes CRLF and keeps empty cells', () => {
    expect(parseClipboardMatrix('a\t\tc\r\n1')).toEqual([['a', '', 'c'], ['1']]);
  });
});

describe('auto sum', () => {
  it('labels a range like Excel', () => {
    expect(rangeLabel({ startRow: 0, startColumn: 0, endRow: 3, endColumn: 1 })).toBe('A1:B4');
    expect(rangeLabel({ startRow: 2, startColumn: 2, endRow: 2, endColumn: 2 })).toBe('C3');
  });

  it('drops the formula below a vertical block and right of a horizontal one', () => {
    expect(buildAutoSum({ startRow: 0, startColumn: 0, endRow: 2, endColumn: 0 })).toEqual({
      row: 3,
      column: 0,
      formula: '=SUM(A1:A3)',
    });
    expect(buildAutoSum({ startRow: 4, startColumn: 1, endRow: 4, endColumn: 3 })).toEqual({
      row: 4,
      column: 4,
      formula: '=SUM(B5:D5)',
    });
  });
});
