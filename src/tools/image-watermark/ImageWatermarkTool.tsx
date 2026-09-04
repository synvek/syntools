import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  DEFAULT_WATERMARK,
  clampOpacity,
  isImageFile,
  resolveAnchor,
  type TextWatermarkOptions,
  type WatermarkPosition,
} from './core';

const POSITIONS: WatermarkPosition[] = [
  'top-left',
  'top-right',
  'center',
  'bottom-left',
  'bottom-right',
  'tile',
];

/** 图片加水印 */
export default function ImageWatermarkTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        txt: DEFAULT_WATERMARK.text,
        fs: DEFAULT_WATERMARK.fontSize,
        c: DEFAULT_WATERMARK.color,
        o: DEFAULT_WATERMARK.opacity,
        p: DEFAULT_WATERMARK.position,
        r: DEFAULT_WATERMARK.rotate,
        g: DEFAULT_WATERMARK.gap,
      }),
    [],
  );

  const [options, setOptions] = useState<TextWatermarkOptions>({
    text: String(init.txt || DEFAULT_WATERMARK.text),
    fontSize: Number(init.fs) || DEFAULT_WATERMARK.fontSize,
    color: String(init.c || DEFAULT_WATERMARK.color),
    opacity: clampOpacity(Number(init.o) || DEFAULT_WATERMARK.opacity),
    position: POSITIONS.includes(init.p as WatermarkPosition)
      ? (init.p as WatermarkPosition)
      : 'bottom-right',
    rotate: Number(init.r) || DEFAULT_WATERMARK.rotate,
    gap: Number(init.g) || DEFAULT_WATERMARK.gap,
  });
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError] = useState<'NOT_IMAGE' | 'ENCODE' | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(
    () => () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    },
    [sourceUrl, outputUrl],
  );

  const patch = (partial: Partial<TextWatermarkOptions>) =>
    setOptions((prev) => ({ ...prev, ...partial }));

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
    ctx.drawImage(img, 0, 0);
    ctx.save();
    ctx.globalAlpha = options.opacity;
    ctx.fillStyle = options.color;
    ctx.font = `${options.fontSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    const text = options.text.trim() || 'Watermark';
    const metrics = ctx.measureText(text);
    const markW = metrics.width;
    const markH = options.fontSize;

    const paintAt = (x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((options.rotate * Math.PI) / 180);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };

    if (options.position === 'tile') {
      const gap = Math.max(40, options.gap);
      for (let y = -canvas.height; y < canvas.height * 2; y += gap) {
        for (let x = -canvas.width; x < canvas.width * 2; x += gap) {
          paintAt(x, y);
        }
      }
    } else {
      const { x, y } = resolveAnchor(
        canvas.width,
        canvas.height,
        markW,
        markH,
        options.position,
      );
      paintAt(x, y);
    }
    ctx.restore();

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

  // 选项变化时重绘；图片加载后由 handleFile 触发
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) draw();
  }, [draw, sourceUrl]);

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

  const download = () => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `watermark-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.watermark.text')}
          <input
            type="text"
            value={options.text}
            onChange={(e) => patch({ text: e.target.value })}
            maxLength={80}
            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.watermark.position')}
          <select
            value={options.position}
            onChange={(e) => patch({ position: e.target.value as WatermarkPosition })}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {t(`tools.watermark.positions.${p}`)}
              </option>
            ))}
          </select>
        </label>
        <ShareButton
          getState={() => ({
            txt: options.text,
            fs: options.fontSize,
            c: options.color,
            o: options.opacity,
            p: options.position,
            r: options.rotate,
            g: options.gap,
          })}
        />
      </OptionBar>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.watermark.color')}
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(options.color) ? options.color : '#ffffff'}
            onChange={(e) => patch({ color: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.watermark.fontSize')}
          <input
            type="range"
            min={12}
            max={96}
            value={options.fontSize}
            onChange={(e) => patch({ fontSize: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-8 font-mono text-xs">{options.fontSize}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.watermark.opacity')}
          <input
            type="range"
            min={5}
            max={100}
            value={Math.round(options.opacity * 100)}
            onChange={(e) => patch({ opacity: clampOpacity(Number(e.target.value) / 100) })}
            className="min-w-0 flex-1"
          />
          <span className="w-10 font-mono text-xs">{Math.round(options.opacity * 100)}%</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.watermark.rotate')}
          <input
            type="range"
            min={-90}
            max={90}
            value={options.rotate}
            onChange={(e) => patch({ rotate: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-10 font-mono text-xs">{options.rotate}°</span>
        </label>
      </div>

      {options.position === 'tile' && (
        <label className="flex max-w-md items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.watermark.gap')}
          <input
            type="range"
            min={60}
            max={320}
            value={options.gap}
            onChange={(e) => patch({ gap: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-10 font-mono text-xs">{options.gap}</span>
        </label>
      )}

      <FileDropZone accept="image/*" onFile={handleFile} hint={t('tools.watermark.dropHint')} />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.watermark.err.${error}`)}
        </p>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {(sourceUrl || outputUrl) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {sourceUrl && (
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('tools.watermark.original')}
              </p>
              <img src={sourceUrl} alt="" className="max-h-80 rounded-md border border-gray-200 dark:border-gray-700" />
            </div>
          )}
          {outputUrl && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('tools.watermark.result')}
                </p>
                <button
                  type="button"
                  onClick={download}
                  className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {t('tools.watermark.download')}
                </button>
              </div>
              <img src={outputUrl} alt="" className="max-h-80 rounded-md border border-gray-200 dark:border-gray-700" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
