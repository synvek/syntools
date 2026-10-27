import type { PhotoDoc, Selection } from './model/types';
import { compositeDoc, rasterizeSelection } from './render/export';

/**
 * System clipboard bridge: exchange bitmaps both ways with Photoshop / Photopea.
 *
 * Same conventions as the other tools (see `tools/code-editor/clipboard.ts`):
 * - when `ClipboardItem` is missing, permission is denied or the browser refuses, **return failure**, never throw;
 *   the caller decides whether to notify or degrade (download / internal clipboard).
 * - reads time out: in some environments `clipboard.read()` hangs on the permission prompt,
 *   and without a cap a high-frequency action like paste would stall.
 */

/** Default read timeout: past it the system clipboard counts as unavailable, so callers fall back */
export const CLIPBOARD_READ_TIMEOUT = 500;

/** Canvas → PNG Blob; when `toBlob` fails or returns nothing, fall back to decoding a dataURL */
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

/** Write a PNG to the system clipboard; success is reported through the return value */
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

/** Read an image from the system clipboard; null on timeout or when unavailable */
export async function readClipboardImage(timeoutMs = CLIPBOARD_READ_TIMEOUT): Promise<Blob | null> {
  return Promise.race([
    readClipboardImageOnce(),
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

/** Blob → File for the existing import flow (extension derived from the MIME type) */
export function blobToImageFile(blob: Blob, name = 'clipboard'): File {
  const extension = (blob.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg');
  return new File([blob], `${name}.${extension}`, { type: blob.type || 'image/png' });
}

/**
 * Pick the pixels "copy" should send to the system clipboard, matching Photoshop:
 * 1. with a selection: the composited content inside it;
 * 2. otherwise with an active layer: render only it (and its subtree, e.g. a group's children), cropped to bbox;
 * 3. neither: the whole composite.
 *
 * Note step 2 swaps in a shallow copy of `layers` to isolate the layer, avoiding `cloneDoc`'s deep copies.
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
