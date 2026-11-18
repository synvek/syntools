/**
 * 主线程 ↔ sheet worker 的消息协议（改进方案 P2-1）。
 *
 * 为什么要协议独立成文件：worker 入口、任务分发、主线程客户端、单测四方都要说同一种语言，
 * 而其中只有 "任务分发" 允许依赖 exceljs 所在的 `xlsx-io`（而且是动态 import）。协议里只放
 * 数据形状与常量，任何一边改动都会立刻变成 `tsc` 报错，而不是运行时字段缺失。
 *
 * 三个刻意的约定：
 * 1. **导入只传 `ArrayBuffer`**：`File` 虽然可以结构化克隆，但克隆会复制整份字节；用 transfer
 *    移交则零拷贝，worker 侧再 `new File([buffer], name)` 还原（`checkImportFile` 只认 name/size）。
 * 2. **导出回传 `ArrayBuffer` 而不是 `Uint8Array`**：视图对象跨线程只做结构化克隆（复制），
 *    其底层 buffer 无法单独 transfer；回传 buffer 才能零拷贝，主线程再包成视图。
 * 3. **三种状态分开**：`ok` / `failed`（业务错误码，重跑一次也一样）/ `crashed`（worker 自身
 *    出问题，主线程退回同步路径还有救）。把 `crashed` 混进 `failed` 会让用户看到错误码，
 *    而实际上主线程本来能成功。
 */
import type { FidelityIssue } from '@/core/fidelity';
import type { SheetIssue } from './issues';
import type { WorkbookSnapshot } from './xlsx-io';

/** Worker 名（devtools 里能看到，便于确认这一帧到底是哪条线程卡住） */
export const SHEET_WORKER_NAME = 'syntools-sheet-io';

/**
 * 单个任务的上限。10MB 的 xlsx 在低端机上解析可能十几秒，所以给得比较宽；
 * 超时的含义是"这条线程已经不回话了"，此时再用它只会让用户等更久。
 */
export const SHEET_WORKER_TIMEOUT_MS = 60_000;

export type SheetWorkerRequest =
  | { id: number; kind: 'importXlsx'; name: string; buffer: ArrayBuffer }
  | { id: number; kind: 'exportXlsx'; snapshot: WorkbookSnapshot }
  /**
   * CSV 也走线程（P2-1 收尾）：`snapshotToCsv` 要把整个工作表拼成一个字符串，
   * 十万行的表在主线程上就是一次可见的卡顿。`sheetId` 为 null 时由实现挑第一张非空表。
   */
  | { id: number; kind: 'exportCsv'; snapshot: WorkbookSnapshot; sheetId: string | null };

/**
 * 成功载荷。`issues` 是导入侧保真报告（P0-4）的原始素材，`notices` 是 worker 内
 * `reportSheetIssue` 播报过的降级提示——worker 有自己的一份模块状态，不显式带回来，
 * 主线程就永远收不到（例如"原生图表部件读不出来"）。
 */
export type SheetWorkerSuccess =
  | {
      kind: 'importXlsx';
      snapshot: WorkbookSnapshot;
      issues: FidelityIssue[];
      notices: SheetIssue[];
    }
  | { kind: 'exportXlsx'; bytes: ArrayBuffer }
  /** CSV 是纯文本：结构化克隆一份字符串，比任何 transfer 都简单 */
  | { kind: 'exportCsv'; text: string };

export type SheetWorkerResponse =
  /** 业务层面完成（`snapshot` / `bytes` 二选一，看 `kind`） */
  | { id: number; status: 'ok'; task: SheetWorkerSuccess }
  /** 业务层面失败：容器不是 xlsx、部件读不出来…… 换条线程也是同一个结果 */
  | { id: number; status: 'failed'; error: string }
  /** worker 自身出错（构造 File 失败、内存不足……）：主线程应退回同步路径再试一次 */
  | { id: number; status: 'crashed'; detail: string };
