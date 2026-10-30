import Konva from 'konva';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { advancePlayback, entranceByElement, FLY_OFFSET } from '../model/animation';
import { backgroundFillProps } from '../render/background';
import { createElementNode } from '../render/nodes';
import { useSlideStore } from '../store';

/**
 * Presentation mode.
 *
 * Rendering: the Konva vector stage is drawn directly at container size (per devicePixelRatio), instead of
 * "render offscreen to a 1600px bitmap and show an img" — the latter blurs text edges when scaled up.
 *
 * Presentation extras: timer, black/white screen, jump to slide, laser pointer, speaker notes panel (with next-slide hint).
 * Annotations exist only during the presentation, are never written back to the document, and are dropped on exit.
 */
export function PresentOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const selectSlide = useSlideStore((s) => s.selectSlide);
  const [cursor, setCursor] = useState(slideIndex);
  const [elapsed, setElapsed] = useState(0);
  const [blank, setBlank] = useState<'none' | 'black' | 'white'>('none');
  const [laser, setLaser] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const laserRef = useRef<Konva.Circle | null>(null);
  /** 本页已经播完的动画组数（每次换页归零） */
  const playedRef = useRef(0);
  /** 元素 id → 节点/原始位置：播放动画时要把节点 tween 回原位 */
  const nodesRef = useRef(new Map<string, Konva.Node>());
  const originsRef = useRef(new Map<string, { x: number; y: number }>());
  const tweensRef = useRef<Konva.Tween[]>([]);

  // Kept in a ref so the fullscreen listeners below never need to re-subscribe.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setCursor(slideIndex);
  }, [slideIndex]);

  // Timer: starts on entering the presentation and is torn down on exit
  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  /* ------------------------------ Fullscreen ------------------------------ */

  // Enter true fullscreen on mount; the overlay itself stays the fallback when the API is
  // unavailable (Tauri WebView, denied gesture) — a failed request must not block presenting.
  const enteredFullscreenRef = useRef(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onChange = () => {
      const active = document.fullscreenElement === el;
      if (active) enteredFullscreenRef.current = true;
      setIsFullscreen(active);
      // Leaving fullscreen (browser-handled Esc) ends the presentation, like PowerPoint.
      // Only react once we actually entered, so a rejected request never closes the overlay.
      if (!active && enteredFullscreenRef.current) onCloseRef.current();
    };

    document.addEventListener('fullscreenchange', onChange);
    const request = el.requestFullscreen?.();
    void request?.catch(() => {
      /* keep the overlay; no error surfaced */
    });

    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement === el) {
        void document.exitFullscreen?.().catch(() => {
          /* already exited */
        });
      }
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      void document.exitFullscreen?.().catch(() => {
        /* already exited */
      });
      return;
    }
    const request = el.requestFullscreen?.();
    void request?.catch(() => {
      /* unsupported: staying in the overlay is fine */
    });
  }, []);

  /* ----------------------------- Vector stage ----------------------------- */

  const draw = useCallback(() => {
    const stage = stageRef.current;
    const layer = layerRef.current;
    const host = hostRef.current;
    if (!stage || !layer || !host) return;
    const slide = doc.slides[cursor];
    if (!slide) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width <= 0 || height <= 0) return;

    // 重画会换掉节点：旧 tween 必须先销毁，否则它会继续改一个已经没人引用的节点
    for (const tween of tweensRef.current) tween.destroy();
    tweensRef.current = [];
    nodesRef.current.clear();
    originsRef.current.clear();

    const scale = Math.min(width / doc.width, height / doc.height);
    layer.destroyChildren();
    layer.scale({ x: scale, y: scale });
    layer.position({ x: (width - doc.width * scale) / 2, y: (height - doc.height * scale) / 2 });

    layer.add(
      new Konva.Rect({
        width: doc.width,
        height: doc.height,
        ...backgroundFillProps(slide.background, doc.width, doc.height),
      }),
    );

    // 还没轮到出场的元素先藏起来：透明；飞入的再挪到起点（单击后 tween 回原位）
    const entrance = entranceByElement(slide.animations ?? []);
    for (const element of slide.elements) {
      if (element.visible === false) continue;
      const node = createElementNode(element, {
        media: doc.media,
        onImageReady: () => layer.batchDraw(),
      });
      node.listening(false);
      const origin = { x: node.x(), y: node.y() };
      originsRef.current.set(element.id, origin);
      nodesRef.current.set(element.id, node);
      const pending = entrance.get(element.id);
      if (pending && pending.group >= playedRef.current) {
        node.opacity(0);
        if (pending.effect === 'flyIn') node.x(origin.x - FLY_OFFSET);
      }
      layer.add(node);
    }

    if (laser) {
      const dot = new Konva.Circle({
        radius: 10 / scale,
        fill: 'rgba(244,63,94,0.55)',
        stroke: '#F43F5E',
        strokeWidth: 2 / scale,
        listening: false,
      });
      laserRef.current = dot;
      layer.add(dot);
    } else {
      laserRef.current = null;
    }
    layer.draw();
  }, [doc, cursor, laser]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const stage = new Konva.Stage({
      container: host,
      width: host.clientWidth || 800,
      height: host.clientHeight || 450,
    });
    const layer = new Konva.Layer();
    stage.add(layer);
    stageRef.current = stage;
    layerRef.current = layer;

    // Laser pointer follows the cursor (stage coordinates)
    stage.on('mousemove', () => {
      const dot = laserRef.current;
      if (!dot) return;
      const point = stage.getPointerPosition();
      if (point) dot.position(point);
      layer.batchDraw();
    });

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            stage.size({ width: host.clientWidth, height: host.clientHeight });
            draw();
          })
        : null;
    observer?.observe(host);

    return () => {
      observer?.disconnect();
      stage.destroy();
      stageRef.current = null;
      layerRef.current = null;
      laserRef.current = null;
    };
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 换页后动画从"一个都没播"开始（声明在 draw 之前，保证先归零再画）
  useEffect(() => {
    playedRef.current = 0;
  }, [cursor]);

  /**
   * 页面切换：draw 之后再把整层淡入/推入。
   * 首次进入放映不播切换（PowerPoint 也不播第一页的"进入"效果）。
   */
  const firstCursorRef = useRef(true);
  useEffect(() => {
    if (firstCursorRef.current) {
      firstCursorRef.current = false;
      return;
    }
    const layer = layerRef.current;
    const transition = doc.slides[cursor]?.transition;
    if (!layer || !transition) return;
    const offset = transition.type === 'push' ? FLY_OFFSET * 2 : 0;
    if (offset > 0) layer.x(layer.x() + offset);
    layer.opacity(0);
    const tween = new Konva.Tween({
      node: layer,
      duration: Math.max(0.1, transition.duration / 1000),
      opacity: 1,
      x: layer.x() - offset,
      easing: Konva.Easings.EaseOut,
    });
    tweensRef.current.push(tween);
    tween.play();
  }, [cursor, doc.slides]);

  useEffect(() => {
    selectSlide(cursor);
  }, [cursor, selectSlide]);

  /* ------------------------------- Interactions ------------------------------- */

  /**
   * 单击/→：先播完本页剩下的动画组，全部播完才翻页。
   * 播放顺序与时长全部来自 `advancePlayback`（纯函数，单测覆盖），这里只负责 tween。
   */
  const next = useCallback(() => {
    const action = advancePlayback(doc.slides[cursor]?.animations ?? [], playedRef.current);
    if (action.kind === 'nextSlide') {
      setCursor((current) => Math.min(doc.slides.length - 1, current + 1));
      return;
    }
    playedRef.current = action.groupIndex + 1;
    for (const { step, start } of action.steps) {
      const node = nodesRef.current.get(step.elementId);
      const origin = originsRef.current.get(step.elementId);
      if (!node || !origin) continue;
      const tween = new Konva.Tween({
        node,
        duration: Math.max(0.05, step.duration / 1000),
        delay: Math.max(0, start / 1000),
        opacity: 1,
        x: origin.x,
        y: origin.y,
        easing: Konva.Easings.EaseOut,
      });
      tweensRef.current.push(tween);
      tween.play();
    }
  }, [cursor, doc.slides]);

  const prev = useCallback(() => setCursor((current) => Math.max(0, current - 1)), []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        next();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        prev();
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'b') setBlank((value) => (value === 'black' ? 'none' : 'black'));
      if (key === 'w') setBlank((value) => (value === 'white' ? 'none' : 'white'));
      if (key === 'l') setLaser((value) => !value);
      if (key === 'n') setShowNotes((value) => !value);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, onClose, prev]);

  const notes = doc.slides[cursor]?.notes?.trim();
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 flex flex-col bg-[#0b1220]">
      <header className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-gray-300">
        <span className="tabular-nums">
          {cursor + 1} / {doc.slides.length}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="tabular-nums text-gray-400" aria-label={t('tools.slide.elapsedTime')}>
            {clock}
          </span>
          <button
            type="button"
            aria-label={t('tools.slide.fullscreen')}
            aria-pressed={isFullscreen}
            onClick={toggleFullscreen}
            className={`rounded-md border px-2 py-1 text-[12px] transition-colors ${
              isFullscreen ? 'border-blue-500 text-blue-300' : 'border-gray-600 hover:bg-gray-800'
            }`}
          >
            ⛶
          </button>
          <button
            type="button"
            aria-label={t('tools.slide.laserPointer')}
            aria-pressed={laser}
            onClick={() => setLaser((value) => !value)}
            className={`rounded-md border px-2 py-1 text-[12px] transition-colors ${
              laser ? 'border-rose-500 text-rose-300' : 'border-gray-600 hover:bg-gray-800'
            }`}
          >
            ●
          </button>
          <button
            type="button"
            aria-label={t('tools.slide.blackScreen')}
            onClick={() => setBlank((value) => (value === 'black' ? 'none' : 'black'))}
            className="rounded-md border border-gray-600 px-2 py-1 text-[12px] transition-colors hover:bg-gray-800"
          >
            {t('tools.slide.blackScreen')}
          </button>
          <button
            type="button"
            aria-label={t('tools.slide.whiteScreen')}
            onClick={() => setBlank((value) => (value === 'white' ? 'none' : 'white'))}
            className="rounded-md border border-gray-600 px-2 py-1 text-[12px] transition-colors hover:bg-gray-800"
          >
            {t('tools.slide.whiteScreen')}
          </button>
          <button
            type="button"
            aria-label={t('tools.slide.notes')}
            aria-pressed={showNotes}
            onClick={() => setShowNotes((value) => !value)}
            className={`rounded-md border px-2 py-1 text-[12px] transition-colors ${
              showNotes ? 'border-blue-500 text-blue-300' : 'border-gray-600 hover:bg-gray-800'
            }`}
          >
            {t('tools.slide.notes')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-600 px-2.5 py-1 text-[12px] transition-colors hover:bg-gray-800"
          >
            <Icon name="close" className="h-4 w-4" />
            {t('tools.slide.exitPresent')}
          </button>
        </div>
      </header>

      <div className="relative flex flex-1 items-stretch gap-3 overflow-hidden px-4 pb-2">
        {blank === 'none' ? (
          <div
            ref={hostRef}
            className="slide-present-enter min-h-0 flex-1"
            onClick={next}
            aria-label="present stage"
          />
        ) : (
          <div
            className={`flex-1 rounded-lg ${blank === 'black' ? 'bg-black' : 'bg-white'}`}
            onClick={() => setBlank('none')}
          />
        )}

        {/* Speaker view: notes + next-slide hint (no second window, so it works on a single screen) */}
        {showNotes && blank === 'none' ? (
          <aside className="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/70 p-3 text-[12px] text-gray-300">
            <div className="font-semibold text-gray-200">{t('tools.slide.notes')}</div>
            {notes ? (
              <p className="whitespace-pre-wrap leading-relaxed">{notes}</p>
            ) : (
              <p className="text-gray-500">{t('tools.slide.notesHint')}</p>
            )}
            {/* Compact "n/m" so it can't collide with the "n / m" page number above (substring matching would be ambiguous) */}
            <div className="mt-auto border-t border-gray-700 pt-2 text-gray-400">
              {t('tools.slide.nextSlide')}: {Math.min(cursor + 2, doc.slides.length)}/
              {doc.slides.length}
            </div>
          </aside>
        ) : null}
      </div>

      <footer className="flex items-center justify-center gap-3 pb-3 text-[12px] text-gray-400">
        <button
          type="button"
          onClick={prev}
          className="rounded-md border border-gray-600 px-2 py-1 transition-colors hover:bg-gray-800"
        >
          {t('tools.slide.prevSlide')}
        </button>
        <label className="flex items-center gap-1.5">
          <span className="sr-only">{t('tools.slide.jumpTo')}</span>
          <input
            type="number"
            min={1}
            max={doc.slides.length}
            value={cursor + 1}
            aria-label={t('tools.slide.jumpTo')}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (!Number.isFinite(value)) return;
              setCursor(Math.min(Math.max(1, Math.round(value)), doc.slides.length) - 1);
            }}
            className="h-7 w-14 rounded-md border border-gray-600 bg-transparent px-2 text-center text-[12px] text-gray-200 outline-none focus:border-blue-500"
          />
        </label>
        <button
          type="button"
          onClick={next}
          className="rounded-md border border-gray-600 px-2 py-1 transition-colors hover:bg-gray-800"
        >
          {t('tools.slide.nextSlide')}
        </button>
      </footer>
    </div>
  );
}
