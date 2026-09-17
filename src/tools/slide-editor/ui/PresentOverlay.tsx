import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { renderThumbnail } from '../render/thumbnail';
import { useSlideStore } from '../store';

/** 放映模式：等比铺满窗口，方向键 / 点击翻页，Esc 退出 */
export function PresentOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const selectSlide = useSlideStore((s) => s.selectSlide);
  const [cursor, setCursor] = useState(slideIndex);

  useEffect(() => {
    setCursor(slideIndex);
  }, [slideIndex]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        setCursor((current) => Math.min(doc.slides.length - 1, current + 1));
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        setCursor((current) => Math.max(0, current - 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [doc.slides.length, onClose]);

  useEffect(() => {
    selectSlide(cursor);
  }, [cursor, selectSlide]);

  const source = useMemo(() => {
    const slide = doc.slides[cursor];
    return slide ? renderThumbnail(doc, slide, 1600) : undefined;
  }, [doc, cursor]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b1220]">
      <header className="flex items-center justify-between px-4 py-3 text-sm text-gray-300">
        <span className="tabular-nums">
          {cursor + 1} / {doc.slides.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-600 px-2.5 py-1 text-[12px] transition-colors hover:bg-gray-800"
        >
          <Icon name="close" className="h-4 w-4" />
          {t('tools.slide.exitPresent')}
        </button>
      </header>
      <div
        className="flex flex-1 items-center justify-center px-6 pb-6"
        onClick={() => setCursor((current) => Math.min(doc.slides.length - 1, current + 1))}
      >
        {source ? (
          <img
            src={source}
            alt={`slide ${cursor + 1}`}
            // bg-white：大图解码完成前也保持「白底幻灯片」观感，避免闪一下深色
            className="slide-present-enter max-h-full max-w-full rounded-lg bg-white shadow-2xl"
          />
        ) : null}
      </div>
      <footer className="flex items-center justify-center gap-3 pb-4 text-[12px] text-gray-400">
        <button
          type="button"
          onClick={() => setCursor((c) => Math.max(0, c - 1))}
          className="rounded-md border border-gray-600 px-2 py-1 transition-colors hover:bg-gray-800"
        >
          {t('tools.slide.prevSlide')}
        </button>
        <button
          type="button"
          onClick={() => setCursor((c) => Math.min(doc.slides.length - 1, c + 1))}
          className="rounded-md border border-gray-600 px-2 py-1 transition-colors hover:bg-gray-800"
        >
          {t('tools.slide.nextSlide')}
        </button>
      </footer>
    </div>
  );
}
