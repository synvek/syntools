import { describe, expect, it } from 'vitest';
import {
  HIGHLIGHT_LANGUAGES,
  buildHighlightSnippet,
  isHighlightLanguage,
  languageLabel,
  lineCount,
} from './core';

describe('code-highlight', () => {
  it('行数与语言', () => {
    expect(lineCount('a\nb\nc')).toBe(3);
    expect(lineCount('')).toBe(1);
    expect(languageLabel('markup')).toBe('html');
    expect(isHighlightLanguage('python')).toBe(true);
    expect(isHighlightLanguage('foo')).toBe(false);
    expect(HIGHLIGHT_LANGUAGES.length).toBeGreaterThan(8);
  });

  it('HTML 片段', () => {
    const html = buildHighlightSnippet('<span class="token">x</span>', 'javascript');
    expect(html).toContain('language-javascript');
    expect(html).toContain('<span class="token">x</span>');
  });
});
