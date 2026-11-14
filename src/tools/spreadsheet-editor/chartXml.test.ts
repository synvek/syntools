import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  absoluteCellRef,
  absoluteRangeRef,
  addContentTypeEntries,
  appendAnchorsToDrawing,
  buildAnchorXml,
  buildChartPlan,
  buildChartXml,
  buildDrawingXml,
  computeAnchor,
  contentTypeOverride,
  EMU_PER_PX,
  ensureRelationshipNamespace,
  insertDrawingIntoSheet,
  sheetRefPrefix,
  upsertRelationship,
  DEFAULT_SHEET_METRICS,
} from './chartXml';
import { collectRawChartParts } from './rawChartParts';
import { CHART_TYPES, resolveChart, type ChartConfig } from './charts';
import { createEmptySheet, exportSnapshotToBytes, type WorkbookSnapshot } from './xlsx-io';

const SHEET_NAME = 'Sales Data';
const CHART: ChartConfig = {
  id: 'c1',
  type: 'bar',
  range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 1 },
  sheetId: 's1',
  x: 200,
  y: 120,
  width: 400,
  height: 300,
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** A workbook with a header row + 2 data rows, optionally carrying in-app charts */
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
          '0': { '0': { v: 'Month' }, '1': { v: 'Qty' }, '2': { v: 'Growth' } },
          '1': { '0': { v: 'Jan' }, '1': { v: 10 }, '2': { v: 0.1 } },
          '2': { '0': { v: 'Feb' }, '1': { v: 20 }, '2': { v: 0.2 } },
        },
      },
    },
    styles: {},
    ...overrides,
  };
}

describe('A1 引用与转义', () => {
  it('工作表名一律加引号，内部单引号翻倍', () => {
    expect(sheetRefPrefix(SHEET_NAME)).toBe("'Sales Data'");
    expect(sheetRefPrefix("Bob's")).toBe("'Bob''s'");
    expect(sheetRefPrefix('')).toBe("'Sheet1'");
  });

  it('绝对单元格 / 区域引用', () => {
    expect(absoluteCellRef(SHEET_NAME, 0, 1)).toBe("'Sales Data'!$B$1");
    expect(absoluteRangeRef(SHEET_NAME, 1, 2, 1)).toBe("'Sales Data'!$B$2:$B$3");
    expect(absoluteRangeRef(SHEET_NAME, 0, 0, 26)).toBe("'Sales Data'!$AA$1:$AA$1");
  });
});

describe('buildChartXml', () => {
  const spec = (() => {
    const resolved = resolveChart(makeSnapshot(), 's1', CHART.range);
    if (!resolved.ok) throw new Error('spec failed');
    return resolved.value;
  })();

  it('柱状图：图组、双轴、系列名与数值引用', () => {
    const xml = buildChartXml(spec, 'bar', SHEET_NAME);
    expect(xml).toContain('<c:barChart><c:barDir val="col"/>');
    expect(xml).toContain('<c:axId val="111111111"/><c:axId val="222222222"/></c:barChart>');
    expect(xml).toContain('<c:catAx>');
    expect(xml).toContain('<c:valAx>');
    // The series name points at the header cell
    expect(xml).toContain("'Sales Data'!$B$1");
    // Category / value references
    expect(xml).toContain("'Sales Data'!$A$2:$A$3");
    expect(xml).toContain("'Sales Data'!$B$2:$B$3");
    // Caches: viewers that never recalculate can still draw the chart
    expect(xml).toContain('<c:ptCount val="2"/>');
    expect(xml).toContain('<c:v>Jan</c:v>');
    expect(xml).toContain('<c:v>20</c:v>');
    expect(xml).toContain('<a:srgbClr val="5470C6"/>');
  });

  it('折线图与饼图的差异', () => {
    const line = buildChartXml(spec, 'line', SHEET_NAME);
    expect(line).toContain('<c:lineChart>');
    expect(line).toContain('<c:marker val="1"/>');
    const pie = buildChartXml(spec, 'pie', SHEET_NAME);
    expect(pie).toContain('<c:pieChart><c:varyColors val="1"/>');
    expect(pie).not.toContain('<c:catAx>');
    expect(pie).not.toContain('<a:srgbClr'); // 饼图交给 varyColors 着色
  });
});

/**
 * P1-8 图表格式化：7 类图表 × 5 个属性。
 *
 * 这里逐项断言 XML 结构，而不是只看"包含了某段文字"：OOXML 对元素的**顺序**有硬约束
 * （`dLbls` 必须在 `ser` 之后、`axId` 之前；`title` 必须在 `majorTickMark` 之前），
 * 顺序错了 Excel 会直接提示"需要修复"，而普通用户完全无法自救。
 */
describe('buildChartXml：格式化（P1-8）', () => {
  const spec = (() => {
    const resolved = resolveChart(makeSnapshot(), 's1', CHART.range);
    if (!resolved.ok) throw new Error('spec failed');
    return resolved.value;
  })();

  it('标题：7 类图表都写 <c:title>，并关闭自动标题', () => {
    for (const type of CHART_TYPES) {
      const xml = buildChartXml(spec, type, SHEET_NAME, { title: '月度销量' });
      expect(xml, type).toContain('<a:t>月度销量</a:t>');
      expect(xml, type).toContain('<c:autoTitleDeleted val="0"/>');
      // title 必须在 plotArea 之前（CT_Chart 的元素顺序）
      expect(xml.indexOf('<c:title>'), type).toBeLessThan(xml.indexOf('<c:plotArea>'));
    }
  });

  it('标题：留空 / 只有空格时只关自动标题，不写空标题框', () => {
    for (const title of ['', '   ']) {
      const xml = buildChartXml(spec, 'bar', SHEET_NAME, { title });
      expect(xml).not.toContain('<c:title>');
      expect(xml).toContain('<c:autoTitleDeleted val="1"/>');
    }
  });

  it('图例：位置映射到 b/t/r/l，none 时整段不写', () => {
    const cases = [
      ['top', 't'],
      ['right', 'r'],
      ['bottom', 'b'],
      ['left', 'l'],
    ] as const;
    for (const type of CHART_TYPES) {
      for (const [position, code] of cases) {
        const xml = buildChartXml(spec, type, SHEET_NAME, { legend: position });
        expect(xml, `${type}/${position}`).toContain(`<c:legendPos val="${code}"/>`);
      }
      const none = buildChartXml(spec, type, SHEET_NAME, { legend: 'none' });
      expect(none, type).not.toContain('<c:legend>');
    }
    // 缺省仍是底部图例（老快照的行为不变）
    expect(buildChartXml(spec, 'bar', SHEET_NAME)).toContain('<c:legendPos val="b"/>');
  });

  it('数据标签：每个图组里都有一段 dLbls，且位置在 ser 之后、axId 之前', () => {
    for (const type of CHART_TYPES) {
      const xml = buildChartXml(spec, type, SHEET_NAME, { dataLabels: true });
      expect(xml, type).toContain('<c:showVal val="1"/>');
      const dLbls = xml.indexOf('<c:dLbls>');
      expect(dLbls, type).toBeGreaterThan(xml.indexOf('<c:ser>'));
      if (type !== 'pie') {
        expect(dLbls, type).toBeLessThan(xml.indexOf('<c:axId'));
      }
    }
    expect(buildChartXml(spec, 'bar', SHEET_NAME)).not.toContain('<c:dLbls>');
  });

  it('轴标题：横轴排进 catAx、纵轴排进 valAx 且旋转 -90°', () => {
    const xml = buildChartXml(spec, 'bar', SHEET_NAME, {
      axisTitles: { x: '月份', y: '销量' },
    });
    const catAx = xml.slice(xml.indexOf('<c:catAx>'), xml.indexOf('</c:catAx>'));
    const valAx = xml.slice(xml.indexOf('<c:valAx>'), xml.indexOf('</c:valAx>'));
    expect(catAx).toContain('<a:t>月份</a:t>');
    expect(valAx).toContain('<a:t>销量</a:t>');
    expect(valAx).toContain('rot="-5400000"');
    // 轴标题必须在 majorTickMark / numFmt 之前
    expect(catAx.indexOf('<c:title>')).toBeLessThan(catAx.indexOf('<c:majorTickMark'));
    expect(valAx.indexOf('<c:title>')).toBeLessThan(valAx.indexOf('<c:numFmt'));
  });

  it('轴标题：饼图与雷达图不写（它们没有可命名的轴）', () => {
    for (const type of ['pie', 'radar'] as const) {
      const xml = buildChartXml(spec, type, SHEET_NAME, { axisTitles: { x: '月份', y: '销量' } });
      expect(xml, type).not.toContain('<a:t>月份</a:t>');
      expect(xml, type).not.toContain('<a:t>销量</a:t>');
    }
  });

  it('网格线：关掉后 valAx 里不再有 majorGridlines，缺省仍然写', () => {
    const off = buildChartXml(spec, 'bar', SHEET_NAME, { showGridlines: false });
    expect(off).not.toContain('<c:majorGridlines/>');
    const on = buildChartXml(spec, 'bar', SHEET_NAME);
    expect(on).toContain('<c:majorGridlines/>');
  });

  it('5 个属性同时打开时仍是结构完整的 chartSpace', () => {
    const xml = buildChartXml(spec, 'combo', SHEET_NAME, {
      secondary: true,
      title: '月度销量',
      legend: 'top',
      axisTitles: { x: '月份', y: '销量' },
      dataLabels: true,
      showGridlines: false,
    });
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml.match(/<c:chartSpace\b/g)).toHaveLength(1);
    expect(xml.match(/<c:plotArea>/g)).toHaveLength(1);
    expect(xml).toContain('<c:legendPos val="t"/>');
    expect(xml).toContain('<c:showVal val="1"/>');
    // 次轴仍然不画网格线，主轴被关掉了 → 整份没有 majorGridlines
    expect(xml).not.toContain('<c:majorGridlines/>');
    // 真 XML 解析一遍：拼字符串最容易出的是少一个闭合标签，Excel 会因此要求"修复"
    const parsed = new DOMParser().parseFromString(xml, 'application/xml');
    expect(parsed.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(parsed.documentElement.nodeName).toBe('c:chartSpace');
  });
});

describe('锚点换算', () => {
  it('像素 → 行列 + 偏移（扣掉行列头）', () => {
    const anchor = computeAnchor(
      { x: 200, y: 120, width: 400, height: 300 },
      DEFAULT_SHEET_METRICS,
    );
    // 200 - 46 = 154 → column 1 (93), offset 61px
    expect(anchor.col).toBe(1);
    expect(anchor.colOff).toBe(61 * EMU_PER_PX);
    // 120 - 20 = 100 → row 3 (27), offset 19px
    expect(anchor.row).toBe(3);
    expect(anchor.rowOff).toBe(19 * EMU_PER_PX);
    expect(anchor.cx).toBe(400 * EMU_PER_PX);
    expect(anchor.cy).toBe(300 * EMU_PER_PX);
  });

  it('负偏移被夹到 0', () => {
    const anchor = computeAnchor({ x: 0, y: 0, width: 10, height: 10 }, DEFAULT_SHEET_METRICS);
    expect(anchor.col).toBe(0);
    expect(anchor.row).toBe(0);
    expect(anchor.colOff).toBe(0);
  });

  it('oneCellAnchor 含 graphicFrame 与关系 id', () => {
    const xml = buildAnchorXml(
      { x: 200, y: 120, width: 400, height: 300 },
      DEFAULT_SHEET_METRICS,
      'rId7',
    );
    expect(xml).toContain('<xdr:oneCellAnchor>');
    expect(xml).toContain('<xdr:graphicFrame macro="">');
    expect(xml).toContain('drawingml/2006/chart');
    expect(xml).toContain('r:id="rId7"');
    expect(xml).toContain('<xdr:clientData/>');
  });
});

describe('关系与内容类型拼接', () => {
  it('新建 rels 并从已用编号继续', () => {
    const created = upsertRelationship(null, 'chart-rel', '../charts/chart1.xml');
    expect(created.id).toBe('rId1');
    expect(created.xml).toContain(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    );
    const next = upsertRelationship(created.xml, 'chart-rel', '../charts/chart2.xml');
    expect(next.id).toBe('rId2');
  });

  it('同 type+target 幂等复用', () => {
    const first = upsertRelationship(null, 'drawing-rel', '../drawings/drawing1.xml');
    const again = upsertRelationship(first.xml, 'drawing-rel', '../drawings/drawing1.xml');
    expect(again.id).toBe('rId1');
    expect(again.xml).toBe(first.xml);
  });

  it('工作表插入 <drawing/> 并补 r: 命名空间', () => {
    const sheet = '<?xml version="1.0"?><worksheet xmlns="http://x"><sheetData/></worksheet>';
    const next = insertDrawingIntoSheet(sheet, 'rId1');
    expect(next).toContain(
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
    );
    expect(next.indexOf('<drawing r:id="rId1"/>')).toBeLessThan(next.indexOf('</worksheet>'));
  });

  it('已有 r: 命名空间时不重复声明；tableParts 前插入', () => {
    const sheet =
      '<?xml version="1.0"?><worksheet xmlns="http://x" xmlns:r="http://r"><sheetData/><tableParts count="1"/></worksheet>';
    const next = insertDrawingIntoSheet(sheet, 'rId2');
    expect(next.match(/xmlns:r=/g)).toHaveLength(1);
    expect(next.indexOf('<drawing r:id="rId2"/>')).toBeLessThan(next.indexOf('<tableParts'));
    expect(ensureRelationshipNamespace(sheet)).toBe(sheet);
  });

  it('内容类型按 PartName / Extension 去重', () => {
    const base =
      '<Types xmlns="http://x"><Default Extension="xml" ContentType="application/xml"/></Types>';
    const merged = addContentTypeEntries(base, [
      contentTypeOverride('/xl/charts/chart1.xml', 'chart+xml'),
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Default Extension="png" ContentType="image/png"/>',
    ]);
    expect(merged).toContain('/xl/charts/chart1.xml');
    expect(merged).toContain('Extension="png"');
    expect(merged.match(/Extension="xml"/g)).toHaveLength(1);
  });

  it('往既有 drawing 追加锚点', () => {
    const base = buildDrawingXml('<xdr:oneCellAnchor/>');
    const next = appendAnchorsToDrawing(base, '<xdr:oneCellAnchor/>');
    expect(next.match(/<xdr:oneCellAnchor\/>/g)).toHaveLength(2);
    expect(next.endsWith('</xdr:wsDr>')).toBe(true);
  });
});

describe('buildChartPlan', () => {
  it('按所属工作表归集并带上度量', () => {
    const plan = buildChartPlan(makeSnapshot({ syntoolsCharts: [CHART] }));
    expect(Object.keys(plan.chartsBySheet)).toEqual([SHEET_NAME]);
    expect(plan.chartsBySheet[SHEET_NAME]).toHaveLength(1);
    expect(plan.metricsBySheet[SHEET_NAME].defaultColumnWidth).toBe(
      DEFAULT_SHEET_METRICS.defaultColumnWidth,
    );
    expect(plan.passthrough).toBeNull();
  });

  it('区域无数据时不产出图表', () => {
    const empty = makeSnapshot({
      syntoolsCharts: [
        { ...CHART, range: { startRow: 50, startColumn: 0, endRow: 51, endColumn: 1 } },
      ],
    });
    expect(Object.keys(buildChartPlan(empty).chartsBySheet)).toHaveLength(0);
  });
});

describe('导出 .xlsx：新图表类型（P2-S8）', () => {
  const exportOne = async (patch: Partial<ChartConfig>) => {
    const result = await exportSnapshotToBytes(
      makeSnapshot({ syntoolsCharts: [{ ...CHART, ...patch }] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return '';
    const zip = await JSZip.loadAsync(toArrayBuffer(result.value));
    return (await zip.file('xl/charts/chart1.xml')?.async('string')) ?? '';
  };

  it('散点图导出为 scatterChart + xVal/yVal', async () => {
    const chart = await exportOne({ type: 'scatter' });
    expect(chart).toContain('<c:scatterChart>');
    expect(chart).toContain('<c:xVal>');
    expect(chart).toContain('<c:yVal>');
  });

  it('雷达图导出为 radarChart', async () => {
    const chart = await exportOne({ type: 'radar' });
    expect(chart).toContain('<c:radarChart>');
  });

  it('组合图导出两个图表组（柱 + 折线）', async () => {
    // 组合图至少两列数据：最后一列才是折线，单列时退化为纯柱图
    const chart = await exportOne({
      type: 'combo',
      range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 },
    });
    expect(chart).toContain('<c:barChart>');
    expect(chart).toContain('<c:lineChart>');
  });

  it('单列数据的组合图不会输出空的折线组', async () => {
    const chart = await exportOne({ type: 'combo' });
    expect(chart).toContain('<c:barChart>');
    expect(chart).not.toContain('<c:lineChart>');
  });

  it('面积图导出为 areaChart（原生图表，不是图片）', async () => {
    const chart = await exportOne({ type: 'area' });
    expect(chart).toContain('<c:areaChart>');
    expect(chart).toContain('<a:alpha val="60000"/>');
  });

  it('双轴导出两组柱 + 一条共用分类轴 + 两条数值轴', async () => {
    const chart = await exportOne({
      type: 'bar',
      range: { startRow: 0, startColumn: 0, endRow: 2, endColumn: 2 },
      secondary: true,
    });
    expect(chart.match(/<c:barChart>/g)).toHaveLength(2);
    expect(chart.match(/<c:catAx>/g)).toHaveLength(1);
    expect(chart.match(/<c:valAx>/g)).toHaveLength(2);
    expect(chart).toContain('<c:axPos val="r"/>');
  });
});

describe('导出 .xlsx：注入原生图表', () => {
  it('6 处部件与引用链齐全', async () => {
    const result = await exportSnapshotToBytes(makeSnapshot({ syntoolsCharts: [CHART] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const zip = await JSZip.loadAsync(toArrayBuffer(result.value));
    const names = Object.keys(zip.files);

    expect(names).toContain('xl/charts/chart1.xml');
    expect(names).toContain('xl/drawings/drawing1.xml');
    expect(names).toContain('xl/drawings/_rels/drawing1.xml.rels');
    expect(names).toContain('xl/worksheets/_rels/sheet1.xml.rels');

    const chart = (await zip.file('xl/charts/chart1.xml')?.async('string')) ?? '';
    expect(chart).toContain('<c:barChart>');
    expect(chart).toContain("'Sales Data'!$A$2:$A$3");

    const drawing = (await zip.file('xl/drawings/drawing1.xml')?.async('string')) ?? '';
    expect(drawing).toContain('<xdr:oneCellAnchor>');
    expect(drawing).toContain('r:id="rId1"');

    const drawingRels =
      (await zip.file('xl/drawings/_rels/drawing1.xml.rels')?.async('string')) ?? '';
    expect(drawingRels).toContain('Target="../charts/chart1.xml"');

    const sheetRels =
      (await zip.file('xl/worksheets/_rels/sheet1.xml.rels')?.async('string')) ?? '';
    expect(sheetRels).toContain('Target="../drawings/drawing1.xml"');

    const sheet = (await zip.file('xl/worksheets/sheet1.xml')?.async('string')) ?? '';
    expect(sheet).toContain('<drawing r:id="rId1"/>');

    const contentTypes = (await zip.file('[Content_Types].xml')?.async('string')) ?? '';
    expect(contentTypes).toContain('/xl/charts/chart1.xml');
    expect(contentTypes).toContain('drawingml.chart+xml');
    expect(contentTypes).toContain('/xl/drawings/drawing1.xml');
    expect(contentTypes).toContain('drawing+xml');
  });

  it('没有图表时不注入任何部件', async () => {
    const result = await exportSnapshotToBytes(makeSnapshot());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const zip = await JSZip.loadAsync(toArrayBuffer(result.value));
    expect(Object.keys(zip.files).some((name) => name.startsWith('xl/charts/'))).toBe(false);
    expect(Object.keys(zip.files)).not.toContain('xl/drawings/drawing1.xml');
  });
});

describe('原生图表往返保留', () => {
  it('导出的图表部件可被收集，并在下一次导出中回填', async () => {
    const first = await exportSnapshotToBytes(makeSnapshot({ syntoolsCharts: [CHART] }));
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const zip = await JSZip.loadAsync(toArrayBuffer(first.value));
    const parts = await collectRawChartParts(zip);
    expect(parts).not.toBeNull();
    if (!parts) return;
    expect(parts.sheetDrawings[SHEET_NAME]).toBe('xl/drawings/drawing1.xml');
    expect(Object.keys(parts.parts)).toContain('xl/charts/chart1.xml');

    // Export again: no in-app charts, only the preserved native parts
    const second = await exportSnapshotToBytes(makeSnapshot({ syntoolsRawParts: parts }));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const zip2 = await JSZip.loadAsync(toArrayBuffer(second.value));
    const names = Object.keys(zip2.files);
    expect(names).toContain('xl/charts/chart1.xml');
    expect(names).toContain('xl/drawings/drawing1.xml');
    const sheet = (await zip2.file('xl/worksheets/sheet1.xml')?.async('string')) ?? '';
    expect(sheet).toContain('<drawing r:id="rId1"/>');
    const contentTypes = (await zip2.file('[Content_Types].xml')?.async('string')) ?? '';
    expect(contentTypes).toContain('/xl/charts/chart1.xml');
  });

  it('保留的原生图表与站内新图表共存（追加锚点、编号避让）', async () => {
    const first = await exportSnapshotToBytes(makeSnapshot({ syntoolsCharts: [CHART] }));
    if (!first.ok) throw new Error('first export failed');
    const parts = await collectRawChartParts(await JSZip.loadAsync(toArrayBuffer(first.value)));
    expect(parts).not.toBeNull();
    if (!parts) return;

    const added: ChartConfig = { ...CHART, id: 'c2', type: 'pie', y: 460 };
    const second = await exportSnapshotToBytes(
      makeSnapshot({ syntoolsCharts: [added], syntoolsRawParts: parts }),
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const zip = await JSZip.loadAsync(toArrayBuffer(second.value));
    const names = Object.keys(zip.files);
    // The original chart is preserved and the new one steps around its number
    expect(names).toContain('xl/charts/chart1.xml');
    expect(names).toContain('xl/charts/chart2.xml');

    const drawing = (await zip.file('xl/drawings/drawing1.xml')?.async('string')) ?? '';
    expect(drawing.match(/<xdr:oneCellAnchor>/g)).toHaveLength(2);
    const drawingRels =
      (await zip.file('xl/drawings/_rels/drawing1.xml.rels')?.async('string')) ?? '';
    expect(drawingRels).toContain('Target="../charts/chart1.xml"');
    expect(drawingRels).toContain('Target="../charts/chart2.xml"');
    // The sheet still references a single drawing, and the relationship points at the preserved one
    const sheet = (await zip.file('xl/worksheets/sheet1.xml')?.async('string')) ?? '';
    expect(sheet.match(/<drawing /g)).toHaveLength(1);
  });
});
