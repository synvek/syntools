import { useMemo, useState } from 'react';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton } from '@/core/components/ActionButtons';
import { countText } from './core';

/**
 * 工具 UI 模板 —— 遵循技术设计 §8 交互规范：
 * - 输入区带「清空」（无输入时 disabled）；
 * - 输出区带「复制」（无输出时 disabled）；
 * - 错误就近展示于输出区下方（role="alert"）。
 */
export default function TemplateTool() {
  const [input, setInput] = useState('');

  const result = useMemo(() => countText(input), [input]);
  const output = result.ok
    ? `字符数：${result.value.chars}\n单词数：${result.value.words}\n行数：${result.value.lines}`
    : '';

  return (
    <div className="flex flex-col gap-4">
      {/* 如有工具选项（模式下拉、开关等），用 <OptionBar> 包裹放在这里 */}

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
