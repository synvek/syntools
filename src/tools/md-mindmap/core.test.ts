import { describe, expect, it } from 'vitest';
import {
  buildMindmap,
  clampZoom,
  getMindmapTheme,
  markdownToMindmapSvg,
  parseMarkdownTree,
} from './core';

describe('md-mindmap', () => {
  it('解析标题层级', () => {
    const r = parseMarkdownTree('# A\n## B\n## C\n### D');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.text).toBe('A');
    expect(r.value.children).toHaveLength(2);
    expect(r.value.children[1].children[0].text).toBe('D');
  });

  it('解析列表', () => {
    const r = parseMarkdownTree('- root\n  - child\n  - sibling');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.text).toBe('root');
    expect(r.value.children.map((c) => c.text)).toEqual(['child', 'sibling']);
  });

  it('空输入', () => {
    expect(parseMarkdownTree('   \n')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('生成带主题的 SVG', () => {
    const r = markdownToMindmapSvg('# Hello\n- one\n- two', 'forest');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain('<svg');
    expect(r.value).toContain('Hello');
    expect(r.value).toContain(getMindmapTheme('forest').background);
  });

  it('buildMindmap 返回尺寸', () => {
    const r = buildMindmap('# Root\n## A');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.width).toBeGreaterThan(0);
    expect(r.value.height).toBeGreaterThan(0);
    expect(r.value.svg).toContain('feDropShadow');
  });

  it('clampZoom', () => {
    expect(clampZoom(0.1)).toBe(0.4);
    expect(clampZoom(3)).toBe(2.5);
    expect(clampZoom(1.234)).toBe(1.23);
  });
});
