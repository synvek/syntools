import katex from 'katex';

/**
 * 公式光栅化（OMML 表达不了的语法走图片降级）：
 * 离屏用 KaTeX 渲染后交给 html-to-image 输出 PNG，
 * 保证 Word 中「看起来一致」，而不是退化成源码文本或丢失内容。
 */

export interface MathImage {
  /** PNG data URL（导出层负责解码为字节） */
  dataUrl: string;
  /** 逻辑尺寸（CSS px）——写入 docx 时按 px → EMU 换算 */
  width: number;
  height: number;
}

/** 光栅化倍率：公式通常很小，3 倍保证打印清晰 */
const PIXEL_RATIO = 3;

export interface MathImageRequest {
  /** 去重键（同一条公式只渲染一次） */
  key: string;
  latex: string;
  display: boolean;
}

/**
 * 批量渲染公式图片。
 * 失败项直接跳过（调用方回退为源码文本），不抛异常——
 * 导出流程不允许因为一条公式而整体失败。
 */
export async function renderLatexImages(
  items: readonly MathImageRequest[],
): Promise<Map<string, MathImage>> {
  const result = new Map<string, MathImage>();
  if (items.length === 0 || typeof document === 'undefined') return result;

  const { toPng } = await import('html-to-image');
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  // 必须参与布局才能被光栅化：放到视口外而不是 display:none
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;background:#ffffff;z-index:-1;pointer-events:none;';
  document.body.appendChild(host);

  try {
    for (const item of items) {
      if (result.has(item.key)) continue;
      const node = document.createElement('div');
      node.style.cssText = 'display:inline-block;background:#ffffff;padding:4px;';
      try {
        node.innerHTML = katex.renderToString(item.latex, {
          displayMode: item.display,
          throwOnError: true,
          strict: false,
        });
      } catch {
        continue;
      }
      host.appendChild(node);
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      if (width <= 0 || height <= 0) {
        node.remove();
        continue;
      }
      try {
        const dataUrl = await toPng(node, {
          pixelRatio: PIXEL_RATIO,
          backgroundColor: '#ffffff',
          cacheBust: true,
        });
        result.set(item.key, { dataUrl, width, height });
      } catch {
        // 单条失败不影响其它公式
      }
      node.remove();
    }
  } finally {
    host.remove();
  }
  return result;
}
