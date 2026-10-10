import { describe, expect, it } from 'vitest';
import { pageHasFormula, pageToVectorSvg } from './vector';
import { defaultData } from '../core';
import type { FlowPage } from '../model/types';

const page: FlowPage = {
  id: 'p1',
  name: 'P',
  nodes: [
    {
      id: 'a',
      type: 'shape',
      position: { x: 0, y: 0 },
      width: 120,
      height: 60,
      data: defaultData('decision', '判断'),
    },
    {
      id: 'b',
      type: 'shape',
      position: { x: 240, y: 0 },
      width: 120,
      height: 60,
      data: defaultData('rect', '过程'),
    },
    {
      id: 't',
      type: 'table',
      position: { x: 0, y: 200 },
      width: 320,
      height: 168,
      data: {
        ...defaultData('rect', ''),
        table: {
          rows: 2,
          cols: 2,
          cells: [
            [{ text: 'A' }, {}],
            [{}, { text: 'D' }],
          ],
        },
      },
    },
  ],
  edges: [{ id: 'e1', source: 'a', target: 'b', label: '是' }],
};

describe('矢量 SVG 导出', () => {
  it('输出纯 SVG：形状与文字均在 SVG 内，且不含 foreignObject', async () => {
    const svg = await pageToVectorSvg(page, { padding: 10 });
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<path');
    expect(svg).toContain('<text');
    expect(svg).toContain('判断');
    expect(svg).not.toContain('foreignObject');
  });

  it('表格节点渲染为矢量单元格', async () => {
    const svg = await pageToVectorSvg(page, { padding: 0 });
    // 2×2 表格：4 个单元格矩形 + 节点矩形等，至少 4 个 rect
    const rectCount = (svg.match(/<rect/g) ?? []).length;
    expect(rectCount).toBeGreaterThanOrEqual(4);
  });

  it('识别公式节点以决定回退到 DOM 截图', () => {
    expect(pageHasFormula(page)).toBe(false);
    const withFormula: FlowPage = {
      ...page,
      nodes: [
        ...page.nodes,
        {
          id: 'f',
          type: 'formula',
          position: { x: 0, y: 300 },
          data: { ...defaultData('rect', ''), formula: 'x' },
        },
      ],
    };
    expect(pageHasFormula(withFormula)).toBe(true);
  });
});
