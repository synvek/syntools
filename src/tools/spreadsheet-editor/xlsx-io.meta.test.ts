import { describe, expect, it } from 'vitest';
import { createEmptySnapshot } from './xlsx-io';
import { exportSnapshotToBytes, importXlsxToSnapshot } from './xlsx-io';
import type { NamedRange } from './namedRanges';
import type { SheetTable } from './sheetTables';
import type { SheetProtectionState } from './sheetProtection';

/**
 * P2-S7.1 / S7.2 的落地验证：名称与保护必须能穿过 export → import 一圈。
 * 单独成文件，避免和 `xlsx-io.test.ts` 里的既有断言互相牵制。
 */

function fakeFile(bytes: Uint8Array, name = 'meta.xlsx'): File {
  const view = new Uint8Array(bytes);
  return {
    name,
    size: view.byteLength,
    arrayBuffer: async () => view.buffer,
  } as unknown as File;
}

function snapshotWithMeta() {
  const snapshot = createEmptySnapshot('meta');
  const sheetId = snapshot.sheetOrder[0];
  const sheet = snapshot.sheets[sheetId];
  sheet.name = 'Data';
  sheet.cellData['0'] = { '0': { v: 1 } };
  const secondId = 'sheet-2';
  snapshot.sheetOrder.push(secondId);
  snapshot.sheets[secondId] = { ...sheet, id: secondId, name: 'Report', cellData: {} };
  return { snapshot, sheetId, secondId };
}

describe('名称与保护的 xlsx 往返', () => {
  it('工作簿级 + 工作表级名称都能回读', async () => {
    const { snapshot, sheetId, secondId } = snapshotWithMeta();
    const names: NamedRange[] = [
      { id: 'name-1', name: '总销售额', ref: 'Data!A1:B9' },
      { id: 'name-2', name: '本表区域', ref: 'A1:A5', sheetId: secondId, hidden: true },
    ];
    snapshot.namedRanges = names;

    const exported = await exportSnapshotToBytes(snapshot);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const imported = await importXlsxToSnapshot(fakeFile(exported.value));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const back = imported.value.namedRanges ?? [];
    expect(back).toHaveLength(2);
    expect(back[0]).toMatchObject({ name: '总销售额', ref: 'Data!A1:B9' });
    expect(back[1]).toMatchObject({ name: '本表区域', ref: 'A1:A5', hidden: true });
    // localSheetId 换成了我们的 sheetId（第二张表）
    const secondSheetId = imported.value.sheetOrder[1];
    expect(back[1].sheetId).toBe(secondSheetId);
    expect(sheetId).not.toBe(secondSheetId);
  });

  it('保护状态与密码哈希往返不变', async () => {
    const { snapshot, sheetId } = snapshotWithMeta();
    const password = {
      algorithmName: 'SHA-512',
      hashValue: 'a'.repeat(88),
      saltValue: 'c2FsdA==',
      spinCount: 100000,
    };
    const state: SheetProtectionState = {
      sheetId,
      enabled: true,
      flags: { formatCells: true, insertRows: true, selectLockedCells: false },
      password,
    };
    snapshot.syntoolsProtection = [state];

    const exported = await exportSnapshotToBytes(snapshot);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const imported = await importXlsxToSnapshot(fakeFile(exported.value));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const back = imported.value.syntoolsProtection ?? [];
    expect(back).toHaveLength(1);
    expect(back[0].enabled).toBe(true);
    expect(back[0].flags).toMatchObject({
      formatCells: true,
      insertRows: true,
      selectLockedCells: false,
    });
    expect(back[0].password).toEqual(password);
  });

  it('表格对象随文件往返，且不改写区域内单元格', async () => {
    const { snapshot, sheetId } = snapshotWithMeta();
    const sheet = snapshot.sheets[sheetId];
    sheet.cellData['0'] = { '0': { v: '商品' }, '1': { v: '金额' } };
    sheet.cellData['1'] = { '0': { v: '苹果' }, '1': { v: 12 } };
    const table: SheetTable = {
      id: 'table-1',
      name: 'Table1',
      sheetId,
      range: { startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 },
      columns: ['商品', '金额'],
      headerRow: true,
      totalsRow: false,
      style: { name: 'TableStyleMedium2', showRowStripes: true },
    };
    snapshot.syntoolsTables = [table];

    const exported = await exportSnapshotToBytes(snapshot);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const imported = await importXlsxToSnapshot(fakeFile(exported.value));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const tables = imported.value.syntoolsTables ?? [];
    expect(tables).toHaveLength(1);
    expect(tables[0]).toMatchObject({ name: 'Table1', headerRow: true });
    expect(tables[0].range).toEqual({ startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 });
    expect(tables[0].columns).toEqual(['商品', '金额']);
    // 单元格内容保持原样（导出不通过 addTable 覆写）
    const backSheet = imported.value.sheets[imported.value.sheetOrder[0]];
    expect(backSheet.cellData['0']?.['0']?.v).toBe('商品');
    expect(backSheet.cellData['1']?.['1']?.v).toBe(12);
  });

  it('没有名称/保护时不往文件里塞空块', async () => {
    const { snapshot } = snapshotWithMeta();
    const exported = await exportSnapshotToBytes(snapshot);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const imported = await importXlsxToSnapshot(fakeFile(exported.value));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.namedRanges).toBeUndefined();
    expect(imported.value.syntoolsProtection).toBeUndefined();
  });
});
