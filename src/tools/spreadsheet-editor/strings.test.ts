import { describe, expect, it } from 'vitest';
import { spreadsheetStrings } from './strings';

/**
 * Copy guards for the sheet editor (plan P0-1).
 *
 * The hint next to the workbook name used to say pictures and pivot tables were unsupported for
 * four releases after both shipped. Users read that sentence first; a stale claim there is worse
 * than a missing feature, so it is now asserted rather than trusted.
 */

const LANGUAGES = ['zh', 'en', 'zh-TW', 'ja', 'fr', 'de', 'it', 'es', 'pt'];

function sheet(lng: string): Record<string, unknown> {
  return spreadsheetStrings[lng].tools.sheet as Record<string, unknown>;
}

function text(lng: string, key: string): string {
  const value = sheet(lng)[key];
  expect(typeof value, `${lng}.${key}`).toBe('string');
  return value as string;
}

/** Every way the nine locales used to say "not supported" */
const DENIAL =
  /暂不支持|not supported|不支援|対応していません|non pris en charge|nicht unterstützt|non sono supportat|no se admiten|não são suportados/i;

describe('sheet copy', () => {
  it('九种语言齐全', () => {
    expect(Object.keys(spreadsheetStrings).sort()).toEqual([...LANGUAGES].sort());
  });

  it('能力提示不再声称"图片/透视表不支持"', () => {
    for (const lng of LANGUAGES) {
      expect(text(lng, 'unsupportedTip'), lng).not.toMatch(DENIAL);
    }
  });

  it('中文 / 英文的能力提示列全了四类对象，并说明限制在导出报告中披露', () => {
    expect(text('zh', 'unsupportedTip')).toContain('图表');
    expect(text('zh', 'unsupportedTip')).toContain('形状');
    expect(text('zh', 'unsupportedTip')).toContain('图片');
    expect(text('zh', 'unsupportedTip')).toContain('透视表');
    expect(text('zh', 'unsupportedTip')).toContain('xlsx');
    const en = text('en', 'unsupportedTip').toLowerCase();
    expect(en).toContain('chart');
    expect(en).toContain('shape');
    expect(en).toContain('picture');
    expect(en).toContain('pivot');
    expect(en).toContain('xlsx');
  });

  it('新增文案（zh / en）没有空值；其余语言走 i18next 英文回退', () => {
    const keys = [
      'importChartsReadonly',
      'importChartsheet',
      'importThreadedComments',
      'importMacros',
      'importPicturesReadonly',
      'a11yGridLabel',
      'a11yCell',
      'a11yRange',
    ];
    for (const lng of ['zh', 'en']) {
      for (const key of keys) {
        expect(text(lng, key).trim().length, `${lng}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('失败提示覆盖 issues.ts 的全部 code', () => {
    const codes = [
      'clipboardRead',
      'clipboardWrite',
      'panelUnavailable',
      'styleRead',
      'chartPartsUnreadable',
    ];
    for (const lng of ['zh', 'en']) {
      const issue = sheet(lng).issue as Record<string, string>;
      expect(Object.keys(issue).sort(), lng).toEqual([...codes].sort());
      for (const code of codes)
        expect(issue[code].trim().length, `${lng}.${code}`).toBeGreaterThan(0);
    }
  });

  it('导入错误码都有对应文案（否则界面会显示裸的 FILE_ENCRYPTED）', () => {
    const codes = ['FILE_ENCRYPTED', 'NOT_ZIP', 'MISSING_WORKBOOK_PART', 'PART_UNREADABLE'];
    for (const lng of ['zh', 'en']) {
      const err = sheet(lng).err as Record<string, string>;
      for (const code of codes) {
        expect(err[code], `${lng}.err.${code}`).toBeTruthy();
      }
    }
  });
});
