import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CANVAS_PRESETS } from '../core';
import { createNewDoc } from '../model/factory';
import type { ExportFormat } from '../render/export';
import { Button, Field, NumberInput, Select, Slider } from './controls';
import type { CanvasBackground } from '../model/types';

const OVERLAY_CLASS =
  'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm';
const PANEL_CLASS =
  'w-full max-w-sm rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-900';

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
    <div
      className={OVERLAY_CLASS}
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.photo.dialogNew')}
    >
      <div className={PANEL_CLASS}>
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
      </div>
    </div>
  );
}

/** 导出图片：格式 / 质量 / 是否仅导出选区 */
export function ExportDialog({
  hasSelection,
  onClose,
  onExport,
}: {
  hasSelection: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat, quality: number, selectionOnly: boolean) => void;
}) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(90);
  const [selectionOnly, setSelectionOnly] = useState(hasSelection);

  return (
    <div
      className={OVERLAY_CLASS}
      role="dialog"
      aria-modal="true"
      aria-label={t('tools.photo.exportTitle')}
    >
      <div className={PANEL_CLASS}>
        <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.photo.exportTitle')}
        </h2>
        <div className="flex flex-col gap-3">
          <Field label={t('tools.photo.format')}>
            <Select
              ariaLabel={t('tools.photo.format')}
              value={format}
              options={[
                { id: 'png', label: 'PNG' },
                { id: 'jpeg', label: 'JPEG' },
                { id: 'webp', label: 'WEBP' },
              ]}
              onChange={(value: ExportFormat) => setFormat(value)}
            />
          </Field>
          {format !== 'png' ? (
            <Slider
              label={t('tools.photo.quality')}
              value={quality}
              min={10}
              max={100}
              step={5}
              onChange={setQuality}
            />
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
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>{t('tools.photo.cancel')}</Button>
          <Button onClick={() => onExport(format, quality / 100, selectionOnly)} primary>
            {t('tools.photo.download')}
          </Button>
        </div>
      </div>
    </div>
  );
}
