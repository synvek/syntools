import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';

interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}

interface OutlinePanelProps {
  editor: Editor;
}

/** 从文档派生 H1-H6 大纲树，点击跳转定位 */
export function OutlinePanel({ editor }: OutlinePanelProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<HeadingItem[]>([]);

  const refresh = useCallback(() => {
    const headings: HeadingItem[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        headings.push({ level: node.attrs.level as number, text: node.textContent, pos });
      }
    });
    setItems(headings);
  }, [editor]);

  useEffect(() => {
    refresh();
    editor.on('update', refresh);
    return () => {
      editor.off('update', refresh);
    };
  }, [editor, refresh]);

  const jump = (pos: number) => {
    editor
      .chain()
      .focus()
      .setTextSelection(pos + 1)
      .scrollIntoView()
      .run();
  };

  if (items.length === 0) return null;

  return (
    <nav
      data-testid="rich-text-outline"
      aria-label={t('tools.richText.outline')}
      className="max-h-[70vh] w-full overflow-auto rounded-lg border border-gray-200 bg-white p-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
    >
      {items.map((item, index) => (
        <button
          key={`${item.pos}-${index}`}
          type="button"
          onClick={() => jump(item.pos)}
          className="block w-full truncate rounded px-2 py-1 text-left text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
          style={{ paddingLeft: `${(item.level - 1) * 0.9 + 0.5}rem` }}
        >
          <span className="mr-1.5 font-medium text-gray-400 dark:text-gray-500">H{item.level}</span>
          {item.text || t('tools.richText.titlePlaceholder')}
        </button>
      ))}
    </nav>
  );
}
