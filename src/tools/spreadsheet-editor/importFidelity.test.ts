import { describe, expect, it } from 'vitest';
import { collectImportIssues } from './importFidelity';

/**
 * Import-side fidelity (plan P0-4).
 *
 * The failure mode to guard is over-claiming: an issue may only appear when the archive really
 * contains the part, otherwise every import would show a wall of warnings and users would learn to
 * dismiss the dialog without reading it.
 */

const codes = (parts: string[], rawChartCount = 0): string[] =>
  collectImportIssues({ parts, rawChartCount }).map((issue) => `${issue.severity}:${issue.code}`);

describe('collectImportIssues', () => {
  it('干净的工作簿不产生任何告警', () => {
    expect(codes(['xl/workbook.xml', 'xl/worksheets/sheet1.xml'])).toEqual([]);
  });

  it('原生图表只能原样保留时给出 info', () => {
    expect(codes(['xl/workbook.xml'], 2)).toEqual(['info:sheet.importChartsReadonly']);
  });

  it('图表工作表（chartsheet）在 exceljs 里读不到 → warning', () => {
    expect(codes(['xl/workbook.xml', 'xl/chartsheets/sheet1.xml'])).toEqual([
      'warning:sheet.importChartsheet',
    ]);
  });

  it('线程批注部件不会被导入 → warning，且按部件计数', () => {
    const issues = collectImportIssues({
      parts: [
        'xl/workbook.xml',
        'xl/threadedComments/threadedComment1.xml',
        'xl/threadedComments/threadedComment2.xml',
      ],
      rawChartCount: 0,
    });
    expect(issues.map((issue) => [issue.code, issue.count])).toEqual([
      ['sheet.importThreadedComments', 2],
    ]);
  });

  it('宏项目部件 → warning（导出为 .xlsx 后宏丢失）', () => {
    expect(codes(['xl/workbook.xml', 'xl/vbaProject.bin'])).toEqual(['warning:sheet.importMacros']);
  });

  it('编辑器渲染不了的图片格式给出 info，常见格式不报', () => {
    expect(
      codes([
        'xl/workbook.xml',
        'xl/media/image1.png',
        'xl/media/image2.jpeg',
        'xl/media/image3.emf',
        'xl/media/image4.svg',
      ]),
    ).toEqual(['info:sheet.importPicturesReadonly']);
  });

  it('多个问题同时出现时，loss 类排在 warning 前面（合并由 core/fidelity 负责，这里只保证都存在）', () => {
    const issues = collectImportIssues({
      parts: ['xl/workbook.xml', 'xl/chartsheets/sheet1.xml', 'xl/vbaProject.bin'],
      rawChartCount: 1,
    });
    expect(issues.map((issue) => issue.code).sort()).toEqual([
      'sheet.importChartsReadonly',
      'sheet.importChartsheet',
      'sheet.importMacros',
    ]);
  });
});
