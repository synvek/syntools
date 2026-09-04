import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { Icon } from '@/core/components/Icon';
import { readSharedState } from '@/core/lib/share';
import {
  buildOutputFilename,
  clampQuality,
  compressionRatio,
  computeTargetSize,
  formatBytes,
  formatById,
  IMAGE_FORMATS,
  isImageFile,
  MAX_DIMENSIONS,
  type ImageErrorCode,
  type MaxDimension,
} from './core';

interface OutputState {
  url: string;
  size: number;
  width: number;
  height: number;
}

const isFormat = (v: string): boolean => IMAGE_FORMATS.some((f) => f.id === v);
const isMaxDim = (v: number): v is MaxDimension => MAX_DIMENSIONS.includes(v as MaxDimension);

/** 图片压缩/格式转换（Tasks T42）：canvas 编码流程在 UI 层；文案走 i18n（T29 约定） */
export default function ImageCompressTool() {
  const { t } = useTranslation();
  // 从分享链接 ?s= 还原初始状态（T28）
  const init = useMemo(() => readSharedState({ f: 'image/webp', q: 0.8, m: 0 }), []);
  const [format, setFormat] = useState(isFormat(init.f) ? init.f : 'image/webp');
  const [quality, setQuality] = useState(clampQuality(init.q));
  const [maxDim, setMaxDim] = useState<MaxDimension>(isMaxDim(init.m) ? init.m : 0);

  const [source, setSource] = useState<{ name: string; size: number; url: string } | null>(null);
  const [output, setOutput] = useState<OutputState | null>(null);
  const [error, setError] = useState<ImageErrorCode | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const outputUrlRef = useRef<string | null>(null);

  const lossy = formatById(format)?.lossy ?? false;

  // 组件卸载时释放全部 objectURL
  useEffect(
    () => () => {
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    },
    [],
  );

  const handleFile = useCallback((file: File) => {
    if (!isImageFile(file.type)) {
      setError('NOT_IMAGE');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setSource((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { name: file.name, size: file.size, url };
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('ENCODE');
    };
    img.src = url;
  }, []);

  // 源图或选项变化时重新编码（toBlob 异步，用 active 标记丢弃过期结果）
  useEffect(() => {
    const img = imgRef.current;
    if (!source || !img) return;
    let active = true;
    const { width, height } = computeTargetSize(img.naturalWidth, img.naturalHeight, maxDim);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('ENCODE');
      return;
    }
    if (format === 'image/jpeg') {
      // JPEG 无透明通道：先铺白底
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!active) return;
        if (!blob) {
          setError('ENCODE');
          return;
        }
        const url = URL.createObjectURL(blob);
        if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
        outputUrlRef.current = url;
        setOutput({ url, size: blob.size, width, height });
        setError(null);
      },
      format,
      lossy ? quality : undefined,
    );
    return () => {
      active = false;
    };
  }, [source, format, quality, maxDim, lossy]);

  const ratio = source && output ? compressionRatio(source.size, output.size) : null;
  const filename = source ? buildOutputFilename(source.name, format) : 'image.png';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.image.format')}
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {IMAGE_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className={`flex items-center gap-2 text-sm ${lossy ? '' : 'opacity-50'}`}>
          {t('tools.image.quality')}
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={quality}
            disabled={!lossy}
            onChange={(e) => setQuality(clampQuality(Number(e.target.value)))}
            className="w-32 accent-blue-600"
          />
          <span className="w-10 font-mono text-xs text-gray-500 dark:text-gray-400">
            {Math.round(quality * 100)}%
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.image.maxDim')}
          <select
            value={maxDim}
            onChange={(e) => setMaxDim(Number(e.target.value) as MaxDimension)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {MAX_DIMENSIONS.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? t('tools.image.original') : `${m}px`}
              </option>
            ))}
          </select>
        </label>
        <ShareButton getState={() => ({ f: format, q: quality, m: maxDim })} />
      </OptionBar>

      <FileDropZone onFile={handleFile} accept="image/*" hint={t('tools.image.dropHint')} />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.image.err.${error}`)}
        </p>
      )}

      {source && output && (
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* 原图 */}
          <figure className="flex min-w-0 flex-1 flex-col gap-1">
            <figcaption className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('tools.image.before')} · {formatBytes(source.size)}
            </figcaption>
            <img
              src={source.url}
              alt={t('tools.image.before')}
              className="max-h-72 rounded-lg border border-gray-200 object-contain dark:border-gray-700"
            />
          </figure>
          {/* 输出 */}
          <figure className="flex min-w-0 flex-1 flex-col gap-1">
            <figcaption className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('tools.image.after')} · {formatBytes(output.size)} · {output.width}×{output.height}
            </figcaption>
            <img
              src={output.url}
              alt={t('tools.image.after')}
              className="max-h-72 rounded-lg border border-gray-200 object-contain dark:border-gray-700"
            />
          </figure>
        </div>
      )}

      {source && output && (
        <div className="flex items-center gap-3">
          <a
            href={output.url}
            download={filename}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            <Icon name="download" className="h-4 w-4" />
            {t('common.download')} {formatById(format)?.label}
          </a>
          {ratio !== null && (
            <span
              className={`text-sm font-medium ${
                ratio >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-orange-600 dark:text-orange-400'
              }`}
            >
              {ratio >= 0
                ? t('tools.image.saved', { ratio })
                : t('tools.image.increased', { ratio: -ratio })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
