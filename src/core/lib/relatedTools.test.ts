import { describe, expect, it } from 'vitest';
import { tools, toolMap } from '@/core/registry';
import { resolveRelatedTools } from './relatedTools';

describe('resolveRelatedTools', () => {
  it('优先使用 relatedIds 且保持声明顺序', () => {
    const tool = toolMap.get('markdown-preview');
    expect(tool).toBeDefined();
    const ids = resolveRelatedTools(tool!).map((t) => t.id);
    expect(ids.slice(0, 3)).toEqual(['latex-editor', 'rich-text-editor', 'md-to-image']);
  });

  it('不会把自身列入相关工具', () => {
    for (const id of ['photo-editor', 'latex-editor', 'doodle-board']) {
      const tool = toolMap.get(id)!;
      expect(resolveRelatedTools(tool).some((t) => t.id === id)).toBe(false);
    }
  });

  it('relatedIds 不足时用同分类补齐，且不超过 limit', () => {
    const tool = toolMap.get('spreadsheet-editor')!;
    const related = resolveRelatedTools(tool, 4);
    expect(related).toHaveLength(4);
    // 前 3 个来自显式声明（可跨分类）
    expect(related.slice(0, 3).map((t) => t.id)).toEqual([
      'rich-text-editor',
      'slide-editor',
      'csv-tool',
    ]);
    // 第 4 个由同分类补齐
    expect(related[3].category).toBe('advanced');
  });

  it('忽略不存在的 relatedId', () => {
    const probe = { ...tools[0], id: '__probe__', relatedIds: ['__does-not-exist__'] };
    const ids = resolveRelatedTools(probe).map((t) => t.id);
    expect(ids).not.toContain('__does-not-exist__');
    expect(ids).not.toContain('__probe__');
  });
});

describe('注册表 relatedIds 完整性', () => {
  it('所有 relatedIds 都指向真实工具且不含自身', () => {
    const problems: string[] = [];
    for (const tool of tools) {
      for (const id of tool.relatedIds ?? []) {
        if (!toolMap.has(id)) problems.push(`${tool.id} → 未知工具 ${id}`);
        if (id === tool.id) problems.push(`${tool.id} → 指向自身`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('「文档与创作」分类的成员都声明了 relatedIds', () => {
    const missing = tools
      .filter((t) => t.category === 'advanced' && (t.relatedIds?.length ?? 0) === 0)
      .map((t) => t.id);
    expect(missing).toEqual([]);
  });

  it('迁移进「文档与创作」的三个工具首选推荐来自显式 relatedIds', () => {
    const expected: Record<string, string> = {
      'markdown-preview': 'latex-editor',
      'latex-editor': 'markdown-preview',
      'doodle-board': 'photo-editor',
    };
    for (const [id, firstRelated] of Object.entries(expected)) {
      const tool = toolMap.get(id);
      expect(tool?.category).toBe('advanced');
      expect(resolveRelatedTools(tool!)[0]?.id).toBe(firstRelated);
    }
  });
});
