import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';

interface StylePanelProps {
  editor: Editor | null;
  onClose: () => void;
}

type StyleId = 'body' | 'title' | 'heading2' | 'heading3' | 'quote' | 'code';

/** 样式面板：一键套用预设样式（组合命令，不改动文档结构） */
export function StylePanel({ editor, onClose }: StylePanelProps) {
  const { t } = useTranslation();
  if (!editor) return null;

  const apply = (id: StyleId) => {
    const chain = editor.chain().focus();
    switch (id) {
      case 'body':
        chain.setParagraph().unsetAllMarks().run();
        break;
      case 'title':
        chain.setNode('heading', { level: 1 }).run();
        break;
      case 'heading2':
        chain.setNode('heading', { level: 2 }).run();
        break;
      case 'heading3':
        chain.setNode('heading', { level: 3 }).run();
        break;
      case 'quote':
        chain.toggleBlockquote().run();
        break;
      case 'code':
        chain.toggleCodeBlock().run();
        break;
    }
    onClose();
  };

  const styles: { id: StyleId; label: string; className: string }[] = [
    { id: 'body', label: t('tools.richText.styleBody'), className: 'text-sm' },
    { id: 'title', label: t('tools.richText.styleTitle'), className: 'text-lg font-bold' },
    {
      id: 'heading2',
      label: t('tools.richText.styleHeading2'),
      className: 'text-base font-semibold',
    },
    {
      id: 'heading3',
      label: t('tools.richText.styleHeading3'),
      className: 'text-sm font-semibold',
    },
    { id: 'quote', label: t('tools.richText.styleQuote'), className: 'text-sm text-gray-500' },
    { id: 'code', label: t('tools.richText.styleCode'), className: 'font-mono text-xs' },
  ];

  return (
    <div
      data-testid="rich-text-styles"
      className="rounded-lg border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {t('tools.richText.styles')}
        </span>
        <button
          type="button"
          aria-label={t('tools.richText.stylesClose')}
          onClick={onClose}
          className="h-7 rounded-md border border-gray-300 px-2 text-xs dark:border-gray-600"
        >
          {t('tools.richText.stylesClose')}
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {styles.map((style) => (
          <button
            key={style.id}
            type="button"
            onClick={() => apply(style.id)}
            className={`rounded-md border border-gray-300 px-2 py-1 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800 ${style.className}`}
          >
            {style.label}
          </button>
        ))}
      </div>
    </div>
  );
}
