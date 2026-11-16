import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { resolveChart } from './charts';
import { computePivot, readPivotSource } from './pivot';
import { SHEET_TEMPLATES, templateById, type SheetTemplate, type TemplateId } from './templates';
import { exportSnapshotToBytes, type WorkbookSnapshot } from './xlsx-io';

const CF_PLUGIN = 'SHEET_CONDITIONAL_FORMATTING_PLUGIN';

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

function build(id: TemplateId, locale: WorkbookSnapshot['locale'] = 'zhCN'): WorkbookSnapshot {
  const template = templateById(id) as SheetTemplate;
  return template.build(`T-${id}`, locale);
}

/** 单元格取值（模板里 cellData 的键是字符串行号/列号） */
function cell(snapshot: WorkbookSnapshot, sheetId: string, row: number, column: number) {
  return snapshot.sheets[sheetId].cellData[String(row)]?.[String(column)];
}

async function sheetXml(snapshot: WorkbookSnapshot, index = 1): Promise<string> {
  const exported = await exportSnapshotToBytes(snapshot);
  if (!exported.ok) throw new Error(exported.error);
  const zip = await JSZip.loadAsync(toArrayBuffer(exported.value));
  return (await zip.file(`xl/worksheets/sheet${index}.xml`)?.async('string')) ?? '';
}

async function chartXml(snapshot: WorkbookSnapshot): Promise<string> {
  const exported = await exportSnapshotToBytes(snapshot);
  if (!exported.ok) throw new Error(exported.error);
  const zip = await JSZip.loadAsync(toArrayBuffer(exported.value));
  return (await zip.file('xl/charts/chart1.xml')?.async('string')) ?? '';
}

/** P2-6：三份模板必须"打开就能看懂"，且真的能导出成 Excel 文件（不是只有个好看的 UI） */
describe('模板注册表', () => {
  it('三份模板都在册，id 不重复、都有标题文案 key', () => {
    expect(SHEET_TEMPLATES.map((item) => item.id)).toEqual(['budget', 'sales', 'schedule']);
    for (const template of SHEET_TEMPLATES) {
      expect(template.titleKey.startsWith('tools.sheet.template')).toBe(true);
    }
  });

  it('认不出的 id 返回 null，不抛异常', () => {
    expect(templateById('nope')).toBeNull();
    expect(templateById(null)).toBeNull();
    expect(templateById(undefined)).toBeNull();
  });

  it('两次构建互不共享数据（连续打开两次不会串内容）', () => {
    const first = build('budget');
    const second = build('budget');
    first.sheets['sheet-budget'].cellData['1']['0'] = { v: '改过了' };
    expect(second.sheets['sheet-budget'].cellData['1']['0']?.v).not.toBe('改过了');
  });
});

describe('① 预算表：公式 + 数字格式 + 条件格式', () => {
  it('表头、每行公式与合计行都在', () => {
    const snapshot = build('budget');
    const sheetId = 'sheet-budget';
    expect(snapshot.sheets[sheetId].name).toBe('Budget');
    expect(cell(snapshot, sheetId, 0, 0)?.v).toBe('项目');

    // 差额 = 预算 - 实际；使用率 = 实际 / 预算（除零保护）
    expect(cell(snapshot, sheetId, 1, 3)?.f).toBe('=B2-C2');
    expect(cell(snapshot, sheetId, 1, 4)?.f).toBe('=IF(B2=0,0,C2/B2)');
    expect(cell(snapshot, sheetId, 1, 4)?.s?.n?.pattern).toBe('0%');

    // 合计行（第 7 行）覆盖 5 条明细
    expect(cell(snapshot, sheetId, 6, 1)?.f).toBe('=SUM(B2:B6)');
    expect(cell(snapshot, sheetId, 6, 3)?.f).toBe('=SUM(D2:D6)');
    expect(cell(snapshot, sheetId, 6, 0)?.v).toBe('合计');
  });

  it('条件格式写在 Univer 资源里（导出能变成真实规则）', () => {
    const snapshot = build('budget');
    const rules = (snapshot.resources?.[CF_PLUGIN] as Record<string, Record<string, unknown[]>>)[
      'tpl-budget'
    ]['sheet-budget'];
    expect(rules).toHaveLength(1);
    const rule = (rules[0] as { rule: Record<string, unknown> }).rule;
    expect(rule).toMatchObject({ subType: 'number', operator: 'greaterThan', value: 1 });
  });

  it('导出后工作表里有条件格式与公式', async () => {
    const xml = await sheetXml(build('budget'));
    expect(xml).toContain('<conditionalFormatting');
    expect(xml).toContain('<f>B2-C2</f>');
    expect(xml).toContain('<f>SUM(B2:B6)</f>');
  });
});

describe('② 销售透视：明细 → 汇总 → 图表 / 透视', () => {
  it('汇总表用 SUMIF 引明细表，且带上缓存值', () => {
    const snapshot = build('sales');
    expect(snapshot.sheetOrder).toEqual(['sheet-data', 'sheet-summary']);
    const summary = snapshot.sheets['sheet-summary'];
    expect(summary.cellData['1']['1'].f).toContain('SUMIF(Data!$A$2:$A$13');
    // 缓存值必须和明细对得上：没有它，公式引擎算出结果前汇总列是空的
    const source = readPivotSource(snapshot, snapshot.syntoolsPivots![0]);
    const amountIndex = source.fields.findIndex((field) => field.label === '金额');
    const eastTotal = source.records
      .filter((record) => record.keys[0]?.label === '华东')
      .reduce((sum, record) => sum + Number(record.values[amountIndex] ?? 0), 0);
    expect(eastTotal).toBeGreaterThan(0);
    expect(summary.cellData['1']['1'].v).toBe(eastTotal);
  });

  it('透视配置能真的算出结果（不是一份没人用的 JSON）', () => {
    const snapshot = build('sales');
    const config = snapshot.syntoolsPivots![0];
    const source = readPivotSource(snapshot, config);
    expect(source.fields.map((field) => field.label)).toEqual([
      '区域',
      '季度',
      '产品',
      '数量',
      '金额',
    ]);
    expect(source.records).toHaveLength(12);
    const result = computePivot(config, source);
    expect(result.rowKeys).toHaveLength(4);
    expect(result.colKeys).toHaveLength(3);
    expect(result.cells[0][0]).toBeGreaterThan(0);
  });

  it('图表数据区落在汇总表上，能解析出系列', () => {
    const snapshot = build('sales');
    const config = snapshot.syntoolsCharts![0];
    expect(config.sheetId).toBe('sheet-summary');
    const spec = resolveChart(snapshot, config.sheetId!, config.range, { type: config.type });
    expect(spec.ok).toBe(true);
    if (spec.ok) expect(spec.value.series.length).toBe(1);
  });

  it('导出会写出独立的 chart part', async () => {
    const xml = await chartXml(build('sales'));
    expect(xml).toContain('<c:barChart>');
    // 引用写成数据表名（带引号与否取决于表名是否需要转义）
    expect(xml).toContain('$B$2:$B$5');
    expect(xml).toContain('Summary');
  });
});

describe('③ 项目排期：日期 + 冻结 + 形状', () => {
  it('日期是 Excel 序列，结束 = 开始 + 工期', () => {
    const snapshot = build('schedule');
    const sheetId = 'sheet-schedule';
    // 2026-11-02 → 46328（1900 日期系统，1900-01-01 = 1）
    expect(cell(snapshot, sheetId, 1, 2)?.v).toBe(46328);
    expect(cell(snapshot, sheetId, 1, 4)?.f).toBe('=C2+D2');
    expect(cell(snapshot, sheetId, 1, 4)?.v).toBe(46332);
    expect(cell(snapshot, sheetId, 1, 5)?.s?.n?.pattern).toBe('0%');
  });

  it('冻结首行 + 两个里程碑形状', () => {
    const snapshot = build('schedule');
    expect(snapshot.sheets['sheet-schedule'].freeze.ySplit).toBe(1);
    expect(snapshot.syntoolsShapes).toHaveLength(2);
    expect(snapshot.syntoolsShapes?.[0].text).toBe('里程碑 1');
    expect(snapshot.syntoolsShapes?.[1].fill).toBe('#ed7d31');
  });

  it('导出后形状进 drawing、进度规则进条件格式', async () => {
    const xml = await sheetXml(build('schedule'));
    expect(xml).toContain('<conditionalFormatting');
    const exported = await exportSnapshotToBytes(build('schedule'));
    if (!exported.ok) throw new Error(exported.error);
    const zip = await JSZip.loadAsync(toArrayBuffer(exported.value));
    const drawing = (await zip.file('xl/drawings/drawing1.xml')?.async('string')) ?? '';
    expect(drawing).toContain('<xdr:sp');
    const texts = Object.keys(zip.files).filter((name) =>
      /^xl\/drawings\/drawing\d+\.xml$/.test(name),
    );
    expect(texts.length).toBeGreaterThan(0);
  });
});

describe('语言', () => {
  it('英文环境下内容与文档标题语言一致，表名保持不变', () => {
    const template = templateById('budget') as SheetTemplate;
    const snapshot = template.build('Budget plan', 'enUS');
    expect(snapshot.locale).toBe('enUS');
    expect(snapshot.sheets['sheet-budget'].name).toBe('Budget');
    expect(snapshot.sheets['sheet-budget'].cellData['0']['0'].v).toBe('Item');
    expect(snapshot.sheets['sheet-budget'].cellData['1']['0'].v).toBe('Office supplies');
  });

  it('三份模板都能导出（模板本身就是合法的 xlsx 源）', async () => {
    for (const template of SHEET_TEMPLATES) {
      const snapshot = template.build('T', 'zhCN');
      const exported = await exportSnapshotToBytes(snapshot);
      expect(exported.ok).toBe(true);
    }
  });
});
