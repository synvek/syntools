import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { CopyButton } from '@/core/components/CopyButton';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { isImageFile, samplePixel, type PickedColor } from './core';

/** 图片取色器：点击图片像素取色 */
export default function ImageColorPickerTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({}), []);
  void init;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<{ data: Uint8ClampedArray; w: number; h: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedColor | null>(null);
  const [error, setError] = useState<'NOT_IMAGE' | 'LOAD' | null>(null);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!isImageFile(file.type)) {
        setError('NOT_IMAGE');
        return;
      }
      setError(null);
      setPicked(null);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const maxW = 720;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setError('LOAD');
          URL.revokeObjectURL(url);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        dataRef.current = { data: imageData.data, w, h };
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setError('LOAD');
      };
      img.src = url;
    },
    [],
  );

  const onClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const packed = dataRef.current;
    if (!canvas || !packed) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * packed.w;
    const y = ((e.clientY - rect.top) / rect.height) * packed.h;
    const result = samplePixel(packed.data, packed.w, packed.h, x, y);
    if (result.ok) setPicked(result.value);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ShareButton getState={() => ({})} />
      </OptionBar>

      <FileDropZone
        accept="image/*"
        onFile={handleFile}
        hint={t('tools.imageColor.dropHint')}
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.imageColor.err.${error}`)}
        </p>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
          <canvas
            ref={canvasRef}
            onClick={onClick}
            className={`max-w-full ${previewUrl ? 'cursor-crosshair' : 'hidden'}`}
          />
          {!previewUrl && (
            <p className="p-6 text-center text-sm text-gray-400">{t('tools.imageColor.empty')}</p>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-64">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.imageColor.picked')}
          </p>
          <div
            className="h-24 rounded-md border border-gray-300 dark:border-gray-700"
            style={{ backgroundColor: picked?.hex ?? 'transparent' }}
            aria-label={t('tools.imageColor.preview')}
          />
          {picked ? (
            <>
              {(
                [
                  ['hex', picked.hex],
                  ['rgb', picked.rgb],
                ] as const
              ).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
                >
                  <span className="w-10 text-xs text-gray-500">{key.toUpperCase()}</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-sm">{value}</code>
                  <CopyButton text={value} />
                </div>
              ))}
            </>
          ) : (
            <p className="text-sm text-gray-400">{t('tools.imageColor.clickHint')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
