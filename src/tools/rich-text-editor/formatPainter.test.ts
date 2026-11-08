import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { applyFormat, captureFormat } from './formatPainter';
import { createExtensions } from './extensions';
import { DEFAULT_PAGE_SETUP, resolvePageMetrics } from './pageSetup';

/**
 * Format painter (implementation plan P0-5.1): the mark whitelist is what keeps the painter from
 * rewriting links / comments / revision anchors, so it gets its own unit coverage — driving the
 * ribbon's arm-then-select flow in e2e proved too dependent on focus timing.
 */

let editor: Editor | null = null;

function makeEditor(content: string): Editor {
  const created = new Editor({
    element: document.createElement('div'),
    extensions: createExtensions({
      placeholder: '输入内容…',
      onLayout: () => {},
      getPageMetrics: () => resolvePageMetrics(DEFAULT_PAGE_SETUP),
    }),
    content,
  });
  editor = created;
  return created;
}

const markNames = (marks: readonly { type: { name: string } }[]): string[] =>
  marks.map((mark) => mark.type.name).sort();

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('captureFormat', () => {
  it('captures the paintable marks of the selection', () => {
    const instance = makeEditor('<p><strong>AAA</strong> BBB</p>');
    instance.commands.setTextSelection({ from: 1, to: 4 });

    expect(markNames(captureFormat(instance))).toEqual(['bold']);
  });

  it('drops marks that are not formatting, such as links', () => {
    const instance = makeEditor('<p><a href="https://example.com">AAA</a></p>');
    instance.commands.setTextSelection({ from: 1, to: 4 });

    expect(captureFormat(instance)).toEqual([]);
  });

  it('reads the caret position, so arming works without a selection', () => {
    const instance = makeEditor('<p><strong>AAA</strong> BBB</p>');
    // Inside the bold run: `$from.marks()` reports bold even with a collapsed caret
    instance.commands.setTextSelection(2);

    expect(markNames(captureFormat(instance))).toEqual(['bold']);
  });
});

describe('applyFormat', () => {
  it('paints the captured marks onto the selection', () => {
    const instance = makeEditor('<p><strong>AAA</strong> BBB</p>');
    instance.commands.setTextSelection({ from: 1, to: 4 });
    const marks = captureFormat(instance);

    instance.commands.setTextSelection({ from: 5, to: 8 });
    expect(applyFormat(instance, marks)).toBe(true);
    expect(instance.state.doc.textBetween(5, 8)).toBe('BBB');
    expect(instance.state.doc.rangeHasMark(5, 8, instance.schema.marks.bold)).toBe(true);
  });

  it('refuses an empty selection and keeps the painter armed for the next drag', () => {
    const instance = makeEditor('<p><strong>AAA</strong> BBB</p>');
    instance.commands.setTextSelection({ from: 1, to: 4 });
    const marks = captureFormat(instance);

    instance.commands.setTextSelection(6);
    expect(applyFormat(instance, marks)).toBe(false);
    // Nothing was written, so the caller can still paint a later selection
    expect(instance.state.doc.rangeHasMark(6, 7, instance.schema.marks.bold)).toBe(false);
  });

  it('leaves non-paintable marks in place (links survive a repaint)', () => {
    const instance = makeEditor('<p><a href="https://example.com">AAA</a></p>');
    const bold = instance.schema.marks.bold.create();
    instance.commands.setTextSelection({ from: 1, to: 4 });

    expect(applyFormat(instance, [bold])).toBe(true);
    expect(instance.state.doc.rangeHasMark(1, 4, instance.schema.marks.bold)).toBe(true);
    expect(instance.state.doc.rangeHasMark(1, 4, instance.schema.marks.link)).toBe(true);
  });
});
