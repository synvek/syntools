import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { FilePreviewList } from '@/core/components/FilePreviewList';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES, downloadBytes } from '@/core/pdf';
import { PdfField, PdfRunButton, pdfInputClass } from '@/core/pdf/ui';
import { compressPdf, type CompressLevel } from './core';

const LEVELS: CompressLevel[] = ['objects', 'raster'];

export default function PdfCompressTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [level, setLevel] = useState<CompressLevel>('objects');
  const [quality, setQuality] = useState(0.8);
  const [scale, setScale] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const [lossy, setLossy] = useState(false);
  const [savedBytes, setSavedBytes] = useState(0);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await compressPdf(file, password, { level, quality, scale });
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.pdf-compress.errors.${r.error}`));
      setRatio(null);
      return;
    }
    setRatio(r.value.ratio);
    setLossy(r.value.lossy);
    setSavedBytes(file.size - r.value.bytes.byteLength);
    downloadBytes(r.value.bytes, file.name.replace(/\.pdf$/i, '') + '-compressed.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <FileDropZone
        accept=".pdf,application/pdf"
        maxBytes={PDF_MAX_BYTES}
        onFile={(f) => {
          setFile(f);
          setError(null);
          setRatio(null);
        }}
      />
      <FilePreviewList files={file ? [file] : []} onRemove={() => setFile(null)} />
      <PdfField label={t('tools.pdf-compress.password')}>
        <input
          className={pdfInputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </PdfField>
      <PdfField label={t('tools.pdf-compress.level')}>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as CompressLevel)}
          className={pdfInputClass}
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {t(`tools.pdf-compress.levels.${l}`)}
            </option>
          ))}
        </select>
      </PdfField>
      {level === 'raster' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <PdfField label={t('tools.pdf-compress.quality')}>
            <input
              type="range"
              min={0.3}
              max={0.95}
              step={0.05}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
            />
          </PdfField>
          <PdfField label={t('tools.pdf-compress.scale')}>
            <input
              type="number"
              className={pdfInputClass}
              value={scale}
              min={1}
              max={4}
              onChange={(e) => setScale(Number(e.target.value) || 2)}
            />
          </PdfField>
        </div>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('tools.pdf-compress.rasterHint')}
      </p>
      <OptionBar>
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-compress.run')}
          disabled={!file || busy}
          onClick={() => void run()}
        />
        <ClearButton
          onClick={() => {
            setFile(null);
            setError(null);
            setRatio(null);
          }}
          disabled={!file}
        />
      </OptionBar>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {ratio !== null && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('tools.pdf-compress.result', {
            percent: (ratio * 100).toFixed(1),
            bytes: savedBytes,
            lossy: lossy ? t('tools.pdf-compress.lossy') : t('tools.pdf-compress.lossless'),
          })}
        </p>
      )}
    </div>
  );
}
