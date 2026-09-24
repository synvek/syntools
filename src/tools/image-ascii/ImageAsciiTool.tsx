import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { DownloadButton, OptionBar } from '@/core/components/ActionButtons';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ASCII_CHARSETS, DEFAULT_ASCII_WIDTH, imageDataToAscii } from './core';

export default function ImageAsciiTool() {
  const { t } = useTranslation();
  const [cols, setCols] = useState(DEFAULT_ASCII_WIDTH);
  const [charsetId, setCharsetId] = useState('standard');
  const [invert, setInvert] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const process = (file: File) => {
    setError(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // 先缩放到目标列数附近，降低采样成本
      const targetW = Math.max(1, Math.min(cols * 4, img.naturalWidth));
      const targetH = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * targetW));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError(t('tools.image-ascii.errors.INVALID'));
        URL.revokeObjectURL(url);
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const { data, width, height } = ctx.getImageData(0, 0, targetW, targetH);
      const charset = ASCII_CHARSETS.find((c) => c.id === charsetId)?.chars ?? ' .:-=+*#%@';
      const r = imageDataToAscii(data, width, height, { cols, charset, invert });
      if (r.ok) setOutput(r.value);
      else {
        setOutput('');
        setError(t(`tools.image-ascii.errors.${r.error}`));
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setError(t('tools.image-ascii.errors.LOAD'));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.image-ascii.charset')}
          <select
            value={charsetId}
            onChange={(e) => setCharsetId(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {ASCII_CHARSETS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.image-ascii.width')}
          <input
            type="number"
            min={10}
            max={300}
            value={cols}
            onChange={(e) => setCols(Math.min(300, Math.max(10, Number(e.target.value) || 80)))}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={invert}
            onChange={(e) => setInvert(e.target.checked)}
            className="rounded border-gray-300"
          />
          {t('tools.image-ascii.invert')}
        </label>
      </OptionBar>

      <FileDropZone onFile={process} accept="image/*" hint={t('tools.image-ascii.dropHint')} />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <IOTextArea
        label={t('tools.image-ascii.output')}
        value={output}
        readOnly
        rows={18}
        actions={
          <>
            <CopyButton text={output} disabled={!output} />
            <DownloadButton content={output} filename="ascii-art.txt" />
          </>
        }
      />
    </div>
  );
}
