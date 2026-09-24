import { describe, expect, it } from 'vitest';
import {
  generateIds,
  generateNanoId,
  generateObjectId,
  generateSnowflake,
  generateUlid,
  parseObjectIdTime,
  parseUlidTime,
} from './core';

describe('id-generator', () => {
  it('ULID 格式与时间可解析', () => {
    const now = 1_700_000_000_000;
    const id = generateUlid(now);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(parseUlidTime(id)).toBe(now);
  });

  it('ULID 随时间单调递增（前缀）', () => {
    const a = generateUlid(1_700_000_000_000);
    const b = generateUlid(1_700_000_001_000);
    expect(b.slice(0, 10) > a.slice(0, 10)).toBe(true);
  });

  it('NanoID 长度与字母表', () => {
    const id = generateNanoId(21);
    expect(id).toHaveLength(21);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('Snowflake 为十进制且含时间位', () => {
    const id = generateSnowflake({ machineId: 1, sequence: 0, timestamp: 1_700_000_000_000 });
    expect(id).toMatch(/^\d+$/);
    expect(BigInt(id) > 0n).toBe(true);
  });

  it('ObjectId 格式与时间可解析', () => {
    const now = 1_700_000_000_000;
    const id = generateObjectId(now);
    expect(id).toMatch(/^[0-9a-f]{24}$/);
    expect(parseObjectIdTime(id)).toBe(Math.floor(now / 1000) * 1000);
  });

  it('非法输入解析返回 null', () => {
    expect(parseUlidTime('bad')).toBeNull();
    expect(parseObjectIdTime('xyz')).toBeNull();
  });

  it('generateIds 批量与去重', () => {
    const r = generateIds({ type: 'ulid', count: 50 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(50);
    expect(new Set(r.value).size).toBe(50);
  });

  it('count 越界报错', () => {
    expect(generateIds({ type: 'ulid', count: 0 })).toEqual({ ok: false, error: 'INVALID_COUNT' });
    expect(generateIds({ type: 'ulid', count: 5000 })).toEqual({
      ok: false,
      error: 'INVALID_COUNT',
    });
  });

  it('支持全部四种类型', () => {
    for (const type of ['ulid', 'nanoid', 'snowflake', 'objectid'] as const) {
      const r = generateIds({ type, count: 3 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toHaveLength(3);
    }
  });
});
