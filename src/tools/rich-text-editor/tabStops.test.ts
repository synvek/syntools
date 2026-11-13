import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';
import {
  DEFAULT_TAB_STOP_PX,
  formatTabStops,
  insertTab,
  nextTabStop,
  normalizeTabStops,
  parseTabStops,
  removeTabBefore,
  removeTabStop,
  resolveTabAdvance,
  setTabStop,
  TAB_ATTR,
  TAB_EDGE_SAFETY_PX,
  TAB_STOPS_ATTR,
  tabsToTabNodes,
} from './tabStops';

/** 制表位（P1-4）：模型、标尺点击后的写入、Tab 键行为与导入转换 */

const editors: Editor[] = [];

function createEditor(content: string): Editor {
  const editor = new Editor({
    extensions: createExtensions({ placeholder: '输入内容…' }),
    content,
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('tab stop model', () => {
  it('sorts and drops unusable entries, keeping the first of two equal positions', () => {
    expect(
      normalizeTabStops([
        { pos: 192, align: 'right' },
        { pos: 96.4, align: 'center' },
        { pos: 96, align: 'left' },
        { pos: -8, align: 'left' },
        { pos: Number.NaN, align: 'left' },
        { pos: 96, align: 'decimal' },
      ]),
    ).toEqual([
      { pos: 96, align: 'center' },
      { pos: 192, align: 'right' },
    ]);
  });

  it('caps the list so a paste accident cannot flood the ruler', () => {
    const many = Array.from({ length: 100 }, (_, index) => ({ pos: index * 8, align: 'left' }));
    expect(normalizeTabStops(many)).toHaveLength(32);
  });

  it('round-trips the compact wire format', () => {
    const stops = [
      { pos: 96, align: 'left' as const },
      { pos: 336, align: 'decimal' as const },
    ];
    expect(formatTabStops(stops)).toBe('96:left,336:decimal');
    expect(parseTabStops('96:left,336:decimal')).toEqual(stops);
    // Garbage in the attribute (older draft, hand-edited HTML) degrades instead of throwing
    expect(parseTabStops('abc,12:nonsense,-4:left')).toEqual([{ pos: 12, align: 'left' }]);
    expect(parseTabStops(null)).toEqual([]);
  });

  it('falls back to the default 0.5in grid when the paragraph has no stop of its own', () => {
    expect(nextTabStop([], 0).pos).toBe(DEFAULT_TAB_STOP_PX);
    expect(nextTabStop([], DEFAULT_TAB_STOP_PX).pos).toBe(DEFAULT_TAB_STOP_PX * 2);
    expect(nextTabStop([], 50).pos).toBe(DEFAULT_TAB_STOP_PX * 2);
  });

  it('picks the first custom stop past the caret and keeps its alignment', () => {
    const stops = [
      { pos: 96, align: 'left' as const },
      { pos: 200, align: 'right' as const },
    ];
    expect(nextTabStop(stops, 10)).toEqual({ pos: 96, align: 'left' });
    expect(nextTabStop(stops, 96)).toEqual({ pos: 200, align: 'right' });
    // Past the last stop: back to the default grid, like Word
    expect(nextTabStop(stops, 300)).toEqual({ pos: DEFAULT_TAB_STOP_PX * 7, align: 'left' });
  });

  it('replaces a stop within 3px instead of stacking markers on one tick', () => {
    const stops = setTabStop([{ pos: 96, align: 'left' }], { pos: 98, align: 'right' });
    expect(stops).toEqual([{ pos: 98, align: 'right' }]);
  });

  it('removes only the nearest stop', () => {
    const stops = [
      { pos: 96, align: 'left' as const },
      { pos: 192, align: 'left' as const },
    ];
    expect(removeTabStop(stops, 97)).toEqual([{ pos: 192, align: 'left' }]);
    expect(removeTabStop(stops, 120)).toEqual(stops);
  });
});

describe('editor wiring', () => {
  it('Tab inserts a tab atom, not a \\t character (HTML parsing would collapse the latter)', () => {
    const editor = createEditor('<p>甲</p>');
    editor.commands.focus('end');
    expect(insertTab(editor)).toBe(true);
    const paragraph = editor.state.doc.firstChild;
    expect(paragraph?.childCount).toBe(2);
    expect(paragraph?.lastChild?.type.name).toBe('docTab');
    const html = editor.getHTML();
    expect(html).toContain(`<span ${TAB_ATTR}="true"`);
    // The atom round-trips through HTML: a reload keeps the tab (unlike a `\t` text node)
    editor.commands.setContent(html, { emitUpdate: false });
    expect(editor.state.doc.firstChild?.lastChild?.type.name).toBe('docTab');
  });

  it('does not hijack Tab inside a list (sinking stays available)', () => {
    const editor = createEditor('<ul><li><p>一</p></li></ul>');
    editor.commands.focus('end');
    expect(insertTab(editor)).toBe(false);
    expect(editor.state.doc.firstChild?.textContent).toBe('一');
  });

  it('Shift-Tab deletes the tab right before the caret and leaves anything else alone', () => {
    const editor = createEditor('<p>甲乙</p>');
    editor.commands.setTextSelection(2);
    insertTab(editor);
    // The caret lands after the atom, so back-tab removes exactly that atom
    expect(editor.state.doc.firstChild?.childCount).toBe(3);
    expect(removeTabBefore(editor)).toBe(true);
    expect(editor.state.doc.firstChild?.childCount).toBe(1);
    expect(editor.state.doc.textContent).toBe('甲乙');

    editor.commands.setTextSelection(2);
    expect(removeTabBefore(editor)).toBe(false);
  });

  it('Shift-Tab also steps back when the caret sits after the stop content', () => {
    const editor = createEditor('<p>甲乙</p>');
    editor.commands.setTextSelection(2);
    insertTab(editor);
    // 甲 ⇥ 乙, caret at the end: the text belongs to the tab field, so back-tab still steps back
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    expect(removeTabBefore(editor)).toBe(true);
    expect(editor.state.doc.textContent).toBe('甲乙');
    expect(editor.state.doc.firstChild?.childCount).toBe(1);
  });

  it('writes the stop list as data-tab-stops so drafts and .docx keep it', () => {
    const editor = createEditor('<p>甲</p>');
    editor.commands.setTextSelection(1);
    editor
      .chain()
      .setParagraphTabStops([
        { pos: 96, align: 'left' },
        { pos: 240, align: 'right' },
      ])
      .run();
    expect(editor.getHTML()).toContain(`${TAB_STOPS_ATTR}="96:left,240:right"`);
    expect(editor.state.doc.firstChild?.attrs.tabStops).toEqual([
      { pos: 96, align: 'left' },
      { pos: 240, align: 'right' },
    ]);
    editor.chain().setParagraphTabStops(null).run();
    expect(editor.getHTML()).not.toContain(TAB_STOPS_ATTR);
  });

  it('renders the atom as a span the advance can be measured on', () => {
    const editor = createEditor('<p>甲<span data-rte-tab="true"></span>乙</p>');
    const spans = Array.from(editor.view.dom.querySelectorAll('.rte-tab'));
    expect(spans).toHaveLength(1);
    // jsdom has no layout, so no measured width is applied — the default grid handles the step
    expect(spans[0]?.classList.contains('rte-tab--measured')).toBe(false);
  });
});

describe('measured advance (right-edge clamp)', () => {
  // A4 is 11906twip, one inch of margin on each side leaves 9026twip — exactly what TOC styles carry
  const CONTENT_PX = (11906 - 1440 * 2) / 15;

  it('subtracts the aligned run for right / center / decimal stops', () => {
    const right = { pos: 400, align: 'right' as const };
    expect(resolveTabAdvance(right, 100, { runWidth: 10, available: CONTENT_PX })).toBe(290);
    const center = { pos: 400, align: 'center' as const };
    expect(resolveTabAdvance(center, 100, { runWidth: 10, available: CONTENT_PX })).toBe(295);
    // Decimal aligns the '.', so only the part before it is subtracted
    const decimal = { pos: 400, align: 'decimal' as const };
    expect(
      resolveTabAdvance(decimal, 100, { runWidth: 24, dotWidth: 16, available: CONTENT_PX }),
    ).toBe(284);
  });

  it('keeps a right stop that sits exactly on the text margin from wrapping its page number', () => {
    // 9026twip rounds to 602px while the text area is 601.73px: the unclamped advance put the run 0.3px
    // past the margin and the browser wrapped the page number onto the next line
    const stop = { pos: 602, align: 'right' as const };
    const advance = resolveTabAdvance(stop, 0, { runWidth: 7, available: CONTENT_PX });
    expect(advance + 7).toBeLessThanOrEqual(CONTENT_PX);
    expect(advance).toBeCloseTo(CONTENT_PX - TAB_EDGE_SAFETY_PX - 7, 2);
  });

  it('clamps the tab box itself for a left stop past the text edge, and never goes negative', () => {
    const left = { pos: 900, align: 'left' as const };
    expect(resolveTabAdvance(left, 0, { runWidth: 0, available: CONTENT_PX })).toBeCloseTo(
      CONTENT_PX - TAB_EDGE_SAFETY_PX,
      2,
    );
    // No room left at all (tab past the edge, run wider than the line): the tab collapses instead of pushing
    expect(resolveTabAdvance(left, CONTENT_PX, { runWidth: 40, available: CONTENT_PX })).toBe(0);
  });

  it('does not clamp a stop that has room, so normal tabs keep their Word position', () => {
    const stop = { pos: 300, align: 'right' as const };
    expect(resolveTabAdvance(stop, 40, { runWidth: 12, available: CONTENT_PX })).toBe(248);
  });
});

describe('tabsToTabNodes (docx import)', () => {
  it('converts text tabs into atoms so ProseMirror keeps them', () => {
    const html = tabsToTabNodes('<p>甲\t乙\t丙</p>');
    expect(html.match(/data-rte-tab="true"/g)).toHaveLength(2);
    expect(html).not.toContain('\t');
  });

  it('leaves code blocks alone: a tab there is literal content', () => {
    const html = '<pre><code>if (x) {\n\treturn 1;\n}</code></pre>';
    expect(tabsToTabNodes(html)).toBe(html);
  });

  it('is a no-op when there is nothing to convert', () => {
    const html = '<p>甲</p>';
    expect(tabsToTabNodes(html)).toBe(html);
    expect(tabsToTabNodes('')).toBe('');
  });
});

describe('editor.css contract', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/tools/rich-text-editor/editor.css'), 'utf8');

  it('keeps the default tab interval in sync with the model', () => {
    // The browser grid and `nextTabStop`'s fallback must agree, otherwise a measured advance and a
    // default-step tab produce different widths for the same stop list
    expect(css).toContain('tab-size: 48px');
    expect(DEFAULT_TAB_STOP_PX).toBe(48);
  });

  it('gives the atom a real tab character in both the editor and the print flow', () => {
    expect(css).toContain("content: '\\0009'");
    const measured = /\.rte-tab--measured \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(measured).toContain('display: inline-block');
    // The measured box must not paint the character it measures
    expect(css).toContain('.rte-tab--measured::before');
  });
});
