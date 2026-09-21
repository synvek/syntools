/**
 * 位图 / 矢量 / PDF 导出。
 * 统一走「DOM 截图」方案（html-to-image），比自绘保真度高：
 * React Flow 渲染结果就是 DOM + SVG，截图即可还原样式。
 */

import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { toJpeg, toPng, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { downloadDataUrl } from '@/core/pdf/download';
import { absolutePositionOf } from '../core';
import type { FlowNodeData } from '../model/types';

export type RasterFormat = 'png' | 'jpeg' | 'svg' | 'pdf';

export interface RasterExportOptions {
  format: RasterFormat;
  /** 导出倍率，越大越清晰（也越占内存） */
  scale: number;
  /** 透明背景（jpeg 不支持透明） */
  transparent: boolean;
  /** 内容外留白 */
  padding: number;
}

export const DEFAULT_RASTER_OPTIONS: RasterExportOptions = {
  format: 'png',
  scale: 2,
  transparent: false,
  padding: 24,
};

const EXT: Record<RasterFormat, string> = { png: 'png', jpeg: 'jpg', svg: 'svg', pdf: 'pdf' };

/** 计算导出区域：子节点坐标先转绝对，避免泳道内元素被裁掉 */
export function exportBoundsOf(
  nodes: ReadonlyArray<Node<FlowNodeData>>,
  padding: number,
): { x: number; y: number; width: number; height: number } {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const absolute = nodes.map((n) => ({ ...n, position: absolutePositionOf(n, byId) }));
  const b = getNodesBounds(absolute);
  return {
    x: b.x,
    y: b.y,
    width: Math.max(1, Math.ceil(b.width)),
    height: Math.max(1, Math.ceil(b.height)),
    ...(padding ? {} : {}),
  };
}

/** 生成截图参数（供 toPng / toJpeg 复用） */
function captureOptions(
  bounds: { x: number; y: number; width: number; height: number },
  opts: RasterExportOptions,
) {
  const pad = opts.padding;
  const width = bounds.width + pad * 2;
  const height = bounds.height + pad * 2;
  const transform = getViewportForBounds(bounds, width, height, 0.5, 2, pad);
  return {
    width,
    height,
    pixelRatio: opts.scale,
    backgroundColor: opts.transparent ? undefined : '#ffffff',
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
    },
  };
}

function viewportEl(): HTMLElement | null {
  return document.querySelector('.react-flow__viewport') as HTMLElement | null;
}

/**
 * 导出当前画布为 PNG / JPEG / PDF。
 * nodes 为要导出的节点集合（传入选中节点即可实现「仅导出选中」）。
 */
export async function exportRaster(
  nodes: Node<FlowNodeData>[],
  options: RasterExportOptions,
  filename: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (nodes.length === 0) return { ok: false, error: 'EMPTY' };
    const viewport = viewportEl();
    if (!viewport) return { ok: false, error: 'EMPTY' };

    const bounds = exportBoundsOf(nodes, options.padding);
    const capture = captureOptions(bounds, options);

    if (options.format === 'pdf') {
      const dataUrl = await toPng(viewport, capture);
      const orientation = capture.width >= capture.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [capture.width, capture.height],
      });
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
