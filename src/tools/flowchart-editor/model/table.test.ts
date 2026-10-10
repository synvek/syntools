import { describe, expect, it } from 'vitest';
import {
  cellAt,
  columnWidths,
  computeTableLayout,
  emptyTable,
  insertCol,
  insertRow,
  mergeCells,
  normalizeTable,
  removeCol,
  removeRow,
  sanitizeSpans,
  setCellText,
  splitCell,
} from './table';

describe('表格纯逻辑', () => {
  it('空表格结构合法且可编辑', () => {
    const t = emptyTable(2, 3);
    expect(t.rows).toBe(2);
    expect(t.cols).toBe(3);
    expect(t.cells).toHaveLength(2);
    expect(t.cells![0]).toHaveLength(3);
    expect(cellAt(t, 1, 2)).toEqual({});
  });

  it('normalizeTable 补齐缺失维度', () => {
    const t = normalizeTable({ rows: 2, cols: 2, cells: [[{ text: 'a' }]] });
    expect(t.cells![0][0]).toEqual({ text: 'a' });
    expect(t.cells![0][1]).toEqual({});
    expect(t.cells![1][0]).toEqual({});
  });

  it('写入单元格文本', () => {
    const t = setCellText(emptyTable(2, 2), 1, 1, '值');
    expect(cellAt(t, 1, 1).text).toBe('值');
  });

  it('行列增删并保证至少 1 行 1 列', () => {
    let t = emptyTable(2, 2);
    t = insertRow(t, 0, 'before');
    expect(t.rows).toBe(3);
    t = insertCol(t, 1);
    expect(t.cols).toBe(3);
    t = removeRow(t, 0);
    t = removeRow(t, 0);
    t = removeRow(t, 0);
    expect(t.rows).toBe(1);
    t = removeCol(t, 0);
    t = removeCol(t, 0);
    t = removeCol(t, 0);
    expect(t.cols).toBe(1);
  });

  it('合并后被覆盖的从属格不参与渲染，拆分后恢复', () => {
    let t = emptyTable(3, 3);
    t = setCellText(t, 0, 0, '标题');
    t = mergeCells(t, 0, 0, 1, 3);
    const boxes = computeTableLayout(t);
    expect(boxes.find((b) => b.col === 1 && b.row === 0)).toBeUndefined();
    expect(cellAt(t, 0, 1)).toEqual({});

    t = splitCell(t, 0, 0);
    const after = computeTableLayout(t);
    expect(after.filter((b) => b.row === 0)).toHaveLength(3);
  });

  it('sanitizeSpans 夹取越界跨度', () => {
    const t = sanitizeSpans({
      rows: 2,
      cols: 2,
      cells: [
        [{ text: 'x', rowspan: 9, colspan: 9 }, null],
        [null, null],
      ],
    });
    expect(t.cells![0][0]).toEqual({ text: 'x', rowspan: 2, colspan: 2 });
  });

  it('列宽支持等分与权重', () => {
    expect(columnWidths(emptyTable(1, 4), 400)).toEqual([100, 100, 100, 100]);
    const weighted = normalizeTable({
      rows: 1,
      cols: 2,
      cells: [[{}, {}]],
      colWeights: [1, 3],
    });
    expect(columnWidths(weighted, 400)).toEqual([100, 300]);
  });
});
