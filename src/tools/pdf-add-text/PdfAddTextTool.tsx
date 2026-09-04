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
import { addTextToPdf } from './core';

const TOOL_ID = 'pdf-add-text';

export default function PdfAddTextTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [allPages, setAllPages] = useState(true);
  const [selection, setSelection] = useState('1');
  const [x, setX] = useState(48);
  const [y, setY] = useState(700);
  const [fontSize, setFontSize] = useState(14);
  const [color, setColor] = useState('#111111');
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
    const r = await addTextToPdf(file, {
      text,
      selection,
      allPages,
      x,
      y,
      fontSize,
      color,
      password: pdfPwd.password,
    });
    setBusy(false);
    if (!r.ok) {
      pdfPwd.notePdfError(r.error);
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      return;
    }
    downloadBytes(r.value, 'with-text.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-add-text.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => void onFile(f)} />
      <FilePreviewList files={file ? [file] : []} onRemove={clear} />
      {shouldShowPdfPassword(errorCode, pdfPwd.needsPassword) && (
        <PdfPasswordField value={pdfPwd.password} onChange={pdfPwd.setPassword} error={errorCode} autoFocus />
      )}
      <PdfField label={t('tools.pdf-add-text.text')}>
        <input className={pdfInputClass} value={text} onChange={(e) => setText(e.target.value)} />
      </PdfField>
      <OptionBar>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={allPages} onChange={(e) => setAllPages(e.target.checked)} />
          {t('tools.pdf-add-text.allPages')}
        </label>
      </OptionBar>
      {!allPages && (
        <PdfField label={t('tools.pdf-add-text.pages')}>
          <input className={pdfInputClass} value={selection} onChange={(e) => setSelection(e.target.value)} />
        </PdfField>
      )}
      <div className="flex flex-wrap gap-3">
        <PdfField label="X"><input className={pdfInputClass + ' w-24'} type="number" value={x} onChange={(e) => setX(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label="Y"><input className={pdfInputClass + ' w-24'} type="number" value={y} onChange={(e) => setY(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label={t('tools.pdf-add-text.fontSize')}><input className={pdfInputClass + ' w-20'} type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value) || 14)} /></PdfField>
        <PdfField label={t('tools.pdf-add-text.color')}><input className={pdfInputClass + ' w-28'} type="color" value={color} onChange={(e) => setColor(e.target.value)} /></PdfField>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-add-text.run')}
          disabled={!file || busy || (pdfPwd.needsPassword && !pdfPwd.password)}
          onClick={() => void run()}
        />
        <ClearButton onClick={clear} disabled={!file} />
      </div>
    </div>
  );
}
