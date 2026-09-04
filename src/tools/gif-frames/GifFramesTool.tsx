import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { isGifFile, parseGifBuffer, type GifParsed } from './core';

interface FramePreview {
  index: number;
  delay: number;
  url: string;
}

/** 将 GIF 帧合成并导出预览 URL */
function compositeFrames(parsed: GifParsed): FramePreview[] {
  const { width, height, frames } = parsed;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const temp = document.createElement('canvas');
  const tempCtx = temp.getContext('2d');
  if (!tempCtx) return [];

  let prevDisposal = 0;
  let prevDims = { top: 0, left: 0, width, height };
  const out: FramePreview[] = [];

  frames.forEach((frame, index) => {
    if (index > 0) {
      if (prevDisposal === 2) {
        ctx.clearRect(prevDims.left, prevDims.top, prevDims.width, prevDims.height);
      } else if (prevDisposal === 3) {
        // restore-to-previous：简化为清屏（多数 GIF 不依赖）
      }
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    const { dims, patch } = frame;
    temp.width = dims.width;
    temp.height = dims.height;
    const imageData = tempCtx.createImageData(dims.width, dims.height);
    imageData.data.set(patch);
    tempCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(temp, dims.left, dims.top);

    const url = canvas.toDataURL('image/png');
    out.push({ index, delay: frame.delay, url });

    prevDisposal = frame.disposalType;
    prevDims = dims;
  });

  return out;
}

/** GIF 拆帧 */
export default function GifFramesTool() {
  const { t } = useTranslation();
  const [frames, setFrames] = useState<FramePreview[]>([]);
  const [meta, setMeta] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<'NOT_GIF' | 'EMPTY' | 'PARSE' | null>(null);
  const urlsRef = useRef<string[]>([]);

  useEffect(
    () => () => {
      urlsRef.current.forEach((u) => {
        if (u.startsWith('blob:')) URL.revokeObjectURL(u);
      });
    },
    [],
  );

  const handleFile = async (file: File) => {
    if (!isGifFile(file.type, file.name)) {
      setError('NOT_GIF');
      setFrames([]);
      setMeta(null);
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseGifBuffer(buffer);
      if (!parsed.ok) {
        setError(parsed.error === 'EMPTY' ? 'EMPTY' : 'PARSE');
        setFrames([]);
        setMeta(null);
        return;
      }
      const previews = compositeFrames(parsed.value);
      setFrames(previews);
      setMeta({ width: parsed.value.width, height: parsed.value.height });
      setError(null);
    } catch {
      setError('PARSE');
      setFrames([]);
      setMeta(null);
    }
  };

  const downloadFrame = (frame: FramePreview) => {
    const a = document.createElement('a');
    a.href = frame.url;
    a.download = `gif-frame-${String(frame.index + 1).padStart(3, '0')}.png`;
    a.click();
  };

  const downloadAll = () => {
    frames.forEach((f, i) => {
      window.setTimeout(() => downloadFrame(f), i * 120);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <FileDropZone
        accept="image/gif,.gif"
        onFile={(f) => void handleFile(f)}
        hint={t('tools.gifFrames.dropHint')}
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.gifFrames.err.${error}`)}
        </p>
      )}

      {meta && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
          <span>
            {t('tools.gifFrames.meta', {
              w: meta.width,
              h: meta.height,
              n: frames.length,
            })}
          </span>
          {frames.length > 0 && (
            <button
              type="button"
              onClick={downloadAll}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t('tools.gifFrames.downloadAll')}
            </button>
          )}
        </div>
      )}

      {frames.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {frames.map((frame) => (
            <div
              key={frame.index}
              className="rounded-md border border-gray-200 p-2 dark:border-gray-700"
            >
              <img
                src={frame.url}
                alt=""
                className="mx-auto max-h-40 object-contain"
              />
              <div className="mt-2 flex items-center justify-between gap-1 text-xs text-gray-500">
                <span>
                  #{frame.index + 1} · {frame.delay}ms
                </span>
                <button
                  type="button"
                  onClick={() => downloadFrame(frame)}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {t('tools.gifFrames.download')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
