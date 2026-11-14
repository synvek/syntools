import { describe, expect, it } from 'vitest';
import { commitFromDraft, draftFromFormat, EMPTY_DRAFT } from './formatCells';
import { EMPTY_SHEET_FORMAT } from './sheetFormat';

/**
 * Format Cells dialog logic (P1-2).
 *
 * The rules worth fixing in tests are the ones a reviewer cannot see by clicking: which keys are
 * committed, what an empty size box means, and that "保持原样" never silently clears a border.
 */

describe('draftFromFormat', () => {
  it('空选区给出中性草稿', () => {
    expect(draftFromFormat(null)).toEqual(EMPTY_DRAFT);
  });

  it('混合态不会写进草稿：对齐回落常规/底部，字号为空', () => {
    const draft = draftFromFormat({
      ...EMPTY_SHEET_FORMAT,
      hAlign: 'mixed',
      vAlign: 'mixed',
      fontSize: null,
      bold: 'mixed',
    });
    expect(draft.hAlign).toBe('general');
    expect(draft.vAlign).toBe('bottom');
    expect(draft.fontSize).toBe('');
    expect(draft.bold).toBe(false);
  });

  it('有边框时记录线型与颜色，但默认仍选"保持原样"', () => {
    const draft = draftFromFormat({
      ...EMPTY_SHEET_FORMAT,
      border: { style: 'thin', color: '#ff0000' },
    });
    expect(draft.borderStyle).toBe('thin');
    expect(draft.borderColor).toBe('#ff0000');
    expect(draft.borderPreset).toBe('keep');
  });
});

describe('commitFromDraft', () => {
  it('一次提交带齐字体 / 数字 / 对齐键', () => {
    const { patch } = commitFromDraft({
      ...EMPTY_DRAFT,
      numberFormat: '#,##0.00',
      fontFamily: 'Arial',
      fontSize: '13.5',
      bold: true,
      hAlign: 'right',
      vAlign: 'middle',
      wrap: true,
    });
    expect(patch).toMatchObject({
      numberFormat: '#,##0.00',
      fontFamily: 'Arial',
      fontSize: 13.5,
      bold: true,
      hAlign: 'right',
      vAlign: 'middle',
      wrap: true,
    });
  });

  it('空字号表示"不设覆盖"，而不是 0', () => {
    expect(commitFromDraft({ ...EMPTY_DRAFT, fontSize: '  ' }).patch.fontSize).toBeNull();
  });

  it('清空颜色 / 填充写入 null（回到自动），空数字格式写入 null（回到常规）', () => {
    const { patch } = commitFromDraft({ ...EMPTY_DRAFT, color: '', fill: '', numberFormat: '' });
    expect(patch.color).toBeNull();
    expect(patch.fill).toBeNull();
    expect(patch.numberFormat).toBeNull();
  });

  it('"保持原样"不产生边框命令', () => {
    expect(commitFromDraft({ ...EMPTY_DRAFT, borderPreset: 'keep' }).border).toBeNull();
  });

  it('选定的边框预设连同线型与颜色一起提交', () => {
    const commit = commitFromDraft({
      ...EMPTY_DRAFT,
      borderPreset: 'outside',
      borderStyle: 'dashed',
      borderColor: '#123456',
    });
    expect(commit.border).toEqual({
      preset: 'outside',
      spec: { style: 'dashed', color: '#123456' },
    });
  });

  it('字号按 Excel 规则夹取到 1–409', () => {
    expect(commitFromDraft({ ...EMPTY_DRAFT, fontSize: '9999' }).patch.fontSize).toBe(409);
    expect(commitFromDraft({ ...EMPTY_DRAFT, fontSize: '0' }).patch.fontSize).toBeNull();
  });
});
