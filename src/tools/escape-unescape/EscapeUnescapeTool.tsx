import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { escapeText, unescapeText, type EscapeKind } from './core';

const KINDS: EscapeKind[] = ['json', 'js', 'html', 'xml', 'url'];

export default function EscapeUnescapeTool() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'escape' | 'unescape'>('escape');
  const [kind, setKind] = useState<EscapeKind>('html');
  const [input, setInput] = useState('');

  const output = useMemo(() => {
    if (!input) return '';
    return mode === 'escape' ? escapeText(input, kind) : unescapeText(input, kind);
  }, [mode, kind, input]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <div className="flex rounded-md border border-gray-300 dark:border-gray-700">
          {(['escape', 'unescape'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-sm ${mode === m ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
            >
              {t(`tools.escape-unescape.modes.${m}`)}
            </button>
          ))}
        </div>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as EscapeKind)}
          aria-label={t('tools.escape-unescape.kind')}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k.toUpperCase()}
            </option>
          ))}
        </select>
        <ClearButton onClick={() => setInput('')} disabled={!input} />
      </OptionBar>
      <IOTextArea
        label={t('tools.escape-unescape.input')}
        value={input}
        onChange={setInput}
        rows={6}
        placeholder={t('tools.escape-unescape.placeholder')}
      />
      <IOTextArea
        label={t('tools.escape-unescape.output')}
        value={output}
        readOnly
        rows={6}
        actions={output ? <CopyButton text={output} /> : undefined}
      />
    </div>
  );
}
