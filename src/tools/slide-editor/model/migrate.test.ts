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
});
