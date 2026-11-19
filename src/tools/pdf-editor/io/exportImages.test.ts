import { describe, expect, it } from 'vitest';
import { exportBaseName, imageFileName, imageZipName, pdfPixelScale } from './exportImages';

describe('pdfPixelScale', () => {
  it('以 72 DPI 为基准换算渲染倍率', () => {
    expect(pdfPixelScale(96)).toBeCloseTo(96 / 72, 10);
    expect(pdfPixelScale(150)).toBeCloseTo(150 / 72, 10);
    expect(pdfPixelScale(300)).toBeCloseTo(300 / 72, 10);
  });
});

describe('imageFileName', () => {
  it('单页不带页码后缀', () => {
    expect(imageFileName('report.pdf', 3, 'png', 1)).toBe('report.png');
    expect(imageFileName('report.pdf', 3, 'jpeg', 1)).toBe('report.jpg');
  });

  it('多页使用两位页码', () => {
    expect(imageFileName('report.pdf', 3, 'png', 12)).toBe('report-p03.png');
    expect(imageFileName('report.pdf', 12, 'jpeg', 12)).toBe('report-p12.jpg');
  });

  it('文件名里的 .pdf 不区分大小写', () => {
    expect(imageFileName('A.PDF', 1, 'png', 2)).toBe('A-p01.png');
  });
});

describe('exportBaseName / imageZipName', () => {
  it('去掉扩展名，空名回退 document', () => {
    expect(exportBaseName('contract.pdf')).toBe('contract');
    expect(exportBaseName('.pdf')).toBe('document');
    expect(exportBaseName('   ')).toBe('document');
  });

  it('ZIP 名与基础名一致', () => {
    expect(imageZipName('contract.pdf')).toBe('contract-images.zip');
  });
});
