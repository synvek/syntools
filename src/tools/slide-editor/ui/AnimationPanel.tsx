import { useTranslation } from 'react-i18next';
import {
  ANIMATION_TRIGGERS,
  TRANSITION_TYPES,
  addAnimationStep,
  moveAnimationStep,
  removeAnimationStep,
  updateAnimationStep,
} from '../model/animation';
import { flattenElements } from '../model/tree';
import type { AnimationTrigger, SlideTransitionType } from '../model/types';
import { useSlideStore } from '../store';
import { Section } from './controls';
import { elementLabel } from './elementLabel';

/**
 * 动画窗格（P2-5.3 的最小可用版）。
 *
 * 只暴露模型真正支持的两种入场（淡入/飞入）与两种切换（淡出/推入）：
 * 下拉里没有的效果，导出与放映都不会"看起来支持"。列表顺序就是播放顺序，
 * 触发方式交给模型层的时间线（单击 / 与上一动画同时 / 上一动画之后）。
 */

const DURATION_CHOICES = [300, 500, 800, 1000];
const TRIGGER_KEYS: Record<AnimationTrigger, string> = {
  onClick: 'tools.slide.animationTriggerOnClick',
  withPrevious: 'tools.slide.animationTriggerWithPrevious',
  afterPrevious: 'tools.slide.animationTriggerAfterPrevious',
};
const TRANSITION_KEYS: Record<SlideTransitionType, string> = {
  none: 'tools.slide.transitionNone',
  fade: 'tools.slide.transitionFade',
  push: 'tools.slide.transitionPush',
};

export function AnimationPanel() {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const selection = useSlideStore((s) => s.selection);
  const updateSlide = useSlideStore((s) => s.updateSlide);

  const slide = doc.slides[slideIndex];
  if (!slide) return null;

  const animations = slide.animations ?? [];
  const elements = flattenElements(slide.elements);
  const selected = elements.find((element) => selection.includes(element.id));
  const transition = slide.transition;
  const labelOf = (elementId: string) => {
    const element = elements.find((candidate) => candidate.id === elementId);
    return element ? elementLabel(element, t) : elementId;
  };
  const writeAnimations = (next: typeof animations) =>
    updateSlide({ animations: next.length > 0 ? next : undefined });

  return (
    <div className="flex flex-col gap-2">
      <Section title={t('tools.slide.animationTransition')}>
        <select
          aria-label={t('tools.slide.animationTransition')}
          value={transition?.type ?? 'none'}
          onChange={(event) => {
            const type = event.target.value as SlideTransitionType;
            updateSlide({
              transition:
                type === 'none'
                  ? undefined
                  : { type, duration: transition?.duration ?? 400, advanceOnClick: true },
            });
          }}
          className="h-7 rounded-md border border-gray-300 bg-white px-2 text-[12px] dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        >
          {TRANSITION_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(TRANSITION_KEYS[type])}
            </option>
          ))}
        </select>
      </Section>

      <Section
        title={t('tools.slide.animationEffects')}
        action={<span className="text-[11px] text-gray-400">{animations.length}</span>}
      >
        <div className="flex gap-1">
          <button
            type="button"
            disabled={!selected}
            onClick={() =>
              selected && writeAnimations(addAnimationStep(animations, selected.id, 'fadeIn'))
            }
            className="h-7 flex-1 rounded-md border border-gray-300 text-[11px] hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            {t('tools.slide.animationFadeIn')}
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() =>
              selected && writeAnimations(addAnimationStep(animations, selected.id, 'flyIn'))
            }
            className="h-7 flex-1 rounded-md border border-gray-300 text-[11px] hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            {t('tools.slide.animationFlyIn')}
          </button>
        </div>

        {animations.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            {t('tools.slide.animationEmpty')}
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5" aria-label={t('tools.slide.animationEffects')}>
            {animations.map((step, index) => (
              <li
                key={step.id}
                className="rounded-md border border-gray-200 p-1.5 text-[11px] dark:border-gray-700"
              >
                <div className="flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate" title={labelOf(step.elementId)}>
                    {index + 1}. {labelOf(step.elementId)}
                  </span>
                  <button
                    type="button"
                    aria-label={`${labelOf(step.elementId)} ${t('tools.slide.bringForward')}`}
                    disabled={index === 0}
                    onClick={() => writeAnimations(moveAnimationStep(animations, step.id, -1))}
                    className="h-5 w-5 rounded border border-gray-300 disabled:opacity-40 dark:border-gray-600"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`${labelOf(step.elementId)} ${t('tools.slide.sendBackward')}`}
                    disabled={index === animations.length - 1}
                    onClick={() => writeAnimations(moveAnimationStep(animations, step.id, 1))}
                    className="h-5 w-5 rounded border border-gray-300 disabled:opacity-40 dark:border-gray-600"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`${labelOf(step.elementId)} ${t('common.remove')}`}
                    onClick={() => writeAnimations(removeAnimationStep(animations, step.id))}
                    className="h-5 w-5 rounded border border-gray-300 text-red-600 disabled:opacity-40 dark:border-gray-600"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-1 flex gap-1">
                  <select
                    aria-label={`${labelOf(step.elementId)} ${t('tools.slide.animationTrigger')}`}
                    value={step.trigger}
                    onChange={(event) =>
                      writeAnimations(
                        updateAnimationStep(animations, step.id, {
                          trigger: event.target.value as AnimationTrigger,
                        }),
                      )
                    }
                    className="h-6 min-w-0 flex-1 rounded border border-gray-300 bg-white px-1 text-[11px] dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                  >
                    {ANIMATION_TRIGGERS.map((trigger) => (
                      <option key={trigger} value={trigger}>
                        {t(TRIGGER_KEYS[trigger])}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`${labelOf(step.elementId)} ${t('tools.slide.animationDuration')}`}
                    value={step.duration}
                    onChange={(event) =>
                      writeAnimations(
                        updateAnimationStep(animations, step.id, {
                          duration: Number(event.target.value),
                        }),
                      )
                    }
                    className="h-6 w-16 rounded border border-gray-300 bg-white px-1 text-[11px] dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                  >
                    {DURATION_CHOICES.map((duration) => (
                      <option key={duration} value={duration}>
                        {duration} ms
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
