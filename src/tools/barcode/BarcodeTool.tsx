import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { OptionBar } from '@/core/components/ActionButtons';
import { BARCODE_TYPES, generateBarcode, type BarcodeType } from './core';

export default function BarcodeTool() {
  const { t } = useTranslation();
  const [type, setType] = useState<BarcodeType>('code128');
  const [text, setText] = useState('SynTools-2026');
  const [moduleWidth, setModuleWidth] = useState(2);
  const [height, setHeight] = useState(80);

  const result = useMemo(() => {
    if (!text.trim()) return null;
    return generateBarcode(type, text, { moduleWidth, height, quietZone: 12 });
  }, [type, text, moduleWidth, height]);

  const svg = result?.ok ? result.value : '';
  const dataUrl = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '';
  const error = result && !result.ok ? result.error : null;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.barcode.type')}
          <select
            value={type}
            onChange={(e) => setType(e.target.value as BarcodeType)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {BARCODE_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.barcode.moduleWidth')}
          <input
            type="number"
            min={1}
            max={6}
            value={moduleWidth}
            onChange={(e) => setModuleWidth(Math.min(6, Math.max(1, Number(e.target.value) || 1)))}
            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.barcode.height')}
          <input
            type="number"
            min={20}
            max={300}
            value={height}
            onChange={(e) => setHeight(Math.min(300, Math.max(20, Number(e.target.value) || 80)))}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
      </OptionBar>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('tools.barcode.placeholder')}
        aria-label={t('tools.barcode.content')}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.barcode.errors.${error}`)}
        </p>
      )}

      {dataUrl && (
        <div className="flex flex-col items-start gap-2">
          <img
            src={dataUrl}
            alt={t('tools.barcode.preview')}
            className="max-w-full rounded-lg border border-gray-200 bg-white dark:border-gray-700"
          />
          <a
            href={dataUrl}
            download={`barcode-${type}.svg`}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Icon name="download" className="h-3.5 w-3.5" />
            {t('common.download')} SVG
          </a>
        </div>
      )}
    </div>
  );
}
