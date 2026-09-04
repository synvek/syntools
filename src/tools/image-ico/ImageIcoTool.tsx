import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  DEFAULT_ICO_SIZES,
  ICO_SIZES,
  type IcoSize,
  encodeIco,
  formatBytes,
  icoToBlob,
  isIcoFile,
  isLikelyImageFile,
  normalizeIcoSizes,
  parseIco,
  type ParsedIcoEntry,
} from './core';

type Mode = 'toIco' | 'fromIco';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load'));
    img.src = url;
  });
}

async function rasterToPng(
  source: CanvasImageSource,
  size: number,
  srcW: number,
  srcH: number,
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.clearRect(0, 0, size, size);
  const scale = Math.min(size / srcW, size / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  ctx.drawImage(source, (size - w) / 2, (size - h) / 2, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('png');
  return new Uint8Array(await blob.arrayBuffer());
}

/** 将 ICO 内嵌 BMP（常见 32-bit BGRA + AND mask）转为 PNG data URL */
function bmpIcoEntryToDataUrl(entry: ParsedIcoEntry): string | null {
  const bytes = entry.bytes;
  if (bytes.length < 40) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerSize = view.getUint32(0, true);
  const width = Math.abs(view.getInt32(4, true));
  const heightFull = Math.abs(view.getInt32(8, true));
  const height = Math.floor(heightFull / 2) || heightFull;
  const bitCount = view.getUint16(14, true);
  if (bitCount !== 32 || width < 1 || height < 1) return null;

  const pixelOffset = headerSize;
  const rowSize = width * 4;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imageData = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y; // BMP bottom-up
    const srcRow = pixelOffset + srcY * rowSize;
    const dstRow = y * width * 4;
    for (let x = 0; x < width; x++) {
      const si = srcRow + x * 4;
      const di = dstRow + x * 4;
      if (si + 3 >= bytes.length) return null;
      imageData.data[di] = bytes[si + 2]; // R
      imageData.data[di + 1] = bytes[si + 1]; // G
      imageData.data[di + 2] = bytes[si]; // B
      imageData.data[di + 3] = bytes[si + 3]; // A
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function entryPreviewUrl(entry: ParsedIcoEntry): string | null {
  if (entry.format === 'png') {
    return URL.createObjectURL(new Blob([entry.bytes], { type: 'image/png' }));
  }
  if (entry.format === 'bmp') return bmpIcoEntryToDataUrl(entry);
  return null;
}

/** 图片 ↔ ICO 转换（多尺寸 favicon） */
export default function ImageIcoTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () => readSharedState({ m: 'toIco', s: DEFAULT_ICO_SIZES.join(',') }),
    [],
  );
  const [mode, setMode] = useState<Mode>(init.m === 'fromIco' ? 'fromIco' : 'toIco');
  const [sizes, setSizes] = useState<IcoSize[]>(() => {
    const parsed = String(init.s || '')
      .split(',')
      .map(Number);
    const n = normalizeIcoSizes(parsed);
    return n.ok ? n.value : [...DEFAULT_ICO_SIZES];
  });
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [icoUrl, setIcoUrl] = useState<string | null>(null);
  const [icoSize, setIcoSize] = useState(0);
  const [extracted, setExtracted] = useState<
    { width: number; height: number; url: string; format: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (icoUrl) URL.revokeObjectURL(icoUrl);
      extracted.forEach((e) => {
        if (e.url.startsWith('blob:')) URL.revokeObjectURL(e.url);
      });
    },
    // 仅卸载时清理；过程中由各 setter 自行 revoke
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const toggleSize = (size: IcoSize) => {
    setSizes((prev) => {
      const next = prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size];
      const n = normalizeIcoSizes(next);
      return n.ok ? n.value : prev;
    });
  };

  const clearAll = () => {
    setSourceUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setIcoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setExtracted((prev) => {
      prev.forEach((e) => {
        if (e.url.startsWith('blob:')) URL.revokeObjectURL(e.url);
      });
      return [];
    });
    setSourceName('');
    setIcoSize(0);
    setError(null);
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (mode === 'toIco') {
      if (isIcoFile(file.type, file.name)) {
        setError('USE_FROM_ICO');
        return;
      }
      if (!isLikelyImageFile(file.type, file.name)) {
        setError('NOT_IMAGE');
        return;
      }
      const url = URL.createObjectURL(file);
      setSourceUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setSourceName(file.name);
      setIcoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setIcoSize(0);
      return;
    }

    // fromIco
    if (!isIcoFile(file.type, file.name) && !file.name.toLowerCase().endsWith('.ico')) {
      setError('NOT_ICO');
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseIco(buf);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      setSourceName(file.name);
      setExtracted((prev) => {
        prev.forEach((e) => {
          if (e.url.startsWith('blob:')) URL.revokeObjectURL(e.url);
        });
        return parsed.value.map((entry) => {
          const url = entryPreviewUrl(entry);
          return {
            width: entry.width,
            height: entry.height,
            url: url || '',
            format: entry.format,
          };
        }).filter((e) => e.url);
      });
      if (parsed.value.length === 0) setError('INVALID_ICO');
    } catch {
      setError('INVALID_ICO');
    } finally {
      setBusy(false);
    }
  };

  const convertToIco = async () => {
    if (!sourceUrl) return;
    const sized = normalizeIcoSizes(sizes);
    if (!sized.ok) {
      setError('NO_SIZES');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const img = await loadImage(sourceUrl);
      const frames = [];
      for (const size of sized.value) {
        const png = await rasterToPng(img, size, img.naturalWidth, img.naturalHeight);
        frames.push({ width: size, height: size, png });
      }
      const encoded = encodeIco(frames);
      if (!encoded.ok) {
        setError(encoded.error);
        return;
      }
      const blob = icoToBlob(encoded.value);
      const url = URL.createObjectURL(blob);
      setIcoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setIcoSize(blob.size);
    } catch {
      setError('ENCODE');
    } finally {
      setBusy(false);
    }
  };

  const downloadIco = () => {
    if (!icoUrl) return;
    const a = document.createElement('a');
    a.href = icoUrl;
    a.download = (sourceName.replace(/\.[^.]+$/, '') || 'favicon') + '.ico';
    a.click();
  };

  const downloadPng = (url: string, w: number, h: number) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `icon-${w}x${h}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageIco.mode')}
          <select
            value={mode}
            onChange={(e) => {
              clearAll();
              setMode(e.target.value as Mode);
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="toIco">{t('tools.imageIco.toIco')}</option>
            <option value="fromIco">{t('tools.imageIco.fromIco')}</option>
          </select>
        </label>
        <ClearButton onClick={clearAll} disabled={!sourceUrl && !icoUrl && extracted.length === 0} />
        <ShareButton getState={() => ({ m: mode, s: sizes.join(',') })} />
      </OptionBar>

      {mode === 'toIco' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {t('tools.imageIco.sizes')}
            </span>
            {ICO_SIZES.map((size) => (
              <label
                key={size}
                className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200"
              >
                <input
                  type="checkbox"
                  checked={sizes.includes(size)}
                  onChange={() => toggleSize(size)}
                />
                {size}×{size}
              </label>
            ))}
          </div>

          <FileDropZone
            accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml"
            onFile={handleFile}
            hint={t('tools.imageIco.uploadImageHint')}
          />

          {sourceUrl && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <img
                src={sourceUrl}
                alt=""
                className="max-h-40 max-w-xs rounded-md border border-gray-200 dark:border-gray-700"
              />
              <div className="flex flex-col gap-2">
                <p className="text-sm text-gray-600 dark:text-gray-300">{sourceName}</p>
                <button
                  type="button"
                  onClick={convertToIco}
                  disabled={busy || sizes.length === 0}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? t('tools.imageIco.converting') : t('tools.imageIco.convert')}
                </button>
                {icoUrl && (
                  <button
                    type="button"
                    onClick={downloadIco}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {t('tools.imageIco.downloadIco')} ({formatBytes(icoSize)})
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'fromIco' && (
        <>
          <FileDropZone
            accept=".ico,image/x-icon,image/vnd.microsoft.icon"
            onFile={handleFile}
            hint={t('tools.imageIco.uploadIcoHint')}
          />
          {busy && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.imageIco.converting')}</p>
          )}
          {extracted.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('tools.imageIco.extracted', { n: extracted.length, name: sourceName })}
              </p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {extracted.map((item) => (
                  <li
                    key={`${item.width}x${item.height}-${item.format}`}
                    className="flex flex-col items-start gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <img
                      src={item.url}
                      alt=""
                      className="h-16 w-16 object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.width}×{item.height} · {item.format.toUpperCase()}
                    </p>
                    <button
                      type="button"
                      onClick={() => downloadPng(item.url, item.width, item.height)}
                      className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      {t('tools.imageIco.downloadPng')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.imageIco.err.${error}`)}
        </p>
      )}
    </div>
  );
}
