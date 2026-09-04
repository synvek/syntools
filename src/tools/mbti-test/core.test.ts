import { describe, expect, it } from 'vitest';
import { MBTI_QUESTIONS, answeredCount, scoreMbti } from './core';

describe('mbti-test', () => {
  it('题目数量', () => {
    expect(MBTI_QUESTIONS).toHaveLength(24);
  });

  it('完整作答得到类型', () => {
    const answers: Record<string, 'a' | 'b'> = {};
    for (const q of MBTI_QUESTIONS) answers[q.id] = 'a';
    const r = scoreMbti(answers);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.type).toMatch(/^[EI][SN][TF][JP]$/);
    expect(answeredCount(answers)).toBe(24);
  });

  it('未完成', () => {
    expect(scoreMbti({})).toEqual({ ok: false, error: 'INCOMPLETE' });
  });
});
