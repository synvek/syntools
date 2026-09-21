import { describe, expect, it } from 'vitest';
import { buildTemplateDoc } from '../model/templates';
import { activePageOf } from '../model/migrate';
import { parseProjectJson, toProjectJson } from './projectJson';
import { toMermaid } from './mermaidIo';
import { kindOfStyle, parseDrawioXml, toDrawioXml } from './drawio';

const basic = () => buildTemplateDoc('basic');

describe('项目 JSON', () => {
  it('序列化后能解析回来', () => {
    const doc = basic();
    const back = parseProjectJson(toProjectJson(doc));
    expect(back).not.toBeNull();
    expect(activePageOf(back!)!.nodes).toHaveLength(activePageOf(doc)!.nodes.length);
    expect(activePageOf(back!)!.edges).toHaveLength(activePageOf(doc)!.edges.length);
  });

  it('内容与坐标保持一致', () => {
    const doc = basic();
    const src = activePageOf(doc)!;
    const page = activePageOf(parseProjectJson(toProjectJson(doc))!)!;
    expect(page.nodes[0].data.label).toBe(src.nodes[0].data.label);
    expect(page.nodes[0].position).toEqual(src.nodes[0].position);
  });

  it('非法内容返回 null', () => {
    expect(parseProjectJson('{oops')).toBeNull();
    expect(parseProjectJson('')).toBeNull();
  });
});

describe('Mermaid 导出', () => {
  it('生成 flowchart 文本与连线', () => {
    const md = toMermaid(basic());
    expect(md.startsWith('flowchart TD')).toBe(true);
    expect(md).toContain('-->');
  });

  it('判断节点使用花括号语法', () => {
    expect(toMermaid(buildTemplateDoc('decision'))).toMatch(/\{[^}]+\}/);
  });

  it('连线标签使用 |label| 语法', () => {
    const doc = basic();
    const edge = activePageOf(doc)!.edges[0];
    edge.label = '是';
    expect(toMermaid(doc)).toContain('|是|');
  });

  it('空文档导出空串', () => {
    expect(toMermaid({ version: 2, pages: [] })).toBe('');
  });
});

describe('Draw.io XML', () => {
  it('导出后能解析回来且数量一致', () => {
    const doc = basic();
    const xml = toDrawioXml(doc);
    expect(xml).toContain('mxfile');
    const back = parseDrawioXml(xml);
    expect(back).not.toBeNull();
    const page = activePageOf(back!)!;
    const src = activePageOf(doc)!;
    expect(page.nodes).toHaveLength(src.nodes.length);
    expect(page.edges).toHaveLength(src.edges.length);
  });

  it('保留节点文本与坐标', () => {
    const doc = basic();
    const src = activePageOf(doc)!;
    const page = activePageOf(parseDrawioXml(toDrawioXml(doc))!)!;
    expect(page.nodes[0].data.label).toBe(src.nodes[0].data.label);
    expect(page.nodes[0].position.x).toBe(Math.round(src.nodes[0].position.x));
  });

  it('泳道模板的父子关系能被保留', () => {
    const doc = buildTemplateDoc('swimlane');
    const page = activePageOf(parseDrawioXml(toDrawioXml(doc))!)!;
    const lane = page.nodes.find((n) => n.data.kind === 'swimlane');
    expect(lane).toBeDefined();
    expect(page.nodes.filter((n) => n.parentId === lane!.id).length).toBeGreaterThan(0);
  });

  it('样式到形状的映射', () => {
    expect(kindOfStyle('rhombus;whiteSpace=wrap;')).toBe('decision');
    expect(kindOfStyle('ellipse;')).toBe('startEnd');
    expect(kindOfStyle('shape=cylinder;')).toBe('database');
    expect(kindOfStyle('parallelogram;')).toBe('data');
    expect(kindOfStyle(undefined)).toBe('rect');
  });

  it('非法 XML 返回 null', () => {
    expect(parseDrawioXml('<not-xml')).toBeNull();
    expect(parseDrawioXml('')).toBeNull();
  });
});
