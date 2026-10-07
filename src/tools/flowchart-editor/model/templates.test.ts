import { describe, expect, it } from 'vitest';
import { TEMPLATE_CATEGORIES, TEMPLATES, buildTemplate, buildTemplateDoc } from './templates';
import { TEMPLATE_LABELS_I18N } from './templateLabels';
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

describe('模板文案多语种', () => {
  it('已提供语种的键集合与 en 完全一致（缺键会静默回退英文）', () => {
    const base = Object.keys(TEMPLATE_LABELS_I18N.en).sort();
    expect(base.length).toBeGreaterThan(0);
    for (const [lang, table] of Object.entries(TEMPLATE_LABELS_I18N)) {
      expect(Object.keys(table).sort(), `语种 ${lang} 的模板文案键不一致`).toEqual(base);
    }
  });

  it('zh / zh-TW 全量本地化，且与英文取值不同', () => {
    for (const lang of ['zh', 'zh-TW']) {
      const table = TEMPLATE_LABELS_I18N[lang];
      expect(table).toBeDefined();
      for (const key of Object.keys(TEMPLATE_LABELS_I18N.en)) {
        expect(table[key]?.trim(), `${lang}.${key} 缺失或为空`).toBeTruthy();
      }
      // 至少核心 token 与英文不同（避免误用英文表）
      expect(table.start).not.toBe(TEMPLATE_LABELS_I18N.en.start);
    }
  });
});
