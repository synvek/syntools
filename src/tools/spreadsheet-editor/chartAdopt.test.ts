import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  adoptChartParts,
  parseChartPart,
  parseRefRange,
  removeAnchor,
  removeRelationship,
} from './chartAdopt';
import { DEFAULT_SHEET_METRICS, buildChartXml } from './chartXml';
import { resolveChart, type ChartConfig } from './charts';
import { collectRawChartParts, type RawChartParts } from './rawChartParts';
import {
  createEmptySheet,
  exportSnapshotToBytes,
  importXlsxToSnapshot,
  type WorkbookSnapshot,
} from './xlsx-io';

/** SHEET-08 收口：导入即编辑（chart part → ChartConfig，并摘除 part） */

const SHEET_NAME = 'Sales Data';
const SHEET_ID = 's1';

const CHART: ChartConfig = {
  id: 'c1',
  type: 'bar',
  range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 },
  sheetId: SHEET_ID,
  x: 200,
  y: 120,
  width: 400,
  height: 300,
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

function makeSnapshot(charts: ChartConfig[], rawParts?: RawChartParts | null): WorkbookSnapshot {
  return {
    id: 'wb',
    name: 'book',
    appVersion: '1.0.0',
    locale: 'zhCN',
    sheetOrder: [SHEET_ID],
    sheets: {
      [SHEET_ID]: {
        ...createEmptySheet(SHEET_ID, SHEET_NAME),
        cellData: {
          '0': { '0': { v: 'Month' }, '1': { v: 'Qty' }, '2': { v: 'Growth' } },
          '1': { '0': { v: 'Jan' }, '1': { v: 10 }, '2': { v: 0.1 } },
          '2': { '0': { v: 'Feb' }, '1': { v: 20 }, '2': { v: 0.2 } },
        },
      },
    },
    styles: {},
    ...(charts.length > 0 ? { syntoolsCharts: charts } : {}),
    ...(rawParts ? { syntoolsRawParts: rawParts } : {}),
  };
}

/** 导出 → 收 part → 按真实导入路径 adopt（返回两份产物，方便断言往返） */
async function exportAndAdopt(charts: ChartConfig[]) {
  const exported = await exportSnapshotToBytes(makeSnapshot(charts));
  if (!exported.ok) throw new Error('export failed');
  const zip = await JSZip.loadAsync(toArrayBuffer(exported.value));
  const parts = await collectRawChartParts(zip);
  if (!parts) throw new Error('no chart parts collected');
  const adopted = adoptChartParts(parts, {
    sheetIdsByName: { [SHEET_NAME]: SHEET_ID },
    metricsByName: { [SHEET_NAME]: DEFAULT_SHEET_METRICS },
  });
  return { adopted, original: parts };
}

const encode = (xml: string) => Buffer.from(xml, 'utf8').toString('base64');
const decode = (value: string) => Buffer.from(value, 'base64').toString('utf8');

describe('引用解析', () => {
  it("'Sheet'!$B$2:$B$4 → 0 基闭区间", () => {
    expect(parseRefRange("'Sales Data'!$B$2:$B$4")).toEqual({
      startRow: 1,
      endRow: 3,
      startColumn: 1,
      endColumn: 1,
    });
  });

  it('单元格引用按 1×1 处理，坏引用返回 null', () => {
    expect(parseRefRange("'S'!$C$1")).toEqual({
      startRow: 0,
      endRow: 0,
      startColumn: 2,
      endColumn: 2,
    });
    expect(parseRefRange('not-a-ref')).toBeNull();
  });
});

describe('chart part 解析', () => {
  const spec = (() => {
    const resolved = resolveChart(makeSnapshot([CHART]), SHEET_ID, CHART.range, { type: 'bar' });
    if (!resolved.ok) throw new Error('spec failed');
    return resolved.value;
  })();

  it('单组柱状图：类型、区域、非双轴', () => {
    const info = parseChartPart(buildChartXml(spec, 'bar', SHEET_NAME));
    expect(info?.type).toBe('bar');
    expect(info?.range).toEqual(CHART.range);
    expect(info?.secondary).toBe(false);
    expect(info?.series).toHaveLength(1);
  });

  it('双轴：第二个图表组挂在次坐标轴', () => {
    const twoColumns = { ...CHART.range, endColumn: 2 };
    const resolved = resolveChart(makeSnapshot([CHART]), SHEET_ID, twoColumns, { type: 'bar' });
    if (!resolved.ok) throw new Error('spec failed');
    const info = parseChartPart(
      buildChartXml(resolved.value, 'bar', SHEET_NAME, { secondary: true }),
    );
    expect(info?.secondary).toBe(true);
    expect(info?.series[0].secondary).toBe(false);
    expect(info?.series[1].secondary).toBe(true);
  });

  it('曲面图这类认不出的结构返回 null', () => {
    expect(parseChartPart('<c:chartSpace><c:surfaceChart/></c:chartSpace>')).toBeNull();
  });
});

describe('导入即编辑（导出 → 导入往返）', () => {
  it('图表变成可编辑配置，位置与原值一致，part 被摘干净', async () => {
    const { adopted } = await exportAndAdopt([CHART]);
    expect(adopted.kept).toBe(0);
    expect(adopted.parts).toBeNull();
    expect(adopted.charts).toHaveLength(1);
    expect(adopted.charts[0]).toMatchObject({
      type: 'bar',
      range: CHART.range,
      sheetId: SHEET_ID,
      x: 200,
      y: 120,
      width: 400,
      height: 300,
    });
  });

  it('走真实导入入口：snapshot 直接带上可编辑图表，且不再保留 chart part', async () => {
    const exported = await exportSnapshotToBytes(makeSnapshot([CHART]));
    if (!exported.ok) throw new Error('export failed');
    const view = new Uint8Array(exported.value);
    const file = {
      name: 'charts.xlsx',
      size: view.byteLength,
      arrayBuffer: async () => view.buffer,
    } as unknown as File;

    const imported = await importXlsxToSnapshot(file);
    if (!imported.ok) throw new Error('import failed');
    const sheetId = imported.value.sheetOrder[0];
    expect(imported.value.syntoolsCharts).toHaveLength(1);
    expect(imported.value.syntoolsCharts?.[0]).toMatchObject({
      type: 'bar',
      range: CHART.range,
      sheetId,
    });
    // 转换过的图表不再以 part 形式保留，否则导出会写两份
    expect(imported.value.syntoolsRawParts).toBeUndefined();
  });

  it('再导出只有一张图、一个锚点（不会写两份）', async () => {
    const { adopted } = await exportAndAdopt([CHART]);
    const again = await exportSnapshotToBytes(makeSnapshot(adopted.charts, adopted.parts));
    if (!again.ok) throw new Error('second export failed');
    const zip = await JSZip.loadAsync(toArrayBuffer(again.value));
    const names = Object.keys(zip.files).filter((name) => /^xl\/charts\/chart\d+\.xml$/.test(name));
    expect(names).toHaveLength(1);
    const drawing = (await zip.file('xl/drawings/drawing1.xml')?.async('string')) ?? '';
    expect(drawing.match(/<xdr:oneCellAnchor>/g)).toHaveLength(1);
  });

  it('面积图与双轴柱状图都能还原类型', async () => {
    const { adopted } = await exportAndAdopt([
      { ...CHART, type: 'area' },
      {
        ...CHART,
        id: 'c2',
        secondary: true,
        range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 },
        y: 460,
      },
    ]);
    expect(adopted.charts.map((item) => item.type).sort()).toEqual(['area', 'bar']);
    const doubleAxis = adopted.charts.find((item) => item.type === 'bar');
    expect(doubleAxis?.secondary).toBe(true);
    expect(doubleAxis?.range.endColumn).toBe(2);
  });

  it('散点图回读后 X 仍按数值列解析，不会多出一个系列', async () => {
    const range = { startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 };
    const { adopted } = await exportAndAdopt([{ ...CHART, type: 'scatter', range }]);
    expect(adopted.charts[0].type).toBe('scatter');
    const resolved = resolveChart(makeSnapshot([]), SHEET_ID, adopted.charts[0].range, {
      type: 'scatter',
    });
    if (!resolved.ok) throw new Error('resolve failed');
    // A 列是 X，B/C 是系列
    expect(resolved.value.series).toHaveLength(2);
    expect(resolved.value.categories).toEqual(['Jan', 'Feb']);
  });
});

describe('摘除与降级', () => {
  const DRAWING = `<xdr:wsDr xmlns:xdr="http://x" xmlns:c="http://c" xmlns:r="http://r"><xdr:oneCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="1" cy="1"/><xdr:graphicFrame><a:graphic><a:graphicData uri="http://c"><c:chart r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame></xdr:oneCellAnchor></xdr:wsDr>`;
  const RELS =
    '<?xml version="1.0"?><Relationships xmlns="http://p"><Relationship Id="rId1" Type="http://x/relationships/chart" Target="../charts/chart1.xml"/></Relationships>';

  it('removeAnchor 只删引用该 rId 的锚点块', () => {
    expect(removeAnchor(DRAWING, 'rId1')).not.toContain('<xdr:oneCellAnchor>');
    expect(removeAnchor(DRAWING, 'rId9')).toBe(DRAWING);
  });

  it('removeRelationship 按 Id 删除', () => {
    expect(removeRelationship(RELS, 'rId1')).not.toContain('chart1.xml');
    expect(removeRelationship(RELS, 'rId9')).toBe(RELS);
  });

  it('认不出的图表原样保留（kept 计数，part 不动）', () => {
    const raw: RawChartParts = {
      version: 1,
      parts: {
        'xl/drawings/drawing1.xml': encode(DRAWING),
        'xl/drawings/_rels/drawing1.xml.rels': encode(RELS),
        'xl/charts/chart1.xml': encode('<c:chartSpace><c:surfaceChart/></c:chartSpace>'),
      },
      sheetDrawings: { [SHEET_NAME]: 'xl/drawings/drawing1.xml' },
    };
    const adopted = adoptChartParts(raw, { sheetIdsByName: { [SHEET_NAME]: SHEET_ID } });
    expect(adopted.charts).toHaveLength(0);
    expect(adopted.kept).toBe(1);
    expect(adopted.parts?.parts['xl/charts/chart1.xml']).toBeDefined();
    // 锚点与关系都还在，仍能原样写回
    expect(decode(adopted.parts?.parts['xl/drawings/drawing1.xml'] ?? '')).toContain(
      '<xdr:oneCellAnchor>',
    );
  });

  it('drawing 摘空后整份丢弃，不留悬空引用', () => {
    const spec = (() => {
      const resolved = resolveChart(makeSnapshot([CHART]), SHEET_ID, CHART.range, { type: 'bar' });
      if (!resolved.ok) throw new Error('spec failed');
      return resolved.value;
    })();
    // 用真实导出的 chart part + 上面的最小 drawing，确保"能转换 + 摘空"这条路径被覆盖
    const raw: RawChartParts = {
      version: 1,
      parts: {
        'xl/drawings/drawing1.xml': encode(DRAWING),
        'xl/drawings/_rels/drawing1.xml.rels': encode(RELS),
        'xl/charts/chart1.xml': encode(buildChartXml(spec, 'bar', SHEET_NAME)),
      },
      sheetDrawings: { [SHEET_NAME]: 'xl/drawings/drawing1.xml' },
    };
    const adopted = adoptChartParts(raw, {
      sheetIdsByName: { [SHEET_NAME]: SHEET_ID },
      metricsByName: { [SHEET_NAME]: DEFAULT_SHEET_METRICS },
    });
    expect(adopted.charts).toHaveLength(1);
    expect(adopted.parts).toBeNull();
  });
});
