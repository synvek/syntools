import { describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';

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
});
