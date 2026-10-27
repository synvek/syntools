/** Export: composite the whole scene offscreen so screen zoom cannot affect export resolution. */

import { downloadBlob } from '@/core/lib/download';
import type { Scene } from './core';
import { drawGrid, drawOps } from './render';

export type ExportFormat = 'png' | 'pngAlpha' | 'jpg';

/** `png` keeps the background, `pngAlpha` is transparent, `jpg` forces a white background */
export async function exportScene(scene: Scene, format: ExportFormat): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(scene.width));
  canvas.height = Math.max(1, Math.round(scene.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[doodle-board] canvas 上下文不可用，导出中止');
    return;
  }

  if (format !== 'pngAlpha') {
    // Transparent exported as JPG turns black, so add a white base; other cases use their own colour
    ctx.fillStyle = scene.background.kind === 'transparent' ? '#ffffff' : scene.background.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (scene.background.kind === 'grid') drawGrid(ctx, canvas.width, canvas.height);
  }
  drawOps(ctx, scene);

  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, 0.92);
  });
  if (!blob) {
    console.error('[doodle-board] 画布导出失败（toBlob 返回空）');
    return;
  }
  downloadBlob(blob, `doodle-${Date.now()}.${format === 'jpg' ? 'jpg' : 'png'}`);
}
