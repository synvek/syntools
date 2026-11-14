import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { appendPivotSheets } from './pivotSheet';
import { readPivotSource, type PivotConfig } from './pivot';
import {
  buildPivotCacheDefinitionXml,
  buildPivotCacheRecordsXml,
  buildPivotTableDefinitionXml,
  buildPivotXlsxPlan,
  canInjectNativePivot,
  injectPivotTablesIntoXlsx,
} from './pivotXlsx';
import { collectExportIssues } from './fidelity';
import { createEmptySnapshot, exportSnapshotToBytes, type WorkbookSnapshot } from './xlsx-io';

/** 原生可刷新透视表（P2-4.6 第二批）：part 生成 + zip 注入 */

const SALES: unknown[][] = [
  ['区域', '季度', '金额'],
  ['华东', 'Q1', 100],
  ['华东', 'Q2', 50],
  ['华南', 'Q1', 30],
  ['华南', 'Q2', 20],
];

function configOf(sheetId: string, patch: Partial<PivotConfig> = {}): PivotConfig {
  return {
    id: 'pivot-1',
    name: '透视表',
    sheetId,
    range: { startRow: 0, startColumn: 0, endRow: 4, endColumn: 2 },
    rows: [0],
    cols: [1],
    values: [{ column: 2, aggregation: 'sum' }],
    filters: {},
    hasHeader: true,
    ...patch,
  };
}

function bookWithPivot(patch: Partial<PivotConfig> = {}): {
  snapshot: WorkbookSnapshot;
  config: PivotConfig;
} {
  const base = createEmptySnapshot('book');
  const sheetId = base.sheetOrder[0];
  base.sheets[sheetId].name = '数据';
  SALES.forEach((row, rowIndex) => {
    base.sheets[sheetId].cellData[String(rowIndex)] = {};
    row.forEach((value, column) => {
      base.sheets[sheetId].cellData[String(rowIndex)][String(column)] = {
        v: value as string | number,
      };
    });
  });
  const config = configOf(sheetId, patch);
  const withPivot = appendPivotSheets({ ...base, syntoolsPivots: [config] }, [config], '(空白)');
  return { snapshot: withPivot, config };
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  return doc;
}

describe('canInjectNativePivot', () => {
  it('accepts the common shape (one column field, one value field)', () => {
    const { snapshot, config } = bookWithPivot();
    const source = readPivotSource(snapshot, config);
    expect(source.records).toHaveLength(4);
    expect(canInjectNativePivot(config, source)).toBe(true);
  });

  it('accepts multi-level column fields now that the matrix expands per field', () => {
    const { snapshot, config } = bookWithPivot();
    const source = readPivotSource(snapshot, config);
    // 静态矩阵与 colFields / colItems 都按"每个列字段一行"展开，刷新前后行列数一致
    expect(canInjectNativePivot({ ...config, cols: [1, 0] }, source)).toBe(true);
  });

  it('refuses shapes the static preview cannot match', () => {
    const { snapshot, config } = bookWithPivot();
    const source = readPivotSource(snapshot, config);

    // 筛选：原生 part 的筛选是页字段，会把表整体推下去
    expect(canInjectNativePivot({ ...config, filters: { 0: ['t:华东'] } }, source)).toBe(false);
    // 截断：缓存里只有部分行，刷新后数字会变
    expect(canInjectNativePivot(config, { ...source, truncated: true })).toBe(false);
    // 没有值字段：默认 count 没有源列可指
    expect(canInjectNativePivot({ ...config, values: [] }, source)).toBe(false);
  });

  it('P1-7 的新能力退回静态值（经典透视表写不出来）', () => {
    const { snapshot, config } = bookWithPivot();
    const source = readPivotSource(snapshot, config);
    // 去重计数：需要数据模型，subtotal 枚举里没有 distinctCount
    expect(
      canInjectNativePivot(
        { ...config, values: [{ column: 2, aggregation: 'countDistinct' }] },
        source,
      ),
    ).toBe(false);
    // 占比 / 排名：静态矩阵里已经是百分比/名次，再挂 showDataAs 会二次换算
    for (const showAs of ['percentTotal', 'percentRow', 'percentColumn', 'rank'] as const) {
      expect(
        canInjectNativePivot(
          { ...config, values: [{ column: 2, aggregation: 'sum', showAs }] },
          source,
        ),
        showAs,
      ).toBe(false);
    }
    // normal 仍然放行（老配置不受影响）
    expect(
      canInjectNativePivot(
        { ...config, values: [{ column: 2, aggregation: 'sum', showAs: 'normal' }] },
        source,
      ),
    ).toBe(true);
  });

  it('falls back to static values for calculated fields', () => {
    const { snapshot, config } = bookWithPivot();
    const source = readPivotSource(snapshot, config);
    // 原生 part 要把计算字段写成 cacheField@formula，语法差异会让 Excel 报"需要修复"
    expect(
      canInjectNativePivot(
        {
          ...config,
          calcFields: [{ id: 'calc-1', name: '毛利', expression: '[金额] - 100' }],
          values: [{ column: -1, aggregation: 'sum', calcId: 'calc-1' }],
        },
        source,
      ),
    ).toBe(false);
  });
});

describe('pivot part XML', () => {
  it('plans one native part per injectable pivot', () => {
    const { snapshot } = bookWithPivot();
    const plan = buildPivotXlsxPlan(snapshot);
    expect(plan.items).toHaveLength(1);
    const item = plan.items[0];
    expect(item.sheetName).toBe('透视表 1');
    expect(item.sourceSheetName).toBe('数据');
    expect(item.sourceRef).toBe('A1:C5');
    // 表头 + 2 行 + 合计行 × 行标签 + 2 列 + 合计列
    expect(item.locationRef).toBe('A1:D4');
    expect(item.fields.map((field) => field.name)).toEqual(['区域', '季度', '金额']);
  });

  it('writes a cache definition pointing at the source range', () => {
    const item = buildPivotXlsxPlan(bookWithPivot().snapshot).items[0];
    const doc = parseXml(buildPivotCacheDefinitionXml(item, 4));
    const root = doc.documentElement;
    expect(root.nodeName).toBe('pivotCacheDefinition');
    // 打开即重算：静态值只是刷新前的画面
    expect(root.getAttribute('refreshOnLoad')).toBe('1');
    expect(root.getAttribute('recordCount')).toBe('4');
    const source = doc.querySelector('worksheetSource');
    expect(source?.getAttribute('ref')).toBe('A1:C5');
    expect(source?.getAttribute('sheet')).toBe('数据');
    expect(doc.querySelectorAll('cacheField')).toHaveLength(3);
    // 文本列共享项按透视表同一套键排序
    const first = doc.querySelectorAll('sharedItems')[0];
    expect([...first.querySelectorAll('s')].map((node) => node.getAttribute('v'))).toEqual([
      '华东',
      '华南',
    ]);
  });

  it('writes cache records that mirror the source rows', () => {
    const item = buildPivotXlsxPlan(bookWithPivot().snapshot).items[0];
    const doc = parseXml(buildPivotCacheRecordsXml(item));
    expect(doc.documentElement.getAttribute('count')).toBe('4');
    const rows = doc.querySelectorAll('r');
    expect(rows).toHaveLength(4);
    // 文本写的是共享项下标（区域: 华东=0；季度: Q1=0），不是文本本身
    const indexes = [...rows[0].querySelectorAll('s')].map((node) => node.getAttribute('v'));
    expect(indexes).toEqual(['0', '0']);
    expect(rows[0].querySelector('n')?.getAttribute('v')).toBe('100');
  });

  it('writes a pivotTable definition with axes, items and data fields', () => {
    const item = buildPivotXlsxPlan(bookWithPivot().snapshot).items[0];
    const doc = parseXml(buildPivotTableDefinitionXml(item, 1, 'PivotTable1'));
    const root = doc.documentElement;
    expect(root.getAttribute('name')).toBe('PivotTable1');
    expect(root.getAttribute('cacheId')).toBe('1');
    const location = doc.querySelector('location');
    expect(location?.getAttribute('ref')).toBe('A1:D4');
    expect(location?.getAttribute('firstDataRow')).toBe('1');

    const fields = doc.querySelectorAll('pivotField');
    expect(fields).toHaveLength(3);
    expect(fields[0].getAttribute('axis')).toBe('axisRow');
    expect(fields[1].getAttribute('axis')).toBe('axisCol');
    expect(fields[2].getAttribute('dataField')).toBe('1');

    expect(doc.querySelector('rowFields field')?.getAttribute('x')).toBe('0');
    expect(doc.querySelector('colFields field')?.getAttribute('x')).toBe('1');
    const dataField = doc.querySelector('dataField');
    expect(dataField?.getAttribute('fld')).toBe('2');
    expect(dataField?.getAttribute('subtotal')).toBe('sum');
    // 行：2 个行键 + 总计；列：2 个列键 + 总计
    expect(doc.querySelectorAll('rowItems i')).toHaveLength(3);
    expect(doc.querySelectorAll('colItems i')).toHaveLength(3);
  });

  it('keeps a value axis for multi-value pivots', () => {
    const { snapshot, config } = bookWithPivot({
      values: [
        { column: 2, aggregation: 'sum' },
        { column: 2, aggregation: 'count' },
      ],
    });
    const item = buildPivotXlsxPlan(snapshot).items[0];
    const doc = parseXml(buildPivotTableDefinitionXml(item, 1, 'PivotTable1'));
    expect(doc.querySelectorAll('dataField')).toHaveLength(2);
    // 2 个列键 × 2 个值 + 2 个合计列
    expect(doc.querySelectorAll('colItems i')).toHaveLength(6);
    // 多值字段：表头两行，数据从第 3 行开始
    expect(doc.querySelector('location')?.getAttribute('firstDataRow')).toBe('2');
    // 与静态矩阵同尺寸：2 行表头 + 2 行数据 + 1 行合计 × 行标签 + 4 个数据列 + 2 个合计列
    expect(doc.querySelector('location')?.getAttribute('ref')).toBe('A1:G5');
    expect(item.config.values).toHaveLength(2);
    expect(buildPivotXlsxPlan(snapshot).items).toHaveLength(1);
    expect(config.values).toHaveLength(2);
  });

  it('writes x children on the values axis when there is no column field', () => {
    const { snapshot } = bookWithPivot({
      cols: [],
      values: [
        { column: 2, aggregation: 'sum' },
        { column: 2, aggregation: 'count' },
      ],
    });
    const item = buildPivotXlsxPlan(snapshot).items[0];
    const doc = parseXml(buildPivotTableDefinitionXml(item, 1, 'PivotTable1'));
    // 没有列字段的多值表：Excel 用 x="-2" 表示"值"轴
    expect(doc.querySelector('colFields field')?.getAttribute('x')).toBe('-2');
    const entries = [...doc.querySelectorAll('colItems i')];
    expect(entries).toHaveLength(2);
    // 每一项都带 <x/>（Excel 自己的输出就是这样），第二项再用 i="1" 指向第二个数据字段
    expect(entries.every((entry) => entry.querySelector('x'))).toBe(true);
    expect(entries[1].getAttribute('i')).toBe('1');
    // 表头两行 → 数据从第 3 行开始，与静态矩阵（2 行表头 + 2 行数据）落在同一块区域
    expect(doc.querySelector('location')?.getAttribute('firstDataRow')).toBe('2');
    expect(doc.querySelector('location')?.getAttribute('ref')).toBe('A1:C4');
  });

  it('expands multiple column fields into per-level x children', () => {
    const { snapshot } = bookWithPivot({ cols: [1, 0] });
    const item = buildPivotXlsxPlan(snapshot).items[0];
    const doc = parseXml(buildPivotTableDefinitionXml(item, 1, 'PivotTable1'));
    // 两个列字段：colFields 按顺序各一项
    const colFields = [...doc.querySelectorAll('colFields field')];
    expect(colFields.map((node) => node.getAttribute('x'))).toEqual(['1', '0']);
    // 4 个列键 + 1 个合计列；一列一项 = 每个列字段一个 <x>
    const entries = [...doc.querySelectorAll('colItems i')];
    expect(entries).toHaveLength(5);
    expect([...entries[0].querySelectorAll('x')].map((node) => node.getAttribute('v'))).toEqual([
      '0',
      '0',
    ]);
    expect([...entries[4].querySelectorAll('x')]).toHaveLength(2);
    expect(entries[4].getAttribute('t')).toBe('grand');
    // 表头两行（每个列字段一行）+ 2 行数据 + 1 行合计 → A1:F5
    expect(doc.querySelector('location')?.getAttribute('firstDataRow')).toBe('2');
    expect(doc.querySelector('location')?.getAttribute('ref')).toBe('A1:F5');
    // 关掉自动分类汇总，否则 Excel 会自己插入 Q1 小计列，与静态矩阵对不上
    const axisFields = [...doc.querySelectorAll('pivotField[axis]')];
    expect(axisFields).toHaveLength(2);
    for (const field of axisFields) {
      expect(field.getAttribute('defaultSubtotal')).toBe('0');
      expect(field.querySelectorAll('item[t="default"]')).toHaveLength(0);
    }
  });
});

describe('injectPivotTablesIntoXlsx', () => {
  it('adds the parts, rels, workbook cache and content types Excel needs', async () => {
    const { snapshot } = bookWithPivot();
    const result = await exportSnapshotToBytes(snapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const zip = await JSZip.loadAsync(result.value);
    const names = Object.keys(zip.files);
    expect(names).toContain('xl/pivotTables/pivotTable1.xml');
    expect(names).toContain('xl/pivotCache/pivotCacheDefinition1.xml');
    expect(names).toContain('xl/pivotCache/pivotCacheRecords1.xml');

    const workbook = await zip.file('xl/workbook.xml')!.async('string');
    const cacheId = /<pivotCache\b[^>]*cacheId="(\d+)"/.exec(workbook)?.[1];
    const cacheRelId = /<pivotCache\b[^>]*r:id="(rId\d+)"/.exec(workbook)?.[1];
    expect(workbook).toMatch(/<pivotCaches count="1">/);
    expect(cacheId).toBe('1');
    expect(cacheRelId).toBeTruthy();
    // CT_Workbook 顺序：sheets → calcPr → pivotCaches；插错位置 Excel 会报修复
    expect(workbook.indexOf('<pivotCaches')).toBeGreaterThan(workbook.indexOf('</sheets>'));
    const calcPr = workbook.indexOf('<calcPr');
    if (calcPr >= 0) {
      expect(workbook.indexOf('<pivotCaches')).toBeGreaterThan(calcPr);
    }

    const workbookRels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
    expect(workbookRels).toContain(
      `<Relationship Id="${cacheRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheDefinition" Target="pivotCache/pivotCacheDefinition1.xml"/>`,
    );

    // 透视表 part 的 rels 指向缓存定义，缓存定义指向记录
    const tableRels = await zip.file('xl/pivotTables/_rels/pivotTable1.xml.rels')!.async('string');
    expect(tableRels).toContain('../pivotCache/pivotCacheDefinition1.xml');
    const cacheRels = await zip
      .file('xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels')!
      .async('string');
    expect(cacheRels).toContain('pivotCacheRecords1.xml');

    // 工作表 → 透视表只有 rels 一条路
    const sheetRelsFiles = names.filter((name) => /^xl\/worksheets\/_rels\/.*\.rels$/.test(name));
    const links = await Promise.all(
      sheetRelsFiles.map(async (name) => ({
        name,
        xml: await zip.file(name)!.async('string'),
      })),
    );
    const linked = links.find((entry) => entry.xml.includes('../pivotTables/pivotTable1.xml'));
    expect(linked).toBeTruthy();

    const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
    expect(contentTypes).toContain('pivotTable+xml');
    expect(contentTypes).toContain('pivotCacheDefinition+xml');
    expect(contentTypes).toContain('pivotCacheRecords+xml');

    // 注入后仍是合法工作簿：exceljs 能读回静态值
    const ExcelJS = (await import('exceljs')).default;
    const workbookRead = new ExcelJS.Workbook();
    await workbookRead.xlsx.load(new Uint8Array(result.value).buffer as ArrayBuffer);
    const sheet = workbookRead.getWorksheet('透视表 1');
    expect(sheet?.getCell('D2').value).toBe(150);
    expect(sheet?.getCell('D4').value).toBe(200);
  });

  it('leaves the workbook alone when nothing can be injected', async () => {
    const { snapshot } = bookWithPivot({ filters: { 0: ['t:华东'] } });
    expect(buildPivotXlsxPlan(snapshot).items).toHaveLength(0);

    const result = await exportSnapshotToBytes(snapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const zip = await JSZip.loadAsync(result.value);
    expect(Object.keys(zip.files).some((name) => name.startsWith('xl/pivotTables/'))).toBe(false);

    // 退回静态值时要明确告警
    const issues = collectExportIssues(snapshot);
    expect(issues.some((issue) => issue.code === 'sheet.pivotSnapshot')).toBe(true);
  });

  it('allocates new part numbers and cache ids when injected twice', async () => {
    const { snapshot } = bookWithPivot();
    const plan = buildPivotXlsxPlan(snapshot);
    expect(plan.items).toHaveLength(1);
    const result = await exportSnapshotToBytes(snapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const once = await injectPivotTablesIntoXlsx(new Uint8Array(result.value).buffer, plan);
    const zip = await JSZip.loadAsync(once);
    // 二次注入不覆盖已有编号
    expect(Object.keys(zip.files)).toContain('xl/pivotTables/pivotTable2.xml');
    expect(await zip.file('xl/pivotTables/pivotTable1.xml')!.async('string')).toContain(
      'name="PivotTable1"',
    );
    const workbook = await zip.file('xl/workbook.xml')!.async('string');
    expect(workbook).toMatch(/<pivotCaches count="2">/);
    expect(workbook).toContain('cacheId="2"');
    // 二次注入走的是"已有 <pivotCaches>"分支：重拼时的切片偏移错一个字符就会吃掉
    // 紧跟的 `</workbook>` 的 `<`，工作簿直接变成非法 XML
    const doc = parseXml(workbook);
    expect(doc.documentElement.nodeName).toBe('workbook');
    expect(doc.querySelector('pivotCaches')?.getAttribute('count')).toBe('2');
    expect(doc.querySelectorAll('pivotCache')).toHaveLength(2);
  });
});
