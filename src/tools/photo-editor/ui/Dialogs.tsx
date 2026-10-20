import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CANVAS_PRESETS, MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from '../core';
import { createNewDoc } from '../model/factory';
import type { ExportFormat } from '../render/export';
import { Button, Field, NumberInput, Select, Slider } from './controls';
import type { CanvasBackground } from '../model/types';

const OVERLAY_CLASS =
  'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm';
const PANEL_CLASS =
  'w-full max-w-sm rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-900';

/**
 * 对话框壳：Esc / 点遮罩关闭，与 ShortcutHelp 行为一致。
 * 面板自身 stopPropagation，避免点表单控件时误关。
 */
function DialogShell({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={OVERLAY_CLASS}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div className={PANEL_CLASS} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/** 新建画布：预设 / 自定义尺寸 / 背景色 */
export function NewCanvasDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (width: number, height: number, background: CanvasBackground) => void;
}) {
  const { t } = useTranslation();
  const [presetId, setPresetId] = useState(CANVAS_PRESETS[0].id);
  const [width, setWidth] = useState(CANVAS_PRESETS[0].width);
  const [height, setHeight] = useState(CANVAS_PRESETS[0].height);
  const [background, setBackground] = useState<CanvasBackground>('white');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const check = createNewDoc({ width, height, background });
    if (!check.ok) {
      setError(t(`tools.photo.err.${check.error}`, check.params));
      return;
    }
    onCreate(width, height, background);
    onClose();
  };

  return (
    <DialogShell label={t('tools.photo.dialogNew')} onClose={onClose}>
      <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
        {t('tools.photo.dialogNew')}
      </h2>
      <div className="flex flex-col gap-3">
        <Field label={t('tools.photo.preset')}>
          <Select
            ariaLabel={t('tools.photo.preset')}
            value={presetId}
            options={CANVAS_PRESETS.map((item) => ({ id: item.id, label: item.label }))}
            onChange={(id) => {
              setPresetId(id);
              const preset = CANVAS_PRESETS.find((item) => item.id === id);
              if (preset) {
                setWidth(preset.width);
                setHeight(preset.height);
              }
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('tools.photo.widthLabel')}>
            <NumberInput
              ariaLabel={t('tools.photo.widthLabel')}
              value={width}
              min={16}
              max={4096}
              onChange={setWidth}
            />
          </Field>
          <Field label={t('tools.photo.heightLabel')}>
            <NumberInput
              ariaLabel={t('tools.photo.heightLabel')}
              value={height}
              min={16}
              max={4096}
              onChange={setHeight}
            />
          </Field>
        </div>
        <Field label={t('tools.photo.background')}>
          <Select
            ariaLabel={t('tools.photo.background')}
            value={background}
            options={[
              { id: 'white', label: t('tools.photo.bgWhite') },
              { id: 'black', label: t('tools.photo.bgBlack') },
              { id: 'transparent', label: t('tools.photo.bgTransparent') },
            ]}
            onChange={(value: CanvasBackground) => setBackground(value)}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>{t('tools.photo.cancel')}</Button>
        <Button onClick={submit} primary>
          {t('tools.photo.create')}
        </Button>
      </div>
    </DialogShell>
  );
}

/**
 * 画布大小 / 背景：修改现有画布的尺寸与背景色。
 * 只改变画布范围（图层内容不平移也不缩放），与「新建画布」是两条不同的路径。
 */
export function CanvasSizeDialog({
  width,
  height,
  background,
  onClose,
  onApply,
}: {
  width: number;
  height: number;
  background: CanvasBackground;
  onClose: () => void;
  onApply: (width: number, height: number, background: CanvasBackground) => void;
}) {
  const { t } = useTranslation();
  const [w, setW] = useState(width);
  const [h, setH] = useState(height);
  const [bg, setBg] = useState<CanvasBackground>(background);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const inRange = (value: number) => value >= MIN_CANVAS_SIZE && value <= MAX_CANVAS_SIZE;
    if (!inRange(w) || !inRange(h)) {
      setError(t('tools.photo.err.INVALID_SIZE', { min: MIN_CANVAS_SIZE, max: MAX_CANVAS_SIZE }));
      return;
    }
    onApply(Math.round(w), Math.round(h), bg);
    onClose();
  };

  return (
    <DialogShell label={t('tools.photo.canvasSize')} onClose={onClose}>
      <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
        {t('tools.photo.canvasSize')}
      </h2>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('tools.photo.widthLabel')}>
            <NumberInput
              ariaLabel={t('tools.photo.widthLabel')}
              value={w}
              min={MIN_CANVAS_SIZE}
              max={MAX_CANVAS_SIZE}
              onChange={setW}
            />
          </Field>
          <Field label={t('tools.photo.heightLabel')}>
            <NumberInput
              ariaLabel={t('tools.photo.heightLabel')}
              value={h}
              min={MIN_CANVAS_SIZE}
              max={MAX_CANVAS_SIZE}
              onChange={setH}
            />
          </Field>
        </div>
        <Field label={t('tools.photo.background')}>
          <Select
            ariaLabel={t('tools.photo.background')}
            value={bg}
            options={[
              { id: 'white', label: t('tools.photo.bgWhite') },
              { id: 'black', label: t('tools.photo.bgBlack') },
              { id: 'transparent', label: t('tools.photo.bgTransparent') },
            ]}
            onChange={(value: CanvasBackground) => setBg(value)}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>{t('tools.photo.cancel')}</Button>
        <Button onClick={submit} primary>
          {t('tools.photo.create')}
        </Button>
      </div>
    </DialogShell>
  );
}

/** 导出图片：格式 / 质量 / 是否仅导出选区 */
/** 导出对话框回传的参数（含仅 PDF 使用的 dpi） */
export interface ExportSubmit {
  format: ExportFormat;
  /** 0~1 */
  quality: number;
  selectionOnly: boolean;
  dpi: number;
}

/** 格式名是专有名词，直接按原名展示；顺序按「常用 → 专用」排列 */
const EXPORT_FORMATS: { id: ExportFormat; label: string }[] = [
  { id: 'png', label: 'PNG' },
  { id: 'jpeg', label: 'JPEG' },
  { id: 'webp', label: 'WEBP' },
  { id: 'tiff', label: 'TIFF' },
  { id: 'gif', label: 'GIF' },
  { id: 'pdf', label: 'PDF' },
];

/** PDF 页面尺寸换算基准（像素 → 点） */
const PDF_DPI_OPTIONS = [
  { id: '72', label: '72' },
  { id: '150', label: '150' },
  { id: '300', label: '300' },
];

export function ExportDialog({
  hasSelection,
  onClose,
  onExport,
  onExportPsd,
  psdBusy = false,
}: {
  hasSelection: boolean;
  onClose: () => void;
  onExport: (options: ExportSubmit) => void;
  onExportPsd: () => void;
  psdBusy?: boolean;
}) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(90);
  const [dpi, setDpi] = useState(72);
  const [selectionOnly, setSelectionOnly] = useState(hasSelection);

  return (
    <DialogShell label={t('tools.photo.exportTitle')} onClose={onClose}>
      <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
        {t('tools.photo.exportTitle')}
      </h2>
      <div className="flex flex-col gap-3">
        <Field label={t('tools.photo.format')}>
          <Select
            ariaLabel={t('tools.photo.format')}
            value={format}
            options={EXPORT_FORMATS}
            onChange={(value: ExportFormat) => setFormat(value)}
          />
        </Field>
        {format === 'jpeg' || format === 'webp' ? (
          <Slider
            label={t('tools.photo.quality')}
            value={quality}
            min={10}
            max={100}
            step={5}
            onChange={setQuality}
          />
        ) : null}
        {format === 'pdf' ? (
          <Field label={t('tools.photo.exportDpi')}>
            <Select
              ariaLabel={t('tools.photo.exportDpi')}
              value={String(dpi)}
              options={PDF_DPI_OPTIONS}
              onChange={(value: string) => setDpi(Number(value))}
            />
          </Field>
        ) : null}
        {format === 'gif' ? (
          <p className="text-[10px] leading-4 text-gray-400 dark:text-gray-500">
            {t('tools.photo.exportGifHint')}
          </p>
        ) : null}
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={selectionOnly}
            disabled={!hasSelection}
            onChange={(event) => setSelectionOnly(event.target.checked)}
            className="h-3.5 w-3.5 accent-blue-600"
          />
          {t('tools.photo.exportSelectionOnly')}
        </label>
      </div>
      <div className="mt-3 rounded-lg border border-dashed border-gray-300 px-2 py-2 dark:border-gray-700">
        <button
          type="button"
          data-testid="export-psd"
          disabled={psdBusy}
          onClick={onExportPsd}
          className="w-full rounded-md bg-gray-900 px-2 py-1.5 text-xs text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {psdBusy ? t('tools.photo.psdExporting') : t('tools.photo.psdExport')}
        </button>
        <p className="mt-1 text-[10px] leading-4 text-gray-400 dark:text-gray-500">
          {t('tools.photo.psdHint')}
        </p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>{t('tools.photo.cancel')}</Button>
        <Button
          onClick={() => onExport({ format, quality: quality / 100, selectionOnly, dpi })}
          primary
        >
          {t('tools.photo.download')}
        </Button>
      </div>
    </DialogShell>
  );
}
