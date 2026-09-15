import { useRef, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorState, type Editor } from '@tiptap/react';
import { Icon } from '@/core/components/Icon';

interface ToolButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** 工具栏按钮：激活态蓝底，尺寸紧凑，带 aria-pressed 与 tooltip */
function ToolButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-1.5 text-xs transition-colors ${
        active
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

/** 对齐按钮里的装饰条（左/中/右/两端对齐） */
function AlignBars({ widths }: { widths: string[] }) {
  return (
    <span className="flex w-4 flex-col items-center gap-[2px]" aria-hidden="true">
      {widths.map((w, index) => (
        <span key={index} className="h-[2px] bg-current" style={{ width: w }} />
      ))}
    </span>
  );
}

interface EditorToolbarProps {
  editor: Editor | null;
}

/**
 * 富文本工具栏：按「历史 / 段落 / 标记 / 列表 / 插入 / 对齐」分组。
 * 通过 useEditorState 精确订阅激活态，避免整棵树随输入频繁重渲染。
 */
export function EditorToolbar({ editor }: EditorToolbarProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const state = useEditorState({
    editor,
    selector: (ctx) => {
      const e = ctx.editor;
      if (!e) return null;
      return {
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        paragraph: e.isActive('paragraph'),
        h1: e.isActive('heading', { level: 1 }),
        h2: e.isActive('heading', { level: 2 }),
        h3: e.isActive('heading', { level: 3 }),
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        code: e.isActive('code'),
        bulletList: e.isActive('bulletList'),
        orderedList: e.isActive('orderedList'),
        taskList: e.isActive('taskList'),
        blockquote: e.isActive('blockquote'),
        codeBlock: e.isActive('codeBlock'),
        link: e.isActive('link'),
        alignLeft: e.isActive('textAlign', { textAlign: 'left' }),
        alignCenter: e.isActive('textAlign', { textAlign: 'center' }),
        alignRight: e.isActive('textAlign', { textAlign: 'right' }),
        alignJustify: e.isActive('textAlign', { textAlign: 'justify' }),
      };
    },
  });

  if (!editor || !state) return null;

  const pickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? '');
      if (src) editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  };

  const toggleLink = () => {
    if (state.link) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const href = window.prompt(t('tools.richText.linkPrompt'), 'https://');
    if (!href) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  const chain = () => editor.chain().focus();

  return (
    <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white/95 p-1 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
      <div className="flex items-center gap-1">
        <ToolButton
          label={t('tools.richText.undo')}
          disabled={!state.canUndo}
          onClick={() => chain().undo().run()}
        >
          <span className="text-sm leading-none">&#8630;</span>
        </ToolButton>
        <ToolButton
          label={t('tools.richText.redo')}
          disabled={!state.canRedo}
          onClick={() => chain().redo().run()}
        >
          <span className="text-sm leading-none">&#8631;</span>
        </ToolButton>
      </div>

      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

      <div className="flex items-center gap-1">
        <ToolButton
          label={t('tools.richText.paragraph')}
          active={state.paragraph}
          onClick={() => chain().setParagraph().run()}
        >
          P
        </ToolButton>
        {[1, 2, 3].map((level) => (
          <ToolButton
            key={level}
            label={t(`tools.richText.h${level}`)}
            active={state[`h${level}` as 'h1' | 'h2' | 'h3']}
            onClick={() =>
              chain()
                .toggleHeading({ level: level as 1 | 2 | 3 })
                .run()
            }
          >
            H{level}
          </ToolButton>
        ))}
      </div>

      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

      <div className="flex items-center gap-1">
        <ToolButton
          label={t('tools.richText.bold')}
          active={state.bold}
          onClick={() => chain().toggleBold().run()}
        >
          <span className="font-bold">B</span>
        </ToolButton>
        <ToolButton
          label={t('tools.richText.italic')}
          active={state.italic}
          onClick={() => chain().toggleItalic().run()}
        >
          <span className="italic">I</span>
        </ToolButton>
        <ToolButton
          label={t('tools.richText.underline')}
          active={state.underline}
          onClick={() => chain().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </ToolButton>
        <ToolButton
          label={t('tools.richText.strike')}
          active={state.strike}
          onClick={() => chain().toggleStrike().run()}
        >
          <span className="line-through">S</span>
        </ToolButton>
        <ToolButton
          label={t('tools.richText.code')}
          active={state.code}
          onClick={() => chain().toggleCode().run()}
        >
          <span className="font-mono">&lt;/&gt;</span>
        </ToolButton>
        <label className="relative flex h-8 items-center gap-1 px-1 text-xs text-gray-500 dark:text-gray-400">
          <span aria-hidden="true">{t('tools.richText.color')}</span>
          <input
            type="color"
            aria-label={t('tools.richText.color')}
            onChange={(e) => chain().setColor(e.target.value).run()}
            className="h-6 w-8 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-600"
          />
        </label>
        <ToolButton
          label={t('tools.richText.highlight')}
          onClick={() => chain().toggleHighlight({ color: '#FEF08A' }).run()}
        >
          <span className="rounded bg-yellow-200 px-1 text-gray-900 dark:bg-yellow-300">A</span>
        </ToolButton>
      </div>

      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

      <div className="flex items-center gap-1">
        <ToolButton
          label={t('tools.richText.bulletList')}
          active={state.bulletList}
          onClick={() => chain().toggleBulletList().run()}
        >
          <span className="text-base leading-none">&bull;</span>
        </ToolButton>
        <ToolButton
          label={t('tools.richText.orderedList')}
          active={state.orderedList}
          onClick={() => chain().toggleOrderedList().run()}
        >
          <span className="text-xs">1.</span>
        </ToolButton>
        <ToolButton
          label={t('tools.richText.taskList')}
          active={state.taskList}
          onClick={() => chain().toggleTaskList().run()}
        >
          <Icon name="check" className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={t('tools.richText.quote')}
          active={state.blockquote}
          onClick={() => chain().toggleBlockquote().run()}
        >
          <span className="text-base leading-none">&rdquo;</span>
        </ToolButton>
        <ToolButton
          label={t('tools.richText.codeBlock')}
          active={state.codeBlock}
          onClick={() => chain().toggleCodeBlock().run()}
        >
          <span className="font-mono">&#123;&#125;</span>
        </ToolButton>
      </div>

      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

      <div className="flex items-center gap-1">
        <ToolButton label={t('tools.richText.link')} active={state.link} onClick={toggleLink}>
          <Icon name="link" className="h-4 w-4" />
        </ToolButton>
        <ToolButton label={t('tools.richText.image')} onClick={() => fileRef.current?.click()}>
          <Icon name="image" className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={t('tools.richText.divider')}
          onClick={() => chain().setHorizontalRule().run()}
        >
          <span className="text-base leading-none">&mdash;</span>
        </ToolButton>
        <ToolButton
          label={t('tools.richText.table')}
          onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <Icon name="table" className="h-4 w-4" />
        </ToolButton>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
      </div>

      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

      <div className="flex items-center gap-1">
        <ToolButton
          label={t('tools.richText.alignLeft')}
          active={state.alignLeft}
          onClick={() => chain().setTextAlign('left').run()}
        >
          <AlignBars widths={['100%', '60%', '100%']} />
        </ToolButton>
        <ToolButton
          label={t('tools.richText.alignCenter')}
          active={state.alignCenter}
          onClick={() => chain().setTextAlign('center').run()}
        >
          <AlignBars widths={['60%', '100%', '60%']} />
        </ToolButton>
        <ToolButton
          label={t('tools.richText.alignRight')}
          active={state.alignRight}
          onClick={() => chain().setTextAlign('right').run()}
        >
          <AlignBars widths={['100%', '60%', '60%']} />
        </ToolButton>
        <ToolButton
          label={t('tools.richText.alignJustify')}
          active={state.alignJustify}
          onClick={() => chain().setTextAlign('justify').run()}
        >
          <AlignBars widths={['100%', '100%', '100%']} />
        </ToolButton>
      </div>
    </div>
  );
}
