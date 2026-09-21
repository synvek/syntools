import { describe, expect, it } from 'vitest';
import { TEMPLATE_CATEGORIES, TEMPLATES, buildTemplate, buildTemplateDoc } from './templates';
import { validateDoc } from '../core';
import { activePageOf } from './migrate';

describe('模板库', () => {
  it('每个模板都能构建出节点与连线', () => {
    for (const item of TEMPLATES) {
      const tpl = buildTemplate(item.kind);
      expect(tpl.nodes.length).toBeGreaterThan(0);
      expect(tpl.edges.length).toBeGreaterThan(0);
    }
  });

  it('每个分类都有模板', () => {
    for (const category of TEMPLATE_CATEGORIES) {
      expect(TEMPLATES.filter((t) => t.category === category).length).toBeGreaterThan(0);
    }
  });

  it('模板文档是合法的 v2 文档', () => {
    for (const item of TEMPLATES) {
      const doc = buildTemplateDoc(item.kind);
      expect(doc.version).toBe(2);
      expect(validateDoc(doc)).toBe(true);
      expect(activePageOf(doc)!.nodes.length).toBeGreaterThan(0);
    }
  });

  it('节点 id 唯一且连线端点都存在', () => {
    for (const item of TEMPLATES) {
      const tpl = buildTemplate(item.kind);
      const ids = new Set(tpl.nodes.map((n) => n.id));
      expect(ids.size).toBe(tpl.nodes.length);
      for (const edge of tpl.edges) {
        expect(ids.has(edge.source)).toBe(true);
        expect(ids.has(edge.target)).toBe(true);
      }
    }
  });

  it('泳道模板内部元素挂在泳道下', () => {
    const tpl = buildTemplate('swimlane');
    const lane = tpl.nodes.find((n) => n.data.kind === 'swimlane');
    expect(lane).toBeDefined();
    expect(tpl.nodes.filter((n) => n.parentId === lane!.id)).toHaveLength(4);
  });
});
