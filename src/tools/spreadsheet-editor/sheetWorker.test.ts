import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportCsvInWorker,
  exportSnapshotInWorker,
  importXlsxInWorker,
  isSheetWorkerUnavailable,
  resetSheetWorker,
} from './sheetWorkerClient';
import { handleSheetWorkerRequest, transferableBuffer } from './sheetWorkerTasks';
import { createEmptySheet, createEmptySnapshot, type WorkbookSnapshot } from './xlsx-io';

const fakeFile = (buffer: ArrayBuffer, name: string): File =>
  ({ name, size: buffer.byteLength, arrayBuffer: async () => buffer }) as unknown as File;

/** 真 exceljs 造一份最小 xlsx：worker 分发层要验的是"字节进 → 快照出"，不是 mock */
async function makeXlsx(): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('明细');
  sheet.getCell('A1').value = '销售额';
  sheet.getCell('B1').value = 42;
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

/** 造一个快照，导出后能被 exceljs 读回 */
function sampleSnapshot(): WorkbookSnapshot {
  const base = createEmptySnapshot('worker-book');
  const sheet = createEmptySheet('s1', '明细');
  sheet.cellData = { '0': { '0': { v: '销售额' }, '1': { v: 42 } } };
  return { ...base, sheetOrder: ['s1'], sheets: { s1: sheet } };
}

describe('sheet worker 任务分发', () => {
  it('importXlsx：真 xlsx 字节 → 快照（与主线程同一条实现）', async () => {
    const response = await handleSheetWorkerRequest({
      id: 1,
      kind: 'importXlsx',
      name: 'book.xlsx',
      buffer: await makeXlsx(),
    });

    expect(response.status).toBe('ok');
    if (response.status !== 'ok' || response.task.kind !== 'importXlsx') return;
    const { snapshot } = response.task;
    expect(snapshot.sheetOrder).toHaveLength(1);
    expect(snapshot.sheets[snapshot.sheetOrder[0]].name).toBe('明细');
    expect(snapshot.sheets[snapshot.sheetOrder[0]].cellData['0']['0']).toMatchObject({
      v: '销售额',
    });
    // 空文件没有可报告的内容，但不允许返回 undefined（主线程会 push 它）
    expect(response.task.issues).toEqual([]);
  });

  it('importXlsx：不是 zip → failed（业务失败，不假装能重试）', async () => {
    const response = await handleSheetWorkerRequest({
      id: 2,
      kind: 'importXlsx',
      name: 'fake.xlsx',
      buffer: new TextEncoder().encode('definitely not a zip').buffer as ArrayBuffer,
    });

    expect(response.status).toBe('failed');
    if (response.status !== 'failed') return;
    // 诊断层先归类容器，不该退化成笼统的 IMPORT_FAILED
    expect(response.error).toBe('NOT_ZIP');
  });

  it('exportXlsx：快照 → 可转让的 buffer，写出的字节能被读回', async () => {
    const response = await handleSheetWorkerRequest({
      id: 3,
      kind: 'exportXlsx',
      snapshot: sampleSnapshot(),
    });

    expect(response.status).toBe('ok');
    if (response.status !== 'ok' || response.task.kind !== 'exportXlsx') return;
    const bytes = new Uint8Array(response.task.bytes);
    expect(bytes.byteLength).toBeGreaterThan(0);

    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.task.bytes);
    expect(workbook.worksheets[0].name).toBe('明细');
    expect(workbook.worksheets[0].getCell('B1').value).toBe(42);
  });

  /**
   * CSV 也走线程（P2-1 收尾）：十万行的表在主线程上拼字符串是一次可见的卡顿。
   * 这里验的是"同一份 `snapshotToCsv` 在 worker 里跑"——输出逐字符相同，失败的归因也一样。
   */
  it('exportCsv：快照 → CSV 文本（与主线程同一实现）', async () => {
    const response = await handleSheetWorkerRequest({
      id: 4,
      kind: 'exportCsv',
      snapshot: sampleSnapshot(),
      sheetId: 's1',
    });

    expect(response.status).toBe('ok');
    if (response.status !== 'ok' || response.task.kind !== 'exportCsv') return;
    expect(response.task.text).toBe('销售额,42');
  });

  it('exportCsv：没有可导出的格子 → failed（业务失败，不报废线程）', async () => {
    const empty = createEmptySnapshot('empty');
    const response = await handleSheetWorkerRequest({
      id: 5,
      kind: 'exportCsv',
      snapshot: empty,
      sheetId: empty.sheetOrder[0] ?? null,
    });

    expect(response).toEqual({ id: 5, status: 'failed', error: 'EMPTY' });
  });

  it('transferableBuffer：视图不覆盖整个 buffer 时复制，避免搬走别的数据', () => {
    const backing = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const view = backing.subarray(1, 4);
    const exact = transferableBuffer(new Uint8Array([7, 8]));

    expect(exact.byteLength).toBe(2);
    const copied = transferableBuffer(view);
    expect(copied.byteLength).toBe(3);
    expect(new Uint8Array(copied)).toEqual(new Uint8Array([2, 3, 4]));
  });
});

describe('sheet worker 客户端：不可用时静默回落', () => {
  beforeEach(() => {
    resetSheetWorker();
  });

  afterEach(() => {
    resetSheetWorker();
    vi.unstubAllGlobals();
  });

  it('没有 Worker 全局（jsdom / SSR）→ unavailable，且不抛错', async () => {
    // jsdom 不实现 Worker；显式删掉以防运行环境不同
    vi.stubGlobal('Worker', undefined);

    expect(await importXlsxInWorker(fakeFile(new ArrayBuffer(4), 'a.xlsx'))).toEqual({
      status: 'unavailable',
    });
    expect(await exportSnapshotInWorker(sampleSnapshot())).toEqual({ status: 'unavailable' });
    expect(await exportCsvInWorker(sampleSnapshot(), 's1')).toEqual({ status: 'unavailable' });
    expect(isSheetWorkerUnavailable()).toBe(true);
  });

  it('线程回包：导入走 transfer 移交字节，结果原样带回', async () => {
    const instance = installFakeWorker((message, worker) => {
      queueMicrotask(() => {
        worker.onmessage?.({
          data: {
            id: message.id,
            status: 'ok',
            task: {
              kind: 'importXlsx',
              snapshot: sampleSnapshot(),
              issues: [
                {
                  code: 'sheet.importMacros',
                  severity: 'warning',
                  count: 1,
                  messageKey: 'tools.sheet.importMacros',
                },
              ],
              notices: [{ code: 'chartPartsUnreadable', level: 'notice' }],
            },
          },
        });
      });
    });

    const result = await importXlsxInWorker(fakeFile(new ArrayBuffer(8), 'book.xlsx'));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.snapshot.sheetOrder).toEqual(['s1']);
    expect(result.issues).toHaveLength(1);
    expect(result.notices[0].code).toBe('chartPartsUnreadable');
    // ArrayBuffer 必须走 transfer，否则整份文件会被复制一遍
    expect(instance.posted[0].transfer).toHaveLength(1);
    expect(instance.options).toMatchObject({ type: 'module' });
  });

  it('线程回包：导出把 buffer 包回视图', async () => {
    installFakeWorker((message, worker) => {
      queueMicrotask(() => {
        worker.onmessage?.({
          data: {
            id: message.id,
            status: 'ok',
            task: { kind: 'exportXlsx', bytes: new Uint8Array([1, 2, 3]).buffer },
          },
        });
      });
    });

    const result = await exportSnapshotInWorker(sampleSnapshot());

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(Array.from(result.bytes)).toEqual([1, 2, 3]);
  });

  it('线程回包：CSV 文本原样带回', async () => {
    installFakeWorker((message, worker) => {
      queueMicrotask(() => {
        worker.onmessage?.({
          data: { id: message.id, status: 'ok', task: { kind: 'exportCsv', text: 'a,b\n1,2' } },
        });
      });
    });

    const result = await exportCsvInWorker(sampleSnapshot(), 's1');

    expect(result).toEqual({ status: 'ok', text: 'a,b\n1,2' });
  });

  it('线程 onerror → 报废一次，之后不再起线程', async () => {
    const instance = installFakeWorker((_message, worker) => {
      queueMicrotask(() => worker.onerror?.({}));
    });

    expect(await importXlsxInWorker(fakeFile(new ArrayBuffer(8), 'a.xlsx'))).toEqual({
      status: 'unavailable',
    });
    expect(instance.terminated).toBe(true);
    expect(isSheetWorkerUnavailable()).toBe(true);

    // 第二次调用直接走同步路径，不会再构造线程
    expect(await exportSnapshotInWorker(sampleSnapshot())).toEqual({ status: 'unavailable' });
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it('业务失败不报废线程：回 failed，下次还能用', async () => {
    installFakeWorker((message, worker) => {
      queueMicrotask(() => {
        worker.onmessage?.({
          data: { id: message.id, status: 'failed', error: 'PART_UNREADABLE' },
        });
      });
    });

    const result = await importXlsxInWorker(fakeFile(new ArrayBuffer(8), 'a.xlsx'));

    expect(result).toEqual({ status: 'failed', error: 'PART_UNREADABLE' });
    expect(isSheetWorkerUnavailable()).toBe(false);
  });
});

interface PostedMessage {
  message: { id: number; kind: string };
  transfer: Transferable[];
}

class FakeWorker {
  static instances: FakeWorker[] = [];
  static handler: ((message: { id: number; kind: string }, worker: FakeWorker) => void) | null =
    null;

  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  posted: PostedMessage[] = [];
  terminated = false;

  constructor(
    public url: URL,
    public options: unknown,
  ) {
    FakeWorker.instances.push(this);
  }

  postMessage(message: { id: number; kind: string }, transfer: Transferable[] = []): void {
    this.posted.push({ message, transfer });
    FakeWorker.handler?.(message, this);
  }

  terminate(): void {
    this.terminated = true;
  }
}

/** 装一个假线程：只实现客户端真正用到的那几个成员 */
function installFakeWorker(
  handler: (message: { id: number; kind: string }, worker: FakeWorker) => void,
): FakeWorker {
  FakeWorker.instances = [];
  FakeWorker.handler = handler;
  vi.stubGlobal('Worker', FakeWorker);
  // 线程是懒创建的：这个代理始终指向"被测代码刚建出来的那一个"
  return new Proxy({} as FakeWorker, {
    get: (_target, key) => {
      const current = FakeWorker.instances[0];
      if (!current) return undefined;
      const value = Reflect.get(current, key, current) as unknown;
      return typeof value === 'function' ? (value as () => unknown).bind(current) : value;
    },
  });
}
