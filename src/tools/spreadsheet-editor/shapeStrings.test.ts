import { describe, expect, it } from 'vitest';
import { SHAPE_STRING_KEYS, shapeStrings } from './shapeStrings';
import { SHEET_SHAPE_PRESETS } from './shapes';

/**
 * Shape copy (SHEET-02).
 *
 * The rows are arrays, so the failure mode to guard is an off-by-one: a missing value would shift
 * every later key into the wrong slot and produce nonsense labels instead of a visible error.
 */

const LANGUAGES = ['zh', 'en', 'zh-TW', 'ja', 'fr', 'de', 'it', 'es', 'pt'];

describe('shapeStrings', () => {
  it('九种语言齐全', () => {
    expect(Object.keys(shapeStrings).sort()).toEqual([...LANGUAGES].sort());
  });

  it('每种语言的键集合完全一致', () => {
    for (const lng of LANGUAGES) {
      expect(Object.keys(shapeStrings[lng].tools.sheet).sort(), lng).toEqual(
        [...SHAPE_STRING_KEYS].sort(),
      );
    }
  });

  it('没有空值（空串会让工具条出现无字按钮）', () => {
    for (const lng of LANGUAGES) {
      for (const [key, value] of Object.entries(shapeStrings[lng].tools.sheet)) {
        expect(value.trim().length, `${lng}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('每个预设都有对应文案', () => {
    for (const group of SHEET_SHAPE_PRESETS) {
      for (const preset of group) {
        expect(SHAPE_STRING_KEYS).toContain(preset.labelKey);
      }
    }
  });

  it('插值占位符在翻译里没有被翻译掉', () => {
    expect(shapeStrings.zh.tools.sheet.keptShapes).toContain('{{count}}');
    expect(shapeStrings.en.tools.sheet.keptShapes).toContain('{{count}}');
  });
});
