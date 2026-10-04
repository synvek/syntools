import type { WatermarkConfig } from './pageSetup';

/**
 * 文字水印的光栅化：Word 的行属性不支持文字旋转，
 * 因此导出 docx 时把水印渲染为透明 PNG，作为页眉中的浮动图片（衬于文字下方），
 * 与屏幕 / 打印 / PDF 三条路径的观感保持一致。
 */

export interface WatermarkImage {
  dataUrl: string;
  /** 逻辑尺寸（CSS px），按 px → EMU 换算写入 docx */
  width: number;
  height: number;
}

/** 光栅化倍率：水印是大幅淡色文字，2 倍足够且体积可控 */
const PIXEL_RATIO = 2;

const FONT_STACK = "'PingFang SC','Microsoft YaHei',Arial,sans-serif";

export async function renderWatermarkImage(
  watermark: WatermarkConfig | null | undefined,
  widthPx: number,
  heightPx: number,
): Promise<WatermarkImage | null> {
  if (!watermark || !watermark.text.trim()) return null;
  if (typeof document === 'undefined') return null;
  if (widthPx <= 0 || heightPx <= 0) return null;

  const { toPng } = await import('html-to-image');
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(host);

  try {
    const node = document.createElement('div');
    node.style.cssText = `width:${widthPx}px;height:${heightPx}px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:transparent;`;
    const span = document.createElement('span');
    span.textContent = watermark.text;
    // 字号与屏幕端 clamp(28px, 5vw, 64px) 对齐：水印观感不变
    const fontSize = Math.max(28, Math.min(Math.round(widthPx * 0.16), 96));
    span.style.cssText = `color:${watermark.color};opacity:${watermark.opacity};transform:rotate(${watermark.rotation}deg);font-family:${FONT_STACK};font-weight:700;font-size:${fontSize}px;letter-spacing:0.08em;white-space:nowrap;`;
    node.appendChild(span);
    host.appendChild(node);

    const dataUrl = await toPng(node, { pixelRatio: PIXEL_RATIO, cacheBust: true });
    return { dataUrl, width: widthPx, height: heightPx };
  } catch {
    // 渲染失败不阻断导出：缺一个水印比导出失败好
    return null;
  } finally {
    host.remove();
  }
}
