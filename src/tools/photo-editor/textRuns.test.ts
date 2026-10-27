import { describe, expect, it } from 'vitest';
import {
  applyRunStyleToRange,
  effectiveRuns,
  hasRichText,
  rangeRunStyle,
  remapRunsAfterTextEdit,
  resolveRunStyle,
  runsToText,
} from './model/textRuns';
import type { TextLayer } from './model/types';

const textLayer = (over: Partial<TextLayer> = {}): TextLayer =>
  ({
    id: 't1',
    kind: 'text',
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: 0,
    y: 0,
    width: 200,
    height: 30,
    rotation: 0,
    flipX: false,
    flipY: false,
    text: 'hello',
    fontSize: 20,
    fontFamily: 'Arial',
    fill: '#111827',
    bold: false,
    italic: false,
    underline: false,
    align: 'left',
    lineHeight: 1.4,
    letterSpacing: 0,
    paragraphSpacing: 0,
    warp: { kind: 'none', bend: 0, horizontal: 0 },
    direction: 'horizontal',
    ...over,
  }) as TextLayer;

describe('text runs: rich text helpers', () => {
  it('a plain layer has a single default run and is not rich', () => {
    const layer = textLayer();
    expect(effectiveRuns(layer)).toEqual([{ text: 'hello' }]);
    expect(hasRichText(layer)).toBe(false);
  });

  it('a single run with overrides is still rich (whole-text styling must render through runs)', () => {
    expect(hasRichText({ runs: [{ text: 'hello', style: { bold: true } }] })).toBe(true);
    expect(hasRichText({ runs: [{ text: 'hello' }] })).toBe(false);
  });

  it('resolveRunStyle falls back to the layer defaults', () => {
    const layer = textLayer({ bold: true, fill: '#FF0000', fontSize: 18 });
    expect(resolveRunStyle(layer, { italic: true })).toEqual({
      bold: true,
      italic: true,
      underline: false,
      fill: '#FF0000',
      fontSize: 18,
    });
  });

  it('applying a style to a range splits the text and only changes that range', () => {
    const layer = textLayer();
    const runs = applyRunStyleToRange(layer, 1, 3, { bold: true });
    expect(runsToText(runs)).toBe('hello');
    expect(runs).toEqual([{ text: 'h' }, { text: 'el', style: { bold: true } }, { text: 'lo' }]);
    expect(hasRichText({ runs })).toBe(true);
  });

  it('same-style neighbours merge back into one run', () => {
    const layer = textLayer({
      runs: [{ text: 'hel', style: { bold: true } }, { text: 'lo' }],
    });
    const runs = applyRunStyleToRange(layer, 0, 3, { bold: true });
    expect(runs).toEqual([{ text: 'hel', style: { bold: true } }, { text: 'lo' }]);
  });

  it('editing text keeps the styles of the unchanged prefix and suffix', () => {
    const layer = textLayer({
      text: 'hello',
      runs: [{ text: 'hel', style: { bold: true } }, { text: 'lo' }],
    });
    // Insert an "X" in the middle of the plain run: it inherits the style of the preceding char
    const runs = remapRunsAfterTextEdit(layer, 'helloX');
    expect(runsToText(runs!)).toBe('helloX');
    expect(runs).toEqual([{ text: 'hel', style: { bold: true } }, { text: 'loX' }]);
  });

  it('rewriting a character inside a styled run keeps the run style', () => {
    const layer = textLayer({
      text: 'hello',
      runs: [{ text: 'h' }, { text: 'ell', style: { italic: true } }, { text: 'o' }],
    });
    const runs = remapRunsAfterTextEdit(layer, 'hexlo');
    expect(runsToText(runs!)).toBe('hexlo');
    // The inserted "x" inherits the italic style of the character before it
    expect(runs?.find((run) => run.text.includes('exl'))?.style).toEqual({ italic: true });
  });

  it('plain layers never gain runs from a text edit', () => {
    expect(remapRunsAfterTextEdit(textLayer(), 'changed')).toBeUndefined();
  });

  it('rangeRunStyle reports only the flags shared by every character', () => {
    const layer = textLayer({
      runs: [
        { text: 'ab', style: { bold: true } },
        { text: 'cd', style: { bold: true, italic: true } },
      ],
    });
    expect(rangeRunStyle(layer, 0, 4)).toEqual({ bold: true });
    expect(rangeRunStyle(layer, 0, 2)).toEqual({ bold: true });
  });
});
