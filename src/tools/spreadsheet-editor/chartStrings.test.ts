import { describe, expect, it } from 'vitest';
import {
  CHART_LEGEND_LABEL_KEY,
  CHART_LEGEND_POSITIONS,
  CHART_TYPE_LABEL_KEY,
  CHART_TYPES,
} from './charts';
import { chartStrings } from './chartStrings';

/**
 * 图表面板文案（P1-8 新增了"图表设置"整组）。
 *
 * 守的是"少一种语言就少一个能用的按钮"：图例位置这类枚举一旦某语言缺 key，
 * 界面上就是一个空的下拉项，用户看不出是没翻译还是坏了。
 */

const LANGUAGES = ['zh', 'en', 'zh-TW', 'ja', 'fr', 'de', 'it', 'es', 'pt'];

describe('chartStrings', () => {
  it('九种语言齐全', () => {
    expect(Object.keys(chartStrings).sort()).toEqual([...LANGUAGES].sort());
  });

  it('每种语言的键集合完全一致', () => {
    const expected = Object.keys(chartStrings.zh.tools.sheet).sort();
    for (const lng of LANGUAGES) {
      expect(Object.keys(chartStrings[lng].tools.sheet).sort(), lng).toEqual(expected);
    }
  });

  it('没有空值（空串会让面板出现无字按钮）', () => {
    for (const lng of LANGUAGES) {
      for (const [key, value] of Object.entries(chartStrings[lng].tools.sheet)) {
        expect(value.trim().length, `${lng}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('7 种图表类型与 5 个图例位置都有文案', () => {
    const keys = new Set(Object.keys(chartStrings.zh.tools.sheet));
    for (const type of CHART_TYPES) expect(keys.has(CHART_TYPE_LABEL_KEY[type]), type).toBe(true);
    for (const position of CHART_LEGEND_POSITIONS) {
      expect(keys.has(CHART_LEGEND_LABEL_KEY[position]), position).toBe(true);
    }
  });

  it('格式化面板的每一项在九种语言里都有', () => {
    const required = [
      'chartSettings',
      'chartTitleLabel',
      'chartTitlePlaceholder',
      'chartLegendLabel',
      'chartAxisX',
      'chartAxisY',
      'chartDataLabels',
      'chartGridlines',
    ];
    for (const lng of LANGUAGES) {
      for (const key of required) {
        expect(chartStrings[lng].tools.sheet[key], `${lng}.${key}`).toBeTruthy();
      }
    }
  });

  it('插值占位符在翻译里没有被翻译掉', () => {
    expect(chartStrings.zh.tools.sheet.chartImported).toContain('{{count}}');
    expect(chartStrings.en.tools.sheet.chartKept).toContain('{{count}}');
  });
});
