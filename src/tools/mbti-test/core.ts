import type { ToolResult } from '@/core/types';

/**
 * MBTI 简易性格测试：四维计分（E/I、S/N、T/F、J/P）。
 */

export type MbtiDimension = 'EI' | 'SN' | 'TF' | 'JP';
export type MbtiLetter = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';
export type MbtiError = 'INCOMPLETE';

export interface MbtiOption {
  id: 'a' | 'b';
  /** i18n key suffix under tools.mbti.q{n}.a / .b */
  letter: MbtiLetter;
}

export interface MbtiQuestion {
  id: string;
  dimension: MbtiDimension;
  options: [MbtiOption, MbtiOption];
}

export type MbtiType =
  | 'ISTJ'
  | 'ISFJ'
  | 'INFJ'
  | 'INTJ'
  | 'ISTP'
  | 'ISFP'
  | 'INFP'
  | 'INTP'
  | 'ESTP'
  | 'ESFP'
  | 'ENFP'
  | 'ENTP'
  | 'ESTJ'
  | 'ESFJ'
  | 'ENFJ'
  | 'ENTJ';

export interface MbtiScores {
  E: number;
  I: number;
  S: number;
  N: number;
  T: number;
  F: number;
  J: number;
  P: number;
}

export interface MbtiResult {
  type: MbtiType;
  scores: MbtiScores;
  /** 各维倾向强度 0–100（偏向字母一侧的百分比） */
  strengths: { EI: number; SN: number; TF: number; JP: number };
}

/** 24 题：每维 6 题，选项 letter 决定加分方向 */
export const MBTI_QUESTIONS: MbtiQuestion[] = [
  { id: 'q1', dimension: 'EI', options: [{ id: 'a', letter: 'E' }, { id: 'b', letter: 'I' }] },
  { id: 'q2', dimension: 'EI', options: [{ id: 'a', letter: 'E' }, { id: 'b', letter: 'I' }] },
  { id: 'q3', dimension: 'EI', options: [{ id: 'a', letter: 'I' }, { id: 'b', letter: 'E' }] },
  { id: 'q4', dimension: 'EI', options: [{ id: 'a', letter: 'E' }, { id: 'b', letter: 'I' }] },
  { id: 'q5', dimension: 'EI', options: [{ id: 'a', letter: 'I' }, { id: 'b', letter: 'E' }] },
  { id: 'q6', dimension: 'EI', options: [{ id: 'a', letter: 'E' }, { id: 'b', letter: 'I' }] },
  { id: 'q7', dimension: 'SN', options: [{ id: 'a', letter: 'S' }, { id: 'b', letter: 'N' }] },
  { id: 'q8', dimension: 'SN', options: [{ id: 'a', letter: 'N' }, { id: 'b', letter: 'S' }] },
  { id: 'q9', dimension: 'SN', options: [{ id: 'a', letter: 'S' }, { id: 'b', letter: 'N' }] },
  { id: 'q10', dimension: 'SN', options: [{ id: 'a', letter: 'S' }, { id: 'b', letter: 'N' }] },
  { id: 'q11', dimension: 'SN', options: [{ id: 'a', letter: 'N' }, { id: 'b', letter: 'S' }] },
  { id: 'q12', dimension: 'SN', options: [{ id: 'a', letter: 'S' }, { id: 'b', letter: 'N' }] },
  { id: 'q13', dimension: 'TF', options: [{ id: 'a', letter: 'T' }, { id: 'b', letter: 'F' }] },
  { id: 'q14', dimension: 'TF', options: [{ id: 'a', letter: 'F' }, { id: 'b', letter: 'T' }] },
  { id: 'q15', dimension: 'TF', options: [{ id: 'a', letter: 'T' }, { id: 'b', letter: 'F' }] },
  { id: 'q16', dimension: 'TF', options: [{ id: 'a', letter: 'T' }, { id: 'b', letter: 'F' }] },
  { id: 'q17', dimension: 'TF', options: [{ id: 'a', letter: 'F' }, { id: 'b', letter: 'T' }] },
  { id: 'q18', dimension: 'TF', options: [{ id: 'a', letter: 'T' }, { id: 'b', letter: 'F' }] },
  { id: 'q19', dimension: 'JP', options: [{ id: 'a', letter: 'J' }, { id: 'b', letter: 'P' }] },
  { id: 'q20', dimension: 'JP', options: [{ id: 'a', letter: 'P' }, { id: 'b', letter: 'J' }] },
  { id: 'q21', dimension: 'JP', options: [{ id: 'a', letter: 'J' }, { id: 'b', letter: 'P' }] },
  { id: 'q22', dimension: 'JP', options: [{ id: 'a', letter: 'J' }, { id: 'b', letter: 'P' }] },
  { id: 'q23', dimension: 'JP', options: [{ id: 'a', letter: 'P' }, { id: 'b', letter: 'J' }] },
  { id: 'q24', dimension: 'JP', options: [{ id: 'a', letter: 'J' }, { id: 'b', letter: 'P' }] },
];

function emptyScores(): MbtiScores {
  return { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
}

export function scoreMbti(
  answers: Record<string, 'a' | 'b'>,
): ToolResult<MbtiResult> {
  const scores = emptyScores();
  for (const q of MBTI_QUESTIONS) {
    const choice = answers[q.id];
    if (choice !== 'a' && choice !== 'b') return { ok: false, error: 'INCOMPLETE' };
    const opt = q.options.find((o) => o.id === choice);
    if (!opt) return { ok: false, error: 'INCOMPLETE' };
    scores[opt.letter] += 1;
  }

  const ei = scores.E >= scores.I ? 'E' : 'I';
  const sn = scores.S >= scores.N ? 'S' : 'N';
  const tf = scores.T >= scores.F ? 'T' : 'F';
  const jp = scores.J >= scores.P ? 'J' : 'P';
  const type = `${ei}${sn}${tf}${jp}` as MbtiType;

  const pct = (a: number, b: number) => {
    const total = a + b;
    if (total === 0) return 50;
    return Math.round((Math.max(a, b) / total) * 100);
  };

  return {
    ok: true,
    value: {
      type,
      scores,
      strengths: {
        EI: pct(scores.E, scores.I),
        SN: pct(scores.S, scores.N),
        TF: pct(scores.T, scores.F),
        JP: pct(scores.J, scores.P),
      },
    },
  };
}

export function answeredCount(answers: Record<string, 'a' | 'b'>): number {
  return MBTI_QUESTIONS.filter((q) => answers[q.id] === 'a' || answers[q.id] === 'b').length;
}
