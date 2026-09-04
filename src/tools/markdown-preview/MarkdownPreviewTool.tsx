import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { renderMarkdown } from './core';
import { MarkdownEditor } from './MarkdownEditor';

/** Markdown 在线编辑 / 预览：高亮编辑器 + 快捷工具栏 + 消毒预览 */
export default function MarkdownPreviewTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ i: '', g: true, b: false }), []);
  const [input, setInput] = useState(init.i);
  const [gfm, setGfm] = useState(init.g);
  const [breaks, setBreaks] = useState(init.b);

  const result = useMemo(() => renderMarkdown(input, { gfm, breaks }), [input, gfm, breaks]);
  const html = result.ok ? result.value : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={gfm}
            onChange={(e) => setGfm(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.markdown.gfm')}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={breaks}
            onChange={(e) => setBreaks(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.markdown.breaks')}
        </label>
        <ShareButton getState={() => ({ i: input, g: gfm, b: breaks })} />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <MarkdownEditor
          value={input}
          onChange={setInput}
          placeholder={t('tools.markdown.placeholder')}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.markdown.preview')}
          </span>
          {input.trim() && !result.ok ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {t(`tools.markdown.err.${result.error}`)}
            </p>
          ) : (
            <div
              className="markdown-body min-h-[360px] flex-1 overflow-auto rounded-md border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
