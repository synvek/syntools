import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  injectNamedRanges,
  normalizeRef,
  parseDefinedNamesXml,
  readNamedRangesFromXlsx,
  setDefinedNamesInWorkbookXml,
  validateName,
  type NamedRange,
} from './namedRanges';

const WORKBOOK_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<sheets><sheet name="Data" sheetId="1" r:id="rId1"/><sheet name="Report" sheetId="2" r:id="rId2"/></sheets>' +
  '<calcPr calcId="191029"/>' +
  '</workbook>';

async function buildWorkbookBytes(): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Data');
  sheet.getCell('A1').value = 42;
  workbook.addWorksheet('Report');
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

describe('名称校验', () => {
  it('接受合法名称，拒绝空名/单元格样式/保留字', () => {
    expect(validateName('销售额')).toBeNull();
    expect(validateName('_tmp')).toBeNull();
    expect(validateName('Q1.2026')).toBeNull();
    expect(validateName('   ')).toBe('empty');
    expect(validateName('1abc')).toBe('invalid');
    expect(validateName('A1')).toBe('invalid');
    expect(validateName('R1C1')).toBe('invalid');
    expect(validateName('a b')).toBe('invalid');
    expect(validateName('TRUE')).toBe('reserved');
  });

  it('重名判定忽略大小写，但跳过自己', () => {
    const existing: NamedRange[] = [{ id: 'name-1', name: 'Total', ref: 'A1' }];
    expect(validateName('total', existing)).toBe('duplicate');
    expect(validateName('total', existing, 'name-1')).toBeNull();
  });
});

describe('引用规范化', () => {
  it('大小写、$、反向区域都能收敛成左上→右下', () => {
    expect(normalizeRef('a1')).toBe('A1');
    expect(normalizeRef('$A$1:$B$2')).toBe('A1:B2');
    expect(normalizeRef('B2:A1')).toBe('A1:B2');
    expect(normalizeRef('Data!B2:A1')).toBe('Data!A1:B2');
    expect(normalizeRef("'My Sheet'!A1:B2")).toBe("'My Sheet'!A1:B2");
  });

  it('整列/整行/垃圾输入一律返回 null，不做猜测', () => {
    expect(normalizeRef('A:A')).toBeNull();
    expect(normalizeRef('1:1')).toBeNull();
    expect(normalizeRef('hello')).toBeNull();
    expect(normalizeRef('')).toBeNull();
  });
});

describe('definedNames XML', () => {
  it('读到局部作用域、hidden 与 comment 属性', () => {
    const xml =
      '<definedNames>' +
      '<definedName name="Total">Data!$A$1:$A$9</definedName>' +
      '<definedName name="_xlnm.Print_Area" localSheetId="1" hidden="1">Report!$A$1:$C$20</definedName>' +
      '<definedName name="Note" comment="带 &amp; 符号">Data!$B$2</definedName>' +
      '</definedNames>';
    expect(parseDefinedNamesXml(xml)).toEqual([
      { name: 'Total', ref: 'Data!$A$1:$A$9' },
      { name: '_xlnm.Print_Area', ref: 'Report!$A$1:$C$20', localSheetId: 1, hidden: true },
      { name: 'Note', ref: 'Data!$B$2', comment: '带 & 符号' },
    ]);
  });

  it('按 CT_Workbook 顺序插到 sheets 之后，并替换旧块', () => {
    const names: NamedRange[] = [
      { id: 'name-1', name: 'Total', ref: 'Data!A1:B2' },
      { id: 'name-2', name: 'Local', ref: 'A1', sheetId: 'sheet-2', hidden: true },
    ];
    const next = setDefinedNamesInWorkbookXml(WORKBOOK_XML, names, ['sheet-1', 'sheet-2'], {
      'sheet-1': { name: 'Data' },
      'sheet-2': { name: 'Report' },
    });
    expect(next.indexOf('</sheets>')).toBeLessThan(next.indexOf('<definedNames>'));
    expect(next.indexOf('<definedNames>')).toBeLessThan(next.indexOf('<calcPr'));
    expect(next).toContain('<definedName name="Total">Data!$A$1:$B$2</definedName>');
    // 局部名称：带 localSheetId + 表名前缀，否则 Excel 会当成工作簿级名称
    expect(next).toContain(
      '<definedName name="Local" localSheetId="1" hidden="1">Report!$A$1</definedName>',
    );

    const again = setDefinedNamesInWorkbookXml(next, names, ['sheet-1', 'sheet-2'], {
      'sheet-1': { name: 'Data' },
      'sheet-2': { name: 'Report' },
    });
    expect(again).toBe(next);
  });

  it('清空名称时整块移除', () => {
    const withNames = setDefinedNamesInWorkbookXml(
      WORKBOOK_XML,
      [{ id: 'a', name: 'Total', ref: 'A1' }],
      ['sheet-1'],
    );
    const cleared = setDefinedNamesInWorkbookXml(withNames, [], ['sheet-1']);
    expect(cleared).not.toContain('definedNames');
    expect(cleared).toContain('<calcPr');
  });
});

describe('xlsx 往返', () => {
  it('写进 workbook.xml 后能被重新读回，且文件仍可被 exceljs 打开', async () => {
    const base = await buildWorkbookBytes();
    const names: NamedRange[] = [
      { id: 'name-1', name: '总销售额', ref: 'Data!A1:B2' },
      { id: 'name-2', name: '本表区域', ref: 'A1:A5', sheetId: '2', comment: '来自导入' },
    ];
    const bytes = await injectNamedRanges(base, names, ['1', '2'], {
      '1': { name: 'Data' },
      '2': { name: 'Report' },
    });

    const zip = await JSZip.loadAsync(bytes);
    const workbookXml = await zip.file('xl/workbook.xml')!.async('string');
    expect(workbookXml).toContain('name="总销售额"');

    const back = await readNamedRangesFromXlsx(bytes, ['1', '2'], {
      '1': { name: 'Data' },
      '2': { name: 'Report' },
    });
    expect(back).toHaveLength(2);
    expect(back[0]).toMatchObject({ name: '总销售额', ref: 'Data!A1:B2' });
    expect(back[1]).toMatchObject({
      name: '本表区域',
      ref: 'A1:A5',
      sheetId: '2',
      comment: '来自导入',
    });

    // Excel 才不管我们的 JSON：文件必须仍能被解析
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await expect(workbook.xlsx.load(bytes)).resolves.toBeTruthy();
  });
});
