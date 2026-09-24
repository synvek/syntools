import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { allChecksums, CHECKSUM_ALGOS, computeChecksum, type ChecksumAlgo } from './core';

type SourceMode = 'text' | 'file';

export default function ChecksumTool() {
  const { t } = useTranslation();
  const init = readSharedState({ t: '', a: 'crc32' as ChecksumAlgo });
  const [source, setSource] = useState<SourceMode>('text');
  const [algo, setAlgo] = useState<ChecksumAlgo>(
    CHECKSUM_ALGOS.some((item) => item.value === init.a) ? (init.a as ChecksumAlgo) : 'crc32',
  );
  const [text, setText] = useState(init.t);
  const [file, setFile] = useState<File | null>(null);
  const [output, setOutput] = useState('');
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      if (source === 'text') {
        setOutput(computeChecksum(algo, new TextEncoder().encode(text)));
        return;
      }
      if (!file) {
        setOutput('');
        return;
      }
      setComputing(true);
      try {
        const buf = await file.arrayBuffer();
        if (cancelled) return;
        setOutput(computeChecksum(algo, new Uint8Array(buf)));
      } catch {
        setOutput('');
      } finally {
        setComputing(false);
      }
    };
    void compute();
    return () => {
      cancelled = true;
    };
  }, [source, algo, text, file]);

  const all = source === 'text' ? allChecksums(new TextEncoder().encode(text)) : null;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.checksum.algorithm')}
          <select
            value={algo}
            onChange={(e) => setAlgo(e.target.value as ChecksumAlgo)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {CHECKSUM_ALGOS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.checksum.source')}
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value as SourceMode);
              setOutput('');
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="text">{t('common.text')}</option>
            <option value="file">{t('common.file')}</option>
          </select>
        </label>
        <ShareButton getState={() => ({ t: text, a: algo })} />
      </OptionBar>

      {source === 'text' ? (
        <>
          <IOTextArea
            label={t('tools.checksum.textInput')}
            value={text}
            onChange={setText}
            placeholder={t('tools.checksum.textPlaceholder')}
            actions={<ClearButton onClick={() => setText('')} disabled={!text} />}
          />
          {all && (
            <div className="flex flex-col gap-2">
              {CHECKSUM_ALGOS.map((item) => (
                <div key={item.value} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {item.label}
                  </span>
                  <code className="flex-1 truncate rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
                    {all[item.value]}
                  </code>
                  <CopyButton text={all[item.value]} disabled={!all[item.value]} />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <FileDropZone
            onFile={(f) => {
              setFile(f);
              setOutput('');
            }}
            hint={t('tools.checksum.fileHint')}
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
            label={t('tools.checksum.result', {
              algorithm: CHECKSUM_ALGOS.find((a) => a.value === algo)?.label,
            })}
            value={computing ? t('tools.checksum.computing') : output}
            readOnly
            rows={3}
            actions={<CopyButton text={output} disabled={!output} />}
          />
        </div>
      )}
    </div>
  );
}
