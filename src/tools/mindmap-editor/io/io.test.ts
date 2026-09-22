import { describe, expect, it } from 'vitest';
import { buildMindTemplate } from '../model/templates';
import { emptyDoc, addChild } from '../model/tree';
import { fromMarkdown, toMarkdown } from './markdown';
import { migrateDoc, parseProjectJson, serializeDoc, toProjectJson } from './projectJson';
import type { MindDoc } from '../model/types';

describe('脑图 Markdown 互转', () => {
  it('导出为中心主题 + 标题层级', () => {
    const doc = buildMindTemplate('weekly');
    const md = toMarkdown(doc);
    const lines = md.split('\n').filter(Boolean);
    expect(lines[0].startsWith('# ')).toBe(true);
    expect(lines[1].startsWith('## ')).toBe(true);
    expect(lines[2].startsWith('### ')).toBe(true);
    expect(lines).toHaveLength(doc.nodes.length);
  });

  it('标题大纲可原样解析回树结构', () => {
    const doc = buildMindTemplate('project');
    const parsed = fromMarkdown(toMarkdown(doc))!;
    expect(parsed).not.toBeNull();
    expect(parsed.nodes).toHaveLength(doc.nodes.length);
    expect(parsed.nodes.filter((n) => n.parentId === null)).toHaveLength(1);
    expect(parsed.nodes[0].text).toBe(doc.nodes[0].text);
  });

  it('列表缩进大纲同样可解析，且层级正确', () => {
    const parsed = fromMarkdown(['- 根', '  - 子一', '    - 孙一', '  - 子二'].join('\n'))!;
    const root = parsed.nodes.find((n) => n.parentId === null)!;
    const kids = parsed.nodes.filter((n) => n.parentId === root.id);
    expect(kids.map((k) => k.text)).toEqual(['子一', '子二']);
    const grand = parsed.nodes.filter((n) => n.parentId === kids[0].id);
    expect(grand.map((g) => g.text)).toEqual(['孙一']);
  });

  it('无有效内容时返回 null', () => {
    expect(fromMarkdown('')).toBeNull();
    expect(fromMarkdown('```\ncode\n```')).toBeNull();
  });
});

describe('脑图工程文件', () => {
  it('序列化 → 解析往返内容一致', () => {
    const doc = emptyDoc();
    const built = addChild(doc.nodes, doc.rootId, '分支一');
    const source: MindDoc = { ...doc, nodes: built.nodes, direction: 'both', themeId: 'forest' };
    const parsed = parseProjectJson(toProjectJson(source))!;
    expect(parsed.rootId).toBe(source.rootId);
    expect(parsed.nodes).toHaveLength(source.nodes.length);
    expect(parsed.direction).toBe('both');
    expect(parsed.themeId).toBe('forest');
  });

  it('孤儿节点被挂到根，保证单根树', () => {
    const parsed = migrateDoc({
      rootId: 'r',
      nodes: [
        { id: 'r', parentId: null, text: '根' },
        { id: 'x', parentId: 'missing', text: '孤儿' },
      ],
    })!;
    expect(parsed.nodes.find((n) => n.id === 'x')?.parentId).toBe('r');
  });

  it('环会被打断（不会死循环）', () => {
    const parsed = migrateDoc({
      rootId: 'r',
      nodes: [
        { id: 'r', parentId: null, text: '根' },
        { id: 'a', parentId: 'b', text: 'A' },
        { id: 'b', parentId: 'a', text: 'B' },
      ],
    })!;
    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.nodes.find((n) => n.id === 'a')?.parentId).toBe('r');
  });

  it('缺少 nodes 字段时返回 null', () => {
    expect(migrateDoc({ rootId: 'r' })).toBeNull();
    expect(migrateDoc(null)).toBeNull();
  });

  it('序列化不带内部字段', () => {
    const doc = buildMindTemplate('meeting');
    const json = JSON.parse(toProjectJson(serializeDoc(doc))) as MindDoc;
    expect(json.version).toBe(1);
    expect(json.nodes.every((n) => typeof n.text === 'string')).toBe(true);
  });
});
