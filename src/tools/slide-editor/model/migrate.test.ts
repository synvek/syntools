import { describe, expect, it } from 'vitest';
import { createDoc } from './factory';
import { CURRENT_SCHEMA_VERSION, migrateDoc } from './migrate';

/** Schema upgrades: v3 adds document-level comment threads (P1-2) */

describe('migrateDoc', () => {
  it('adds an empty comment list when reading a v2 document', () => {
    const current = createDoc('legacy');
    const legacy = { ...current, comments: undefined, schemaVersion: 2 };
    const migrated = migrateDoc(legacy);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.comments).toEqual([]);
  });

  it('keeps existing threads and is idempotent', () => {
    const current = createDoc('current');
    const withThread = {
      ...current,
      comments: [
        {
          id: 't1',
          anchor: { kind: 'page' as const, slideId: current.slides[0].id, x: 1, y: 2 },
          resolved: false,
          comments: [{ id: 'c1', author: '甲', createdAt: 1, body: '内容' }],
        },
      ],
    };
    const migrated = migrateDoc({ ...withThread, schemaVersion: 2 });
    expect(migrated.comments).toHaveLength(1);
    expect(migrateDoc(migrated)).toBe(migrated);
  });

  it('falls back to an empty list for corrupt data', () => {
    const legacy = { ...createDoc('corrupt'), comments: null as never, schemaVersion: 1 };
    expect(migrateDoc(legacy).comments).toEqual([]);
  });

  it('normalizes animations/transition written by an older schema', () => {
    const current = createDoc('legacy-animations');
    const legacy = {
      ...current,
      schemaVersion: 3,
      // 旧版本可能写着未支持的效果/越界时长：这里故意用非法值喂给迁移
      slides: current.slides.map((slide) => ({
        ...slide,
        transition: { type: 'wipe', duration: 99999 } as never,
        animations: [
          { id: 'a', elementId: 'el-1', effect: 'fadeIn', duration: 1 },
          { id: 'b', elementId: 'el-2', effect: 'spin' },
        ] as never,
      })),
    };

    const migrated = migrateDoc(legacy);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // 不认识的切换整条丢掉：播放层与导出层都不用再判断一次
    expect(migrated.slides[0].transition).toBeUndefined();
    expect(migrated.slides[0].animations).toHaveLength(1);
    expect(migrated.slides[0].animations?.[0]).toMatchObject({ id: 'a', duration: 100 });
  });
});
