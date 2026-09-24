import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { FileDropZone } from '@/core/components/FileDropZone';
import { downloadBlob } from '@/core/lib/download';
import { coverCrop, DEFAULT_DPI, ID_PHOTO_SIZES, targetPixels } from './core';

type OutputFormat = 'image/png' | 'image/jpeg';

export default function IdPhotoTool() {
  const { t } = useTranslation();
  const [presetId, setPresetId] = useState('one-inch');
  const [dpi, setDpi] = useState(DEFAULT_DPI);
  const [background, setBackground] = useState('#ffffff');
  const [format, setFormat] = useState<OutputFormat>('image/jpeg');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const render = () => {
    const img = imageRef.current;
    if (!img) return;
    const target = targetPixels(presetId, dpi);
    if (!target.ok) {
      setError(t(`tools.id-photo.errors.${target.error}`));
      return;
    }
    const { width, height } = target.value;
    const crop = coverCrop(img.naturalWidth, img.naturalHeight, width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
    setOutput(canvas.toDataURL(format, 0.92));
    setError(null);
  };

  useEffect(() => {
    if (ready) render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, presetId, dpi, background, format]);

  const process = (file: File) => {
    setError(null);
    setReady(false);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setReady(true);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setError(t('tools.id-photo.errors.LOAD'));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const download = async () => {
    if (!output) return;
    const res = await fetch(output);
    const blob = await res.blob();
    const ext = format === 'image/png' ? 'png' : 'jpg';
    downloadBlob(blob, `id-photo-${presetId}.${ext}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.id-photo.size')}
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {ID_PHOTO_SIZES.map((p) => (
              <option key={p.id} value={p.id}>
                {t(`tools.id-photo.sizes.${p.id}`, { w: p.mmW, h: p.mmH })}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.id-photo.dpi')}
          <input
            type="number"
            min={72}
            max={600}
            value={dpi}
            onChange={(e) => setDpi(Math.min(600, Math.max(72, Number(e.target.value) || 300)))}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.id-photo.background')}
          <input
            type="color"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
          />
        </label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as OutputFormat)}
          aria-label={t('tools.id-photo.format')}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="image/jpeg">JPEG</option>
          <option value="image/png">PNG</option>
        </select>
      </OptionBar>

      <FileDropZone onFile={process} accept="image/*" hint={t('tools.id-photo.dropHint')} />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {output && (
        <div className="flex flex-col items-start gap-2">
          <img
            src={output}
            alt={t('tools.id-photo.preview')}
            className="rounded-lg border border-gray-200 dark:border-gray-700"
            style={{ maxWidth: 220 }}
          />
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            {t('common.download')}
          </button>
        </div>
      )}
    </div>
  );
}
