import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Mount smoke test (guarding render-order regressions).
 *
 * Background: `useEditor` **constructs the editor synchronously during render** and immediately runs each
 * plugin's `state.init`. So any getter called from plugin init reads refs/state that
 * must be declared before `useEditor`, otherwise it throws
 * `ReferenceError: Cannot access 'xxx' before initialization`。
 *
 * Neither tsc nor eslint catches this (referencing a later-declared variable inside a closure is legal syntax);
 * only a real mount surfaces it, so this test covers it.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'zh', changeLanguage: () => Promise.resolve() },
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('word processor mount', () => {
  it('renders the editor area without TDZ-style ordering errors during render', async () => {
    // jsdom does not implement these two APIs but the tool uses them right after mounting
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }));

    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });

    const { default: RichTextEditorTool } = await import('./RichTextEditorTool');
    let thrown: unknown = null;
    try {
      const { container } = render(<RichTextEditorTool />);
      expect(container.querySelector('.rte-surface')).toBeTruthy();
      expect(container.querySelector('[contenteditable="true"]')).toBeTruthy();
    } catch (error) {
      thrown = error;
    }

    const joined = `${errors.join('\n')}\n${String(thrown)}`;
    expect(joined).not.toContain('before initialization');
    expect(thrown).toBeNull();
    spy.mockRestore();
  });
});
