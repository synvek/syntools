import type { ToolResult } from '@/core/types';
import { computePageBreaks } from './core';
import { applyPagedBreaks } from './PageView';
import {
  DEFAULT_PAGE_SETUP,
  normalizePageSetup,
  resolvePageMetrics,
  type PageSetupConfig,
} from './pageSetup';

/**
 * PDF 导出适配层：
 * - 模式一（text）：交给浏览器打印视图，生成可选可检索的文字 PDF（中文不乱码）；
 * - 模式二（snapshot）：按内容宽度排版后光栅化，再按块级边界切片拼成多页 PDF。
 *
 * 两种模式共用同一份页面设置（纸张/边距/方向），确保版式一致。
 */

const MAX_PAGES = 200;
/** 大文档分片渲染阈值（px）：超过时按页区段分片 toPng，避免单张超大 canvas */
const CHUNK_HEIGHT_PX = 6000;

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
    img.src = dataUrl;
  });
}

/**
 * 当前环境是否支持打印对话框。
 * Tauri 等桌面 WebView（WKWebView / WebView2）中 window.print() 静默无效，
 * 此时导出 PDF 应回退到快照模式。
 */
export function printSupported(): boolean {
  return !('__TAURI_INTERNALS__' in window) && !('__TAURI__' in window);
}

/**
 * 打印整篇文档（依赖用户在打印对话框中选择「另存为 PDF」）。
 * @param flow 页面视图下传入打印流容器：套用与屏幕页面视图同一套块级分页，
 *             配合 CSS `break-before: page` 使打印分页与所见一致。
 */
export function printToPdf(flow?: HTMLElement | null, setup?: PageSetupConfig | null): void {
  if (flow) applyPagedBreaks(flow, resolvePageMetrics(setup ?? DEFAULT_PAGE_SETUP));
  window.print();
}

/**
 * 高保真 PDF：把按 A4 内容宽度排版的容器整体光栅化，
 * 再按块级元素的边界切片为多页 A4 图片 PDF。
 */
export async function snapshotToPdf(
  container: HTMLElement,
  onProgress?: (value: number) => void,
  setupInput?: PageSetupConfig | null,
): Promise<ToolResult<Uint8Array>> {
  try {
    const setup = normalizePageSetup(setupInput ?? DEFAULT_PAGE_SETUP);
    const metrics = resolvePageMetrics(setup);
    const width = container.clientWidth;
    const height = container.scrollHeight;
    if (!width || !height) return { ok: false, error: 'RENDER_FAILED' };

    const pxPerMm = width / metrics.contentWidthMm;
    const pageHeightPx = metrics.contentHeightMm * pxPerMm;
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

    // 大文档按高度分片光栅化，避免单张超大 canvas（浏览器尺寸上限/内存）
    const pixelRatio = height > CHUNK_HEIGHT_PX ? 1.5 : 2;
    const source = await rasterize(container, width, height, pixelRatio, onProgress);
    const renderedRatio = source.height / height;

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      unit: 'mm',
      format: [metrics.widthMm, metrics.heightMm],
      orientation: 'portrait',
      compress: true,
    });

    for (let i = 0; i < pages.length; i += 1) {
      const page = pages[i];
      if (i > 0) doc.addPage();
      const sliceHeightPx = Math.max(
        1,
        Math.min(
          Math.round(page.height * renderedRatio),
          source.height - Math.round(page.start * renderedRatio),
        ),
      );
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = sliceHeightPx;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { ok: false, error: 'RENDER_FAILED' };
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, -Math.round(page.start * renderedRatio));
      const pageUrl = canvas.toDataURL('image/jpeg', 0.92);
      const pageHeightMm = Math.min(metrics.contentHeightMm, page.height / pxPerMm);
      doc.addImage(
        pageUrl,
        'JPEG',
        setup.margin.left,
        setup.margin.top,
        metrics.contentWidthMm,
        pageHeightMm,
      );
      // 页眉 / 页脚 / 页码（文本层叠在快照之上）
      drawHeaderFooter(doc, setup, metrics, i + 1);
      onProgress?.((i + 1) / pages.length);
    }

    const output = doc.output('arraybuffer');
    return { ok: true, value: new Uint8Array(output) };
  } catch {
    return { ok: false, error: 'SNAPSHOT_FAILED' };
  }
}

/**
 * 光栅化容器为 canvas：超过分片阈值时按高度分段渲染再拼接，
 * 避免单张超大 canvas 触发浏览器尺寸上限或内存峰值。
 */
async function rasterize(
  container: HTMLElement,
  widthPx: number,
  heightPx: number,
  ratio: number,
  onProgress?: (value: number) => void,
): Promise<HTMLCanvasElement> {
  const { toPng } = await import('html-to-image');
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(widthPx * ratio));
  canvas.height = Math.max(1, Math.round(heightPx * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (heightPx <= CHUNK_HEIGHT_PX) {
    const url = await toPng(container, {
      pixelRatio: ratio,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });
    const image = await loadImage(url);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  const total = Math.ceil(heightPx / CHUNK_HEIGHT_PX);
  for (let index = 0, offset = 0; offset < heightPx; index += 1, offset += CHUNK_HEIGHT_PX) {
    const chunk = Math.min(CHUNK_HEIGHT_PX, heightPx - offset);
    const url = await toPng(container, {
      pixelRatio: ratio,
      backgroundColor: '#ffffff',
      cacheBust: true,
      width: widthPx,
      height: chunk,
      style: { transform: `translateY(${-offset}px)`, transformOrigin: 'top left' },
    });
    const image = await loadImage(url);
    ctx.drawImage(
      image,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
      0,
      Math.round(offset * ratio),
      image.naturalWidth,
      image.naturalHeight,
    );
    onProgress?.((index + 1) / (total + 1));
  }
  return canvas;
}

/** 在快照页上绘制页眉 / 页脚 / 页码（页眉位于上边距中部，页脚位于下边距中部） */
function drawHeaderFooter(
  doc: import('jspdf').jsPDF,
  setup: PageSetupConfig,
  metrics: { widthMm: number; heightMm: number },
  page: number,
): void {
  doc.setFontSize(9);
  doc.setTextColor(110, 118, 129);
  const left = setup.margin.left;
  if (setup.header.trim()) {
    doc.text(setup.header.trim(), left, Math.max(4, setup.margin.top / 2));
  }
  const footerY = metrics.heightMm - Math.max(4, setup.margin.bottom / 2);
  if (setup.footer.trim()) {
    doc.text(setup.footer.trim(), left, footerY);
  }
  if (setup.showPageNumber) {
    const label = String(page);
    doc.text(label, metrics.widthMm - setup.margin.right - doc.getTextWidth(label), footerY);
  }
}
