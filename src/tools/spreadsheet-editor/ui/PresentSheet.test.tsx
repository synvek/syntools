import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PresentGrid, PresentObject } from '../core';
import { PresentSheet } from './PresentSheet';

function gridWith(objects: PresentObject[]): PresentGrid {
  return {
    sheetName: '表',
    rows: 2,
    cols: 2,
    cells: [{ row: 0, col: 0, text: '姓名' }],
    merges: [],
    truncated: false,
    objects,
  };
}

const IMAGE: PresentObject = {
  id: 'img-1',
  kind: 'image',
  left: 148,
  top: 78,
  width: 120,
  height: 80,
  z: 1,
  src: 'data:image/png;base64,AAA',
  name: 'cat.png',
};

const SHAPE: PresentObject = {
  id: 'shape-1',
  kind: 'shape',
  left: 40,
  top: 26,
  width: 90,
  height: 40,
  z: 2,
  fill: '#eeeeee',
  stroke: '#333333',
  strokeWidth: 2,
  text: '标题',
};

const CHART: PresentObject = {
  id: 'chart-1',
  kind: 'chart',
  left: 64,
  top: 42,
  width: 320,
  height: 220,
  z: 3,
  label: '销售',
};

describe('PresentSheet 对象层', () => {
  it('图片按投影坐标渲染，并带可读的 alt', () => {
    render(<PresentSheet grid={gridWith([IMAGE])} />);
    const image = screen.getByTestId('present-image-img-1') as HTMLImageElement;
    expect(image.src).toContain('base64,AAA');
    expect(image.alt).toBe('cat.png');
    expect(image.style.left).toBe('148px');
    expect(image.style.top).toBe('78px');
    expect(image.style.width).toBe('120px');
  });

  it('形状带填充 / 描边 / 文字，层级按 z 抬升', () => {
    const { container } = render(<PresentSheet grid={gridWith([SHAPE])} />);
    const shape = screen.getByTestId('present-shape-shape-1');
    expect(shape.textContent).toBe('标题');
    expect(shape.style.background).toBe('rgb(238, 238, 238)');
    expect(shape.style.border).toContain('2px');
    // 表格内容在 z-index 自动值上，对象必须为正才盖得住
    expect(Number(shape.style.zIndex)).toBeGreaterThan(0);
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('图表渲染为定位占位框，写清标题与尺寸', () => {
    render(<PresentSheet grid={gridWith([CHART])} />);
    const chart = screen.getByTestId('present-chart-chart-1');
    expect(chart.textContent).toContain('销售');
    expect(chart.textContent).toContain('320');
    expect(chart.style.left).toBe('64px');
  });

  it('没有对象时不渲染对象层（老文档不会多一层空白 div）', () => {
    const { container } = render(<PresentSheet grid={gridWith([])} />);
    expect(container.querySelector('[data-testid^="present-image-"]')).toBeNull();
    expect(container.querySelector('[data-testid^="present-shape-"]')).toBeNull();
    expect(container.querySelector('[data-testid^="present-chart-"]')).toBeNull();
  });

  it('对象层不拦截点击（演示时仍可选中 / 复制文本）', () => {
    const { container } = render(<PresentSheet grid={gridWith([IMAGE, SHAPE, CHART])} />);
    const layer = container.querySelector('[data-testid="present-shape-shape-1"]')?.parentElement;
    expect(layer?.className).toContain('pointer-events-none');
  });
});
