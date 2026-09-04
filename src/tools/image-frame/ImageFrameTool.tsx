import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  DEFAULT_FRAME,
  clampFrameOptions,
  computeFrameLayout,
  hexToRgba,
  isImageFile,
  type FrameOptions,
} from './core';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** 图片边框 / 圆角 / 阴影 */
export default function ImageFrameTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        bw: DEFAULT_FRAME.borderWidth,
        bc: DEFAULT_FRAME.borderColor,
        r: DEFAULT_FRAME.radius,
        sb: DEFAULT_FRAME.shadowBlur,
        sx: DEFAULT_FRAME.shadowOffsetX,
        sy: DEFAULT_FRAME.shadowOffsetY,
        sc: DEFAULT_FRAME.shadowColor,
        so: DEFAULT_FRAME.shadowOpacity,
      }),
    [],
  );
  const [options, setOptions] = useState<FrameOptions>(() =>
    clampFrameOptions({
      borderWidth: Number(init.bw),
      borderColor: String(init.bc),
      radius: Number(init.r),
      shadowBlur: Number(init.sb),
      shadowOffsetX: Number(init.sx),
      shadowOffsetY: Number(init.sy),
      shadowColor: String(init.sc),
      shadowOpacity: Number(init.so),
    }),
  );
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError] = useState<'NOT_IMAGE' | 'ENCODE' | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const patch = (partial: Partial<FrameOptions>) =>
    setOptions((prev) => clampFrameOptions({ ...prev, ...partial }));

  const draw = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const layout = computeFrameLayout(img.naturalWidth, img.naturalHeight, options);
    if (!layout.ok) {
      setError('ENCODE');
      return;
    }
    const L = layout.value;
    canvas.width = L.canvasWidth;
    canvas.height = L.canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('ENCODE');
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const r = Math.min(options.radius, L.contentWidth / 2, L.contentHeight / 2);

    // 阴影底板
    ctx.save();
    ctx.shadowColor = hexToRgba(options.shadowColor, options.shadowOpacity);
    ctx.shadowBlur = options.shadowBlur;
    ctx.shadowOffsetX = options.shadowOffsetX;
    ctx.shadowOffsetY = options.shadowOffsetY;
    ctx.fillStyle = options.borderWidth > 0 ? options.borderColor : '#ffffff';
    roundRect(ctx, L.contentX, L.contentY, L.contentWidth, L.contentHeight, r);
    ctx.fill();
    ctx.restore();

    // 边框填充已由底板完成；再裁切绘制图片
    ctx.save();
    const ir = Math.max(0, r - options.borderWidth);
    roundRect(ctx, L.imageX, L.imageY, L.imageWidth, L.imageHeight, ir);
    ctx.clip();
    ctx.drawImage(img, L.imageX, L.imageY, L.imageWidth, L.imageHeight);
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

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) draw();
  }, [draw, sourceUrl]);

  useEffect(
    () => () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
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

  const download = () => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `framed-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ShareButton
          getState={() => ({
            bw: options.borderWidth,
            bc: options.borderColor,
            r: options.radius,
            sb: options.shadowBlur,
            sx: options.shadowOffsetX,
            sy: options.shadowOffsetY,
            sc: options.shadowColor,
            so: options.shadowOpacity,
          })}
        />
      </OptionBar>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageFrame.borderWidth')}
          <input
            type="range"
            min={0}
            max={80}
            value={options.borderWidth}
            onChange={(e) => patch({ borderWidth: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-8 font-mono text-xs">{options.borderWidth}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageFrame.borderColor')}
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(options.borderColor) ? options.borderColor : '#ffffff'}
            onChange={(e) => patch({ borderColor: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageFrame.radius')}
          <input
            type="range"
            min={0}
            max={200}
            value={options.radius}
            onChange={(e) => patch({ radius: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-8 font-mono text-xs">{options.radius}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageFrame.shadowBlur')}
          <input
            type="range"
            min={0}
            max={120}
            value={options.shadowBlur}
            onChange={(e) => patch({ shadowBlur: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-8 font-mono text-xs">{options.shadowBlur}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageFrame.shadowOffsetY')}
          <input
            type="range"
            min={-80}
            max={80}
            value={options.shadowOffsetY}
            onChange={(e) => patch({ shadowOffsetY: Number(e.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="w-8 font-mono text-xs">{options.shadowOffsetY}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageFrame.shadowOpacity')}
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(options.shadowOpacity * 100)}
            onChange={(e) => patch({ shadowOpacity: Number(e.target.value) / 100 })}
            className="min-w-0 flex-1"
          />
          <span className="w-10 font-mono text-xs">{Math.round(options.shadowOpacity * 100)}%</span>
        </label>
      </div>

      <FileDropZone accept="image/*" onFile={handleFile} hint={t('tools.imageFrame.dropHint')} />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.imageFrame.err.${error}`)}
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
              {t('tools.imageFrame.download')}
            </button>
          </div>
          <div className="rounded-md bg-[length:16px_16px] bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee)] bg-[position:0_0,8px_8px] p-6 dark:bg-gray-900">
            <img src={outputUrl} alt="" className="mx-auto max-h-96 max-w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
