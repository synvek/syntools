import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { FilePreviewList } from '@/core/components/FilePreviewList';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import {
  PDF_MAX_BYTES,
  downloadBytes,
  PdfPasswordField,
  shouldShowPdfPassword,
  pdfToolErrorMessage,
  usePdfPassword,
} from '@/core/pdf';
import { PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import { insertImageIntoPdf } from './core';

const TOOL_ID = 'pdf-insert-image';

export default function PdfInsertImageTool() {
  const { t } = useTranslation();
  const [pdf, setPdf] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [allPages, setAllPages] = useState(true);
  const [selection, setSelection] = useState('1');
  const [x, setX] = useState(48);
  const [y, setY] = useState(48);
  const [width, setWidth] = useState(160);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const pdfPwd = usePdfPassword();

  const clear = () => {
    setPdf(null);
    setImage(null);
    setError(null);
    setErrorCode(null);
    pdfPwd.resetPassword();
  };

  const onPdf = async (f: File) => {
    setPdf(f);
    setError(null);
    setErrorCode(null);
    const probe = await pdfPwd.onPdfSelected(f);
    if (!probe.ok && probe.error !== 'NEED_PASSWORD') {
      setErrorCode(probe.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, probe.error));
    }
  };

  const run = async () => {
    if (!pdf || !image) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    const r = await insertImageIntoPdf(pdf, image, {
      selection,
      allPages,
      x,
      y,
      width,
      password: pdfPwd.password,
    });
    setBusy(false);
    if (!r.ok) {
      pdfPwd.notePdfError(r.error);
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      return;
    }
    downloadBytes(r.value, 'with-image.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-insert-image.hint')}</p>
      <div className="flex flex-col gap-2">
        <PdfField label={t('tools.pdf-insert-image.pdf')}>
          <FileDropZone
            accept=".pdf,application/pdf"
            maxBytes={PDF_MAX_BYTES}
            onFile={(f) => void onPdf(f)}
          />
        </PdfField>
        <FilePreviewList
          files={pdf ? [pdf] : []}
          onRemove={() => {
            setPdf(null);
            setError(null);
            setErrorCode(null);
            pdfPwd.resetPassword();
          }}
        />
        {shouldShowPdfPassword(errorCode, pdfPwd.needsPassword) && (
          <PdfPasswordField value={pdfPwd.password} onChange={pdfPwd.setPassword} error={errorCode} autoFocus />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <PdfField label={t('tools.pdf-insert-image.image')}>
          <FileDropZone
            accept="image/png,image/jpeg"
            maxBytes={PDF_MAX_BYTES}
            onFile={(f) => {
              setImage(f);
              setError(null);
              setErrorCode(null);
            }}
          />
        </PdfField>
        <FilePreviewList files={image ? [image] : []} onRemove={() => setImage(null)} />
      </div>
      <OptionBar>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={allPages} onChange={(e) => setAllPages(e.target.checked)} />
          {t('tools.pdf-insert-image.allPages')}
        </label>
      </OptionBar>
      {!allPages && (
        <PdfField label={t('tools.pdf-insert-image.pages')}>
          <input className={pdfInputClass} value={selection} onChange={(e) => setSelection(e.target.value)} />
        </PdfField>
      )}
      <div className="flex flex-wrap gap-3">
        <PdfField label="X">
          <input
            className={pdfInputClass + ' w-24'}
            type="number"
            value={x}
            onChange={(e) => setX(Number(e.target.value) || 0)}
          />
        </PdfField>
        <PdfField label="Y">
          <input
            className={pdfInputClass + ' w-24'}
            type="number"
            value={y}
            onChange={(e) => setY(Number(e.target.value) || 0)}
          />
        </PdfField>
        <PdfField label={t('tools.pdf-insert-image.width')}>
          <input
            className={pdfInputClass + ' w-24'}
            type="number"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value) || 100)}
          />
        </PdfField>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-insert-image.run')}
          disabled={!pdf || !image || busy || (pdfPwd.needsPassword && !pdfPwd.password)}
          onClick={() => void run()}
        />
        <ClearButton onClick={clear} />
      </div>
    </div>
  );
}
