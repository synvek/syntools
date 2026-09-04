import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  MAX_IMAGES,
  computeMergeLayout,
  isImageFile,
  type MergeDirection,
} from './core';

interface LoadedImage {
  id: string;
  url: string;
  img: HTMLImageElement;
}

const DIRECTIONS: MergeDirection[] = ['horizontal', 'vertical', 'grid'];

/** 在线图片合并 */
export default function ImageMergeTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ d: 'horizontal', g: 0 }), []);
  const [direction, setDirection] = useState<MergeDirection>(
    DIRECTIONS.includes(init.d as MergeDirection)
      ? (init.d as MergeDirection)
      : 'horizontal',
  );
  const [gap, setGap] = useState(Number(init.g) || 0);
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError] = useState<'NOT_IMAGE' | 'TOO_MANY' | 'ENCODE' | 'EMPTY' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const imagesRef = useRef(images);
  imagesRef.current = images;
  const outputUrlRef = useRef(outputUrl);
  outputUrlRef.current = outputUrl;

  useEffect(
    () => () => {
      imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url));
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    },
    [],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || images.length === 0) {
      setOutputUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const sizes = images.map((i) => ({
      width: i.img.naturalWidth,
      height: i.img.naturalHeight,
    }));
    const layout = computeMergeLayout(sizes, direction, Math.max(0, gap));
    if (!layout.ok) {
      setError(layout.error === 'TOO_MANY' ? 'TOO_MANY' : 'EMPTY');
      return;
    }
    canvas.width = layout.value.canvasWidth;
    canvas.height = layout.value.canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('ENCODE');
      return;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    layout.value.slots.forEach((slot, idx) => {
      const item = images[idx];
      if (!item) return;
      ctx.drawImage(item.img, slot.x, slot.y, slot.width, slot.height);
    });
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
  }, [images, direction, gap]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const handleFile = (file: File) => {
    if (!isImageFile(file.type)) {
      setError('NOT_IMAGE');
      return;
    }
    if (images.length >= MAX_IMAGES) {
      setError('TOO_MANY');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImages((prev) => {
        if (prev.length >= MAX_IMAGES) {
          URL.revokeObjectURL(url);
          setError('TOO_MANY');
          return prev;
        }
        setError(null);
        return [...prev, { id: `${Date.now()}-${Math.random()}`, url, img }];
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('ENCODE');
    };
    img.src = url;
  };

  const removeAt = (id: string) => {
    setImages((prev) => {
      const next = prev.filter((i) => i.id !== id);
      const removed = prev.find((i) => i.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  };

  const clearAll = () => {
    setImages((prev) => {
      prev.forEach((i) => URL.revokeObjectURL(i.url));
      return [];
    });
  };

  const download = () => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `merged-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageMerge.direction')}
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as MergeDirection)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {t(`tools.imageMerge.directions.${d}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageMerge.gap')}
          <input
            type="number"
            min={0}
            max={100}
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <button
          type="button"
          onClick={clearAll}
          disabled={images.length === 0}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200"
        >
          {t('common.clear')}
        </button>
        <ShareButton getState={() => ({ d: direction, g: gap })} />
      </OptionBar>

      <FileDropZone
        accept="image/*"
        onFile={handleFile}
        hint={t('tools.imageMerge.dropHint', { max: MAX_IMAGES })}
      />

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((item, idx) => (
            <div key={item.id} className="relative">
              <img
                src={item.url}
                alt=""
                className="h-20 w-20 rounded-md border border-gray-200 object-cover dark:border-gray-700"
              />
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">
                {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeAt(item.id)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                aria-label={t('common.remove')}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.imageMerge.err.${error}`)}
        </p>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {outputUrl && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('common.result')}
            </p>
            <button
              type="button"
              onClick={download}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t('tools.imageMerge.download')}
            </button>
          </div>
          <img
            src={outputUrl}
            alt=""
            className="max-h-96 max-w-full rounded-md border border-gray-200 dark:border-gray-700"
          />
        </div>
      )}
    </div>
  );
}
