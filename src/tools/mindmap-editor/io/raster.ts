/**
 * 位图 / 矢量 / PDF 导出。
 * 沿用 flowchart-editor 的「DOM 截图」方案（html-to-image）：
 * React Flow 渲染结果就是 DOM + SVG，截图即可还原样式。
 */

import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { toJpeg, toPng, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { downloadDataUrl } from '@/core/pdf/download';
import type { MindNodeData } from '../nodes/MindNode';

export type RasterFormat = 'png' | 'jpeg' | 'svg' | 'pdf';

export interface RasterExportOptions {
  format: RasterFormat;
  /** 导出倍率，越大越清晰（也越占内存） */
  scale: number;
  /** 透明背景（jpeg 不支持透明） */
  transparent: boolean;
  /** 导出底色，缺省为当前主题的背景色 */
  background?: string;
  /** 内容外留白 */
  padding: number;
}

export const DEFAULT_RASTER_OPTIONS: RasterExportOptions = {
  format: 'png',
  scale: 2,
  transparent: false,
  padding: 32,
};

const EXT: Record<RasterFormat, string> = { png: 'png', jpeg: 'jpg', svg: 'svg', pdf: 'pdf' };

function boundsOf(nodes: ReadonlyArray<Node<MindNodeData>>, padding: number) {
  const b = getNodesBounds(nodes as unknown as Node[]);
  return {
    x: b.x - padding,
    y: b.y - padding,
    width: Math.max(1, Math.ceil(b.width) + padding * 2),
    height: Math.max(1, Math.ceil(b.height) + padding * 2),
  };
}

function captureOptions(
  bounds: { x: number; y: number; width: number; height: number },
  opts: RasterExportOptions,
) {
  const transform = getViewportForBounds(bounds, bounds.width, bounds.height, 0.2, 2, 0);
  return {
    width: bounds.width,
    height: bounds.height,
    pixelRatio: opts.scale,
    backgroundColor: opts.transparent ? undefined : (opts.background ?? '#ffffff'),
    style: {
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
    },
  };
}

function viewportEl(): HTMLElement | null {
  return document.querySelector('.react-flow__viewport') as HTMLElement | null;
}

/** 导出当前脑图为 PNG / JPEG / SVG / PDF */
export async function exportRaster(
  nodes: Node<MindNodeData>[],
  options: RasterExportOptions,
  filename: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (nodes.length === 0) return { ok: false, error: 'EMPTY' };
    const viewport = viewportEl();
    if (!viewport) return { ok: false, error: 'EMPTY' };

    const bounds = boundsOf(nodes, options.padding);
    const capture = captureOptions(bounds, options);

    if (options.format === 'pdf') {
      const dataUrl = await toPng(viewport, capture);
      const orientation = capture.width >= capture.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'px', format: [capture.width, capture.height] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, capture.width, capture.height);
      pdf.save(`${filename}.pdf`);
      return { ok: true };
    }

    let dataUrl: string;
    if (options.format === 'svg') {
      dataUrl = await toSvg(viewport, capture);
    } else if (options.format === 'jpeg') {
      dataUrl = await toJpeg(viewport, capture);
    } else {
      dataUrl = await toPng(viewport, capture);
    }
    downloadDataUrl(dataUrl, `${filename}.${EXT[options.format]}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'EXPORT_FAILED' };
  }
}
