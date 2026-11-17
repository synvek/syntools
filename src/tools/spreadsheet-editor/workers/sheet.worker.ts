/**
 * sheet worker 入口（P2-1）：只做一件事——收消息、交给 `handleSheetWorkerRequest`、带 transfer 回包。
 *
 * 这里刻意不写 `/// <reference lib="webworker" />`：项目 tsconfig 已经带 DOM lib，再引一份 webworker
 * 会让 `File` / `Blob` 等名字重复声明。所以 `self` 用结构化的最小接口描述，够用且不与 DOM 冲突。
 */
import { handleSheetWorkerRequest } from '../sheetWorkerTasks';
import type { SheetWorkerRequest } from '../sheetWorkerProtocol';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<SheetWorkerRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

scope.onmessage = (event: MessageEvent<SheetWorkerRequest>) => {
  void (async () => {
    const response = await handleSheetWorkerRequest(event.data);
    // 只有导出的字节值得 transfer；快照是普通对象，结构化克隆是唯一办法
    const transfer: Transferable[] =
      response.status === 'ok' && response.task.kind === 'exportXlsx' ? [response.task.bytes] : [];
    scope.postMessage(response, transfer);
  })();
};
