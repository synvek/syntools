import { useMemo, useState } from 'react';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton } from '@/core/components/ActionButtons';
import { countText } from './core';

/**
 * Tool UI template - follows the interaction spec in Technical Design §8:
 * - the input area has a Clear action (disabled while empty);
 * - the output area has a Copy action (disabled while empty);
 * - errors render right below the output area (role="alert").
 */
export default function TemplateTool() {
  const [input, setInput] = useState('');

  const result = useMemo(() => countText(input), [input]);
  const output = result.ok
    ? `字符数：${result.value.chars}\n单词数：${result.value.words}\n行数：${result.value.lines}`
    : '';

  return (
    <div className="flex flex-col gap-4">
      {/* Tool options (mode select, toggles, ...) go here, wrapped in <OptionBar> */}

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label="输入"
          value={input}
          onChange={setInput}
          placeholder="输入内容…"
          actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
        />
        <IOTextArea
          label="结果"
          value={output}
          readOnly
          actions={<CopyButton text={output} disabled={!output} />}
        />
      </div>

      {!result.ok && input.trim() && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {result.error}
        </p>
      )}
    </div>
  );
}
