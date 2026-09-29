import { describe, expect, it } from 'vitest';
import { slideStrings } from '../strings';
import {
  SLIDE_TEMPLATES,
  TEMPLATE_CATEGORIES,
  findTemplate,
  instantiateTemplate,
  templateSwatch,
} from './templates';

/** 把嵌套语言包摊平成 `tools.slide.*` 起始的键集合 */
function flatKeys(tree: unknown, prefix = ''): string[] {
  if (!tree || typeof tree !== 'object') return prefix ? [prefix] : [];
  const keys: string[] = [];
  for (const [key, value] of Object.entries(tree as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') keys.push(...flatKeys(value, path));
    else keys.push(path);
  }
  return keys;
}

describe('模板库', () => {
  it('至少 12 套，且 id 唯一', () => {
    expect(SLIDE_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    const ids = SLIDE_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每套都有分类，且分类都在展示列表里', () => {
    for (const template of SLIDE_TEMPLATES) {
      expect(template.category.trim().length).toBeGreaterThan(0);
      expect(TEMPLATE_CATEGORIES).toContain(template.category);
    }
  });

  it('每套都带 6 个标准版式（含空白版式）', () => {
    for (const template of SLIDE_TEMPLATES) {
      expect(template.layouts.length).toBe(6);
      expect(template.layouts.some((layout) => layout.key === 'blank')).toBe(true);
    }
  });

  it('模板名与分类都有 9 语言文案（缺键会让画廊显示原始 key）', () => {
    const missing: string[] = [];
    for (const [language, tree] of Object.entries(slideStrings)) {
      const keys = new Set(flatKeys(tree));
      for (const template of SLIDE_TEMPLATES) {
        if (!keys.has(`tools.slide.tpl${template.nameKey}`)) {
          missing.push(`${language}:tpl${template.nameKey}`);
        }
      }
      for (const category of TEMPLATE_CATEGORIES) {
        if (!keys.has(`tools.slide.tplCat${category}`))
          missing.push(`${language}:tplCat${category}`);
        if (!keys.has(`tools.slide.tplCatDesc${category}`)) {
          missing.push(`${language}:tplCatDesc${category}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('配色预览取到 4 个合法色值', () => {
    for (const template of SLIDE_TEMPLATES) {
      const swatch = templateSwatch(template);
      expect(swatch).toHaveLength(4);
      for (const color of swatch) expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('实例化后 id 全部新建，不污染模板定义', () => {
    const template = findTemplate('business-blue');
    expect(template).toBeDefined();
    if (!template) return;
    const first = instantiateTemplate(template);
    const second = instantiateTemplate(template);
    expect(first.masters[0]!.id).not.toBe(second.masters[0]!.id);
    expect(first.layouts[0]!.id).not.toBe(second.layouts[0]!.id);
    expect(first.layouts.every((layout) => layout.masterId === first.masters[0]!.id)).toBe(true);
  });

  it('未知模板 id 返回 undefined', () => {
    expect(findTemplate('nope')).toBeUndefined();
  });
});
