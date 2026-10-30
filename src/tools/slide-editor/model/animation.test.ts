import { describe, expect, it } from 'vitest';
import {
  addAnimationStep,
  advancePlayback,
  buildTimeline,
  entranceByElement,
  MAX_ANIMATION_DURATION,
  MIN_ANIMATION_DURATION,
  moveAnimationStep,
  normalizeAnimationSteps,
  normalizeTransition,
  pruneAnimations,
  removeAnimationStep,
  updateAnimationStep,
} from './animation';
import type { AnimationStep } from './types';

/** P2-5.1：动画/切换的纯数据层（顺序、触发语义、容错） */

function step(overrides: Partial<AnimationStep> & { id: string }): AnimationStep {
  return {
    id: overrides.id,
    elementId: overrides.elementId ?? 'el-1',
    effect: overrides.effect ?? 'fadeIn',
    duration: overrides.duration ?? 500,
    delay: overrides.delay ?? 0,
    trigger: overrides.trigger ?? 'onClick',
  };
}

describe('normalizeTransition', () => {
  it('keeps fade/push and drops none or garbage', () => {
    expect(normalizeTransition({ type: 'fade', duration: 300 })).toEqual({
      type: 'fade',
      duration: 300,
      advanceOnClick: true,
    });
    expect(normalizeTransition({ type: 'push', duration: 400, advanceOnClick: false })).toEqual({
      type: 'push',
      duration: 400,
      advanceOnClick: false,
    });
    // 用户选"无"时不该在文档里留下一个 type:none 的对象
    expect(normalizeTransition({ type: 'none' })).toBeUndefined();
    expect(normalizeTransition(null)).toBeUndefined();
    expect(normalizeTransition({ type: 'wipe' })).toBeUndefined();
  });

  it('clamps the duration into a playable range', () => {
    expect(normalizeTransition({ type: 'fade', duration: 1 })?.duration).toBe(
      MIN_ANIMATION_DURATION,
    );
    expect(normalizeTransition({ type: 'fade', duration: 99999 })?.duration).toBe(
      MAX_ANIMATION_DURATION,
    );
  });
});

describe('normalizeAnimationSteps', () => {
  it('drops unknown effects, missing targets and duplicate ids', () => {
    const steps = normalizeAnimationSteps([
      { id: 'a', elementId: 'el-1', effect: 'fadeIn' },
      { id: 'a', elementId: 'el-2', effect: 'flyIn' },
      { id: 'b', elementId: 'el-3', effect: 'spin' },
      { id: 'c', effect: 'fadeIn' },
      { id: 'd', elementId: 'el-4', effect: 'flyIn', duration: 20, delay: -5 },
    ]);
    expect(steps.map((item) => item.id)).toEqual(['a', 'd']);
    expect(steps[1]).toMatchObject({
      elementId: 'el-4',
      effect: 'flyIn',
      duration: MIN_ANIMATION_DURATION,
      delay: 0,
      trigger: 'onClick',
    });
  });

  it('is tolerant of non-array input', () => {
    expect(normalizeAnimationSteps(undefined)).toEqual([]);
    expect(normalizeAnimationSteps({})).toEqual([]);
  });
});

describe('buildTimeline', () => {
  it('groups clicks and resolves with/after previous', () => {
    const groups = buildTimeline([
      step({ id: 'a', duration: 500 }),
      step({ id: 'b', delay: 100, trigger: 'withPrevious' }),
      step({ id: 'c', trigger: 'afterPrevious' }),
      step({ id: 'd', duration: 300, delay: 200 }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].steps.map((item) => [item.step.id, item.start])).toEqual([
      ['a', 0],
      ['b', 100],
      // b 在 100 开始、500 结束 → 600；a 在 500 结束，取较大者
      ['c', 600],
    ]);
    expect(groups[0].duration).toBe(1100);
    expect(groups[1].steps.map((item) => [item.step.id, item.start])).toEqual([['d', 200]]);
    expect(groups[1].duration).toBe(500);
  });

  it('treats a leading withPrevious/afterPrevious as a click group', () => {
    const groups = buildTimeline([step({ id: 'a', trigger: 'afterPrevious' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].steps[0].start).toBe(0);
  });

  it('returns no groups for an empty list', () => {
    expect(buildTimeline([])).toEqual([]);
  });
});

describe('advancePlayback', () => {
  const steps = [step({ id: 'a' }), step({ id: 'b' }), step({ id: 'c' })];

  it('plays one group per click, then asks for the next slide', () => {
    expect(advancePlayback(steps, 0)).toMatchObject({ kind: 'play', groupIndex: 0 });
    expect(advancePlayback(steps, 1)).toMatchObject({ kind: 'play', groupIndex: 1 });
    expect(advancePlayback(steps, 2)).toMatchObject({ kind: 'play', groupIndex: 2 });
    // 三个 onClick 步骤 = 三组；全部播完才翻页
    expect(advancePlayback(steps, 3)).toEqual({ kind: 'nextSlide' });
    expect(advancePlayback([], 0)).toEqual({ kind: 'nextSlide' });
  });

  it('includes every step of the group in one click', () => {
    const together = [step({ id: 'a' }), step({ id: 'b', trigger: 'withPrevious' })];
    const action = advancePlayback(together, 0);
    expect(action.kind).toBe('play');
    if (action.kind === 'play') {
      expect(action.steps.map((item) => item.step.id)).toEqual(['a', 'b']);
    }
  });
});

describe('entranceByElement', () => {
  it('uses the first appearance of each element', () => {
    const map = entranceByElement([
      step({ id: 'a', elementId: 'el-1' }),
      step({ id: 'b', elementId: 'el-2', effect: 'flyIn', trigger: 'withPrevious' }),
      step({ id: 'c', elementId: 'el-1', trigger: 'withPrevious' }),
    ]);
    expect(map.get('el-1')).toEqual({ group: 0, effect: 'fadeIn' });
    expect(map.get('el-2')).toEqual({ group: 0, effect: 'flyIn' });
  });
});

describe('step editing helpers', () => {
  const base = [step({ id: 'a' }), step({ id: 'b' }), step({ id: 'c' })];

  it('adds at the end, removes by id and clamps moves', () => {
    const added = addAnimationStep(base, 'el-9', 'flyIn');
    expect(added.at(-1)).toMatchObject({ elementId: 'el-9', effect: 'flyIn' });
    expect(removeAnimationStep(base, 'b').map((item) => item.id)).toEqual(['a', 'c']);
    expect(moveAnimationStep(base, 'c', -1).map((item) => item.id)).toEqual(['a', 'c', 'b']);
    expect(moveAnimationStep(base, 'a', -1).map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('updates trigger/duration without touching order', () => {
    const next = updateAnimationStep(base, 'b', { trigger: 'withPrevious', duration: 800 });
    expect(next.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(next[1]).toMatchObject({ trigger: 'withPrevious', duration: 800 });
  });

  it('prunes steps whose element is gone', () => {
    expect(pruneAnimations(base, new Set(['el-1']))).toHaveLength(3);
    expect(pruneAnimations(base, new Set(['nope']))).toHaveLength(0);
  });
});
