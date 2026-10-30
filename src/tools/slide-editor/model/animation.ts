import { createId } from './factory';
import type {
  AnimationEffect,
  AnimationStep,
  AnimationTrigger,
  SlideTransition,
  SlideTransitionType,
} from './types';

/**
 * 动画/切换的**纯数据层**（P2-5.1）。
 *
 * 设计口径：
 * - 只做两种入场效果（淡入/飞入）与两种切换（淡出/推入）。其余效果不假装支持，
 *   导入时列进保真提示（P2-5.5），避免"模型说有、播放不出来"。
 * - 时间线是纯函数：`buildTimeline` 把"单击/与上一动画同时/上一动画之后"翻译成
 *   每组内的相对开始时间；播放层只按时间走 tween，导出层（`p:timing`）也能复用它。
 * - 动画挂在元素 id 上，不嵌在元素里：元素复制/删除时不会带着一串副作用数据跑，
 *   删除元素后动画由 `pruneAnimations` 清理。
 */

export const DEFAULT_TRANSITION_DURATION = 400;
export const DEFAULT_ANIMATION_DURATION = 500;
export const MIN_ANIMATION_DURATION = 100;
export const MAX_ANIMATION_DURATION = 5000;
export const MAX_ANIMATION_DELAY = 10000;
/** 飞入起点相对终点的水平偏移（slide 坐标系 px） */
export const FLY_OFFSET = 64;

export const ANIMATION_EFFECTS: readonly AnimationEffect[] = ['fadeIn', 'flyIn'];
export const ANIMATION_TRIGGERS: readonly AnimationTrigger[] = [
  'onClick',
  'withPrevious',
  'afterPrevious',
];
export const TRANSITION_TYPES: readonly SlideTransitionType[] = ['none', 'fade', 'push'];

const FALLBACK_ANIMATION_DURATION = DEFAULT_ANIMATION_DURATION;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

/** 切换：`none` 视为没有切换，返回 `undefined`（不写进文档，导出也就不会写 `p:transition`） */
export function normalizeTransition(input: unknown): SlideTransition | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Partial<SlideTransition>;
  if (raw.type !== 'fade' && raw.type !== 'push') return undefined;
  return {
    type: raw.type,
    duration: clamp(
      raw.duration,
      MIN_ANIMATION_DURATION,
      MAX_ANIMATION_DURATION,
      DEFAULT_TRANSITION_DURATION,
    ),
    advanceOnClick: raw.advanceOnClick !== false,
  };
}

export function normalizeAnimationStep(input: unknown): AnimationStep | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<AnimationStep>;
  if (typeof raw.elementId !== 'string' || raw.elementId === '') return null;
  if (!ANIMATION_EFFECTS.includes(raw.effect as AnimationEffect)) return null;
  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : createId('anim'),
    elementId: raw.elementId,
    effect: raw.effect as AnimationEffect,
    duration: clamp(
      raw.duration,
      MIN_ANIMATION_DURATION,
      MAX_ANIMATION_DURATION,
      FALLBACK_ANIMATION_DURATION,
    ),
    delay: clamp(raw.delay, 0, MAX_ANIMATION_DELAY, 0),
    trigger: ANIMATION_TRIGGERS.includes(raw.trigger as AnimationTrigger)
      ? (raw.trigger as AnimationTrigger)
      : 'onClick',
  };
}

export function normalizeAnimationSteps(input: unknown): AnimationStep[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const steps: AnimationStep[] = [];
  for (const item of input) {
    const step = normalizeAnimationStep(item);
    if (!step || seen.has(step.id)) continue;
    seen.add(step.id);
    steps.push(step);
  }
  return steps;
}

export function createAnimationStep(elementId: string, effect: AnimationEffect): AnimationStep {
  return {
    id: createId('anim'),
    elementId,
    effect,
    duration: FALLBACK_ANIMATION_DURATION,
    delay: 0,
    trigger: 'onClick',
  };
}

export function addAnimationStep(
  steps: readonly AnimationStep[],
  elementId: string,
  effect: AnimationEffect,
): AnimationStep[] {
  return [...steps, createAnimationStep(elementId, effect)];
}

export function updateAnimationStep(
  steps: readonly AnimationStep[],
  id: string,
  patch: Partial<Pick<AnimationStep, 'duration' | 'delay' | 'trigger' | 'effect'>>,
): AnimationStep[] {
  return steps.map((step) => (step.id === id ? { ...step, ...patch } : step));
}

export function removeAnimationStep(steps: readonly AnimationStep[], id: string): AnimationStep[] {
  return steps.filter((step) => step.id !== id);
}

/** 上移/下移一格；返回新数组，越界时原样返回（调用方不必判断） */
export function moveAnimationStep(
  steps: readonly AnimationStep[],
  id: string,
  delta: -1 | 1,
): AnimationStep[] {
  const index = steps.findIndex((step) => step.id === id);
  if (index < 0) return [...steps];
  const target = index + delta;
  if (target < 0 || target >= steps.length) return [...steps];
  const next = [...steps];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

/** 元素被删除后清理它的动画，避免播放时找不到节点 */
export function pruneAnimations(
  steps: readonly AnimationStep[],
  elementIds: ReadonlySet<string>,
): AnimationStep[] {
  return steps.filter((step) => elementIds.has(step.elementId));
}

/* --------------------------------- 时间线 --------------------------------- */

export interface TimelineStep {
  step: AnimationStep;
  /** 相对本组触发点的开始时间（ms） */
  start: number;
}

export interface TimelineGroup {
  steps: TimelineStep[];
  /** 本组总时长（含延迟），用于导入/校验与"自动换页"的估计 */
  duration: number;
}

/**
 * 把动画列表翻译成"单击分组"的时间线。
 *
 * - `onClick`：新开一组，玩家点一下才播；
 * - `withPrevious`：与同组上一动画同时开始（再叠加自己的 delay）；
 * - `afterPrevious`：等同组前面所有动画结束后再开始（叠加 delay）；
 * - 第一项无论写的是什么触发方式，都按 `onClick` 处理（否则一进页面就自己播了）。
 */
export function buildTimeline(steps: readonly AnimationStep[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  let current: TimelineGroup | null = null;
  let cursor = 0;

  steps.forEach((step, index) => {
    if (index === 0 || step.trigger === 'onClick' || !current) {
      current = { steps: [], duration: 0 };
      groups.push(current);
      cursor = 0;
    }
    const group = current;

    let start: number;
    if (index === 0 || step.trigger === 'onClick') {
      start = step.delay;
    } else if (step.trigger === 'withPrevious') {
      const previous = group.steps[group.steps.length - 1];
      start = (previous?.start ?? 0) + step.delay;
    } else {
      start = cursor + step.delay;
    }

    group.steps.push({ step, start });
    group.duration = Math.max(group.duration, start + step.duration);
    cursor = Math.max(cursor, start + step.duration);
  });

  return groups;
}

/**
 * 元素第一次出场的组序号与效果；播放器据此决定"还没轮到的先藏起来"，
 * 以及该从哪个方向飞进来。
 */
export function entranceByElement(
  steps: readonly AnimationStep[],
): Map<string, { group: number; effect: AnimationEffect }> {
  const map = new Map<string, { group: number; effect: AnimationEffect }>();
  buildTimeline(steps).forEach((group, index) => {
    for (const { step } of group.steps) {
      if (!map.has(step.elementId)) map.set(step.elementId, { group: index, effect: step.effect });
    }
  });
  return map;
}

export type PlaybackAction =
  { kind: 'play'; groupIndex: number; steps: TimelineStep[] } | { kind: 'nextSlide' };

/**
 * 放映时"点一下"要做什么：先播完当前页剩下的动画组，再翻页。
 * 纯函数，播放器只负责执行，e2e/单测可以直接验。
 */
export function advancePlayback(
  steps: readonly AnimationStep[],
  playedGroups: number,
): PlaybackAction {
  const groups = buildTimeline(steps);
  if (playedGroups < groups.length) {
    return { kind: 'play', groupIndex: playedGroups, steps: groups[playedGroups].steps };
  }
  return { kind: 'nextSlide' };
}
