import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  MAX_SCALE,
  MIN_SCALE,
  computeOutputSize,
  svgToDataUrl,
  validateSvg,
} from './core';

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120">
  <rect width="200" height="120" fill="#e8f0fe"/>
  <circle cx="100" cy="60" r="36" fill="#3b82f6"/>
  <text x="100" y="66" text-anchor="middle" fill="white" font-size="18" font-family="sans-serif">SVG</text>
</svg>`;

/** 在线 SVG 转 PNG */
export default function SvgToPngTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ i: SAMPLE, sc: 2, bg: 0 }), []);
  const [input, setInput] = useState(String(init.i || SAMPLE));
  const [scale, setScale] = useState(Number(init.sc) || 2);
  const [transparent, setTransparent] = useState(Number(init.bg) === 0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<'INVALID_SVG' | 'INVALID_SIZE' | 'ENCODE' | 'EMPTY' | null>(
    null,
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const validated = useMemo(() => validateSvg(input), [input]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const run = async () => {
      if (!validated.ok) {
        if (validated.error === 'EMPTY') setError(null);
        else setError('INVALID_SVG');
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        return;
      }
      const out = computeOutputSize(validated.value.width, validated.value.height, scale);
      if (!out.ok) {
        setError('INVALID_SIZE');
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = out.value.width;
      canvas.height = out.value.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('ENCODE');
        return;
      }

      if (!transparent) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      const img = new Image();
      const dataUrl = svgToDataUrl(validated.value.svg);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('load'));
        img.src = dataUrl;
      }).catch(() => {
        if (!cancelled) setError('ENCODE');
      });
      if (cancelled) return;

      try {
        ctx.drawImage(img, 0, 0, out.value.width, out.value.height);
      } catch {
        setError('ENCODE');
        return;
      }

      canvas.toBlob((blob) => {
        if (cancelled || !blob) {
          if (!cancelled) setError('ENCODE');
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
        setError(null);
      }, 'image/png');
    };

    void run();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [validated, scale, transparent]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const handleFile = async (file: File) => {
    if (!file.type.includes('svg') && !file.name.toLowerCase().endsWith('.svg')) {
      setError('INVALID_SVG');
      return;
    }
    const text = await file.text();
    setInput(text);
  };

  const download = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `svg-${Date.now()}.png`;
    a.click();
  };

  const sizeHint =
    validated.ok
      ? (() => {
          const out = computeOutputSize(validated.value.width, validated.value.height, scale);
          return out.ok
            ? t('tools.svgPng.sizeHint', {
                sw: validated.value.width,
                sh: validated.value.height,
                pw: out.value.width,
                ph: out.value.height,
              })
            : '';
        })()
      : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.svgPng.scale')}
          <input
            type="number"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.25}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={transparent}
            onChange={(e) => setTransparent(e.target.checked)}
          />
          {t('tools.svgPng.transparent')}
        </label>
        <ShareButton
          getState={() => ({ i: input, sc: scale, bg: transparent ? 0 : 1 })}
        />
      </OptionBar>

      <FileDropZone
        accept=".svg,image/svg+xml"
        onFile={(f) => void handleFile(f)}
        hint={t('tools.svgPng.dropHint')}
      />

      <IOTextArea
        label={t('tools.svgPng.input')}
        value={input}
        onChange={setInput}
        placeholder={t('tools.svgPng.placeholder')}
        actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
      />

      {sizeHint && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{sizeHint}</p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.svgPng.err.${error}`)}
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
              {t('tools.svgPng.download')}
            </button>
          </div>
          <img
            src={previewUrl}
            alt=""
            className="max-h-96 max-w-full rounded-md border border-gray-200 bg-[length:16px_16px] bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee)] bg-[position:0_0,8px_8px] dark:border-gray-700"
          />
        </div>
      )}
    </div>
  );
}
