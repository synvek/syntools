import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import { CodeJar } from 'codejar';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-markdown';
import { useTranslation } from 'react-i18next';
import { ClearButton } from '@/core/components/ActionButtons';
import { MarkdownToolbar, runMarkdownAction, type MarkdownJarLike } from './MarkdownToolbar';
import type { MarkdownAction } from './editor';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function highlightMarkdown(editor: HTMLElement) {
  const code = editor.textContent ?? '';
  editor.innerHTML = Prism.highlight(code, Prism.languages.markdown, 'markdown');
}

/** 带语法高亮与快捷工具栏的 Markdown 编辑器（CodeJar + Prism） */
export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const jarRef = useRef<ReturnType<typeof CodeJar> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const jar = CodeJar(el, highlightMarkdown, {
      tab: '  ',
      addClosing: false,
      spellcheck: false,
      preserveIdent: true,
      catchTab: true,
    });
    jar.updateCode(value, false);
    jar.onUpdate((code) => onChangeRef.current(code));
    jarRef.current = jar;

    return () => {
      jar.destroy();
      jarRef.current = null;
    };
    // 仅挂载一次；外部 value 通过下方 effect 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only init
  }, []);

  // 外部清空 / 分享还原等受控更新
  useEffect(() => {
    const jar = jarRef.current;
    if (!jar) return;
    if (jar.toString() !== value) {
      jar.updateCode(value, false);
    }
  }, [value]);

  const getJar = useCallback((): MarkdownJarLike | null => jarRef.current, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const map: Record<string, MarkdownAction> = {
      b: 'bold',
      i: 'italic',
      k: 'link',
      e: 'code',
    };
    const action = map[e.key.toLowerCase()];
    if (!action) return;
    const jar = jarRef.current;
    if (!jar) return;
    e.preventDefault();
    runMarkdownAction(jar, action);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('tools.markdown.input')}
        </span>
        <ClearButton
          onClick={() => {
            onChange('');
            requestAnimationFrame(() => editorRef.current?.focus());
          }}
          disabled={!value}
        />
      </div>

      <MarkdownToolbar getJar={getJar} />

      <div className="md-editor relative min-h-[320px] flex-1 overflow-auto rounded-md border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900">
        {!value && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 font-mono text-sm text-gray-400">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={t('tools.markdown.input')}
          className="md-editor-surface min-h-[320px] p-3 font-mono text-sm leading-6 text-gray-800 outline-none dark:text-gray-100"
          onKeyDown={onKeyDown}
        />
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.markdown.shortcuts')}</p>
    </div>
  );
}
