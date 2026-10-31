import JSZip from 'jszip';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildShapeAnchorXml,
  buildShapeElementXml,
  buildShapePlan,
  collectSheetShapes,
  injectShapesIntoXlsx,
} from './shapesXml';
import { collectRawChartParts } from './rawChartParts';
import {
  createEmptySheet,
  exportSnapshotToBytes,
  importXlsxToSnapshot,
  type WorkbookSnapshot,
} from './xlsx-io';
import { createSheetShape, type SheetShapeConfig } from './shapes';
import type { ChartConfig } from './charts';

/**
 * `xdr:sp` round-trip (P4-SH3/SH4).
 *
 * Three failure modes are pinned here because each one makes Excel report a repair:
 * the `xdr:sp` child order, the `oneCellAnchor` offsets, and the six-part reference chain
 * (drawing / drawing rels / sheet rel / `<drawing/>` / content type / the shape itself).
 */

const SHEET_NAME = 'Report';

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const fileOf = (bytes: Uint8Array, name: string): File => {
  const buffer = toArrayBuffer(bytes);
  return { name, size: bytes.byteLength, arrayBuffer: async () => buffer } as unknown as File;
};

function shape(overrides: Partial<SheetShapeConfig> = {}): SheetShapeConfig {
  return {
    ...createSheetShape({
      prst: 'roundRect',
      from: { col: 3, row: 5, colOff: 12, rowOff: 8 },
      width: 160,
      height: 90,
      sheetId: 's1',
    }),
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<WorkbookSnapshot> = {}): WorkbookSnapshot {
  return {
    id: 'wb',
    name: 'book',
    appVersion: '1.0.0',
    locale: 'zhCN',
    sheetOrder: ['s1'],
    sheets: {
      s1: {
        ...createEmptySheet('s1', SHEET_NAME),
        cellData: {
          '0': { '0': { v: 'Month' }, '1': { v: 'Qty' } },
          '1': { '0': { v: 'Jan' }, '1': { v: 10 } },
        },
      },
    },
    styles: {},
    ...overrides,
  };
}

describe('xdr:sp 结构', () => {
  it('子元素顺序固定：nvSpPr → spPr → style → txBody', () => {
    const xml = buildShapeElementXml(shape({ text: '标签' }), 2);
    const order = ['<xdr:nvSpPr>', '<xdr:spPr>', '<xdr:style>', '<xdr:txBody>'].map((tag) =>
      xml.indexOf(tag),
    );
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('无文字时不写 txBody（空的 xdr:txBody 在 Excel 里会变成可编辑文本框）', () => {
    expect(buildShapeElementXml(shape(), 2)).not.toContain('<xdr:txBody>');
  });

  it('spPr 的几何、填充、描边与旋转都写进去', () => {
    const xml = buildShapeElementXml(
      shape({ prst: 'ellipse', fill: '#ff8800', stroke: '#112233', strokeWidth: 2, rotation: 30 }),
      3,
    );
    expect(xml).toContain('<a:prstGeom prst="ellipse">');
    expect(xml).toContain('<a:srgbClr val="FF8800"/>');
    expect(xml).toContain('<a:srgbClr val="112233"/>');
    expect(xml).toContain('w="19050"');
    expect(xml).toContain('rot="1800000"');
    expect(xml).toContain('id="3"');
  });

  it('调整值写进 avLst', () => {
    const xml = buildShapeElementXml(shape({ prst: 'roundRect', adj: { adj1: 0.25 } }), 2);
    expect(xml).toContain('<a:avLst><a:gd name="adj1" fmla="val 25000"/></a:avLst>');
  });

  it('锚点偏移按 EMU 换算，且 ext 与 spPr 的 ext 一致', () => {
    const xml = buildShapeAnchorXml(shape(), 2);
    expect(xml.startsWith('<xdr:oneCellAnchor>')).toBe(true);
    expect(xml).toContain('<xdr:col>3</xdr:col><xdr:colOff>114300</xdr:colOff>');
    expect(xml).toContain('<xdr:row>5</xdr:row><xdr:rowOff>76200</xdr:rowOff>');
    // 160 × 90 px → 1524000 / 857250 EMU，两处 ext 必须一致
    expect(xml.match(/<a:ext cx="1524000" cy="857250"\/>/g) ?? []).toHaveLength(1);
    expect(xml).toContain('<xdr:ext cx="1524000" cy="857250"/>');
    expect(xml.trimEnd().endsWith('<xdr:clientData/></xdr:oneCellAnchor>')).toBe(true);
  });
});

describe('buildShapePlan', () => {
  it('按 z 排序并挂到对应工作表名下', () => {
    const plan = buildShapePlan({
      sheets: { s1: { name: SHEET_NAME } },
      sheetOrder: ['s1'],
      syntoolsShapes: [shape({ z: 5, id: 'b' }), shape({ z: 1, id: 'a' })],
    });
    expect(plan.shapesBySheet[SHEET_NAME].map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('未知工作表回落到第一张表（形状不会因为换表而消失）', () => {
    const plan = buildShapePlan({
      sheets: { s1: { name: SHEET_NAME } },
      sheetOrder: ['s1'],
      syntoolsShapes: [shape({ sheetId: 'gone' })],
    });
    expect(plan.shapesBySheet[SHEET_NAME]).toHaveLength(1);
  });
});

describe('导出 .xlsx 注入形状', () => {
  it('六处部件与引用链齐全（无图表时自建 drawing）', async () => {
    const result = await exportSnapshotToBytes(makeSnapshot({ syntoolsShapes: [shape()] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const zip = await JSZip.loadAsync(toArrayBuffer(result.value));
    const names = Object.keys(zip.files);

    expect(names).toContain('xl/drawings/drawing1.xml');
    expect(names).toContain('xl/worksheets/_rels/sheet1.xml.rels');

    const drawing = (await zip.file('xl/drawings/drawing1.xml')?.async('string')) ?? '';
    expect(drawing).toContain('<xdr:oneCellAnchor>');
    expect(drawing).toContain('<xdr:sp macro="" textlink="">');
    expect(drawing).toContain('name="roundRect 2"');

    const sheet = (await zip.file('xl/worksheets/sheet1.xml')?.async('string')) ?? '';
    expect(sheet).toContain('<drawing r:id="rId1"/>');

    const contentTypes = (await zip.file('[Content_Types].xml')?.async('string')) ?? '';
    expect(contentTypes).toContain('/xl/drawings/drawing1.xml');
  });

  it('没有形状时不创建 drawing', async () => {
    const result = await exportSnapshotToBytes(makeSnapshot());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const zip = await JSZip.loadAsync(toArrayBuffer(result.value));
    expect(Object.keys(zip.files)).not.toContain('xl/drawings/drawing1.xml');
  });

  it('与图表共存于同一个 drawing（Excel 每张表只允许一个 <drawing/>）', async () => {
    const chart: ChartConfig = {
      id: 'c1',
      type: 'bar',
      range: { startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 },
      sheetId: 's1',
      x: 200,
      y: 40,
      width: 320,
      height: 200,
    };
    const result = await exportSnapshotToBytes(
      makeSnapshot({ syntoolsCharts: [chart], syntoolsShapes: [shape()] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const zip = await JSZip.loadAsync(toArrayBuffer(result.value));
    const drawings = Object.keys(zip.files).filter((name) =>
      /^xl\/drawings\/drawing\d+\.xml$/.test(name),
    );
    expect(drawings).toHaveLength(1);
    const drawing = (await zip.file(drawings[0])?.async('string')) ?? '';
    expect(drawing).toContain('<c:chart');
    expect(drawing).toContain('<xdr:sp');
    // 形状的 cNvPr id 必须避开图表锚点（图表从 2 起）
    expect(drawing).toContain('id="3"');
  });

  it('空计划直接返回原字节', async () => {
    const result = await exportSnapshotToBytes(makeSnapshot());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const injected = await injectShapesIntoXlsx(toArrayBuffer(result.value), { shapesBySheet: {} });
    expect(injected.byteLength).toBe(toArrayBuffer(result.value).byteLength);
  });
});

describe('导入回读', () => {
  it('自研导出 → 自研导入：prst / 锚点 / 尺寸 / 文字一致', async () => {
    const original = shape({ prst: 'star6', text: '备注', width: 140, height: 120 });
    const exported = await exportSnapshotToBytes(makeSnapshot({ syntoolsShapes: [original] }));
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const imported = await importXlsxToSnapshot(fileOf(exported.value, 'shapes.xlsx'));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const shapes = imported.value.syntoolsShapes ?? [];
    expect(shapes).toHaveLength(1);
    const [restored] = shapes;
    expect(restored.prst).toBe('star6');
    expect(restored.from).toEqual(original.from);
    expect(Math.round(restored.width)).toBe(140);
    expect(Math.round(restored.height)).toBe(120);
    expect(restored.text).toBe('备注');
    // Imported workbooks get exceljs' numeric sheet ids, so the shape must follow the restored sheet
    expect(restored.sheetId).toBe(imported.value.sheetOrder[0]);
  });

  it('形状-only 的 drawing 不再被丢弃（旧实现只保留含图表的 drawing）', async () => {
    const exported = await exportSnapshotToBytes(makeSnapshot({ syntoolsShapes: [shape()] }));
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const zip = await JSZip.loadAsync(toArrayBuffer(exported.value));
    const parts = await collectRawChartParts(zip);
    expect(parts).not.toBeNull();
    expect(Object.keys(parts?.sheetDrawings ?? {})).toEqual([SHEET_NAME]);
  });

  it('collectSheetShapes 按工作表名分组', async () => {
    const exported = await exportSnapshotToBytes(makeSnapshot({ syntoolsShapes: [shape()] }));
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const byName = await collectSheetShapes(toArrayBuffer(exported.value));
    expect(Object.keys(byName)).toEqual([SHEET_NAME]);
    expect(byName[SHEET_NAME][0].prst).toBe('roundRect');
  });

  it('没有形状的文件不会产生空数组字段', async () => {
    const exported = await exportSnapshotToBytes(makeSnapshot());
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const imported = await importXlsxToSnapshot(fileOf(exported.value, 'plain.xlsx'));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.syntoolsShapes).toBeUndefined();
  });
});

describe('注入幂等性', () => {
  let buffer: ArrayBuffer;
  beforeEach(async () => {
    const exported = await exportSnapshotToBytes(makeSnapshot({ syntoolsShapes: [shape()] }));
    if (!exported.ok) throw new Error('export failed');
    buffer = toArrayBuffer(exported.value);
  });

  it('再次注入到已有 drawing 时追加锚点而不是覆盖', async () => {
    const again = await injectShapesIntoXlsx(buffer, {
      shapesBySheet: { [SHEET_NAME]: [shape({ id: 'second', prst: 'ellipse' })] },
    });
    const zip = await JSZip.loadAsync(again);
    const drawing = (await zip.file('xl/drawings/drawing1.xml')?.async('string')) ?? '';
    expect((drawing.match(/<xdr:oneCellAnchor>/g) ?? []).length).toBe(2);
    expect(drawing).toContain('prst="ellipse"');
    // 新锚点的 id 从已有最大值继续，不允许重复
    const ids = [...drawing.matchAll(/<xdr:cNvPr[^>]*\bid="(\d+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
