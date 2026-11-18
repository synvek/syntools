/**
 * 主线程侧的 worker 客户端（P2-1）。
 *
 * 设计原则与照片编辑器的 `render/bakeQueue.ts` 一致：**同步路径永远是正确的那条，worker 只是加速**。
 * 于是这里的公开函数没有"抛错"这条路——要么回 `ok`，要么回 `unavailable` 让调用方走同步实现。
 * 唯一的例外是业务失败（`failed`）：那是文件本身的问题，换线程重跑也一样，重跑只会让用户多等一遍。
 *
 * 生命周期：
 * - 懒创建，第一次导入 / 导出才起线程；没进过表格工具的用户不会多发一个 worker 请求。
 * - 一次失败即报废（`Worker` 构造不出来、`onerror`、超时、回包形态不对）→ `terminate` 并记住
 *   `workerBroken`。在坏环境里反复起线程只会把"卡一下"变成"卡很多下"。
 * - 单条线程串行处理：没有并发上限，因为同一时刻本来最多一个导入或一个导出。
 */
import type { FidelityIssue } from '@/core/fidelity';
import type { SheetIssue } from './issues';
import {
  SHEET_WORKER_NAME,
  SHEET_WORKER_TIMEOUT_MS,
  type SheetWorkerRequest,
  type SheetWorkerResponse,
} from './sheetWorkerProtocol';
import type { WorkbookSnapshot } from './xlsx-io';

export type SheetImportOffload =
  | { status: 'ok'; snapshot: WorkbookSnapshot; issues: FidelityIssue[]; notices: SheetIssue[] }
  | { status: 'failed'; error: string }
  | { status: 'unavailable' };

export type SheetExportOffload =
  | { status: 'ok'; bytes: Uint8Array }
  | { status: 'failed'; error: string }
  | { status: 'unavailable' };

export type SheetCsvOffload =
  { status: 'ok'; text: string } | { status: 'failed'; error: string } | { status: 'unavailable' };

interface PendingTask {
  resolve: (response: SheetWorkerResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let worker: Worker | null = null;
let workerBroken = false;
let sequence = 0;
const pending = new Map<number, PendingTask>();

/** 丢掉所有在途任务：线程已经不可信，让每个等待者立刻走同步路径，而不是等到超时 */
function rejectPending(reason: string): void {
  for (const task of pending.values()) {
    clearTimeout(task.timer);
    task.reject(new Error(reason));
  }
  pending.clear();
}

function markBroken(): void {
  workerBroken = true;
  const current = worker;
  worker = null;
  current?.terminate();
  rejectPending('sheet worker stopped');
}

function ensureWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  // jsdom / SSR / 极老的浏览器：没有线程可用，直接认了（这条判断也让单测不必打桩全局 Worker）
  if (typeof Worker === 'undefined') {
    workerBroken = true;
    return null;
  }
  try {
    const instance = new Worker(new URL('./workers/sheet.worker.ts', import.meta.url), {
      type: 'module',
      name: SHEET_WORKER_NAME,
    });
    instance.onmessage = (event: MessageEvent<SheetWorkerResponse>) => {
      const id = event.data?.id;
      const task = id === undefined ? undefined : pending.get(id);
      if (!task || id === undefined) return;
      pending.delete(id);
      clearTimeout(task.timer);
      task.resolve(event.data);
    };
    instance.onerror = () => markBroken();
    instance.onmessageerror = () => markBroken();
    worker = instance;
    return instance;
  } catch {
    workerBroken = true;
    worker = null;
    return null;
  }
}

function post(request: SheetWorkerRequest, transfer: Transferable[]): Promise<SheetWorkerResponse> {
  const instance = ensureWorker();
  if (!instance) return Promise.reject(new Error('sheet worker unavailable'));
  return new Promise<SheetWorkerResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(request.id);
      reject(new Error('sheet worker timeout'));
      // 不回话的线程留着没用，还会占住内存；后续任务一律走同步路径
      markBroken();
    }, SHEET_WORKER_TIMEOUT_MS);
    pending.set(request.id, { resolve, reject, timer });
    try {
      instance.postMessage(request, transfer);
    } catch (error) {
      pending.delete(request.id);
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error('sheet worker post failed'));
    }
  });
}

/**
 * 导入 .xlsx：把字节移交给 worker，返回带保真问题与降级提示的快照。
 * `unavailable` = 没用上 worker（调用方必须自己跑同步实现）；`failed` = 文件本身读不了。
 */
export async function importXlsxInWorker(file: File): Promise<SheetImportOffload> {
  if (!ensureWorker()) return { status: 'unavailable' };
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    // 连字节都读不出来不在这一层下结论：交给同步实现去复现同一个失败原因
    return { status: 'unavailable' };
  }
  try {
    const response = await post(
      { id: (sequence += 1), kind: 'importXlsx', name: file.name, buffer },
      [buffer],
    );
    if (response.status === 'crashed') {
      markBroken();
      return { status: 'unavailable' };
    }
    if (response.status === 'failed') return { status: 'failed', error: response.error };
    if (response.task.kind !== 'importXlsx') {
      markBroken();
      return { status: 'unavailable' };
    }
    return {
      status: 'ok',
      snapshot: response.task.snapshot,
      issues: response.task.issues,
      notices: response.task.notices,
    };
  } catch {
    markBroken();
    return { status: 'unavailable' };
  }
}

/** 导出 .xlsx：快照进 worker，写出字节后零拷贝搬回来 */
export async function exportSnapshotInWorker(
  snapshot: WorkbookSnapshot,
): Promise<SheetExportOffload> {
  if (!ensureWorker()) return { status: 'unavailable' };
  try {
    const response = await post({ id: (sequence += 1), kind: 'exportXlsx', snapshot }, []);
    if (response.status === 'crashed') {
      markBroken();
      return { status: 'unavailable' };
    }
    if (response.status === 'failed') return { status: 'failed', error: response.error };
    if (response.task.kind !== 'exportXlsx') {
      markBroken();
      return { status: 'unavailable' };
    }
    return { status: 'ok', bytes: new Uint8Array(response.task.bytes) };
  } catch {
    markBroken();
    return { status: 'unavailable' };
  }
}

/**
 * 导出 CSV：整表拼字符串进 worker，回传纯文本。
 *
 * 之所以连这件"只是拼字符串"的活也搬走：十万行的表在主线程上拼完要几百毫秒，
 * 期间页面完全不动（滚动、光标都停住）。快照本身要结构化克隆一份，但那是指针搬运，
 * 与"逐格转义 + 拼大串"不是同一个量级。
 */
export async function exportCsvInWorker(
  snapshot: WorkbookSnapshot,
  sheetId: string | null,
): Promise<SheetCsvOffload> {
  if (!ensureWorker()) return { status: 'unavailable' };
  try {
    const response = await post({ id: (sequence += 1), kind: 'exportCsv', snapshot, sheetId }, []);
    if (response.status === 'crashed') {
      markBroken();
      return { status: 'unavailable' };
    }
    if (response.status === 'failed') return { status: 'failed', error: response.error };
    if (response.task.kind !== 'exportCsv') {
      markBroken();
      return { status: 'unavailable' };
    }
    return { status: 'ok', text: response.task.text };
  } catch {
    markBroken();
    return { status: 'unavailable' };
  }
}

/** 诊断用：这条会话里 worker 是否已被判定不可用（UI / e2e 可读） */
export function isSheetWorkerUnavailable(): boolean {
  return workerBroken;
}

/** 测试与"重试"入口：忘掉已判定的不可用与在途任务 */
export function resetSheetWorker(): void {
  rejectPending('sheet worker reset');
  const current = worker;
  worker = null;
  workerBroken = false;
  sequence = 0;
  current?.terminate();
}
