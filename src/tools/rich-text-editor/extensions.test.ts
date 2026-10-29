import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';
import { DEFAULT_PAGE_SETUP, resolvePageMetrics } from './pageSetup';

/**
 * Extension-set guard: dragging images / text blocks needs a drop cursor, or users cannot tell where it will land.
 * The dropcursor bundled with StarterKit never showed up in this project, so we register our own plugin (configurable color / width).
 */
describe('editor extension set', () => {
  it('registers the drop-cursor extension and disables the StarterKit one', () => {
    const extensions = createExtensions({ placeholder: '输入内容…' });
    const names = extensions.map((ext) => ext.name);

    expect(names).toContain('dropIndicator');
    const starterKit = extensions.find((ext) => ext.name === 'starterKit');
    expect(starterKit?.options.dropcursor).toBe(false);
  });

  it('inserts consecutive section breaks instead of replacing the previous one', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: createExtensions({
        placeholder: '输入内容…',
        onLayout: () => {},
        getPageMetrics: () => resolvePageMetrics(DEFAULT_PAGE_SETUP),
      }),
      content: '<p>hello</p>',
    });
    editor.commands.focus('end');
    editor.commands.setSectionBreak({ startType: 'nextPage' });
    editor.commands.setSectionBreak({ startType: 'continuous' });

    const topLevel: string[] = [];
    editor.state.doc.forEach((node) => topLevel.push(node.type.name));
    expect(topLevel.filter((name) => name === 'sectionBreak')).toHaveLength(2);
    editor.destroy();
  });
});
