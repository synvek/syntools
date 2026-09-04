import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { FileDropZone } from '@/core/components/FileDropZone';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { ALGORITHMS, hashFile, hashText, type DigestEncoding, type HashAlgorithm } from './core';

type SourceMode = 'text' | 'file';

export default function HashTool() {
  const { t } = useTranslation();
  const init = readSharedState({ t: '', a: 'sha-256', e: 'hex' });
  const [source, setSource] = useState<SourceMode>('text');
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>(
    ALGORITHMS.some((item) => item.value === init.a) ? (init.a as HashAlgorithm) : 'sha-256',
  );
  const [encoding, setEncoding] = useState<DigestEncoding>(init.e === 'base64' ? 'base64' : 'hex');
  const [text, setText] = useState(init.t);
  const [file, setFile] = useState<File | null>(null);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const algorithmLabel = ALGORITHMS.find((a) => a.value === algorithm)?.label ?? '';

  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      setError(null);
      if (source === 'text') {
        if (!text) {
          setOutput('');
          return;
        }
        const r = await hashText(algorithm, text, encoding);
        if (cancelled) return;
        if (r.ok) setOutput(r.value);
        else {
          setOutput('');
          setError(translateToolError('tools.hash', r));
        }
      } else {
        if (!file) {
          setOutput('');
          return;
        }
        setComputing(true);
        const r = await hashFile(algorithm, file, encoding);
        if (cancelled) return;
        setComputing(false);
        if (r.ok) setOutput(r.value);
        else {
          setOutput('');
          setError(translateToolError('tools.hash', r));
        }
      }
    };
    void compute();
    return () => {
      cancelled = true;
    };
  }, [source, algorithm, encoding, text, file, t]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.hash.algorithm')}
          <select
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value as HashAlgorithm)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {ALGORITHMS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.hash.encoding')}
          <select
            value={encoding}
            onChange={(e) => setEncoding(e.target.value as DigestEncoding)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="hex">{t('tools.hash.encodings.hex')}</option>
            <option value="base64">{t('tools.hash.encodings.base64')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.hash.source')}
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value as SourceMode);
              setOutput('');
              setError(null);
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="text">{t('common.text')}</option>
            <option value="file">{t('common.file')}</option>
          </select>
        </label>
        <ShareButton getState={() => ({ t: text, a: algorithm, e: encoding })} />
      </OptionBar>

      {source === 'text' ? (
        <>
          <IOTextArea
            label={t('tools.hash.textInput')}
            value={text}
            onChange={setText}
            placeholder={t('tools.hash.textPlaceholder')}
            actions={<ClearButton onClick={() => setText('')} disabled={!text} />}
          />
          <IOTextArea
            label={t('tools.hash.result', { algorithm: algorithmLabel })}
            value={output}
            readOnly
            rows={3}
            actions={<CopyButton text={output} disabled={!output} />}
          />
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <FileDropZone
            onFile={(f) => {
              setFile(f);
              setError(null);
            }}
            hint={t('tools.hash.fileHint')}
          />
          {file && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {file.name}（{t('common.bytes', { size: file.size })}）
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setOutput('');
                }}
                className="ml-2 text-blue-600 hover:underline dark:text-blue-400"
              >
                {t('common.remove')}
              </button>
            </p>
          )}
          <IOTextArea
            label={t('tools.hash.result', { algorithm: algorithmLabel })}
            value={computing ? t('tools.hash.computing') : output}
            readOnly
            rows={3}
            actions={<CopyButton text={output} disabled={!output} />}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
