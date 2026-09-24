import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { FilePreviewList } from '@/core/components/FilePreviewList';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES, downloadBytes } from '@/core/pdf';
import { PdfField, PdfRunButton, pdfInputClass } from '@/core/pdf/ui';
import { addWatermark, type WatermarkOptions } from './core';

const MODES: WatermarkOptions['mode'][] = ['all', 'first', 'custom'];

export default function PdfWatermarkTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [text, setText] = useState('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(0.2);
  const [rotation, setRotation] = useState(-30);
  const [color, setColor] = useState('#888888');
  const [mode, setMode] = useState<WatermarkOptions['mode']>('all');
  const [pageSelection, setPageSelection] = useState('1-3');
  const [tiled, setTiled] = useState(true);
  const [spacing, setSpacing] = useState(220);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await addWatermark(file, password, {
      text,
      fontSize,
      opacity,
      rotation,
      color,
      mode,
      pageSelection,
      tiled,
      spacing,
    });
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.pdf-watermark.errors.${r.error}`));
      return;
    }
    downloadBytes(r.value.bytes, file.name.replace(/\.pdf$/i, '') + '-watermark.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <FileDropZone
        accept=".pdf,application/pdf"
        maxBytes={PDF_MAX_BYTES}
        onFile={(f) => {
          setFile(f);
          setError(null);
        }}
      />
      <FilePreviewList files={file ? [file] : []} onRemove={() => setFile(null)} />
      <PdfField label={t('tools.pdf-watermark.password')}>
        <input
          className={pdfInputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </PdfField>
      <PdfField label={t('tools.pdf-watermark.text')}>
        <input className={pdfInputClass} value={text} onChange={(e) => setText(e.target.value)} />
      </PdfField>
      <div className="grid gap-3 sm:grid-cols-2">
        <PdfField label={t('tools.pdf-watermark.fontSize')}>
          <input
            type="number"
            className={pdfInputClass}
            value={fontSize}
            min={6}
            max={300}
            onChange={(e) => setFontSize(Number(e.target.value) || 12)}
          />
        </PdfField>
        <PdfField label={t('tools.pdf-watermark.color')}>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-16 rounded border border-gray-300 dark:border-gray-700"
          />
        </PdfField>
        <PdfField label={t('tools.pdf-watermark.opacity')}>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
          />
        </PdfField>
        <PdfField label={t('tools.pdf-watermark.rotation')}>
          <input
            type="number"
            className={pdfInputClass}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value) || 0)}
          />
        </PdfField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <PdfField label={t('tools.pdf-watermark.mode')}>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as WatermarkOptions['mode'])}
            className={pdfInputClass}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {t(`tools.pdf-watermark.modes.${m}`)}
              </option>
            ))}
          </select>
        </PdfField>
        {mode === 'custom' && (
          <PdfField label={t('tools.pdf-watermark.pageSelection')}>
            <input
              className={pdfInputClass}
              value={pageSelection}
              onChange={(e) => setPageSelection(e.target.value)}
              placeholder="1-3,5"
            />
          </PdfField>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={tiled} onChange={(e) => setTiled(e.target.checked)} />
          {t('tools.pdf-watermark.tiled')}
        </label>
        {tiled && (
          <PdfField label={t('tools.pdf-watermark.spacing')}>
            <input
              type="number"
              className={pdfInputClass}
              value={spacing}
              min={40}
              max={2000}
              onChange={(e) => setSpacing(Number(e.target.value) || 200)}
            />
          </PdfField>
        )}
      </div>
      <OptionBar>
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-watermark.run')}
          disabled={!file || busy}
          onClick={() => void run()}
        />
        <ClearButton
          onClick={() => {
            setFile(null);
            setError(null);
          }}
          disabled={!file}
        />
      </OptionBar>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
