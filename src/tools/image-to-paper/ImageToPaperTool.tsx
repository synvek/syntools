import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  MAX_MARGIN_MM,
  MIN_MARGIN_MM,
  PAPER_SIZE_IDS,
  PREVIEW_DPI,
  computeLayout,
  isImageFile,
  mmToPx,
  type FitMode,
  type Orientation,
  type PaperSize,
} from './core';

/** 图片转纸张并导出 PDF */
export default function ImageToPaperTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        p: 'A4',
        o: 'portrait',
        m: 10,
        f: 'contain',
      }),
    [],
  );
  const [paper, setPaper] = useState<PaperSize>(
    PAPER_SIZE_IDS.includes(init.p as PaperSize) ? (init.p as PaperSize) : 'A4',
  );
  const [orientation, setOrientation] = useState<Orientation>(
    init.o === 'landscape' ? 'landscape' : 'portrait',
  );
  const [marginMm, setMarginMm] = useState(Number(init.m) || 10);
  const [fit, setFit] = useState<FitMode>(init.f === 'cover' ? 'cover' : 'contain');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [fileError, setFileError] = useState<'NOT_IMAGE' | null>(null);
  const [exporting, setExporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const layout = useMemo(() => {
    if (!imageSize) return null;
    return computeLayout({
      paper,
      orientation,
      marginMm,
      fit,
      imageWidth: imageSize.w,
      imageHeight: imageSize.h,
    });
  }, [paper, orientation, marginMm, fit, imageSize]);

  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !layout?.ok) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    const L = layout.value;
    const pw = Math.round(mmToPx(L.paperWidthMm, PREVIEW_DPI));
    const ph = Math.round(mmToPx(L.paperHeightMm, PREVIEW_DPI));
    canvas.width = pw;
    canvas.height = ph;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pw, ph);

    const cx = mmToPx(L.contentXMm, PREVIEW_DPI);
    const cy = mmToPx(L.contentYMm, PREVIEW_DPI);
    const cw = mmToPx(L.contentWidthMm, PREVIEW_DPI);
    const ch = mmToPx(L.contentHeightMm, PREVIEW_DPI);
    const dx = mmToPx(L.drawXMm, PREVIEW_DPI);
    const dy = mmToPx(L.drawYMm, PREVIEW_DPI);
    const dw = mmToPx(L.drawWidthMm, PREVIEW_DPI);
    const dh = mmToPx(L.drawHeightMm, PREVIEW_DPI);

    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, cw, ch);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();

    // 边距示意线
    ctx.strokeStyle = '#e5e7eb';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(cx, cy, cw, ch);
    ctx.setLineDash([]);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    }, 'image/png');
  }, [layout, imageUrl]);

  const handleFile = (file: File) => {
    if (!isImageFile(file.type)) {
      setFileError('NOT_IMAGE');
      return;
    }
    setFileError(null);
    const url = URL.createObjectURL(file);
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
  };

  const clearAll = () => {
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    imgRef.current = null;
    setImageSize(null);
    setFileError(null);
  };

  const downloadPng = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `paper-${paper}-${orientation}.png`;
    a.click();
  };

  const exportPdf = async () => {
    if (!layout?.ok || !imgRef.current) return;
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const L = layout.value;
      const doc = new jsPDF({
        orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [L.paperWidthMm, L.paperHeightMm],
      });

      // 用临时 canvas 按纸张比例光栅化（cover 需裁剪）
      const scale = 2;
      const cw = Math.round(mmToPx(L.contentWidthMm, PREVIEW_DPI) * scale);
      const ch = Math.round(mmToPx(L.contentHeightMm, PREVIEW_DPI) * scale);
      const tmp = document.createElement('canvas');
      tmp.width = Math.max(1, cw);
      tmp.height = Math.max(1, ch);
      const ctx = tmp.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tmp.width, tmp.height);

      const dx = mmToPx(L.drawXMm - L.contentXMm, PREVIEW_DPI) * scale;
      const dy = mmToPx(L.drawYMm - L.contentYMm, PREVIEW_DPI) * scale;
      const dw = mmToPx(L.drawWidthMm, PREVIEW_DPI) * scale;
      const dh = mmToPx(L.drawHeightMm, PREVIEW_DPI) * scale;
      ctx.drawImage(imgRef.current, dx, dy, dw, dh);

      const dataUrl = tmp.toDataURL('image/jpeg', 0.92);
      doc.addImage(
        dataUrl,
        'JPEG',
        L.contentXMm,
        L.contentYMm,
        L.contentWidthMm,
        L.contentHeightMm,
      );
      doc.save(`paper-${paper}-${orientation}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageToPaper.paper')}
          <select
            value={paper}
            onChange={(e) => setPaper(e.target.value as PaperSize)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {PAPER_SIZE_IDS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageToPaper.orientation')}
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as Orientation)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="portrait">{t('tools.imageToPaper.portrait')}</option>
            <option value="landscape">{t('tools.imageToPaper.landscape')}</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageToPaper.fit')}
          <select
            value={fit}
            onChange={(e) => setFit(e.target.value as FitMode)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="contain">{t('tools.imageToPaper.contain')}</option>
            <option value="cover">{t('tools.imageToPaper.cover')}</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.imageToPaper.margin')}
          <input
            type="number"
            min={MIN_MARGIN_MM}
            max={MAX_MARGIN_MM}
            value={marginMm}
            onChange={(e) => setMarginMm(Number(e.target.value))}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          mm
        </label>
        <ClearButton onClick={clearAll} disabled={!imageUrl} />
        <ShareButton getState={() => ({ p: paper, o: orientation, m: marginMm, f: fit })} />
      </OptionBar>

      <FileDropZone
        accept="image/*"
        onFile={handleFile}
        hint={t('tools.imageToPaper.uploadHint')}
      />
      {fileError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.imageToPaper.err.${fileError}`)}
        </p>
      )}
      {layout && !layout.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.imageToPaper.err.${layout.error}`)}
        </p>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {previewUrl && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('common.result')}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadPng}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {t('tools.imageToPaper.downloadPng')}
              </button>
              <button
                type="button"
                onClick={exportPdf}
                disabled={exporting}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {exporting ? t('tools.imageToPaper.exporting') : t('tools.imageToPaper.downloadPdf')}
              </button>
            </div>
          </div>
          <img
            src={previewUrl}
            alt=""
            className="max-h-[480px] max-w-full rounded-md border border-gray-200 shadow-sm dark:border-gray-700"
          />
        </div>
      )}
    </div>
  );
}
