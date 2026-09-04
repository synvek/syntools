import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { FilePreviewList } from '@/core/components/FilePreviewList';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import {
  PDF_MAX_BYTES,
  downloadBytes,
  fileToBytes,
  PdfPasswordField,
  shouldShowPdfPassword,
  pdfToolErrorMessage,
  usePdfPassword,
} from '@/core/pdf';
import { PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import { signPdfWithImage, dataUrlToBytes, isImageFile } from './core';

const TOOL_ID = 'pdf-sign';

export default function PdfSignTool() {
  const { t } = useTranslation();
  const [pdf, setPdf] = useState<File | null>(null);
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [allPages, setAllPages] = useState(false);
  const [selection, setSelection] = useState('1');
  const [x, setX] = useState(72);
  const [y, setY] = useState(72);
  const [width, setWidth] = useState(140);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const pdfPwd = usePdfPassword();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = 360;
    c.height = 140;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  const clear = () => {
    setPdf(null);
    setSigFile(null);
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

  const pointer = (e: PointerEvent<HTMLCanvasElement>, type: 'down' | 'move' | 'up') => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const rect = c.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * c.width;
    const py = ((e.clientY - rect.top) / rect.height) * c.height;
    if (type === 'down') {
      drawing.current = true;
      ctx.beginPath();
      ctx.moveTo(px, py);
      c.setPointerCapture(e.pointerId);
    } else if (type === 'move' && drawing.current) {
      ctx.lineTo(px, py);
      ctx.stroke();
    } else if (type === 'up') {
      drawing.current = false;
    }
  };

  const run = async () => {
    if (!pdf) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    let bytes: Uint8Array;
    let mime: string;
    if (sigFile) {
      bytes = await fileToBytes(sigFile);
      mime = sigFile.type || 'image/png';
    } else if (canvasRef.current) {
      const parsed = dataUrlToBytes(canvasRef.current.toDataURL('image/png'));
      if (!parsed) {
        setBusy(false);
        setErrorCode('EMPTY');
        setError(t('tools.pdf-sign.errors.EMPTY'));
        return;
      }
      bytes = parsed.bytes;
      mime = parsed.mime;
    } else {
      setBusy(false);
      setErrorCode('EMPTY');
      setError(t('tools.pdf-sign.errors.EMPTY'));
      return;
    }
    const r = await signPdfWithImage(pdf, bytes, mime, {
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
    downloadBytes(r.value, 'signed.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-sign.hint')}</p>
      <FileDropZone
        accept=".pdf,application/pdf"
        maxBytes={PDF_MAX_BYTES}
        onFile={(f) => void onPdf(f)}
      />
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
      <div className="flex flex-col gap-2">
        <PdfField label={t('tools.pdf-sign.upload')}>
          <FileDropZone
            accept="image/png,image/jpeg"
            maxBytes={PDF_MAX_BYTES}
            onFile={(f) => {
              if (isImageFile(f)) setSigFile(f);
            }}
          />
        </PdfField>
        <FilePreviewList files={sigFile ? [sigFile] : []} onRemove={() => setSigFile(null)} />
      </div>
      <PdfField label={t('tools.pdf-sign.draw')}>
        <canvas
          ref={canvasRef}
          className="w-full max-w-md touch-none rounded border border-gray-300 dark:border-gray-700"
          onPointerDown={(e) => pointer(e, 'down')}
          onPointerMove={(e) => pointer(e, 'move')}
          onPointerUp={(e) => pointer(e, 'up')}
        />
      </PdfField>
      <OptionBar>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={allPages} onChange={(e) => setAllPages(e.target.checked)} />
          {t('tools.pdf-sign.allPages')}
        </label>
      </OptionBar>
      {!allPages && (
        <PdfField label={t('tools.pdf-sign.pages')}>
          <input className={pdfInputClass} value={selection} onChange={(e) => setSelection(e.target.value)} />
        </PdfField>
      )}
      <div className="flex flex-wrap gap-3">
        <PdfField label="X"><input className={pdfInputClass + ' w-24'} type="number" value={x} onChange={(e) => setX(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label="Y"><input className={pdfInputClass + ' w-24'} type="number" value={y} onChange={(e) => setY(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label={t('tools.pdf-sign.width')}><input className={pdfInputClass + ' w-24'} type="number" value={width} onChange={(e) => setWidth(Number(e.target.value) || 100)} /></PdfField>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-sign.run')}
          disabled={!pdf || busy || (pdfPwd.needsPassword && !pdfPwd.password)}
          onClick={() => void run()}
        />
        <ClearButton onClick={clear} />
      </div>
    </div>
  );
}
