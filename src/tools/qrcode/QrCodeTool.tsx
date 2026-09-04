import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { FileDropZone } from '@/core/components/FileDropZone';
import { Icon } from '@/core/components/Icon';
import { readSharedState } from '@/core/lib/share';
import type { ToolResult } from '@/core/types';
import {
  DEFAULT_BG,
  DEFAULT_FG,
  MAX_MARGIN,
  MIN_MARGIN,
  decodeQrFromImage,
  generateQr,
  normalizeQrColor,
  QR_LEVELS,
  QR_SIZES,
  type QrLevel,
  type QrSize,
} from './core';

const isLevel = (v: string): v is QrLevel => QR_LEVELS.includes(v as QrLevel);
const isSize = (v: number): v is QrSize => QR_SIZES.includes(v as QrSize);

/** 二维码生成与解析（Tasks T37）：文案全部走 i18n（T29 约定） */
export default function QrCodeTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        t: '',
        l: 'M',
        s: 256,
        fg: DEFAULT_FG,
        bg: DEFAULT_BG,
        m: 2,
      }),
    [],
  );
  const [text, setText] = useState(init.t);
  const [level, setLevel] = useState<QrLevel>(isLevel(init.l) ? init.l : 'M');
  const [size, setSize] = useState<QrSize>(isSize(init.s) ? init.s : 256);
  const [foreground, setForeground] = useState(
    () => normalizeQrColor(String(init.fg)) ?? DEFAULT_FG,
  );
  const [background, setBackground] = useState(
    () => normalizeQrColor(String(init.bg)) ?? DEFAULT_BG,
  );
  const [margin, setMargin] = useState(() => {
    const m = Number(init.m);
    return Number.isFinite(m) ? Math.min(MAX_MARGIN, Math.max(MIN_MARGIN, Math.round(m))) : 2;
  });

  const [genResult, setGenResult] = useState<ToolResult<string> | null>(null);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!text.trim()) {
        setGenResult(null);
        return;
      }
      void generateQr(text, { level, size, foreground, background, margin }).then((r) => {
        if (active) setGenResult(r);
      });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [text, level, size, foreground, background, margin]);
  const dataUrl = genResult?.ok ? genResult.value : '';
  const genError = genResult && !genResult.ok ? genResult.error : null;

  const [decodeResult, setDecodeResult] = useState<ToolResult<string> | null>(null);
  const handleFile = (file: File) => {
    setDecodeResult(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setDecodeResult(decodeQrFromImage(data, width, height));
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setDecodeResult({ ok: false, error: 'LOAD' });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  const decodedText = decodeResult?.ok ? decodeResult.value : '';
  const decodeError = decodeResult && !decodeResult.ok ? decodeResult.error : null;

  const onColorChange = (kind: 'fg' | 'bg', value: string) => {
    const normalized = normalizeQrColor(value);
    if (kind === 'fg') {
      setForeground(normalized ?? value);
    } else {
      setBackground(normalized ?? value);
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <OptionBar>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.qr.level')}
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as QrLevel)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
            >
              {QR_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`tools.qr.levels.${l}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.qr.size')}
            <select
              value={size}
              onChange={(e) => setSize(Number(e.target.value) as QrSize)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
            >
              {QR_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}×{s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.qr.margin')}
            <input
              type="number"
              min={MIN_MARGIN}
              max={MAX_MARGIN}
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
          <ShareButton
            getState={() => ({
              t: text,
              l: level,
              s: size,
              fg: foreground,
              bg: background,
              m: margin,
            })}
          />
        </OptionBar>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.qr.foreground')}
            <input
              type="color"
              value={normalizeQrColor(foreground) ?? DEFAULT_FG}
              onChange={(e) => onColorChange('fg', e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
            />
            <input
              type="text"
              value={foreground}
              onChange={(e) => onColorChange('fg', e.target.value)}
              spellCheck={false}
              className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.qr.background')}
            <input
              type="color"
              value={normalizeQrColor(background) ?? DEFAULT_BG}
              onChange={(e) => onColorChange('bg', e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
            />
            <input
              type="text"
              value={background}
              onChange={(e) => onColorChange('bg', e.target.value)}
              spellCheck={false}
              className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
        </div>

        <IOTextArea
          label={t('tools.qr.input')}
          value={text}
          onChange={setText}
          placeholder={t('tools.qr.placeholder')}
          actions={<ClearButton onClick={() => setText('')} disabled={!text} />}
        />

        {genError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {t(`tools.qr.err.${genError}`)}
          </p>
        )}

        {dataUrl && (
          <div className="flex flex-col items-start gap-2">
            <img
              src={dataUrl}
              alt={t('tools.qr.preview')}
              width={size}
              height={size}
              className="max-w-full rounded-lg border border-gray-200 dark:border-gray-700"
              style={{
                width: Math.min(size, 320),
                height: Math.min(size, 320),
                backgroundColor: normalizeQrColor(background) ?? DEFAULT_BG,
              }}
            />
            <a
              href={dataUrl}
              download="qrcode.png"
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Icon name="download" className="h-3.5 w-3.5" />
              {t('common.download')} PNG
            </a>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('tools.qr.decodeTitle')}
        </p>
        <FileDropZone onFile={handleFile} accept="image/*" hint={t('tools.qr.decodeHint')} />

        {decodeError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {t(`tools.qr.err.${decodeError}`)}
          </p>
        )}

        <IOTextArea
          label={t('tools.qr.decodeOutput')}
          value={decodedText}
          readOnly
          actions={<CopyButton text={decodedText} disabled={!decodedText} />}
        />
      </div>
    </div>
  );
}
