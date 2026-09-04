import { PDFDocument } from '@cantoo/pdf-lib';
import type { ToolResult } from '@/core/types';
import { openPdfjsDoc, renderPageToCanvas, canvasToGrayscale } from './render';

/** 视觉灰度：渲图后重打 PDF（非矢量文字可编辑灰度） */
export async function pdfToGrayscaleVisual(
  bytes: Uint8Array,
  scale = 1.5,
  opts?: { password?: string },
): Promise<ToolResult<Uint8Array>> {
  const opened = await openPdfjsDoc(bytes, { password: opts?.password });
  if (!opened.ok) return opened;
  try {
    const out = await PDFDocument.create();
    for (let i = 1; i <= opened.value.numPages; i++) {
      const canvasResult = await renderPageToCanvas(opened.value, i, scale);
      if (!canvasResult.ok) return canvasResult;
      const gray = canvasToGrayscale(canvasResult.value);
      const dataUrl = gray.toDataURL('image/jpeg', 0.9);
      const jpgBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
      const image = await out.embedJpg(jpgBytes);
      const page = out.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }
    await opened.value.cleanup();
    return { ok: true, value: await out.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

/** 多图合成 PDF（每图一页，按图片像素尺寸） */
export async function imagesToPdf(
  images: Array<{ bytes: Uint8Array; mime: string }>,
): Promise<ToolResult<Uint8Array>> {
  if (images.length === 0) return { ok: false, error: 'EMPTY' };
  try {
    const out = await PDFDocument.create();
    for (const img of images) {
      const isPng = img.mime.includes('png');
      const embedded = isPng ? await out.embedPng(img.bytes) : await out.embedJpg(img.bytes);
      const page = out.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: embedded.width,
        height: embedded.height,
      });
    }
    return { ok: true, value: await out.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}
