import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  applySheetProtection,
  createPasswordHash,
  fromExcelProtection,
  readSheetProtection,
  protectionFor,
  setProtection,
  toExcelProtection,
  type SheetProtectionState,
  type WorksheetProtectionLike,
} from './sheetProtection';

async function exportWith(state: SheetProtectionState | null): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Data');
  sheet.getCell('A1').value = 1;
  applySheetProtection(sheet as unknown as { sheetProtection?: unknown }, state);
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

async function sheetXml(bytes: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  return zip.file('xl/worksheets/sheet1.xml')!.async('string');
}

describe('保护模型换算', () => {
  it('exceljs 模型 → 允许口径（formatCells 模型 true 才等于允许）', () => {
    const state = fromExcelProtection({
      sheet: true,
      formatCells: true,
      selectLockedCells: false,
    });
    expect(state).not.toBeNull();
    expect(state!.flags.formatCells).toBe(true);
    expect(state!.flags.sort).toBeUndefined();
    // 模型 false = 禁止
    expect(state!.flags.selectLockedCells).toBe(false);
    expect(state!.flags.selectUnlockedCells).toBe(true);
  });

  it('未保护 / 无 sheet 标记返回 null', () => {
    expect(fromExcelProtection(null)).toBeNull();
    expect(fromExcelProtection({})).toBeNull();
    expect(fromExcelProtection({ sheet: false })).toBeNull();
  });

  it('允许口径 ↔ exceljs 模型对齐（往返不漂）', () => {
    const state: SheetProtectionState = {
      sheetId: '1',
      enabled: true,
      flags: {
        formatCells: true,
        insertRows: true,
        selectLockedCells: false,
        selectUnlockedCells: true,
      },
    };
    const model = toExcelProtection(state)!;
    expect(model.formatCells).toBe(true);
    expect(model.insertRows).toBe(true);
    expect(model.sort).toBeUndefined();
    expect(model.selectLockedCells).toBe(false);
    // 对象/方案固定禁止（exceljs 表达不了"允许"）
    expect(model.objects).toBe(false);
    expect(model.scenarios).toBe(false);

    const back = fromExcelProtection(model)!;
    expect(back.flags).toMatchObject({
      formatCells: true,
      insertRows: true,
      selectLockedCells: false,
      selectUnlockedCells: true,
    });
  });
});

describe('导出写 sheetProtection', () => {
  it('关闭时工作表里没有该元素', async () => {
    const xml = await sheetXml(await exportWith(null));
    expect(xml).not.toContain('<sheetProtection');
  });

  it('开启后写入 OOXML 属性，并能在导入时读回', async () => {
    const state: SheetProtectionState = {
      sheetId: '1',
      enabled: true,
      flags: { formatCells: true, selectLockedCells: false },
    };
    const bytes = await exportWith(state);
    const xml = await sheetXml(bytes);
    expect(xml).toContain('<sheetProtection');
    expect(xml).toContain('sheet="1"');
    // 允许设置格式 → formatCells="0"；禁止选择锁定单元格 → selectLockedCells="1"
    expect(xml).toContain('formatCells="0"');
    expect(xml).toContain('selectLockedCells="1"');
    // 位置要求：sheetData 之后、autoFilter 之前
    expect(xml.indexOf('</sheetData>')).toBeLessThan(xml.indexOf('<sheetProtection'));

    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const sheet = workbook.getWorksheet('Data')!;
    const back = readSheetProtection(sheet as unknown as WorksheetProtectionLike);
    expect(back?.flags.formatCells).toBe(true);
    expect(back?.flags.selectLockedCells).toBe(false);
    expect(back?.password).toBeUndefined();
  });

  it('密码只算一次哈希，导出多次得到同一份 salt', async () => {
    const password = await createPasswordHash('s3cret');
    expect(password?.algorithmName).toBe('SHA-512');
    expect(password?.hashValue).toHaveLength(88);
    expect(password?.spinCount).toBeGreaterThan(0);

    const state: SheetProtectionState = {
      sheetId: '1',
      enabled: true,
      flags: {},
      password,
    };
    const first = await sheetXml(await exportWith(state));
    const second = await sheetXml(await exportWith(state));
    expect(first).toContain('algorithmName="SHA-512"');
    expect(first).toContain(`saltValue="${password!.saltValue}"`);
    // 快照里带着哈希，所以两次导出逐字节一致（不是每次重新加盐）
    expect(first).toBe(second);
  });

  it('空密码不产生哈希', async () => {
    expect(await createPasswordHash('   ')).toBeUndefined();
  });
});

describe('保护列表维护', () => {
  const a: SheetProtectionState = { sheetId: '1', enabled: true, flags: {} };
  const b: SheetProtectionState = { sheetId: '2', enabled: true, flags: {} };

  it('按表查询只看启用项', () => {
    expect(protectionFor([a, b], '2')).toBe(b);
    expect(protectionFor([a], '9')).toBeNull();
    expect(protectionFor([a], null)).toBeNull();
  });

  it('关闭保护即移除条目，不留 enabled:false', () => {
    expect(setProtection([a, b], '1', null).map((item) => item.sheetId)).toEqual(['2']);
    expect(setProtection([a], '1', { ...a, enabled: false })).toEqual([]);
    expect(setProtection([a], '3', { ...b, sheetId: '3' })).toEqual([a, { ...b, sheetId: '3' }]);
  });
});
