import Konva from 'konva';
import { findIcon } from '../model/icons';
import type { FormulaElement, IconElement } from '../model/types';

/**
 * 公式与图标的 Konva 节点。
 *
 * 两者都要求**同步**出图：缩略图与 PNG / PDF 光栅导出没有等待异步解码的机会，
 * 所以一律用矢量图元 / 文本直接绘制，不走「HTML → 位图」的异步链路。
 */

const DEFAULT_FONT = 'Arial, Helvetica, sans-serif';
const MONO_FONT = 'Consolas, Menlo, monospace';

/**
 * 公式节点。
 *
 * MVP 阶段以等宽字体展示 LaTeX 源码（与 .pptx 导出的降级形态保持一致），
 * 保证「插入 → 渲染 → 导出」闭环且三处所见一致。
 * KaTeX 排版渲染需要 DOM + CSS，无法在同步渲染路径里完成，留作后续增强。
 */
export function createFormulaNode(element: FormulaElement): Konva.Group {
  const group = new Konva.Group({ listening: false });
  group.add(
    new Konva.Rect({
      width: element.width,
      height: element.height,
      fill: '#F8FAFC',
      stroke: '#CBD5E1',
      strokeWidth: 1,
      cornerRadius: 4,
    }),
  );
  const label = new Konva.Text({
    text: element.latex || '',
    width: element.width - 12,
    height: element.height - 8,
    x: 6,
    y: 4,
    fontSize: element.fontSize ?? 24,
    fontFamily: MONO_FONT,
    fill: element.color ?? '#111827',
    align: 'center',
    verticalAlign: 'middle',
    wrap: 'none',
    ellipsis: true,
    listening: false,
  });
  group.add(label);
  return group;
}

/** 图标节点：内置 SVG path 用 Konva.Path 矢量绘制（24×24 viewBox 等比缩放） */
export function createIconNode(element: IconElement): Konva.Group {
  const group = new Konva.Group({ listening: false });
  const icon = findIcon(element.iconId);
  if (!icon) {
    const label = new Konva.Text({
      text: '?',
      width: element.width,
      height: element.height,
      fontSize: Math.max(10, Math.min(element.width, element.height) * 0.5),
      fontFamily: DEFAULT_FONT,
      fill: '#94A3B8',
      align: 'center',
      verticalAlign: 'middle',
      listening: false,
    });
    group.add(label);
    return group;
  }
  const scale = Math.min(element.width, element.height) / 24;
  group.add(
    new Konva.Path({
      data: icon.path,
      fill: icon.stroke ? undefined : (element.color ?? '#2563EB'),
      stroke: icon.stroke ? (element.color ?? '#2563EB') : undefined,
      strokeWidth: icon.stroke ? 2 : 0,
      lineCap: 'round',
      lineJoin: 'round',
      scaleX: scale,
      scaleY: scale,
      // 居中：缩放后的 24×24 图形对齐到元素中心
      x: (element.width - 24 * scale) / 2,
      y: (element.height - 24 * scale) / 2,
      listening: false,
    }),
  );
  return group;
}
