import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { OptionBar } from '@/core/components/ActionButtons';
import { translateToolError } from '@/core/i18n/helpers';
import { stripJpegExif, type ExifInfo } from './core';

export default function ExifStripTool() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<ExifInfo | null>(null);
  const [filename, setFilename] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setInfo(null);
      setBytes(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);

      const buf = new Uint8Array(await file.arrayBuffer());
      const r = stripJpegExif(buf, file.name);
      if (!r.ok) {
        setError(translateToolError('tools.exif-strip', r));
        return;
      }
      setInfo(r.value.info);
      setFilename(r.value.filename);
      setBytes(r.value.bytes);
      const blob = new Blob([r.value.bytes.buffer.slice(
        r.value.bytes.byteOffset,
        r.value.bytes.byteOffset + r.value.bytes.byteLength,
      )], { type: 'image/jpeg' });
      setPreviewUrl(URL.createObjectURL(blob));
    },
    [previewUrl],
  );

  const download = () => {
    if (!bytes || !filename) return;
    const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
      type: 'image/jpeg',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.exif-strip.hint')}</p>
      </OptionBar>

      <FileDropZone onFile={handleFile} accept="image/jpeg,.jpg,.jpeg" hint={t('tools.exif-strip.drop')} />

      {info && (
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
            {t('tools.exif-strip.hasExif')}:{' '}
            {info.hasExif ? t('tools.exif-strip.yes') : t('tools.exif-strip.no')}
          </div>
          <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
            {t('tools.exif-strip.orientation')}: {info.orientation ?? '—'}
          </div>
          <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
            {t('tools.exif-strip.make')}: {info.make ?? '—'}
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="flex flex-col gap-3">
          <img src={previewUrl} alt="" className="max-h-64 w-auto rounded border border-gray-200 dark:border-gray-700" />
          <button
            type="button"
            onClick={download}
            className="w-fit rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t('tools.exif-strip.download')}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
