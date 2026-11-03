import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import { STYLE_PRESETS, applyStylePreset } from './stylePresets';

interface StyleGalleryProps {
  open: boolean;
  editor: Editor;
  onClose: () => void;
}

/**
 * Word's style gallery, hung under the 开始 → 样式 button.
 *
 * Word shows the presets right in the ribbon instead of a panel below the page: the choice is
 * visual (each card is painted in its own style), so it belongs next to the document, not under it.
 */
export function StyleGallery({ open, editor, onClose }: StyleGalleryProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      data-testid="rich-text-style-gallery"
      role="menu"
      aria-label={t('tools.richText.styles')}
      className="absolute left-0 top-full z-40 mt-1 w-[360px] rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900"
    >
      {/* Three columns: the nine presets (body, 标题 1-6, quote, code) fill the grid exactly */}
      <div className="grid grid-cols-3 gap-1">
        {STYLE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="menuitem"
            data-style-id={preset.id}
            onClick={() => {
              applyStylePreset(editor, preset.id);
              onClose();
            }}
            className={`truncate rounded border border-gray-300 px-2 py-1.5 text-left transition-colors hover:border-blue-500 hover:bg-blue-50 dark:border-gray-600 dark:hover:bg-blue-950 ${preset.preview}`}
          >
            {t(preset.label)}
          </button>
        ))}
      </div>
    </div>
  );
}
