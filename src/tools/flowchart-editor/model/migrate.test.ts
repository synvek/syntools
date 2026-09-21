import { describe, expect, it } from 'vitest';
import { activePageOf, createPage, migrateDoc, toDocV2 } from './migrate';
import { buildTemplate } from './templates';
import { defaultData } from '../core';

function v1Node(id: string, x: unknown, y: unknown) {
  return { id, type: 'shape', position: { x, y }, data: defaultData('rect', id) };
}

describe('文档迁移', () => {
  it('v1 文档迁移为 v2 单页', () => {
    const doc = migrateDoc({ version: 1, nodes: [v1Node('n1', 1, 2)], edges: [] });
    expect(doc).not.toBeNull();
    expect(doc!.version).toBe(2);
    expect(doc!.pages).toHaveLength(1);
    const page = activePageOf(doc!)!;
    expect(page.nodes).toHaveLength(1);
    expect(page.nodes[0].position).toEqual({ x: 1, y: 2 });
  });

  it('v2 文档保留多页与活动页', () => {
    const doc = migrateDoc({
      version: 2,
      pages: [createPage('A', 'p1'), createPage('B', 'p2')],
      activePageId: 'p2',
    });
    expect(doc!.pages).toHaveLength(2);
    expect(doc!.activePageId).toBe('p2');
    expect(activePageOf(doc!)!.name).toBe('B');
  });

  it('activePageId 非法时回退第一页', () => {
    const doc = migrateDoc({ version: 2, pages: [createPage('A', 'p1')], activePageId: 'missing' });
    expect(doc!.activePageId).toBe('p1');
  });

  it('非法节点被过滤且坐标归一为数字', () => {
    const doc = migrateDoc({
      version: 1,
      nodes: [v1Node('ok', 'x', null), { id: 'no-data' }, null],
      edges: [],
    });
    const page = activePageOf(doc!)!;
    expect(page.nodes).toHaveLength(1);
    expect(page.nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it('无法识别的输入返回 null', () => {
    expect(migrateDoc(null)).toBeNull();
    expect(migrateDoc({ foo: 1 })).toBeNull();
    expect(migrateDoc({ version: 2, pages: [] })).toBeNull();
  });

  it('toDocV2 生成带名称的单页文档', () => {
    const tpl = buildTemplate('basic');
    const doc = toDocV2(tpl.nodes, tpl.edges, '流程图');
    const page = activePageOf(doc)!;
    expect(page.name).toBe('流程图');
    expect(page.nodes).toHaveLength(tpl.nodes.length);
  });
});
