import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MERMAID,
  MERMAID_THEMES,
  buildMermaidInitConfig,
  clampZoom,
  getMermaidTheme,
  injectSvgBackground,
  parseSvgSize,
  validateMermaidSource,
} from './core';

describe('mermaid-editor', () => {
  it('校验非空', () => {
    expect(validateMermaidSource('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(validateMermaidSource('   ')).toEqual({ ok: false, error: 'EMPTY' });
    const r = validateMermaidSource(DEFAULT_MERMAID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.startsWith('flowchart')).toBe(true);
  });

  it('主题配置', () => {
    expect(MERMAID_THEMES.length).toBeGreaterThanOrEqual(6);
    const ocean = getMermaidTheme('ocean');
    expect(ocean.mermaidTheme).toBe('base');
    expect(buildMermaidInitConfig(ocean).themeVariables).toBeTruthy();
    expect(buildMermaidInitConfig(getMermaidTheme('dark')).theme).toBe('dark');
  });

  it('clampZoom / parseSvgSize / injectSvgBackground', () => {
    expect(clampZoom(0.1)).toBe(0.4);
    expect(clampZoom(3)).toBe(2.5);
    expect(parseSvgSize('<svg viewBox="0 0 200 100"></svg>')).toEqual({
      width: 200,
      height: 100,
    });
    const withBg = injectSvgBackground('<svg width="10" height="10"></svg>', '#fff');
    expect(withBg).toContain('fill="#fff"');
  });
});
