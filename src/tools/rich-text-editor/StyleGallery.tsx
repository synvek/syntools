import { useTranslation } from 'react-i18next';
import { useEditorState, type Editor } from '@tiptap/react';
import { Z_FLYOUT } from '@/core/components/ribbon/ribbonTheme';
import { useMenuNavigation } from '@/core/hooks/useMenuNavigation';
import {
  applyNamedStyle,
  currentStyleId,
  nextCustomStyleId,
  removeStyle,
  resetStyle,
  upsertStyle,
  type NamedStyle,
  type StyleFont,
} from './namedStyles';

interface StyleGalleryProps {
  open: boolean;
  editor: Editor;
  /** The document's style set (persisted with the draft) */
  styles: NamedStyle[];
  onChangeStyles: (styles: NamedStyle[]) => void;
  onClose: () => void;
}

/**
 * Word's style gallery + "modify style" pane, hung under 开始 → 样式.
 *
 * The top grid applies a style (one click, like Word's gallery); the part below edits the style the
 * caret currently sits in, which is how Word's 修改样式 works — no separate "select a style to edit"
 * step, and the effect is visible on every paragraph that uses it.
 */
export function StyleGallery({ open, editor, styles, onChangeStyles, onClose }: StyleGalleryProps) {
  const { t } = useTranslation();
  const { rootRef, onKeyDown } = useMenuNavigation(open, onClose);
  // Follow the caret: the pane always edits the style of the block the user is writing in (P1-1)
  const activeId = useEditorState({
    editor,
    selector: ({ editor: current }) => currentStyleId(current),
  });
  if (!open) return null;

  const active = styles.find((style) => style.id === activeId) ?? (styles[0] as NamedStyle);
  const activeName = active.name ?? (active.label ? t(active.label) : active.id);

  const update = (patch: Partial<NamedStyle>) =>
    onChangeStyles(upsertStyle(styles, { ...active, ...patch }));
  const updateFont = (patch: StyleFont) => update({ font: { ...active.font, ...patch } });

  return (
    <div
      ref={rootRef}
      onKeyDown={onKeyDown}
      data-testid="rich-text-style-gallery"
      role="menu"
      aria-label={t('tools.richText.styles')}
      className={`absolute left-0 top-full ${Z_FLYOUT} mt-1 w-[360px] rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900`}
    >
      {/* Three columns: the nine presets (body, 标题 1-6, quote, code) fill the grid exactly */}
      <div className="grid grid-cols-3 gap-1">
        {styles.map((style) => (
          <button
            key={style.id}
            type="button"
            role="menuitem"
            data-style-id={style.id}
            aria-current={style.id === active.id}
            onClick={() => applyNamedStyle(editor, style)}
            className={`truncate rounded border px-2 py-1.5 text-left transition-colors hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 ${
              style.id === active.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            {style.name ?? (style.label ? t(style.label) : style.id)}
          </button>
        ))}
      </div>

      {/* Modify the style of the current block: every paragraph pointing at it updates at once */}
      <div
        data-testid="rich-text-style-editor"
        className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700"
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span
            data-testid="style-editor-title"
            className="truncate text-xs font-medium text-gray-700 dark:text-gray-200"
          >
            {activeName}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="style-new"
              onClick={() => {
                const id = nextCustomStyleId(styles);
                onChangeStyles(
                  upsertStyle(styles, {
                    id,
                    name: `${t('tools.richText.styleNew')}`,
                    basedOn: active.id,
                  }),
                );
              }}
              className="h-6 rounded border border-gray-300 px-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('tools.richText.styleNew')}
            </button>
            <button
              type="button"
              data-testid="style-reset"
              onClick={() => onChangeStyles(resetStyle(styles, active.id))}
              className="h-6 rounded border border-gray-300 px-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('tools.richText.styleReset')}
            </button>
            <button
              type="button"
              data-testid="style-delete"
              disabled={active.builtin === true}
              onClick={() => onChangeStyles(removeStyle(styles, active.id))}
              className="h-6 rounded border border-gray-300 px-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('tools.richText.styleDelete')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <label className="col-span-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-10 shrink-0">{t('tools.richText.styleName')}</span>
            <input
              data-testid="style-name"
              value={activeName}
              onChange={(event) => update({ name: event.target.value || undefined })}
              className="h-6 min-w-0 flex-1 rounded border border-gray-300 px-1 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <label className="col-span-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-10 shrink-0">{t('tools.richText.styleBasedOn')}</span>
            <select
              data-testid="style-based-on"
              value={active.basedOn ?? ''}
              onChange={(event) => update({ basedOn: event.target.value || undefined })}
              className="h-6 min-w-0 flex-1 rounded border border-gray-300 px-1 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">{t('tools.richText.styleNone')}</option>
              {styles
                .filter((style) => style.id !== active.id)
                .map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name ?? (style.label ? t(style.label) : style.id)}
                  </option>
                ))}
            </select>
          </label>
          <label className="col-span-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-10 shrink-0">{t('tools.richText.fontFamily')}</span>
            <input
              data-testid="style-family"
              value={active.font?.family ?? ''}
              onChange={(event) => updateFont({ family: event.target.value || undefined })}
              className="h-6 min-w-0 flex-1 rounded border border-gray-300 px-1 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-10 shrink-0">{t('tools.richText.fontSize')}</span>
            <input
              data-testid="style-size"
              type="number"
              min={4}
              max={96}
              step={0.5}
              value={active.font?.size ?? ''}
              onChange={(event) => updateFont({ size: Number(event.target.value) || undefined })}
              className="h-6 w-14 rounded border border-gray-300 px-1 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="style-bold"
              aria-pressed={active.font?.bold === true}
              aria-label={t('tools.richText.bold')}
              onClick={() => updateFont({ bold: !active.font?.bold })}
              className={`h-6 w-6 rounded border text-xs font-bold ${
                active.font?.bold
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'
              }`}
            >
              B
            </button>
            <button
              type="button"
              data-testid="style-italic"
              aria-pressed={active.font?.italic === true}
              aria-label={t('tools.richText.italic')}
              onClick={() => updateFont({ italic: !active.font?.italic })}
              className={`h-6 w-6 rounded border text-xs italic ${
                active.font?.italic
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'
              }`}
            >
              I
            </button>
            <input
              data-testid="style-color"
              type="color"
              aria-label={t('tools.richText.color')}
              value={active.font?.color ?? '#111827'}
              onChange={(event) => updateFont({ color: event.target.value })}
              className="h-6 w-8 rounded border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
