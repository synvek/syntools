import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { MAX_SIZE, MIN_SIZE, validatePlaceholder } from './core';

/** 在线占位图生成 */
export default function PlaceholderImageTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () => readSharedState({ w: 640, h: 360, bg: '#cccccc', fg: '#666666', txt: '' }),
    [],
  );
  const [width, setWidth] = useState(Number(init.w) || 640);
  const [height, setHeight] = useState(Number(init.h) || 360);
  const [bg, setBg] = useState(String(init.bg || '#cccccc'));
  const [fg, setFg] = useState(String(init.fg || '#666666'));
  const [text, setText] = useState(String(init.txt || ''));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const validated = useMemo(
    () => validatePlaceholder({ width, height, bg, fg, text }),
    [width, height, bg, fg, text],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !validated.ok) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const { width: w, height: h, bg: bgN, fg: fgN, text: label } = validated.value;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = bgN;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fgN;
    const fontSize = Math.max(12, Math.min(w, h) / 8);
    ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2, w * 0.9);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    }, 'image/png');
  }, [validated]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const download = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `placeholder-${width}x${height}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.placeholder.width')}
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.placeholder.height')}
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <ShareButton
          getState={() => ({ w: width, h: height, bg, fg, txt: text })}
        />
      </OptionBar>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.placeholder.bg')}
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/i.test(bg) ? bg : '#cccccc'}
            onChange={(e) => setBg(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
          />
          <input
            type="text"
            value={bg}
            onChange={(e) => setBg(e.target.value)}
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.placeholder.fg')}
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/i.test(fg) ? fg : '#666666'}
            onChange={(e) => setFg(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
          />
          <input
            type="text"
            value={fg}
            onChange={(e) => setFg(e.target.value)}
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.placeholder.text')}
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('tools.placeholder.textPlaceholder')}
            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
      </div>

      {!validated.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.placeholder.err.${validated.error}`)}
        </p>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {previewUrl && (
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
              {t('tools.placeholder.download')}
            </button>
          </div>
          <img
            src={previewUrl}
            alt=""
            className="max-h-96 max-w-full rounded-md border border-gray-200 dark:border-gray-700"
          />
        </div>
      )}
    </div>
  );
}
