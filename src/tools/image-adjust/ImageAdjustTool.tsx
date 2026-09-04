import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  DEFAULT_ADJUST,
  buildCssFilter,
  clampAdjust,
  isImageFile,
  type AdjustOptions,
} from './core';

/** 在线图片调色 */
export default function ImageAdjustTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        b: DEFAULT_ADJUST.brightness,
        c: DEFAULT_ADJUST.contrast,
        s: DEFAULT_ADJUST.saturate,
        h: DEFAULT_ADJUST.hue,
      }),
    [],
  );
  const [options, setOptions] = useState<AdjustOptions>(() =>
    clampAdjust({
      brightness: Number(init.b),
      contrast: Number(init.c),
      saturate: Number(init.s),
      hue: Number(init.h),
    }),
  );
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError] = useState<'NOT_IMAGE' | 'ENCODE' | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const patch = (partial: Partial<AdjustOptions>) =>
    setOptions((prev) => clampAdjust({ ...prev, ...partial }));

  const draw = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('ENCODE');
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = buildCssFilter(options);
    ctx.drawImage(img, 0, 0);
    ctx.filter = 'none';
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
  }, [options]);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) draw();
  }, [draw, sourceUrl]);

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

  const reset = () => setOptions({ ...DEFAULT_ADJUST });

  const download = () => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `adjusted-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
        >
          {t('tools.imageAdjust.reset')}
        </button>
        <ShareButton
          getState={() => ({
            b: options.brightness,
            c: options.contrast,
            s: options.saturate,
            h: options.hue,
          })}
        />
      </OptionBar>

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ['brightness', options.brightness, 0, 200],
            ['contrast', options.contrast, 0, 200],
            ['saturate', options.saturate, 0, 200],
            ['hue', options.hue, -180, 180],
          ] as const
        ).map(([key, value, min, max]) => (
          <label
            key={key}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
          >
            {t(`tools.imageAdjust.${key}`)}
            <input
              type="range"
              min={min}
              max={max}
              value={value}
              onChange={(e) => patch({ [key]: Number(e.target.value) })}
              className="min-w-0 flex-1"
            />
            <span className="w-12 font-mono text-xs">
              {key === 'hue' ? `${value}°` : `${value}%`}
            </span>
          </label>
        ))}
      </div>

      <FileDropZone accept="image/*" onFile={handleFile} hint={t('tools.imageAdjust.dropHint')} />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.imageAdjust.err.${error}`)}
        </p>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {(sourceUrl || outputUrl) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {sourceUrl && (
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('tools.imageAdjust.original')}
              </p>
              <img
                src={sourceUrl}
                alt=""
                className="max-h-80 rounded-md border border-gray-200 dark:border-gray-700"
              />
            </div>
          )}
          {outputUrl && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('common.result')}
                </p>
                <button
                  type="button"
                  onClick={download}
                  className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {t('tools.imageAdjust.download')}
                </button>
              </div>
              <img
                src={outputUrl}
                alt=""
                className="max-h-80 rounded-md border border-gray-200 dark:border-gray-700"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
