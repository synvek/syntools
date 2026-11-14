import { describe, expect, it } from 'vitest';
import type { CommentThread } from '../../core/comments/model';
import { collectThreadNotes, formatThreadNote, NOTE_MAX_CHARS } from './commentsXlsx';
import { createEmptySheet, exportSnapshotToBytes, importXlsxToSnapshot } from './xlsx-io';

/**
 * Comments → xlsx notes (P1-9).
 *
 * The valuable case here is the real round trip: export a workbook that carries threads, then import
 * it through the normal path and check the note is on the cell. That proves the comments part and the
 * VML drawing exceljs emits are actually readable again — not just that we set a property.
 */

const SHEET_ID = 's1';
const SHEET_NAME = 'Comments';

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const fileOf = (bytes: Uint8Array, name: string): File =>
  ({
    name,
    size: bytes.byteLength,
    arrayBuffer: async () => toArrayBuffer(bytes),
  }) as unknown as File;

function thread(overrides: Partial<CommentThread> = {}): CommentThread {
  return {
    id: 't1',
    anchor: { kind: 'cell', sheetId: SHEET_ID, row: 0, col: 0 },
    resolved: false,
    comments: [
      { id: 'e1', author: '张三', createdAt: 0, body: '请确认这个数' },
      { id: 'e2', author: '李四', createdAt: 1, body: '已确认' },
    ],
    ...overrides,
  };
}

describe('formatThreadNote', () => {
  it('把每条回复压成一行，作者在前', () => {
    expect(formatThreadNote(thread())).toBe('张三: 请确认这个数\n李四: 已确认');
  });

  it('已解决的线程带标记，避免丢掉"已解决"这个信息', () => {
    expect(formatThreadNote(thread({ resolved: true }))).toContain('✓');
  });

  it('空白正文被跳过；全是空白时返回 null', () => {
    const blank = thread({
      comments: [
        { id: 'e1', author: 'A', createdAt: 0, body: '   ' },
        { id: 'e2', author: 'B', createdAt: 1, body: '' },
      ],
    });
    expect(formatThreadNote(blank)).toBeNull();
  });

  it('作者缺失时用占位符，不掉内容', () => {
    expect(
      formatThreadNote(
        thread({ comments: [{ id: 'e1', author: '', createdAt: 0, body: '内容' }] }),
      ),
    ).toBe('—: 内容');
  });

  it('超长内容截断，不写爆备注', () => {
    const long = thread({
      comments: [{ id: 'e1', author: 'A', createdAt: 0, body: 'x'.repeat(NOTE_MAX_CHARS + 100) }],
    });
    expect(formatThreadNote(long)?.length).toBeLessThanOrEqual(NOTE_MAX_CHARS + 1);
  });
});

describe('collectThreadNotes', () => {
  it('按工作表分组，并保留坐标', () => {
    const notes = collectThreadNotes({
      [SHEET_ID]: [thread({ anchor: { kind: 'cell', sheetId: SHEET_ID, row: 3, col: 2 } })],
    });
    expect(notes[SHEET_ID]).toEqual([{ row: 3, col: 2, text: '张三: 请确认这个数\n李四: 已确认' }]);
  });

  it('同一单元格的两条线程合并成一条备注（xlsx 只允许一条）', () => {
    const notes = collectThreadNotes({ [SHEET_ID]: [thread(), thread({ id: 't2' })] });
    expect(notes[SHEET_ID]).toHaveLength(1);
    expect(notes[SHEET_ID][0].text.split('\n\n')).toHaveLength(2);
  });

  it('孤儿线程与非单元格锚点被跳过', () => {
    const notes = collectThreadNotes({
      [SHEET_ID]: [
        thread({ id: 'orphan', orphaned: true }),
        thread({ id: 'slide', anchor: { kind: 'page', slideId: 'p1', x: 0, y: 0 } }),
      ],
    });
    expect(notes[SHEET_ID]).toBeUndefined();
  });
});

describe('round trip through xlsx', () => {
  it('线程导出后能作为单元格备注再导入', async () => {
    const snapshot = {
      id: 'wb',
      name: 'book',
      appVersion: '1.0.0',
      locale: 'zhCN',
      sheetOrder: [SHEET_ID],
      sheets: {
        [SHEET_ID]: {
          ...createEmptySheet(SHEET_ID, SHEET_NAME),
          cellData: {
            '0': { '0': { v: 'Q1' } },
            '1': { '0': { v: 120 } },
          },
        },
      },
      styles: {},
      syntoolsComments: { [SHEET_ID]: [thread()] },
    };

    const exported = await exportSnapshotToBytes(snapshot as never);
    if (!exported.ok) throw new Error('export failed');

    const imported = await importXlsxToSnapshot(fileOf(exported.value, 'notes.xlsx'));
    if (!imported.ok) throw new Error('import failed');

    const sheetId = imported.value.sheetOrder[0];
    const cell = imported.value.sheets[sheetId].cellData['0']?.['0'];
    const note = cell?.custom?.note;
    expect(typeof note).toBe('string');
    expect(note).toContain('请确认这个数');
    expect(note).toContain('已确认');
  });

  it('没有批注时导出不产生 comments part（不凭空造部件）', async () => {
    const snapshot = {
      id: 'wb',
      name: 'book',
      appVersion: '1.0.0',
      locale: 'zhCN',
      sheetOrder: [SHEET_ID],
      sheets: {
        [SHEET_ID]: {
          ...createEmptySheet(SHEET_ID, SHEET_NAME),
          cellData: { '0': { '0': { v: 'x' } } },
        },
      },
      styles: {},
    };
    const exported = await exportSnapshotToBytes(snapshot as never);
    if (!exported.ok) throw new Error('export failed');

    const imported = await importXlsxToSnapshot(fileOf(exported.value, 'plain.xlsx'));
    if (!imported.ok) throw new Error('import failed');
    const sheetId = imported.value.sheetOrder[0];
    expect(imported.value.sheets[sheetId].cellData['0']?.['0']?.custom?.note).toBeUndefined();
  });
});
