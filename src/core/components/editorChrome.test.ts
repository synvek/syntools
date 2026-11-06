import { afterEach, describe, expect, it } from 'vitest';
import { modifierShortcut } from './editorChrome';

/** Platform is read at call time, so stubbing it per case is enough to cover both keyboard maps. */
function stubPlatform(value: string): void {
  Object.defineProperty(navigator, 'platform', { configurable: true, value });
}

describe('modifierShortcut (P0-3.2 / P0-4.5 platform mapping)', () => {
  afterEach(() => stubPlatform(''));

  it.each([
    ['MacIntel', '⌘A'],
    ['MacARM64', '⌘A'],
    ['iPhone', '⌘A'],
    ['iPad', '⌘A'],
    ['Win32', 'Ctrl+A'],
    ['Linux x86_64', 'Ctrl+A'],
  ])('renders %s as "%s"', (platform, expected) => {
    stubPlatform(platform);
    expect(modifierShortcut('A')).toBe(expected);
  });

  it('covers every key used by the word processor shortcuts and the help panel', () => {
    stubPlatform('MacIntel');
    for (const key of ['A', 'F', 'P', 'S', 'N', 'B', 'I', 'U']) {
      expect(modifierShortcut(key)).toBe(`⌘${key}`);
    }
    stubPlatform('Win32');
    for (const key of ['A', 'F', 'P', 'S', 'N', 'B', 'I', 'U']) {
      expect(modifierShortcut(key)).toBe(`Ctrl+${key}`);
    }
  });

  it('falls back to the Ctrl form when navigator.platform is empty', () => {
    stubPlatform('');
    expect(modifierShortcut('S')).toBe('Ctrl+S');
  });
});
