import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { OptionBar } from '@/core/components/ActionButtons';
import {
  CROP_ASPECTS,
  clampCrop,
  defaultCrop,
  fitAspect,
  isImageFile,
  validateCrop,
  type CropAspect,
  type CropRect,
} from './core';

/** 在线图片裁剪 */
export default function ImageCropTool() {
  const { t } = useTranslation();
  const [aspect, setAspect] = useState<CropAspect>('free');
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 1, height: 1 });
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError] = useState<'NOT_IMAGE' | 'ENCODE' | 'INVALID' | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const applyCrop = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || imgSize.w < 1) return;
    const v = validateCrop(crop, imgSize.w, imgSize.h);
    if (!v.ok) {
      setError('INVALID');
      return;
    }
    const c = v.value;
    canvas.width = c.width;
    canvas.height = c.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('ENCODE');
      return;
    }
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, c.x, c.y, c.width, c.height, 0, 0, c.width, c.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError('ENCODE');
        return;
      }
      const url = URL.createObjectURL(blob);
      setOutputUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setError(null);
    }, 'image/png');
  }, [crop, imgSize]);

  useEffect(() => {
    if (imgRef.current?.complete && imgSize.w > 0) applyCrop();
  }, [applyCrop, sourceUrl, imgSize.w]);

  useEffect(
    () => () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleFile = (file: File) => {
    if (!isImageFile(file.type)) {
      setError('NOT_IMAGE');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setImgSize({ w, h });
      setCrop(defaultCrop(w, h));
      setAspect('1:1');
      setSourceUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('ENCODE');
    };
    img.src = url;
  };

  const changeAspect = (next: CropAspect) => {
    setAspect(next);
    if (imgSize.w > 0) setCrop((prev) => fitAspect(prev, next, imgSize.w, imgSize.h));
  };

  const patchCrop = (partial: Partial<CropRect>) => {
    if (imgSize.w < 1) return;
    setCrop((prev) => {
      const merged = { ...prev, ...partial };
      return aspect === 'free'
        ? clampCrop(merged, imgSize.w, imgSize.h)
        : fitAspect(merged, aspect, imgSize.w, imgSize.h);
    });
  };

  const toImageCoords = (clientX: number, clientY: number) => {
    const el = displayRef.current;
    if (!el || imgSize.w < 1) return null;
    const rect = el.getBoundingClientRect();
    const scaleX = imgSize.w / rect.width;
    const scaleY = imgSize.h / rect.height;
    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top) * scaleY),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (aspect !== 'free') return;
    const p = toImageCoords(e.clientX, e.clientY);
    if (!p) return;
    dragStart.current = p;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current) return;
    const p = toImageCoords(e.clientX, e.clientY);
    if (!p) return;
    const x = Math.min(dragStart.current.x, p.x);
    const y = Math.min(dragStart.current.y, p.y);
    const width = Math.abs(p.x - dragStart.current.x);
    const height = Math.abs(p.y - dragStart.current.y);
    setCrop(clampCrop({ x, y, width, height }, imgSize.w, imgSize.h));
  };

  const onPointerUp = () => {
    setDragging(false);
    dragStart.current = null;
  };

  const download = () => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `crop-${crop.width}x${crop.height}.png`;
    a.click();
  };

  const overlayStyle = useMemo(() => {
    if (imgSize.w < 1) return undefined;
    return {
      left: `${(crop.x / imgSize.w) * 100}%`,
      top: `${(crop.y / imgSize.h) * 100}%`,
      width: `${(crop.width / imgSize.w) * 100}%`,
      height: `${(crop.height / imgSize.h) * 100}%`,
    };
  }, [crop, imgSize]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageCrop.aspect')}
          <select
            value={aspect}
            onChange={(e) => changeAspect(e.target.value as CropAspect)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {CROP_ASPECTS.map((a) => (
              <option key={a} value={a}>
                {t(`tools.imageCrop.aspects.${a === 'free' ? 'free' : a.replace(':', '_')}`)}
              </option>
            ))}
          </select>
        </label>
      </OptionBar>

      {imgSize.w > 0 && (
        <div className="grid gap-2 sm:grid-cols-4">
          {(['x', 'y', 'width', 'height'] as const).map((key) => (
            <label
              key={key}
              className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300"
            >
              {t(`tools.imageCrop.${key}`)}
              <input
                type="number"
                min={0}
                value={crop[key]}
                onChange={(e) => patchCrop({ [key]: Number(e.target.value) })}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
          ))}
        </div>
      )}

      <FileDropZone accept="image/*" onFile={handleFile} hint={t('tools.imageCrop.dropHint')} />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.imageCrop.err.${error}`)}
        </p>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {sourceUrl && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
              {t('tools.imageCrop.hint')}
            </p>
            <div
              ref={displayRef}
              className="relative inline-block max-w-full cursor-crosshair touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <img src={sourceUrl} alt="" className="max-h-96 max-w-full select-none" draggable={false} />
              {overlayStyle && (
                <div
                  className="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/20"
                  style={overlayStyle}
                />
              )}
            </div>
          </div>
          {outputUrl && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('common.result')} ({crop.width}×{crop.height})
                </p>
                <button
                  type="button"
                  onClick={download}
                  className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {t('tools.imageCrop.download')}
                </button>
              </div>
              <img
                src={outputUrl}
                alt=""
                className="max-h-96 rounded-md border border-gray-200 dark:border-gray-700"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
