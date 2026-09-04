import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { CopyButton } from '@/core/components/CopyButton';
import { FileDropZone } from '@/core/components/FileDropZone';
import { IOTextArea } from '@/core/components/IOTextArea';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { formatBytes, isImageFile, parseBase64Input } from './core';

/** 图片 ↔ Base64 互转 */
export default function ImageBase64Tool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ b: '' }), []);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [dataUrl, setDataUrl] = useState('');
  const [base64Input, setBase64Input] = useState(String(init.b || ''));
  const [fileError, setFileError] = useState<'NOT_IMAGE' | null>(null);

  const parsed = useMemo(() => parseBase64Input(base64Input), [base64Input]);

  useEffect(
    () => () => {
      /* FileReader data URLs 无需 revoke */
    },
    [],
  );

  const handleFile = (file: File) => {
    if (!isImageFile(file.type)) {
      setFileError('NOT_IMAGE');
      return;
    }
    setFileError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setDataUrl(result);
      setFileInfo({ name: file.name, size: file.size });
      setBase64Input(result);
    };
    reader.readAsDataURL(file);
  };

  const downloadFromBase64 = () => {
    if (!parsed.ok) return;
    const a = document.createElement('a');
    a.href = parsed.value.dataUrl;
    const ext = parsed.value.mime.split('/')[1] || 'png';
    a.download = `image.${ext}`;
    a.click();
  };

  const clearAll = () => {
    setDataUrl('');
    setFileInfo(null);
    setBase64Input('');
    setFileError(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ClearButton onClick={clearAll} disabled={!dataUrl && !base64Input} />
        <ShareButton getState={() => ({ b: base64Input.slice(0, 1800) })} />
      </OptionBar>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.imageBase64.upload')}
          </p>
          <FileDropZone
            accept="image/*"
            onFile={handleFile}
            hint={t('tools.imageBase64.uploadHint')}
          />
          {fileError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {t(`tools.imageBase64.err.${fileError}`)}
            </p>
          )}
          {fileInfo && dataUrl && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm text-gray-600 dark:text-gray-300">
                  {fileInfo.name} · {formatBytes(fileInfo.size)}
                </p>
                <CopyButton text={dataUrl} label={t('tools.imageBase64.copyDataUrl')} />
              </div>
              <img
                src={dataUrl}
                alt=""
                className="max-h-48 max-w-full rounded-md border border-gray-200 dark:border-gray-700"
              />
              <IOTextArea
                label={t('tools.imageBase64.base64Out')}
                value={dataUrl}
                rows={6}
                readOnly
                actions={<CopyButton text={dataUrl} />}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <IOTextArea
            label={t('tools.imageBase64.paste')}
            value={base64Input}
            onChange={setBase64Input}
            placeholder={t('tools.imageBase64.pastePlaceholder')}
            rows={10}
            actions={
              <ClearButton onClick={() => setBase64Input('')} disabled={!base64Input} />
            }
          />
          {base64Input.trim() && !parsed.ok && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {t(`tools.imageBase64.err.${parsed.error}`)}
            </p>
          )}
          {parsed.ok && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {parsed.value.mime}
                </p>
                <button
                  type="button"
                  onClick={downloadFromBase64}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {t('common.download')}
                </button>
              </div>
              <img
                src={parsed.value.dataUrl}
                alt=""
                className="max-h-64 max-w-full rounded-md border border-gray-200 dark:border-gray-700"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
