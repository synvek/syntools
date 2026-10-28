import { describe, expect, it } from 'vitest';
import type { CommentThread } from '../../core/comments/model';
import {
  cellLabel,
  countSheetComments,
  readSheetComments,
  setSheetThreads,
  threadsForSheet,
  withSheetComments,
} from './comments';

function thread(id: string, row = 0, col = 0): CommentThread {
  return {
    id,
    anchor: { kind: 'cell', sheetId: 's1', row, col },
    resolved: false,
    comments: [{ id: `${id}-c`, author: '甲', createdAt: 1, body: '内容' }],
  };
}

describe('readSheetComments', () => {
  it('returns an empty map for missing or corrupt data', () => {
    expect(readSheetComments(null)).toEqual({});
    expect(readSheetComments({})).toEqual({});
    expect(readSheetComments({ syntoolsComments: { s1: 'nope' as never } })).toEqual({});
  });

  it('drops malformed threads but keeps valid ones', () => {
    const source = { syntoolsComments: { s1: [thread('t1'), null as never] } };
    const map = readSheetComments(source);
    expect(map.s1).toHaveLength(1);
  });
});

describe('countSheetComments / threadsForSheet', () => {
  it('counts across sheets and filters by active sheet', () => {
    const map = { s1: [thread('a'), thread('b')], s2: [thread('c')] };
    expect(countSheetComments(map)).toBe(3);
    expect(threadsForSheet(map, 's1')).toHaveLength(2);
    expect(threadsForSheet(map, null)).toEqual([]);
  });
});

describe('setSheetThreads', () => {
  it('adds, replaces and removes a sheet entry', () => {
    const empty = setSheetThreads({}, 's1', [thread('a')]);
    expect(empty.s1).toHaveLength(1);
    expect(setSheetThreads(empty, 's1', [])).toEqual({});
  });
});

describe('withSheetComments', () => {
  it('attaches the map only when it has content', () => {
    const snapshot = { name: 'book' };
    expect(withSheetComments(snapshot, {})).toEqual({ name: 'book' });
    const withThread = withSheetComments(snapshot, { s1: [thread('a')] });
    expect(withThread.syntoolsComments?.s1).toHaveLength(1);
    // The input snapshot must not be mutated
    expect('syntoolsComments' in snapshot).toBe(false);
  });
});

describe('cellLabel', () => {
  it('formats A1 references including multi-letter columns', () => {
    expect(cellLabel(0, 0)).toBe('A1');
    expect(cellLabel(9, 25)).toBe('Z10');
    expect(cellLabel(0, 26)).toBe('AA1');
    expect(cellLabel(0, 27)).toBe('AB1');
    expect(cellLabel(0, 51)).toBe('AZ1');
    expect(cellLabel(0, 52)).toBe('BA1');
  });
});
