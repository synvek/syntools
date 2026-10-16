import type { PhotoDoc, Selection } from './model/types';
import { compositeDoc, rasterizeSelection } from './render/export';

/**
 * 系统剪贴板桥：与 Photoshop / Photopea 双向交换位图。
 *
 * 约定与站内其它工具一致（见 `tools/code-editor/clipboard.ts`）：
 * - `ClipboardItem` 不可用、无权限、或被浏览器拒绝时**一律返回失败**，不抛出；
 *   由调用方决定是提示还是降级（下载 / 内部剪贴板）。
 * - 读取带超时：某些环境下 `clipboard.read()` 会挂在权限提示上，
 *   若不设上限会把「粘贴」这类高频操作卡住。
 */

/** 默认读取超时：超过即视为「系统剪贴板不可用」，让调用方回退 */
export const CLIPBOARD_READ_TIMEOUT = 500;

/** 画布 → PNG Blob；`toBlob` 失败或返回空时回落到 dataURL 解码 */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        resolve(dataUrlToBlob(canvas.toDataURL('image/png')));
      }, 'image/png');
    } catch {
      resolve(null);
    }
  });
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [meta, payload] = dataUrl.split(',');
    if (!payload) return null;
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const type = /:(.*?);/.exec(meta)?.[1] ?? 'image/png';
    return new Blob([bytes], { type });
  } catch {
    return null;
  }
}

/** 写入 PNG 到系统剪贴板；成功与否由返回值表达 */
export async function writeClipboardImage(blob: Blob): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

async function readClipboardImageOnce(): Promise<Blob | null> {
  if (!navigator.clipboard?.read) return null;
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((candidate) => candidate.startsWith('image/'));
      if (type) return await item.getType(type);
    }
  } catch {
    return null;
  }
  return null;
}

/** 读取系统剪贴板中的图片；超时或不可用时返回 null */
export async function readClipboardImage(timeoutMs = CLIPBOARD_READ_TIMEOUT): Promise<Blob | null> {
  return Promise.race([
    readClipboardImageOnce(),
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

/** Blob → 可交给既有导入流程的 File（扩展名按 MIME 推导） */
export function blobToImageFile(blob: Blob, name = 'clipboard'): File {
  const extension = (blob.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg');
  return new File([blob], `${name}.${extension}`, { type: blob.type || 'image/png' });
}

/**
 * 挑出「复制」应该送往系统剪贴板的那块像素，语义与 Photoshop 对齐：
 * 1. 有选区 → 选区内的合成内容；
 * 2. 否则有活动图层 → 只渲染该图层（及其子树，例如组 / 智能对象的子级）并裁到它的包围盒；
 * 3. 都没有 → 整幅合并图像。
 *
 * 注意第 2 步用浅拷贝替换 `layers` 来隔离图层，避免 `cloneDoc` 深拷贝整份像素数据。
 */
export function clipboardCanvas(
  doc: PhotoDoc,
  selection: Selection | null,
  activeLayerId: string | null,
): HTMLCanvasElement | null {
  if (selection && selection.width >= 1 && selection.height >= 1) {
    return rasterizeSelection(doc, selection);
  }
  const layer = doc.layers.find((item) => item.id === activeLayerId);
  if (layer && layer.width >= 1 && layer.height >= 1) {
    const isolated: PhotoDoc = { ...doc, layers: [layer] };
    return compositeDoc(isolated, {
      x: Math.round(layer.x),
      y: Math.round(layer.y),
      width: Math.round(layer.width),
      height: Math.round(layer.height),
    });
  }
  return compositeDoc(doc);
}
