import { deflateRaw } from 'pako';
import { describe, expect, it } from 'vitest';
import { buildTemplateDoc } from '../model/templates';
import { activePageOf, migrateDoc, toDocV2 } from '../model/migrate';
import { defaultData } from '../core';
import {
  DEFAULT_EDGE_STYLE,
  type FlowDoc,
  type FlowEdgeRec,
  type FlowNodeRec,
} from '../model/types';
import { parseProjectJson, toProjectJson } from './projectJson';
import { parseMermaidFlowchart, toMermaid } from './mermaidIo';
import {
  htmlToPlain,
  kindOfStyle,
  parseDrawioXml,
  parseDrawioXmlAsync,
  toDrawioXml,
} from './drawio';
import { importKindOf, parseImportedFile } from './index';

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

  it('图片 / 图标 / 公式节点与折点都能往返', () => {
    const nodes: FlowNodeRec[] = [
      {
        id: 'a',
        type: 'shape',
        position: { x: 0, y: 0 },
        data: defaultData('rect', 'A'),
      },
      {
        id: 'img',
        type: 'image',
        position: { x: 0, y: 200 },
        width: 120,
        height: 80,
        data: { ...defaultData('rect'), src: 'data:image/png;base64,AAAA' },
      },
      {
        id: 'icon',
        type: 'icon',
        position: { x: 200, y: 200 },
        data: { ...defaultData('rect'), iconId: 'star' },
      },
      {
        id: 'tex',
        type: 'formula',
        position: { x: 400, y: 200 },
        data: { ...defaultData('rect'), formula: 'E = mc^2' },
      },
    ];
    const edges: FlowEdgeRec[] = [
      { id: 'e1', source: 'a', target: 'img', waypoints: [{ x: 40, y: 100 }] },
    ];
    const doc = toDocV2(nodes, edges);
    const page = activePageOf(parseProjectJson(toProjectJson(doc))!)!;

    expect(page.nodes.map((n) => n.type)).toEqual(['shape', 'image', 'icon', 'formula']);
    expect(page.nodes[1].data.src).toBe('data:image/png;base64,AAAA');
    expect(page.nodes[2].data.iconId).toBe('star');
    expect(page.nodes[3].data.formula).toBe('E = mc^2');
    expect(page.edges[0].waypoints).toEqual([{ x: 40, y: 100 }]);
  });

  it('未知的节点类型回退为 shape（脏数据安全）', () => {
    const raw = {
      version: 2,
      pages: [
        {
          id: 'p1',
          name: 'P',
          nodes: [{ id: 'x', type: 'video', position: { x: 0, y: 0 }, data: defaultData('rect') }],
          edges: [],
        },
      ],
      activePageId: 'p1',
    };
    const page = activePageOf(migrateDoc(raw)!)!;
    expect(page.nodes[0].type).toBe('shape');
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

  it('导出节点样式为 classDef、连线样式为 linkStyle', () => {
    const doc = basic();
    const page = activePageOf(doc)!;
    page.nodes[0].data.style = { ...page.nodes[0].data.style, fill: '#ff0000' };
    page.edges[0].style = { ...DEFAULT_EDGE_STYLE, dash: 'dashed' };

    const md = toMermaid(doc);
    expect(md).toContain('classDef c0 fill:#ff0000;');
    expect(md).toContain(`class ${page.nodes[0].id} c0;`);
    expect(md).toContain('linkStyle 0 stroke-dasharray:6 4;');
  });

  it('样式导出后再导入可还原填充与虚线', () => {
    const doc = basic();
    const page = activePageOf(doc)!;
    page.nodes[0].data.style = { ...page.nodes[0].data.style, fill: '#ff0000' };
    page.edges[0].style = { ...DEFAULT_EDGE_STYLE, dash: 'dashed' };

    const res = parseMermaidFlowchart(toMermaid(doc));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const back = activePageOf(res.doc)!;
    expect(back.nodes.find((n) => n.id === page.nodes[0].id)!.data.style.fill).toBe('#ff0000');
    expect(back.edges[0].style?.dash).toBe('dashed');
  });

  it('多页导出为多段 flowchart，导入后恢复为多页', () => {
    const doc = basic();
    const extra = buildTemplateDoc('decision');
    doc.pages.push({ ...extra.pages[0], id: 'page2', name: '第二页' });

    const md = toMermaid(doc, { pages: 'all' });
    expect(md.match(/flowchart TD/g)?.length).toBe(2);
    expect(md).toContain('%% page: 第二页');

    const res = parseMermaidFlowchart(md);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.doc.pages).toHaveLength(2);
    expect(res.doc.pages[1].name).toBe('第二页');
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

  it('多页导出后能完整再导入', () => {
    const p1: FlowNodeRec[] = [
      { id: 'a', type: 'shape', position: { x: 0, y: 0 }, data: defaultData('rect', 'A') },
    ];
    const p2: FlowNodeRec[] = [
      { id: 'b', type: 'shape', position: { x: 10, y: 20 }, data: defaultData('decision', 'B') },
    ];
    const doc: FlowDoc = {
      version: 2,
      pages: [
        { id: 'p1', name: 'First', nodes: p1, edges: [] },
        { id: 'p2', name: 'Second', nodes: p2, edges: [] },
      ],
      activePageId: 'p1',
    };
    const back = parseDrawioXml(toDrawioXml(doc));
    expect(back).not.toBeNull();
    expect(back!.pages).toHaveLength(2);
    expect(back!.pages[1].name).toBe('Second');
    expect(activePageOf(back!)!.nodes[0].data.kind).toBe('rect');
  });

  it('节点样式往返（填充 / 描边 / 线宽 / 字号 / 对齐 / 虚线 / 圆角）', () => {
    const node: FlowNodeRec = {
      id: 'n1',
      type: 'shape',
      position: { x: 5, y: 6 },
      width: 160,
      height: 80,
      data: {
        ...defaultData('roundRect', 'Styled'),
        style: {
          ...defaultData('roundRect').style,
          fill: '#ff0000',
          stroke: '#00ff00',
          strokeWidth: 3,
          fontSize: 16,
          align: 'left',
          lineDash: 'dashed',
          cornerRadius: 12,
        },
      },
    };
    const page = activePageOf(parseDrawioXml(toDrawioXml(toDocV2([node], [])))!)!;
    const style = page.nodes[0].data.style;
    expect(page.nodes[0].data.kind).toBe('roundRect');
    expect(style.fill).toBe('#ff0000');
    expect(style.stroke).toBe('#00ff00');
    expect(style.strokeWidth).toBe(3);
    expect(style.fontSize).toBe(16);
    expect(style.align).toBe('left');
    expect(style.lineDash).toBe('dashed');
  });

  it('形状可调参数往返（便签折角 / 预定义竖线宽 / 生命线标题框）', () => {
    const nodes: FlowNodeRec[] = [
      {
        id: 'n1',
        type: 'shape',
        position: { x: 0, y: 0 },
        width: 150,
        height: 90,
        data: {
          ...defaultData('note', 'N'),
          style: { ...defaultData('note').style, shapeParams: { foldSize: 24 } },
        },
      },
      {
        id: 'n2',
        type: 'shape',
        position: { x: 0, y: 120 },
        width: 170,
        height: 64,
        data: {
          ...defaultData('predefined'),
          style: { ...defaultData('predefined').style, shapeParams: { barWidth: 22 } },
        },
      },
      {
        id: 'n3',
        type: 'shape',
        position: { x: 0, y: 220 },
        width: 120,
        height: 300,
        data: {
          ...defaultData('umlLifeline'),
          style: { ...defaultData('umlLifeline').style, shapeParams: { lifelineHeader: 56 } },
        },
      },
    ];
    const xml = toDrawioXml(toDocV2(nodes, []));
    expect(xml).toContain('size=24');
    expect(xml).toContain('size=22');
    expect(xml).toContain('size=56');

    const page = activePageOf(parseDrawioXml(xml)!)!;
    const byId = new Map(page.nodes.map((n) => [n.id, n] as const));
    expect(byId.get('n1')!.data.style.shapeParams?.foldSize).toBe(24);
    expect(byId.get('n2')!.data.style.shapeParams?.barWidth).toBe(22);
    // 已语义化的 size token 不再进入 mxStyle 兜底
    expect(byId.get('n1')!.mxStyle ?? []).not.toContain('size=24');
    expect(byId.get('n2')!.mxStyle ?? []).not.toContain('size=22');
    // 生命线形状本身尚未与 draw.io 的 umlLifeline token 互认，size 作为未识别 token 无损保留
    expect(byId.get('n3')!.mxStyle ?? []).toContain('size=56');
  });

  it('圆角导入还原（修复 arcSize 丢失）', () => {
    const xml = `<mxfile><diagram name="P" id="d1"><mxGraphModel><root>
      <mxCell id="0"/><mxCell id="1" parent="0"/>
      <mxCell id="n1" value="R" style="rounded=1;arcSize=6;html=1;" vertex="1" parent="1">
        <mxGeometry x="1" y="2" width="120" height="60" as="geometry"/>
      </mxCell>
    </root></mxGraphModel></diagram></mxfile>`;
    const page = activePageOf(parseDrawioXml(xml)!)!;
    // arcSize=6 → cornerRadius = 12
    expect(page.nodes[0].data.style.shapeParams?.cornerRadius).toBe(12);
  });

  it('连线样式往返（线型 / 虚线 / 起止箭头 / 颜色 / 折点）', () => {
    const nodes: FlowNodeRec[] = [
      { id: 'a', type: 'shape', position: { x: 0, y: 0 }, data: defaultData('rect', 'A') },
      { id: 'b', type: 'shape', position: { x: 0, y: 200 }, data: defaultData('rect', 'B') },
    ];
    const edge: FlowEdgeRec = {
      id: 'e1',
      source: 'a',
      target: 'b',
      label: 'flow',
      style: {
        type: 'step',
        stroke: '#123456',
        strokeWidth: 4,
        dash: 'dotted',
        startArrow: 'circle',
        endArrow: 'diamond',
      },
      waypoints: [{ x: 80, y: 100 }],
    };
    const page = activePageOf(parseDrawioXml(toDrawioXml(toDocV2(nodes, [edge])))!)!;
    const back = page.edges[0];
    expect(back.style?.type).toBe('step');
    expect(back.style?.stroke).toBe('#123456');
    expect(back.style?.strokeWidth).toBe(4);
    expect(back.style?.dash).toBe('dotted');
    expect(back.style?.startArrow).toBe('circle');
    expect(back.style?.endArrow).toBe('diamond');
    expect(back.label).toBe('flow');
    expect(back.waypoints).toEqual([{ x: 80, y: 100 }]);
  });

  it('未识别的样式 token 存进 mxStyle 并在导出时回写', () => {
    const xml = `<mxfile><diagram name="P" id="d1"><mxGraphModel><root>
      <mxCell id="0"/><mxCell id="1" parent="0"/>
      <mxCell id="n1" value="X" style="rounded=0;html=1;customToken=42;" vertex="1" parent="1">
        <mxGeometry x="1" y="2" width="100" height="50" as="geometry"/>
      </mxCell>
    </root></mxGraphModel></diagram></mxfile>`;
    const doc = parseDrawioXml(xml)!;
    expect(activePageOf(doc)!.nodes[0].mxStyle).toContain('customToken=42');
    expect(toDrawioXml(doc)).toContain('customToken=42');
  });

  it('htmlToPlain：行内换行、块级边界与实体还原为纯文本', () => {
    // 输入是 XML 解析器已解码的 HTML 片段
    expect(htmlToPlain('a<br>b')).toBe('a\nb');
    expect(htmlToPlain('<div>第一行</div><div>第二行</div>')).toBe('第一行\n第二行');
    expect(htmlToPlain('A &amp; B &lt;C&gt;')).toBe('A & B <C>');
    // 非标签形态的孤立尖括号原样保留
    expect(htmlToPlain('普通文本 < 10')).toBe('普通文本 < 10');
  });

  it('HTML 标签往返：换行在导入时还原为纯文本', () => {
    const node: FlowNodeRec = {
      id: 'n1',
      type: 'shape',
      position: { x: 10, y: 20 },
      data: defaultData('rect', '第一行\n第二行'),
    };
    const xml = toDrawioXml(toDocV2([node], []));
    // 导出为 html=1 值：换行转 <br>，XMLBuilder 再把尖括号转义
    expect(xml).toContain('第一行&lt;br&gt;第二行');
    const back = activePageOf(parseDrawioXml(xml)!)!;
    expect(back.nodes[0].data.label).toBe('第一行\n第二行');
  });

  it('解析压缩形式（base64 + deflateRaw + URI 编码）的 .drawio', async () => {
    // jsdom 可能带 Node 的 DecompressionStream：显式移除以走 pako 兜底分支
    Reflect.deleteProperty(globalThis, 'DecompressionStream');

    const inner =
      '<mxGraphModel dx="0" dy="0" grid="1" page="1"><root>' +
      '<mxCell id="0"/><mxCell id="1" parent="0"/>' +
      '<mxCell id="n1" value="开始" style="rounded=0;html=1;" vertex="1" parent="1">' +
      '<mxGeometry x="40" y="60" width="120" height="60" as="geometry"/></mxCell>' +
      '</root></mxGraphModel>';
    const bytes = deflateRaw(encodeURIComponent(inner));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const xml = `<mxfile host="x"><diagram name="页 1" id="p1">${btoa(binary)}</diagram></mxfile>`;

    // 同步解析器不认压缩格式，异步解析器负责解码
    expect(parseDrawioXml(xml)).toBeNull();
    const doc = await parseDrawioXmlAsync(xml);
    expect(doc).not.toBeNull();
    const page = activePageOf(doc!)!;
    expect(page.name).toBe('页 1');
    expect(page.nodes).toHaveLength(1);
    expect(page.nodes[0].data.label).toBe('开始');
    expect(page.nodes[0].position).toEqual({ x: 40, y: 60 });
  });
});

describe('Mermaid 导入', () => {
  it('解析节点、形状与连线标签', () => {
    const src = [
      'flowchart TD',
      '  A[开始] --> B{条件成立?}',
      '  B -->|是| C([结束])',
      '  B -->|否| A',
    ].join('\n');
    const res = parseMermaidFlowchart(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const page = activePageOf(res.doc)!;
    expect(page.nodes).toHaveLength(3);
    expect(page.nodes.find((n) => n.id === 'B')!.data.kind).toBe('decision');
    expect(page.nodes.find((n) => n.id === 'C')!.data.kind).toBe('startEnd');
    expect(page.nodes.find((n) => n.id === 'A')!.data.label).toBe('开始');
    expect(page.edges).toHaveLength(3);
    expect(page.edges.some((e) => e.label === '是')).toBe(true);
    // Mermaid 不携带坐标：导入后必然完成一次自动布局
    expect(page.nodes.every((n) => Number.isFinite(n.position.x))).toBe(true);
    expect(new Set(page.nodes.map((n) => n.position.y)).size).toBeGreaterThan(1);
  });

  it('支持 graph 语法、行内标签、虚线箭头与多种包裹', () => {
    const src = [
      'graph LR',
      '  A((圆形)) -- 文本 --> B[(数据库)]',
      '  B -.-> C{{六边形}}',
      '  C ==> D[/数据/]',
    ].join('\n');
    const res = parseMermaidFlowchart(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const page = activePageOf(res.doc)!;
    const kindOf = (id: string) => page.nodes.find((n) => n.id === id)!.data.kind;
    expect(kindOf('A')).toBe('ellipse');
    expect(kindOf('B')).toBe('database');
    expect(kindOf('C')).toBe('hexagon');
    expect(kindOf('D')).toBe('data');
    expect(page.edges.find((e) => e.label === '文本')).toBeDefined();
    expect(page.edges.some((e) => e.style?.dash === 'dashed')).toBe(true);
    expect(page.edges.some((e) => (e.style?.strokeWidth ?? 2) === 3)).toBe(true);
  });

  it('链式写法与 subgraph 映射为编组容器', () => {
    const src = ['flowchart TD', '  subgraph 流程', '    A --> B --> C', '  end', '  D[外部]'].join(
      '\n',
    );
    const res = parseMermaidFlowchart(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const page = activePageOf(res.doc)!;
    const group = page.nodes.find((n) => n.data.kind === 'group');
    expect(group).toBeDefined();
    expect(group!.data.label).toBe('流程');
    const children = page.nodes.filter((n) => n.parentId === group!.id);
    expect(children.map((c) => c.id).sort()).toEqual(['A', 'B', 'C']);
    // 顶层游离节点：编组容器自身也挂在顶层，需排除
    expect(
      page.nodes.filter((n) => !n.parentId && n.data.kind !== 'group').map((n) => n.id),
    ).toEqual(['D']);
    expect(page.edges).toHaveLength(2);
  });

  it('忽略样式指令，保留结构', () => {
    const src = [
      'flowchart TD',
      '  A --> B',
      '  classDef red fill:#f00,stroke:#333',
      '  class A red',
      '  style B fill:#0f0',
      '  linkStyle 0 stroke:#00f',
      '  click A "https://example.com"',
    ].join('\n');
    const res = parseMermaidFlowchart(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const page = activePageOf(res.doc)!;
    expect(page.nodes).toHaveLength(2);
    expect(page.edges).toHaveLength(1);
  });

  it('缺少 header 时返回错误并给出行号', () => {
    const res = parseMermaidFlowchart('A --> B');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('MISSING_HEADER');
    expect(res.line).toBe(1);
  });

  it('只有 header 时返回 EMPTY', () => {
    const res = parseMermaidFlowchart('flowchart TD');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('EMPTY');
  });

  it('导出后再导入能保留节点与连线数量', () => {
    const doc = basic();
    const res = parseMermaidFlowchart(toMermaid(doc));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const src = activePageOf(doc)!;
    const page = activePageOf(res.doc)!;
    expect(page.nodes).toHaveLength(src.nodes.length);
    expect(page.edges).toHaveLength(src.edges.length);
  });
});

describe('导入分发', () => {
  it('按后缀识别类型', () => {
    expect(importKindOf('a.flow.json')).toBe('project');
    expect(importKindOf('a.drawio')).toBe('drawio');
    expect(importKindOf('a.xml')).toBe('drawio');
    expect(importKindOf('a.mmd')).toBe('mermaid');
    expect(importKindOf('a.mermaid')).toBe('mermaid');
    expect(importKindOf('a.txt')).toBe('mermaid');
  });

  it('解析 Mermaid 文本与非法内容', () => {
    const doc = parseImportedFile('x.mmd', 'flowchart LR\n A --> B');
    expect(doc).not.toBeNull();
    expect(activePageOf(doc!)!.nodes).toHaveLength(2);
    expect(parseImportedFile('x.mmd', 'not mermaid')).toBeNull();
    expect(parseImportedFile('x.json', '{oops')).toBeNull();
  });
});
