import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';
import { shapePathD } from './shapeSvg';
import { resolvePresetGeometry } from '../../core/drawing/shapeDefs';
import {
  DEFAULT_SHAPE_SIZE,
  SHAPE_PRESETS,
  createShapeId,
  findSelectedShape,
  shapeGeometryOf,
  shapeSpec,
  type DocShapeAttrs,
} from './shapeNode';

/**
 * P3-1.1: the shape atom must survive HTML round-trips (drafts are HTML) with every attribute the
 * docx writer needs — `prst`, `adj`, box, rotation, paint and anchor mode.
 */

function makeEditor(content = '<p>hello</p>'): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: createExtensions({ placeholder: '输入内容…' }),
    content,
  });
}

function shapeNodes(editor: Editor): { pos: number; attrs: DocShapeAttrs }[] {
  const found: { pos: number; attrs: DocShapeAttrs }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'docShape') found.push({ pos, attrs: shapeSpec(node.attrs) });
    return true;
  });
  return found;
}

describe('docShape 节点', () => {
  it('插入后成为顶层 block 节点，并紧跟一个可写段落', () => {
    const editor = makeEditor();
    editor.commands.focus('end');
    expect(editor.commands.insertDocShape({ prst: 'ellipse' })).toBe(true);

    const names: string[] = [];
    editor.state.doc.forEach((node) => names.push(node.type.name));
    expect(names[0]).toBe('paragraph');
    expect(names).toContain('docShape');
    // The atom cannot hold a caret: a trailing paragraph keeps the document editable
    expect(names[names.length - 1]).toBe('paragraph');

    const shapes = shapeNodes(editor);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].attrs.prst).toBe('ellipse');
    expect(shapes[0].attrs.width).toBe(DEFAULT_SHAPE_SIZE.width);
    editor.destroy();
  });

  it('插入后自动选中，命令可直接改属性', () => {
    const editor = makeEditor();
    editor.commands.focus('end');
    editor.commands.insertDocShape({ prst: 'roundRect' });

    const selected = findSelectedShape(editor.state);
    expect(selected).not.toBeNull();

    editor.commands.updateDocShape({ fill: '#FF0000', rotation: 30, adj: { adj1: 0.3 } });
    const [shape] = shapeNodes(editor);
    expect(shape.attrs.fill).toBe('#FF0000');
    expect(shape.attrs.rotation).toBe(30);
    expect(shape.attrs.adj?.adj1).toBeCloseTo(0.3, 5);
    editor.destroy();
  });

  it('getHTML → setContent 后属性完全一致（草稿与 docx 导出共用这条路径）', () => {
    const editor = makeEditor();
    editor.commands.focus('end');
    editor.commands.insertDocShape({ prst: 'star', text: '星级' });
    editor.commands.updateDocShape({
      width: 240,
      height: 120,
      fill: '#123456',
      stroke: '#654321',
      strokeWidth: 2,
      dash: 'dash',
      layer: 'wrap-right',
    });

    const html = editor.getHTML();
    expect(html).toContain('data-doc-shape');
    expect(html).toContain('data-shape-prst="star"');
    expect(html).toContain('data-shape-w="240"');
    // The visible body is an SVG path, so print / PDF snapshots render without extra work
    expect(html).toContain('<svg');

    const before = shapeNodes(editor)[0].attrs;
    const reopened = makeEditor(html);
    const after = shapeNodes(reopened)[0]?.attrs;
    expect(after).toBeDefined();
    expect(after.prst).toBe(before.prst);
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
    expect(after.fill).toBe(before.fill);
    expect(after.stroke).toBe(before.stroke);
    expect(after.strokeWidth).toBe(before.strokeWidth);
    expect(after.dash).toBe(before.dash);
    expect(after.layer).toBe(before.layer);
    expect(after.text).toBe('星级');
    editor.destroy();
    reopened.destroy();
  });

  it('adj 以 JSON 往返，非法值被丢弃', () => {
    const editor = makeEditor();
    editor.commands.focus('end');
    editor.commands.insertDocShape({ prst: 'chevron' });
    editor.commands.updateDocShape({ adj: { adj1: 0.55, adj2: Number.NaN } });

    const html = editor.getHTML();
    expect(html).toContain('data-shape-adj="{&quot;adj1&quot;:0.55}"');
    const reopened = makeEditor(html);
    expect(shapeNodes(reopened)[0].attrs.adj).toEqual({ adj1: 0.55 });
    editor.destroy();
    reopened.destroy();
  });

  it('图层切换与删除', () => {
    const editor = makeEditor();
    editor.commands.focus('end');
    editor.commands.insertDocShape();
    editor.commands.setDocShapeLayer('behind');
    const [shape] = shapeNodes(editor);
    expect(shape.attrs.layer).toBe('behind');
    expect(shape.attrs.offsetX).not.toBeNull();

    editor.commands.removeDocShape();
    expect(shapeNodes(editor)).toHaveLength(0);
    editor.destroy();
  });

  it('解析外部 HTML 时缺 id 也能恢复，并补齐默认值', () => {
    const editor = makeEditor(
      '<div data-doc-shape="rect" data-shape-prst="rect" data-shape-w="99"></div>',
    );
    const [shape] = shapeNodes(editor);
    expect(shape.attrs.width).toBe(99);
    expect(shape.attrs.height).toBe(DEFAULT_SHAPE_SIZE.height);
    expect(shape.attrs.layer).toBe('inline');
    editor.destroy();
  });
});

describe('shapeSvg 路径', () => {
  it('四种几何都能生成非空 path', () => {
    expect(shapePathD(resolvePresetGeometry('rect'), 100, 60)).toMatch(/^M 0 0 L/);
    expect(shapePathD(resolvePresetGeometry('roundRect', { adj1: 0.3 }), 100, 60)).toContain(' A ');
    expect(shapePathD(resolvePresetGeometry('ellipse'), 100, 60)).toContain(' A ');
    expect(shapePathD(resolvePresetGeometry('star'), 100, 60)).toMatch(/^M /);
    expect(shapePathD(resolvePresetGeometry('rightArrow'), 100, 60)).toMatch(/^M /);
  });

  it('自定义路径按包围盒缩放', () => {
    const geom = resolvePresetGeometry('rect');
    const custom = {
      ...geom,
      kind: 'path' as const,
      custGeom: [
        { c: 'M' as const, x: 0, y: 0 },
        { c: 'L' as const, x: 1, y: 0 },
        { c: 'L' as const, x: 0.5, y: 1 },
        { c: 'Z' as const },
      ],
    };
    expect(shapePathD(custom, 200, 100)).toBe('M 0 0 L 200 0 L 100 100 Z');
  });
});

describe('形状调色板', () => {
  it('覆盖四个分组且至少 20 个预设', () => {
    expect(SHAPE_PRESETS.length).toBeGreaterThanOrEqual(20);
    for (const group of ['basic', 'arrow', 'star', 'flowchart']) {
      expect(SHAPE_PRESETS.some((preset) => preset.group === group)).toBe(true);
    }
    // Every preset must resolve through the kernel (no typos reaching the docx writer)
    for (const preset of SHAPE_PRESETS) {
      expect(shapeGeometryOf(shapeSpec({ prst: preset.prst })).prst).toBe(preset.prst);
    }
  });

  it('createShapeId 唯一', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createShapeId()));
    expect(ids.size).toBe(50);
  });
});
