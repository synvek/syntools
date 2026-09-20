/**
 * 导出 PNG(2x) / SVG：复用已安装的 html-to-image，按内容包围盒裁剪避免空白边距。
 * 下载复用 core/pdf/download 的 downloadDataUrl。
 */

import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import { downloadDataUrl } from '@/core/pdf/download';
import { absolutePositionOf } from './core';
import { type FlowNodeData } from './model/types';

export type ExportFormat = 'png' | 'svg';

export async function exportFlowchart(
  nodes: Node<FlowNodeData>[],
  format: ExportFormat,
  filename: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (nodes.length === 0) return { ok: false, error: 'EMPTY' };
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!viewport) return { ok: false, error: 'EMPTY' };

    // 子节点坐标相对泳道，导出前转为绝对坐标，保证包围盒正确
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    const absoluteNodes = nodes.map((n) => ({ ...n, position: absolutePositionOf(n, byId) }));
    const bounds = getNodesBounds(absoluteNodes);
    const width = Math.max(1, Math.ceil(bounds.width));
    const height = Math.max(1, Math.ceil(bounds.height));
    const transform = getViewportForBounds(bounds, width, height, 0.5, 2, 0);

    const options = {
      backgroundColor: '#ffffff',
      width,
      height,
      pixelRatio: format === 'png' ? 2 : 1,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
      },
    };

    const dataUrl =
      format === 'png' ? await toPng(viewport, options) : await toSvg(viewport, options);
    downloadDataUrl(dataUrl, filename.endsWith(`.${format}`) ? filename : `${filename}.${format}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'EXPORT_FAILED' };
  }
}
