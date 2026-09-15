import type { ToolResult } from '@/core/types';
import { CONTENT_HEIGHT_MM, CONTENT_WIDTH_MM, PAGE_MARGIN_MM, computePageBreaks } from './core';

/**
 * PDF 导出适配层：
 * - 模式一（text）：交给浏览器打印视图，生成可选可检索的文字 PDF（中文不乱码）；
 * - 模式二（snapshot）：A4 宽内容光栅化后，按块级边界切片拼成多页 PDF。
 *
 * 两种模式共用同一个按 A4 内容宽度排版的容器，确保版式一致。
 */

const MAX_PAGES = 200;

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
    img.src = dataUrl;
  });
}

/** 打印<整篇文档：依赖用户在打印对话框中选择「另存为 PDF」 */
export function printToPdf(): void {
  window.print();
}

/**
 * 高保真 PDF：把按 A4 内容宽度排版的容器整体光栅化，
 * 再按块级元素的边界切片为多页 A4 图片 PDF。
 */
export async function snapshotToPdf(
  container: HTMLElement,
  onProgress?: (value: number) => void,
): Promise<ToolResult<Uint8Array>> {
  try {
    const width = container.clientWidth;
    const height = container.scrollHeight;
    if (!width || !height) return { ok: false, error: 'RENDER_FAILED' };

    const pxPerMm = width / CONTENT_WIDTH_MM;
    const pageHeightPx = CONTENT_HEIGHT_MM * pxPerMm;
    const baseTop = container.getBoundingClientRect().top;
    const items = Array.from(container.children).map((child) => {
      const rect = child.getBoundingClientRect();
      return { top: rect.top - baseTop, height: rect.height };
    });
    const cuts = computePageBreaks(items, pageHeightPx);
    const bounds = [0, ...cuts, height];
    const pages = bounds
      .slice(0, -1)
      .map((start, index) => ({ start, height: bounds[index + 1] - start }))
      .filter((page) => page.height > 1)
      .slice(0, MAX_PAGES);
    if (pages.length === 0) return { ok: false, error: 'RENDER_FAILED' };

    const { toPng } = await import('html-to-image');
    const rawUrl = await toPng(container, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });
    const source = await loadImage(rawUrl);
    const pixelRatio = source.naturalHeight / height;

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });

    for (let i = 0; i < pages.length; i += 1) {
      const page = pages[i];
      if (i > 0) doc.addPage();
      const sliceHeightPx = Math.max(
        1,
        Math.min(
          Math.round(page.height * pixelRatio),
          source.naturalHeight - Math.round(page.start * pixelRatio),
        ),
      );
      const canvas = document.createElement('canvas');
      canvas.width = source.naturalWidth;
      canvas.height = sliceHeightPx;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { ok: false, error: 'RENDER_FAILED' };
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, -Math.round(page.start * pixelRatio));
      const pageUrl = canvas.toDataURL('image/jpeg', 0.92);
      const pageHeightMm = Math.min(CONTENT_HEIGHT_MM, page.height / pxPerMm);
      doc.addImage(pageUrl, 'JPEG', PAGE_MARGIN_MM, PAGE_MARGIN_MM, CONTENT_WIDTH_MM, pageHeightMm);
      onProgress?.((i + 1) / pages.length);
    }

    const output = doc.output('arraybuffer');
    return { ok: true, value: new Uint8Array(output) };
  } catch {
    return { ok: false, error: 'SNAPSHOT_FAILED' };
  }
}
