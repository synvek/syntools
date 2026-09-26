import { useRef, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorState, type Editor } from '@tiptap/react';
import { Icon } from '@/core/components/Icon';
import type { ViewMode } from './draft';

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

interface ToolbarSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

/** 工具栏内联下拉：与 pdfMode 选择器同风格，紧凑高度 */
function ToolbarSelect({ label, value, onChange, options }: ToolbarSelectProps) {
  return (
    <select
      aria-label={label}
      title={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 max-w-32 rounded-md border border-gray-300 bg-white px-1.5 text-xs text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

interface EditorToolbarProps {
  editor: Editor | null;
  onToggleFind: () => void;
  findOpen: boolean;
  onToggleOutline: () => void;
  outlineOpen: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

/**
 * 富文本工具栏：按「历史 / 段落 / 标记 / 列表 / 插入 / 对齐」分组。
 * 通过 useEditorState 精确订阅激活态，避免整棵树随输入频繁重渲染。
 */
export function EditorToolbar({
  editor,
  onToggleFind,
  findOpen,
  onToggleOutline,
  outlineOpen,
  viewMode,
  onViewModeChange,
}: EditorToolbarProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const state = useEditorState({
    editor,
    selector: (ctx) => {
      const e = ctx.editor;
      if (!e) return null;
      const headingLevel = ([1, 2, 3, 4, 5, 6] as const).find((level) =>
        e.isActive('heading', { level }),
      );
      return {
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        headingLevel,
        paragraph: e.isActive('paragraph'),
        fontSize: String(e.getAttributes('textStyle').fontSize ?? ''),
        fontFamily: String(e.getAttributes('textStyle').fontFamily ?? ''),
        lineHeight: String(e.getAttributes('textStyle').lineHeight ?? ''),
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
        inTable: e.isActive('table'),
        headerRow: e.isActive('tableHeader'),
        canMergeCells: e.can().mergeCells(),
        canSplitCell: e.can().splitCell(),
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
        <ToolbarSelect
          label={t('tools.richText.headingSelect')}
          value={state.headingLevel ? String(state.headingLevel) : 'paragraph'}
          onChange={(value) =>
            value === 'paragraph'
              ? chain().setParagraph().run()
              : chain()
                  .toggleHeading({ level: Number(value) as 1 | 2 | 3 | 4 | 5 | 6 })
                  .run()
          }
          options={[
            { value: 'paragraph', label: t('tools.richText.paragraph') },
            ...([1, 2, 3, 4, 5, 6] as const).map((level) => ({
              value: String(level),
              label: t(`tools.richText.h${level}`),
            })),
          ]}
        />
        <ToolbarSelect
          label={t('tools.richText.fontFamily')}
          value={state.fontFamily}
          onChange={(value) =>
            value ? chain().setFontFamily(value).run() : chain().unsetFontFamily().run()
          }
          options={[
            { value: '', label: t('tools.richText.fontDefault') },
            { value: '"Arial", "Helvetica Neue", sans-serif', label: t('tools.richText.fontSans') },
            { value: 'Georgia, "Times New Roman", serif', label: t('tools.richText.fontSerif') },
            { value: '"Courier New", monospace', label: t('tools.richText.fontMono') },
            { value: 'SimSun, "Songti SC", serif', label: t('tools.richText.fontSong') },
            { value: 'KaiTi, "Kaiti SC", "STKaiti", serif', label: t('tools.richText.fontKai') },
          ]}
        />
        <ToolbarSelect
          label={t('tools.richText.fontSize')}
          value={state.fontSize}
          onChange={(value) =>
            value ? chain().setFontSize(value).run() : chain().unsetFontSize().run()
          }
          options={[
            { value: '', label: t('tools.richText.sizeDefault') },
            ...['12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px'].map((size) => ({
              value: size,
              label: size.replace('px', ''),
            })),
          ]}
        />
        <ToolbarSelect
          label={t('tools.richText.lineHeight')}
          value={state.lineHeight}
          onChange={(value) =>
            value ? chain().setLineHeight(value).run() : chain().unsetLineHeight().run()
          }
          options={[
            { value: '', label: t('tools.richText.spacingDefault') },
            ...['1.15', '1.5', '1.75', '2'].map((value) => ({ value, label: value })),
          ]}
        />
        <ToolButton
          label={t('tools.richText.findReplace')}
          active={findOpen}
          onClick={onToggleFind}
        >
          <Icon name="search" className="h-4 w-4" />
        </ToolButton>
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
          label={t('tools.richText.pageBreak')}
          onClick={() => chain().setPageBreak().run()}
        >
          {/* 与分隔线/对齐按钮同风格的单色线条图标（虚线断页） */}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M2 5.5h12" strokeDasharray="3 2" />
            <path d="M2 10.5h12" strokeDasharray="3 2" />
          </svg>
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

      {state.inTable && (
        <div className="flex items-center gap-1 rounded-md bg-blue-50 px-1 dark:bg-blue-950/40">
          <ToolButton
            label={t('tools.richText.rowAbove')}
            onClick={() => chain().addRowBefore().run()}
          >
            <span className="text-xs leading-none">+&#8593;</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.rowBelow')}
            onClick={() => chain().addRowAfter().run()}
          >
            <span className="text-xs leading-none">+&#8595;</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.columnLeft')}
            onClick={() => chain().addColumnBefore().run()}
          >
            <span className="text-xs leading-none">+&#8592;</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.columnRight')}
            onClick={() => chain().addColumnAfter().run()}
          >
            <span className="text-xs leading-none">+&#8594;</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.deleteRow')}
            onClick={() => chain().deleteRow().run()}
          >
            <span className="text-xs leading-none">&minus;&#8595;</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.deleteColumn')}
            onClick={() => chain().deleteColumn().run()}
          >
            <span className="text-xs leading-none">&minus;&#8594;</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.headerRow')}
            active={state.headerRow}
            onClick={() => chain().toggleHeaderRow().run()}
          >
            <span className="text-xs font-semibold leading-none">TH</span>
          </ToolButton>
          {state.canMergeCells && (
            <ToolButton
              label={t('tools.richText.mergeCells')}
              onClick={() => chain().mergeCells().run()}
            >
              <span className="text-xs leading-none">&#8862;</span>
            </ToolButton>
          )}
          {state.canSplitCell && (
            <ToolButton
              label={t('tools.richText.splitCell')}
              onClick={() => chain().splitCell().run()}
            >
              <span className="text-xs leading-none">&#8863;</span>
            </ToolButton>
          )}
          <ToolButton
            label={t('tools.richText.deleteTable')}
            onClick={() => chain().deleteTable().run()}
          >
            <Icon name="close" className="h-4 w-4" />
          </ToolButton>
        </div>
      )}

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

      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

      <div className="flex items-center gap-1">
        <ToolButton
          label={t('tools.richText.outline')}
          active={outlineOpen}
          onClick={onToggleOutline}
        >
          <Icon name="menu" className="h-4 w-4" />
        </ToolButton>
        <ToolbarSelect
          label={t('tools.richText.viewMode')}
          value={viewMode}
          onChange={(value) => onViewModeChange(value as ViewMode)}
          options={[
            { value: 'flow', label: t('tools.richText.viewFlow') },
            { value: 'paged', label: t('tools.richText.viewPaged') },
          ]}
        />
      </div>
    </div>
  );
}
