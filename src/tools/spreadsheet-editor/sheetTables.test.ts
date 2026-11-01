import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createEmptySnapshot, type WorkbookSnapshot } from './xlsx-io';
import {
  buildTableXml,
  createTableFromSelection,
  injectTablesIntoXlsx,
  parseTableRef,
  readSheetTables,
  setTablePartsInSheetXml,
  tableRefOf,
  tableRelationshipCount,
  tablesInRange,
  uniqueTableName,
  type SheetTable,
} from './sheetTables';

/** P2-S7.3 表格对象：引用解析、命名判重、part 注入与回读 */

function snapshotWithCells(): { snapshot: WorkbookSnapshot; sheetId: string } {
  const snapshot = createEmptySnapshot('tables');
  const sheetId = snapshot.sheetOrder[0];
  const sheet = snapshot.sheets[sheetId];
  sheet.name = 'Data';
  sheet.cellData['0'] = { '0': { v: '商品' }, '1': { v: '金额' } };
  sheet.cellData['1'] = { '0': { v: '苹果' }, '1': { v: 12 } };
  sheet.cellData['2'] = { '0': { v: '梨' }, '1': { v: 8 } };
  return { snapshot, sheetId };
}

async function buildWorkbook(snapshot: WorkbookSnapshot): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  for (const id of snapshot.sheetOrder) {
    const sheet = snapshot.sheets[id];
    const worksheet = workbook.addWorksheet(sheet.name);
    for (const [rowKey, row] of Object.entries(sheet.cellData ?? {})) {
      for (const [colKey, cell] of Object.entries(row)) {
        worksheet.getCell(Number(rowKey) + 1, Number(colKey) + 1).value = cell.v ?? null;
      }
    }
  }
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

describe('表格引用与命名', () => {
  it('A1:C10 与单格写法都能解析，非法输入返回 null', () => {
    expect(parseTableRef('A1:C10')).toEqual({
      startRow: 0,
      startColumn: 0,
      endRow: 9,
      endColumn: 2,
    });
    expect(parseTableRef('$B$2:$B$4')).toEqual({
      startRow: 1,
      startColumn: 1,
      endRow: 3,
      endColumn: 1,
    });
    expect(parseTableRef('C10:A1')).toEqual({
      startRow: 0,
      startColumn: 0,
      endRow: 9,
      endColumn: 2,
    });
    expect(parseTableRef('nope')).toBeNull();
    expect(parseTableRef('')).toBeNull();
  });

  it('区域写出为 A1:C10', () => {
    expect(tableRefOf({ startRow: 0, startColumn: 0, endRow: 9, endColumn: 2 })).toBe('A1:C10');
  });

  it('表名避开已用名称（含名称管理器），大小写不敏感', () => {
    expect(uniqueTableName([])).toBe('Table1');
    expect(uniqueTableName(['Table1', 'table2'])).toBe('Table3');
    expect(uniqueTableName(['Total'], 'Table')).toBe('Table1');
  });
});

describe('从选区建表', () => {
  it('表头取首行文字，重名与空名自动兜底', () => {
    const { snapshot, sheetId } = snapshotWithCells();
    snapshot.sheets[sheetId].cellData['0'] = { '0': { v: '金额' }, '1': { v: '金额' } };
    const table = createTableFromSelection(
      snapshot,
      sheetId,
      { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 },
      [],
    );
    expect(table).not.toBeNull();
    expect(table!.columns).toEqual(['金额', '金额2']);
    expect(table!.name).toBe('Table1');
    expect(table!.style.showRowStripes).toBe(true);
  });

  it('只有表头、没有数据行时不建表', () => {
    const { snapshot, sheetId } = snapshotWithCells();
    expect(
      createTableFromSelection(
        snapshot,
        sheetId,
        {
          startRow: 0,
          startColumn: 0,
          endRow: 0,
          endColumn: 1,
        },
        [],
      ),
    ).toBeNull();
  });

  it('相交判定按矩形重叠', () => {
    const table: SheetTable = {
      id: 't1',
      name: 'Table1',
      sheetId: 's1',
      range: { startRow: 0, startColumn: 0, endRow: 4, endColumn: 1 },
      columns: ['A', 'B'],
      headerRow: true,
      totalsRow: false,
      style: { name: 'TableStyleMedium2', showRowStripes: true },
    };
    const hit = { startRow: 3, startColumn: 1, endRow: 6, endColumn: 3 };
    const miss = { startRow: 5, startColumn: 0, endRow: 6, endColumn: 1 };
    expect(tablesInRange([table], 's1', hit)).toHaveLength(1);
    expect(tablesInRange([table], 's1', miss)).toHaveLength(0);
    expect(tablesInRange([table], 's2', hit)).toHaveLength(0);
  });
});

describe('part 注入', () => {
  it('tableParts 块可重复写入（幂等）', () => {
    const xml = '<worksheet><sheetData/></worksheet>';
    const once = setTablePartsInSheetXml(xml, ['rId1']);
    expect(once).toContain('<tableParts count="1"><tablePart r:id="rId1"/></tableParts>');
    const twice = setTablePartsInSheetXml(once, ['rId2', 'rId3']);
    expect(twice.match(/<tableParts/g)).toHaveLength(1);
    expect(twice).toContain('<tablePart r:id="rId2"/><tablePart r:id="rId3"/>');
    expect(setTablePartsInSheetXml(once, [])).not.toContain('tableParts');
  });

  it('table XML 带齐 Excel 需要的属性与列定义', () => {
    const xml = buildTableXml(
      {
        id: 't1',
        name: 'Sales & Co',
        sheetId: 's1',
        range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 },
        columns: ['商品'],
        headerRow: true,
        totalsRow: false,
        style: { name: 'TableStyleMedium2', showRowStripes: true },
      },
      3,
    );
    expect(xml).toContain('id="3"');
    expect(xml).toContain('displayName="Sales &amp; Co"');
    expect(xml).toContain('ref="A1:B3"');
    expect(xml).toContain('headerRowCount="1"');
    expect(xml).toContain('<tableColumns count="2">');
    // 列定义少于区域宽度时补齐，避免 Excel 报错
    expect(xml).toContain('name="Column2"');
    expect(xml).toContain('showRowStripes="1"');
  });

  it('注入后三处登记齐全，且 exceljs 能读回同一张表', async () => {
    const { snapshot, sheetId } = snapshotWithCells();
    const table = createTableFromSelection(
      snapshot,
      sheetId,
      { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 },
      [],
    )!;
    snapshot.syntoolsTables = [table];

    const base = await buildWorkbook(snapshot);
    const bytes = await injectTablesIntoXlsx(base, snapshot);

    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file('xl/tables/table1.xml')).toBeTruthy();
    const rels = await zip.file('xl/worksheets/_rels/sheet1.xml.rels')!.async('string');
    expect(tableRelationshipCount(rels)).toBe(1);
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheetXml).toContain('<tableParts count="1">');
    const ct = await zip.file('[Content_Types].xml')!.async('string');
    expect(ct).toContain('/xl/tables/table1.xml');

    // exceljs 读回：单元格值不动，表格语义挂在 worksheet.tables 上
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const worksheet = workbook.getWorksheet('Data')!;
    expect(worksheet.getCell('A1').value).toBe('商品');
    expect(worksheet.getCell('B3').value).toBe(8);

    const back = readSheetTables(worksheet as unknown as { tables?: unknown }, '1');
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({
      name: 'Table1',
      sheetId: '1',
      headerRow: true,
      totalsRow: false,
    });
    expect(back[0].range).toEqual({ startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 });
    expect(back[0].columns).toEqual(['商品', '金额']);
    expect(back[0].style.name).toBe('TableStyleMedium2');
  });

  it('没有表格时导出字节不变', async () => {
    const { snapshot } = snapshotWithCells();
    const base = await buildWorkbook(snapshot);
    const bytes = await injectTablesIntoXlsx(base, snapshot);
    expect(new Uint8Array(bytes)).toEqual(new Uint8Array(base));
  });
});
