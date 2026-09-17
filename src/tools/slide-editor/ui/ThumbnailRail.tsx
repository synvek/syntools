import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { renderThumbnail } from '../render/thumbnail';
import { useSlideStore } from '../store';

/** 左侧页导航：离屏缩略图 + 增删复制排序（拖拽排序用原生 HTML5 DnD） */
export function ThumbnailRail() {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const selectSlide = useSlideStore((s) => s.selectSlide);
  const addSlide = useSlideStore((s) => s.addSlide);
  const duplicateSlide = useSlideStore((s) => s.duplicateSlide);
  const removeSlide = useSlideStore((s) => s.removeSlide);
  const moveSlide = useSlideStore((s) => s.moveSlide);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const thumbs = useMemo(() => doc.slides.map((slide) => renderThumbnail(doc, slide, 200)), [doc]);

  return (
    <aside className="flex w-[132px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-gray-200 p-2 dark:border-gray-700 lg:w-[152px]">
      {doc.slides.map((slide, index) => {
        const active = index === slideIndex;
        return (
          <div
            key={slide.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== index) moveSlide(dragIndex, index);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            className={`slide-thumb group cursor-pointer rounded-lg border bg-white p-1 dark:bg-gray-900 ${
              active ? 'slide-thumb-active' : 'border-gray-200 dark:border-gray-700'
            }`}
            onClick={() => selectSlide(index)}
          >
            <div className="flex items-start gap-1">
              <span className="w-4 shrink-0 pt-0.5 text-center text-[11px] text-gray-400">
                {index + 1}
              </span>
              <div className="relative min-h-[62px] flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                {thumbs[index] ? (
                  <img src={thumbs[index]} alt={`slide ${index + 1}`} className="w-full" />
                ) : (
                  <div className="h-[62px]" />
                )}
              </div>
            </div>
            <div className="mt-1 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <IconButton
                title={t('tools.slide.moveUp')}
                icon="swap"
                onClick={() => moveSlide(index, Math.max(0, index - 1))}
              />
              <IconButton
                title={t('tools.slide.moveDown')}
                icon="swap"
                onClick={() => moveSlide(index, Math.min(doc.slides.length - 1, index + 1))}
              />
              <IconButton
                title={t('tools.slide.duplicate')}
                icon="copy"
                onClick={() => duplicateSlide(index)}
              />
              <IconButton
                title={t('tools.slide.deleteSlide')}
                icon="close"
                disabled={doc.slides.length <= 1}
                onClick={() => removeSlide(index)}
              />
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={addSlide}
        className="flex h-[62px] items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-[12px] text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-gray-700 dark:text-gray-400"
      >
        <Icon name="slides" className="h-4 w-4" />
        {t('tools.slide.addSlide')}
      </button>
    </aside>
  );
}

function IconButton({
  title,
  icon,
  onClick,
  disabled,
}: {
  title: string;
  icon: string;
  onClick: (event: { stopPropagation: () => void }) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick(event);
      }}
      className="inline-flex h-5 w-5 items-center justify-center rounded border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      <Icon name={icon} className="h-3 w-3" />
    </button>
  );
}
