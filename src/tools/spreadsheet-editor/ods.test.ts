import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { FidelityIssue } from '@/core/fidelity';
import { odsToSnapshot } from './ods';

/**
 * `.ods` 导入（P2-2）。样本用 JSZip 现造：ODS 就是"一个 content.xml 的 zip"，
 * 造真文件比造 mock 更能证明解析器能吃真实结构。
 */

const HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
  <office:automatic-styles>
    <style:style style:name="bold" style:family="table-cell">
      <style:text-properties fo:font-weight="bold" fo:color="#ff0000" fo:font-size="12pt"/>
    </style:style>
    <style:style style:name="italic-center" style:family="table-cell">
      <style:paragraph-properties fo:text-align="center"/>
      <style:text-properties fo:font-style="italic" style:text-underline-style="solid"/>
    </style:style>
    <style:style style:name="boxed" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#eeeeee" fo:border="0.06pt solid #000000"/>
    </style:style>
    <style:style style:name="money" style:family="table-cell" style:data-style-name="N2"/>
  </office:automatic-styles>
  <office:body>
    <office:spreadsheet>`;

const FOOTER = `    </office:spreadsheet>
  </office:body>
</office:document-content>`;

async function odsFile(name: string, body: string): Promise<File> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.spreadsheet');
  zip.file('content.xml', `${HEADER}${body}${FOOTER}`);
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer,
  } as unknown as File;
}

function fileOf(name: string, bytes: Uint8Array): File {
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer,
  } as unknown as File;
}

const VALUES = `
      <table:table table:name="数据">
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p>姓名</text:p></table:table-cell>
          <table:table-cell office:value-type="float" office:value="128.5"><text:p>128.5</text:p></table:table-cell>
          <table:table-cell office:value-type="boolean" office:boolean-value="true"><text:p>TRUE</text:p></table:table-cell>
          <table:table-cell office:value-type="date" office:date-value="2026-03-01"><text:p>2026-03-01</text:p></table:table-cell>
        </table:table-row>
      </table:table>`;

describe('odsToSnapshot', () => {
  it('按 value-type 取值：文本 / 数值 / 布尔 / 日期保持 ISO 文本', async () => {
    const result = await odsToSnapshot(await odsFile('数据.ods', VALUES));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('数据');
    expect(result.value.sheetOrder).toHaveLength(1);
    const sheet = result.value.sheets[result.value.sheetOrder[0]];
    expect(sheet.name).toBe('数据');
    expect(sheet.cellData[0][0].v).toBe('姓名');
    expect(sheet.cellData[0][1].v).toBe(128.5);
    expect(sheet.cellData[0][2].v).toBe(true);
    // 日期不猜序列号：保留 ISO 文本，至少不会"看起来对、算出来错"
    expect(sheet.cellData[0][3].v).toBe('2026-03-01');
    expect(sheet.rowCount).toBe(1);
    expect(sheet.columnCount).toBe(4);
  });

  it('多工作表：名字与顺序都保留', async () => {
    const result = await odsToSnapshot(
      await odsFile(
        'multi.ods',
        `
      <table:table table:name="第一"><table:table-row>
        <table:table-cell office:value-type="string"><text:p>a</text:p></table:table-cell>
      </table:table-row></table:table>
      <table:table table:name="第二"><table:table-row>
        <table:table-cell office:value-type="string"><text:p>b</text:p></table:table-cell>
      </table:table-row></table:table>`,
      ),
    );
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.sheets[result.value.sheetOrder[0]].name).toBe('第一');
    expect(result.value.sheets[result.value.sheetOrder[1]].name).toBe('第二');
  });

  it('number-columns-repeated：带内容的格子展开，空重复不展开', async () => {
    const result = await odsToSnapshot(
      await odsFile(
        'repeat.ods',
        `
      <table:table table:name="表">
        <table:table-row>
          <table:table-cell office:value-type="string" table:number-columns-repeated="3"><text:p>x</text:p></table:table-cell>
          <table:table-cell table:number-columns-repeated="500"/>
          <table:table-cell office:value-type="string"><text:p>end</text:p></table:table-cell>
        </table:table-row>
      </table:table>`,
      ),
    );
    if (!result.ok) throw new Error('expected ok');
    const sheet = result.value.sheets[result.value.sheetOrder[0]];
    expect(sheet.cellData[0][0].v).toBe('x');
    expect(sheet.cellData[0][1].v).toBe('x');
    expect(sheet.cellData[0][2].v).toBe('x');
    // 500 个空单元格只推进列号，不建 500 个空对象
    expect(Object.keys(sheet.cellData[0])).toEqual(['0', '1', '2', '503']);
    expect(sheet.cellData[0][503].v).toBe('end');
  });

  it('number-rows-repeated：整行有内容时按次数展开', async () => {
    const result = await odsToSnapshot(
      await odsFile(
        'rows.ods',
        `
      <table:table table:name="表">
        <table:table-row table:number-rows-repeated="2">
          <table:table-cell office:value-type="float" office:value="7"><text:p>7</text:p></table:table-cell>
        </table:table-row>
      </table:table>`,
      ),
    );
    if (!result.ok) throw new Error('expected ok');
    const sheet = result.value.sheets[result.value.sheetOrder[0]];
    expect(sheet.cellData[0][0].v).toBe(7);
    expect(sheet.cellData[1][0].v).toBe(7);
    expect(sheet.rowCount).toBe(2);
  });

  it('合并单元格：span 转成 mergeData，被覆盖的格子不建数据', async () => {
    const result = await odsToSnapshot(
      await odsFile(
        'merge.ods',
        `
      <table:table table:name="表">
        <table:table-row>
          <table:table-cell office:value-type="string" table:number-columns-spanned="2" table:number-rows-spanned="2"><text:p>合并</text:p></table:table-cell>
          <table:covered-table-cell/>
          <table:table-cell office:value-type="string"><text:p>b</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:covered-table-cell/>
          <table:covered-table-cell/>
        </table:table-row>
      </table:table>`,
      ),
    );
    if (!result.ok) throw new Error('expected ok');
    const sheet = result.value.sheets[result.value.sheetOrder[0]];
    expect(sheet.mergeData).toEqual([{ startRow: 0, startColumn: 0, endRow: 1, endColumn: 1 }]);
    expect(sheet.cellData[0][0].v).toBe('合并');
    // 合并区域里的覆盖格没有内容
    expect(sheet.cellData[1]?.[0]).toBeUndefined();
  });

  it('样式子集：粗体 / 斜体 / 下划线 / 颜色 / 底色 / 字号（pt→px）/ 对齐', async () => {
    const result = await odsToSnapshot(
      await odsFile(
        'style.ods',
        `
      <table:table table:name="表">
        <table:table-row>
          <table:table-cell table:style-name="bold" office:value-type="string"><text:p>粗</text:p></table:table-cell>
          <table:table-cell table:style-name="italic-center" office:value-type="string"><text:p>斜</text:p></table:table-cell>
          <table:table-cell table:style-name="boxed" office:value-type="string"><text:p>框</text:p></table:table-cell>
        </table:table-row>
      </table:table>`,
      ),
    );
    if (!result.ok) throw new Error('expected ok');
    const cells = result.value.sheets[result.value.sheetOrder[0]].cellData[0];
    expect(cells[0].s).toMatchObject({ bl: 1, cl: { rgb: '#ff0000' }, fs: 16 });
    expect(cells[1].s).toMatchObject({ it: 1, ul: { s: 1 }, ht: 2 });
    expect(cells[2].s).toMatchObject({ bg: { rgb: '#eeeeee' } });
  });

  it('边框 / 数字格式这类表达不了的样式：计入 sheet.importOdsStyleLoss', async () => {
    const outcome = { issues: [] as FidelityIssue[] };
    const result = await odsToSnapshot(
      await odsFile(
        'loss.ods',
        `
      <table:table table:name="表">
        <table:table-row>
          <table:table-cell table:style-name="boxed" office:value-type="string"><text:p>框</text:p></table:table-cell>
          <table:table-cell table:style-name="money" office:value-type="float" office:value="9"><text:p>9</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>普通</text:p></table:table-cell>
        </table:table-row>
      </table:table>`,
      ),
      outcome,
    );
    expect(result.ok).toBe(true);
    expect(outcome.issues).toHaveLength(1);
    expect(outcome.issues[0]).toMatchObject({
      code: 'sheet.importOdsStyleLoss',
      severity: 'info',
      count: 2,
      messageKey: 'tools.sheet.importOdsStyleLoss',
    });
  });

  it('没有可报告的样式损失时不产出空问题', async () => {
    const outcome = { issues: [] as FidelityIssue[] };
    await odsToSnapshot(await odsFile('clean.ods', VALUES), outcome);
    expect(outcome.issues).toEqual([]);
  });

  it('缺少 content.xml：报 IMPORT_FAILED（不是"仅支持 xlsx"）', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/vnd.oasis.opendocument.spreadsheet');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const result = await odsToSnapshot(fileOf('broken.ods', bytes));
    expect(result).toEqual({ ok: false, error: 'IMPORT_FAILED' });
  });

  it('不是 zip（扩展名骗人）：报 IMPORT_FAILED 而不是抛异常', async () => {
    const result = await odsToSnapshot(
      fileOf('fake.ods', new TextEncoder().encode('this is not a zip')),
    );
    expect(result).toEqual({ ok: false, error: 'IMPORT_FAILED' });
  });

  it('content.xml 不是合法 XML：报 IMPORT_FAILED', async () => {
    const zip = new JSZip();
    zip.file('content.xml', '<office:document-content><unclosed>');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const result = await odsToSnapshot(fileOf('bad.ods', bytes));
    expect(result).toEqual({ ok: false, error: 'IMPORT_FAILED' });
  });

  it('完全没有工作表：报 IMPORT_FAILED', async () => {
    const zip = new JSZip();
    zip.file(
      'content.xml',
      `${HEADER}
    </office:spreadsheet>
  </office:body>
</office:document-content>`,
    );
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const result = await odsToSnapshot(fileOf('empty.ods', bytes));
    expect(result).toEqual({ ok: false, error: 'IMPORT_FAILED' });
  });

  it('扩展名与解析器不匹配时拒绝（避免把 xlsx 丢进 ODS 解析器）', async () => {
    const result = await odsToSnapshot(await odsFile('report.xlsx', VALUES));
    expect(result).toEqual({ ok: false, error: 'NOT_XLSX' });
  });
});
