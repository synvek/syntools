/**
 * Worker 侧的任务分发（P2-1）。这个模块**只允许在 worker 里跑**，也是唯一让 exceljs 进 worker 的门。
 *
 * 为什么不在 worker 里再走一遍 `importXlsxToSnapshot` / `exportSnapshotToBytes`：那两个公开函数
 * 现在会先尝试把活派给 worker。worker 调它们等于自己给自己派活（嵌套线程），所以内部实现被拆成
 * `importXlsxInThread` / `exportSnapshotInThread`，这里只调 in-thread 版本。这样"同一条代码路径
 * 两条线程复用"成立，行为差异只可能来自运行环境，不会来自两套实现。
 *
 * 依赖全部动态 import：`sheetWorkerTasks.ts` 会被单测直接 import（jsdom 里没有 Worker），
 * 静态 import exceljs 会让所有用例多背一份 1MB 的解析器。
 */
import type { FidelityIssue } from '@/core/fidelity';
import { subscribeSheetIssues, type SheetIssue } from './issues';
import type { SheetWorkerRequest, SheetWorkerResponse } from './sheetWorkerProtocol';
// 只取类型：`xlsx-io`（连同 exceljs）仍然只在真正执行任务时才被动态 import
import type { ImportFileLike } from './xlsx-io';

/**
 * `Uint8Array` → 可 transfer 的 `ArrayBuffer`。
 * 视图可能只覆盖 buffer 的一段（exceljs 的 writeBuffer 在几种实现下都会这样），
 * 直接 transfer 底层 buffer 会把别的数据一并搬走并在主线程留下错位的视图，所以不规整时复制一份。
 */
export function transferableBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }
  return bytes.slice().buffer;
}

export async function handleSheetWorkerRequest(
  request: SheetWorkerRequest,
): Promise<SheetWorkerResponse> {
  // worker 里的 `reportSheetIssue` 写进的是 worker 自己的模块状态，主线程订阅收不到。
  // 本条任务期间把它收集起来带回主线程重播，否则"图表部件读不出来"这类提示会静默消失。
  const notices: SheetIssue[] = [];
  const stopListening = subscribeSheetIssues((issue) => notices.push(issue));
  try {
    if (request.kind === 'importXlsx') {
      const { importXlsxInThread } = await import('./xlsx-io');
      // 不造 File：`importXlsxInThread` 只需要 name / size / arrayBuffer 三个成员，
      // 结构化对象在任何线程里都能用，而 File 在旧 worker 实现里并不保证有 arrayBuffer()
      const file: ImportFileLike = {
        name: request.name,
        size: request.buffer.byteLength,
        arrayBuffer: async () => request.buffer,
      };
      const outcome: { issues: FidelityIssue[] } = { issues: [] };
      const result = await importXlsxInThread(file, outcome);
      if (!result.ok) return { id: request.id, status: 'failed', error: result.error };
      return {
        id: request.id,
        status: 'ok',
        task: { kind: 'importXlsx', snapshot: result.value, issues: outcome.issues, notices },
      };
    }

    if (request.kind === 'exportCsv') {
      // `csv.ts` 是纯函数且不依赖 exceljs：单独 import 才不会为了导 CSV 把解析器也拉进来
      const { snapshotToCsv } = await import('./csv');
      const result = snapshotToCsv(request.snapshot, request.sheetId);
      if (!result.ok) return { id: request.id, status: 'failed', error: result.error };
      return {
        id: request.id,
        status: 'ok',
        task: { kind: 'exportCsv', text: result.value },
      };
    }

    const { exportSnapshotInThread } = await import('./xlsx-io');
    const result = await exportSnapshotInThread(request.snapshot);
    if (!result.ok) return { id: request.id, status: 'failed', error: result.error };
    return {
      id: request.id,
      status: 'ok',
      task: { kind: 'exportXlsx', bytes: transferableBuffer(result.value) },
    };
  } catch (error) {
    return {
      id: request.id,
      status: 'crashed',
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    stopListening();
  }
}
