import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { convertJson, TARGETS, type JsonTarget } from './core';

const isTarget = (v: string): v is JsonTarget => TARGETS.includes(v as JsonTarget);

/** JSON 解析并转换为 YAML / XML / CSV */
export default function JsonConvertTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ i: '', t: 'yaml' }), []);
  const [input, setInput] = useState(init.i);
  const [target, setTarget] = useState<JsonTarget>(isTarget(init.t) ? init.t : 'yaml');

  const result = useMemo(() => (input.trim() ? convertJson(input, target) : null), [input, target]);
  const output = result?.ok ? result.value : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.jsonConvert.target')}
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as JsonTarget)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {TARGETS.map((item) => (
              <option key={item} value={item}>
                {t(`tools.jsonConvert.targets.${item}`)}
              </option>
            ))}
          </select>
        </label>
        <ShareButton getState={() => ({ i: input, t: target })} />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('tools.jsonConvert.input')}
          value={input}
          onChange={setInput}
          placeholder={t('tools.jsonConvert.placeholder')}
          actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
        />
        <IOTextArea
          label={`${t('common.output')}（${t(`tools.jsonConvert.targets.${target}`)}）`}
          value={output}
          readOnly
          actions={<CopyButton text={output} disabled={!output} />}
        />
      </div>

      {result && !result.ok && result.error !== 'EMPTY' && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.jsonConvert.err.${result.error}`)}
        </p>
      )}
    </div>
  );
}
