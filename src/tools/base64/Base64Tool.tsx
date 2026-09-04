import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar, SwapButton } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { OpenInToolButton } from '@/core/components/OpenInToolButton';
import { FileDropZone } from '@/core/components/FileDropZone';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { bytesToBase64, decodeBase64, encodeBase64 } from './core';

type Direction = 'encode' | 'decode';

export default function Base64Tool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '', d: 'encode', u: false });
    const handoff = consumeHandoff('base64');
    return { ...shared, i: handoff ?? shared.i };
  }, []);
  const [input, setInput] = useState(init.i);
  const [direction, setDirection] = useState<Direction>(init.d === 'decode' ? 'decode' : 'encode');
  const [urlSafe, setUrlSafe] = useState(init.u);
  const [fileResult, setFileResult] = useState<string | null>(null);

  const result = useMemo(
    () => (direction === 'encode' ? encodeBase64(input, urlSafe) : decodeBase64(input, urlSafe)),
    [input, direction, urlSafe],
  );
  const output = fileResult ?? (result.ok ? result.value : '');

  const swap = () => {
    if (!result.ok || fileResult) return;
    setInput(result.value);
    setDirection(direction === 'encode' ? 'decode' : 'encode');
  };

  const handleFile = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    setDirection('encode');
    setFileResult(bytesToBase64(bytes, urlSafe));
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('common.operation')}
          <select
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value as Direction);
              setFileResult(null);
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="encode">{t('tools.base64.direction.encode')}</option>
            <option value="decode">{t('tools.base64.direction.decode')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={urlSafe}
            onChange={(e) => setUrlSafe(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          {t('tools.base64.urlSafe')}
        </label>
        <SwapButton onSwap={swap} disabled={!result.ok || !!fileResult} />
        <ShareButton getState={() => ({ i: input, d: direction, u: urlSafe })} />
      </OptionBar>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <IOTextArea
          label={
            direction === 'encode'
              ? t('tools.base64.labels.rawText')
              : t('tools.base64.labels.base64Input')
          }
          value={input}
          onChange={(v) => {
            setInput(v);
            setFileResult(null);
          }}
          placeholder={
            direction === 'encode'
              ? t('tools.base64.placeholders.encode')
              : t('tools.base64.placeholders.decode')
          }
          actions={
            <ClearButton
              onClick={() => {
                setInput('');
                setFileResult(null);
              }}
              disabled={!input && !fileResult}
            />
          }
        />
        <div className="flex min-w-0 flex-col gap-2">
          <IOTextArea
            label={
              direction === 'encode'
                ? t('tools.base64.labels.base64Result')
                : t('tools.base64.labels.decodeResult')
            }
            value={output}
            readOnly
            actions={<CopyButton text={output} disabled={!output} />}
          />
          {output ? (
            <div className="flex flex-wrap gap-1">
              <OpenInToolButton targetId="json-format" text={output} />
              <OpenInToolButton targetId="hex-codec" text={output} />
            </div>
          ) : null}
        </div>
      </div>

      {!result.ok && input && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.base64', result)}
        </p>
      )}

      {fileResult && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('tools.base64.fileNote')}</p>
      )}

      <details className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
        <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-300">
          {t('tools.base64.fileMode')}
        </summary>
        <div className="mt-3">
          <FileDropZone onFile={handleFile} />
        </div>
      </details>
    </div>
  );
}
