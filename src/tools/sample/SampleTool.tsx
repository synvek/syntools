import { useMemo, useState } from 'react';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { OptionBar } from '@/core/components/ActionButtons';
import { sampleOps, sampleTransform, type SampleOp } from './core';

export default function SampleTool() {
  const [input, setInput] = useState('');
  const [op, setOp] = useState<SampleOp>('reverse');
  const result = useMemo(() => sampleTransform(input, op), [input, op]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          转换方式
          <select
            value={op}
            onChange={(e) => setOp(e.target.value as SampleOp)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {sampleOps.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </OptionBar>

      <IOTextArea label="输入" value={input} onChange={setInput} placeholder="输入任意文本…" />

      {result.ok ? (
        <IOTextArea
          label="输出"
          value={result.value}
          readOnly
          actions={<CopyButton text={result.value} />}
        />
      ) : (
        <p className="rounded-lg border border-gray-200 p-3 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {result.error}
        </p>
      )}
    </div>
  );
}
