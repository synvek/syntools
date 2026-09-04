import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FORMAT,
  formatUuid,
  generateBatch,
  generateV4,
  generateV7,
  MAX_BATCH,
} from './core';

const V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('generateV4', () => {
  it('符合 v4 格式（版本位 4、变体位 8/9/a/b）', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateV4()).toMatch(V4_PATTERN);
    }
  });

  it('连续生成不重复', () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateV4()));
    expect(set.size).toBe(1000);
  });
});

describe('generateV7', () => {
  it('符合 v7 格式（版本位 7、变体位）', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateV7()).toMatch(V7_PATTERN);
    }
  });

  it('时间戳前缀与传入时间一致', () => {
    const now = 1_725_000_000_000;
    const uuid = generateV7(now);
    const hex = uuid.replace(/-/g, '');
    expect(parseInt(hex.slice(0, 12), 16)).toBe(now);
  });

  it('早生成的排序在前（可排序性）', () => {
    const early = generateV7(1_000);
    const late = generateV7(Date.now());
    expect(early < late).toBe(true);
  });
});

describe('formatUuid', () => {
  const sample = '123e4567-e89b-12d3-a456-426614174000';

  it('大写', () => {
    expect(formatUuid(sample, { ...DEFAULT_FORMAT, uppercase: true })).toBe(sample.toUpperCase());
  });

  it('去横线', () => {
    expect(formatUuid(sample, { ...DEFAULT_FORMAT, hyphens: false })).toBe(
      '123e4567e89b12d3a456426614174000',
    );
  });

  it('花括号包裹', () => {
    expect(formatUuid(sample, { ...DEFAULT_FORMAT, braces: true })).toBe(`{${sample}}`);
  });

  it('组合选项', () => {
    expect(formatUuid(sample, { uppercase: true, hyphens: false, braces: true })).toBe(
      '{123E4567E89B12D3A456426614174000}',
    );
  });
});

describe('generateBatch', () => {
  it('批量生成且唯一', () => {
    const r = generateBatch('v4', 500, DEFAULT_FORMAT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(500);
    expect(new Set(r.value).size).toBe(500);
    for (const uuid of r.value.slice(0, 10)) expect(uuid).toMatch(V4_PATTERN);
  });

  it('v7 批量格式正确', () => {
    const r = generateBatch('v7', 50, DEFAULT_FORMAT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const uuid of r.value) expect(uuid).toMatch(V7_PATTERN);
  });

  it('超过上限拒绝', () => {
    const r = generateBatch('v4', MAX_BATCH + 1, DEFAULT_FORMAT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('TOO_MANY');
  });

  it('非法数量拒绝', () => {
    expect(generateBatch('v4', 0, DEFAULT_FORMAT).ok).toBe(false);
    expect(generateBatch('v4', 1.5, DEFAULT_FORMAT).ok).toBe(false);
  });
});
