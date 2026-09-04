import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { FilePreviewList } from '@/core/components/FilePreviewList';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { PdfNextSteps } from '@/core/components/PdfNextSteps';
import {
  PDF_MAX_BYTES,
  downloadDataUrl,
  PdfPasswordField,
  shouldShowPdfPassword,
  pdfToolErrorMessage,
  usePdfPassword,
} from '@/core/pdf';
import { PdfProgress, PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import { pdfPagesToImages, type ImageFormat } from './core';

const TOOL_ID = 'pdf-to-image';

export default function PdfToImageTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImageFormat>('image/png');
  const [scale, setScale] = useState(1.5);
  const [selection, setSelection] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const pdfPwd = usePdfPassword();

  const clear = () => {
    setFile(null);
    setPreviews([]);
    setError(null);
    setErrorCode(null);
    setDone(false);
    setProgress(null);
    pdfPwd.resetPassword();
  };

  const onFile = async (f: File) => {
    setFile(f);
    setPreviews([]);
    setError(null);
    setErrorCode(null);
    setDone(false);
    const probe = await pdfPwd.onPdfSelected(f);
    if (!probe.ok && probe.error !== 'NEED_PASSWORD') {
      setErrorCode(probe.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, probe.error));
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setDone(false);
    setError(null);
    setErrorCode(null);
    setProgress({ current: 0, total: 1 });
    const r = await pdfPagesToImages(
      file,
      {
        format,
        scale,
        selection: selection || undefined,
        password: pdfPwd.password,
      },
      (current, total) => setProgress({ current, total }),
    );
    setBusy(false);
    setProgress(null);
    if (!r.ok) {
      pdfPwd.notePdfError(r.error);
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      return;
    }
    setPreviews(r.value);
    const ext = format === 'image/jpeg' ? 'jpg' : 'png';
    r.value.forEach((url, i) => downloadDataUrl(url, `page-${i + 1}.${ext}`));
    setDone(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-to-image.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => void onFile(f)} />
      <FilePreviewList files={file ? [file] : []} onRemove={clear} />
      {shouldShowPdfPassword(errorCode, pdfPwd.needsPassword) && (
        <PdfPasswordField value={pdfPwd.password} onChange={pdfPwd.setPassword} error={errorCode} autoFocus />
      )}
      <OptionBar>
        <label className="flex items-center gap-1 text-sm">
          <input type="radio" checked={format === 'image/png'} onChange={() => setFormat('image/png')} /> PNG
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="radio" checked={format === 'image/jpeg'} onChange={() => setFormat('image/jpeg')} /> JPG
        </label>
        <PdfField label={t('tools.pdf-to-image.scale')}>
          <input
            className={pdfInputClass + ' w-24'}
            type="number"
            min={0.5}
            max={3}
            step={0.25}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value) || 1.5)}
          />
        </PdfField>
      </OptionBar>
      <PdfField label={t('tools.pdf-to-image.pages')}>
        <input
          className={pdfInputClass}
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          placeholder={t('tools.pdf-to-image.pagesAll')}
        />
      </PdfField>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {progress && (
        <PdfProgress
          current={progress.current}
          total={progress.total}
          label={t('tool.progress', { current: progress.current, total: progress.total })}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-to-image.run')}
          disabled={!file || busy || (pdfPwd.needsPassword && !pdfPwd.password)}
          onClick={() => void run()}
        />
        <ClearButton onClick={clear} disabled={!file} />
      </div>
      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {previews.map((url, i) => (
            <img key={i} src={url} alt={`page ${i + 1}`} className="rounded border border-gray-200 dark:border-gray-700" />
          ))}
        </div>
      )}
      {done && <PdfNextSteps toolIds={['images-to-pdf', 'image-compress', 'pdf-grayscale', 'pdf-viewer']} />}
    </div>
  );
}
