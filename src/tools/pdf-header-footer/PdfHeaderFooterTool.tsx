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
  type HAlign,
} from '@/core/pdf';
import { PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import { applyHeaderFooter } from './core';

const TOOL_ID = 'pdf-header-footer';
const ALIGNS: HAlign[] = ['left', 'center', 'right'];

export default function PdfHeaderFooterTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [header, setHeader] = useState('');
  const [footer, setFooter] = useState('');
  const [align, setAlign] = useState<HAlign>('center');
  const [fontSize, setFontSize] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const pdfPwd = usePdfPassword();

  const clear = () => {
    setFile(null);
    setError(null);
    setErrorCode(null);
    pdfPwd.resetPassword();
  };

  const onFile = async (f: File) => {
    setFile(f);
    setError(null);
    setErrorCode(null);
    const probe = await pdfPwd.onPdfSelected(f);
    if (!probe.ok && probe.error !== 'NEED_PASSWORD') {
      setErrorCode(probe.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, probe.error));
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    const r = await applyHeaderFooter(file, {
      header,
      footer,
      align,
      fontSize,
      password: pdfPwd.password,
    });
    setBusy(false);
    if (!r.ok) {
      pdfPwd.notePdfError(r.error);
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      return;
    }
    downloadBytes(r.value, 'header-footer.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-header-footer.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => void onFile(f)} />
      <FilePreviewList files={file ? [file] : []} onRemove={clear} />
      {shouldShowPdfPassword(errorCode, pdfPwd.needsPassword) && (
        <PdfPasswordField value={pdfPwd.password} onChange={pdfPwd.setPassword} error={errorCode} autoFocus />
      )}
      <PdfField label={t('tools.pdf-header-footer.header')}>
        <input className={pdfInputClass} value={header} onChange={(e) => setHeader(e.target.value)} />
      </PdfField>
      <PdfField label={t('tools.pdf-header-footer.footer')}>
        <input className={pdfInputClass} value={footer} onChange={(e) => setFooter(e.target.value)} />
      </PdfField>
      <OptionBar>
        {ALIGNS.map((a) => (
          <label key={a} className="flex items-center gap-1 text-sm">
            <input type="radio" checked={align === a} onChange={() => setAlign(a)} />
            {t(`tools.pdf-header-footer.align.${a}`)}
          </label>
        ))}
      </OptionBar>
      <PdfField label={t('tools.pdf-header-footer.fontSize')}>
        <input className={pdfInputClass + ' w-20'} type="number" min={6} max={48} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value) || 10)} />
      </PdfField>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-header-footer.run')}
          disabled={!file || busy || (pdfPwd.needsPassword && !pdfPwd.password)}
          onClick={() => void run()}
        />
        <ClearButton onClick={clear} disabled={!file} />
      </div>
    </div>
  );
}
