import { useCallback, useRef, useState } from 'react';
import { buildChartData, chartDataSheetId, type ChartConfig, type ChartData } from '../charts';
import { summarizeImport, type ChartImportReport } from '../chartImport';
import type { RawChartParts } from '../rawChartParts';
import type { WorkbookSnapshotLite } from '../core';

/**
 * 浮动图表（P2-4 第 5 片）。
 *
 * 图表是本工具自有内容，不在 Univer 的单元格里：
 *
 * - 任何改动都**不是** mutation，脏标记看不到它，必须显式请求落盘（`onCommit`）；
 * - 快照合并走 `sheetObjects.ts`，所以这里必须持有一份与 state 同源的 `chartsRef`；
 * - 派生数据（`dataMap`）只是渲染用的缓存：单元格一改就整体重算，算不出来给 `null`，
 *   让浮层显示"数据无效"而不是画一张空图。
 *
 * 采纳规则与批注不同、故意如此：批注用"只采纳第一次"，图表用"列表为空才采纳"。原因是图表的
 * 重建路径（StrictMode 的第二挂载、换主题/语言）拿到的是原始 Univer 快照，**里面根本没有图表**；
 * 只要有图表就说明它来自草稿，不能被覆盖。换文档走 `reset`，无条件替换。
 */

/** 本 hook 真正会调的引擎能力 */
export interface ChartEngine {
  getSnapshot(): WorkbookSnapshotLite;
  getActiveSheetId(): string | null;
  getActiveRange(): {
    startRow: number;
    startColumn: number;
    endRow: number;
    endColumn: number;
  } | null;
}

export interface UseSheetChartsOptions {
  handleRef: { current: ChartEngine | null };
  /** 表格区域尺寸：新图表的默认大小按它算，避免一插入就超出可视区 */
  bounds: { width: number; height: number };
  /** 图表改动不产生 Univer mutation：必须显式落盘 */
  onCommit: () => void;
}

export interface SheetChartsApi {
  charts: ChartConfig[];
  chartsRef: { current: ChartConfig[] };
  /** 派生数据（每个图表一份），渲染与打印共用 */
  dataMap: Record<string, ChartData | null>;
  selectedId: string | null;
  /** 选区为空 / 数据不足时的提示（"请先选中包含数据的区域"） */
  notice: boolean;
  /** 导入文件里的图表统计（可编辑 / 原样保留） */
  importReport: ChartImportReport | null;
  select: (id: string | null) => void;
  insert: () => void;
  update: (id: string, patch: Partial<ChartConfig>) => void;
  remove: (id: string) => void;
  /** 把图表的数据区域指向当前选区 */
  pickRange: (id: string) => void;
  /** 单元格改动后重算全部图表的派生数据 */
  applyData: (snapshot: WorkbookSnapshotLite, sheetId: string | null) => void;
  /** 实例重建：列表为空才采纳，别把用户刚插的图抹掉 */
  adoptIfEmpty: (configs: ChartConfig[], rawParts?: RawChartParts | null) => boolean;
  /** 换文档：无条件替换 */
  reset: (configs: ChartConfig[], rawParts?: RawChartParts | null) => void;
}

export function useSheetCharts({
  handleRef,
  bounds,
  onCommit,
}: UseSheetChartsOptions): SheetChartsApi {
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const chartsRef = useRef<ChartConfig[]>([]);
  const [dataMap, setDataMap] = useState<Record<string, ChartData | null>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  const [importReport, setImportReport] = useState<ChartImportReport | null>(null);
  const seqRef = useRef(0);

  const latest = useRef({ bounds, onCommit });
  latest.current = { bounds, onCommit };

  const setList = useCallback((next: ChartConfig[]) => {
    chartsRef.current = next;
    setCharts(next);
  }, []);

  /** 重算派生数据；没有图表时清空，避免留下上一份文档的数据 */
  const applyData = useCallback((snapshot: WorkbookSnapshotLite, sheetId: string | null) => {
    const configs = chartsRef.current;
    if (configs.length === 0) {
      setDataMap({});
      return;
    }
    const next: Record<string, ChartData | null> = {};
    for (const config of configs) {
      // 跨表图表（导入的 `ChartData!` 引用）读的是 `dataSheetId`，不是图表所在的表
      const result = buildChartData(
        snapshot,
        chartDataSheetId(config, sheetId),
        config.range,
        config.type,
      );
      next[config.id] = result.ok ? result.value : null;
    }
    setDataMap(next);
  }, []);

  /** 插入一张浮动图表：数据取自当前选区，位置按已有数量错开，避免全部叠在一起 */
  const insert = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const range = handle.getActiveRange();
    if (!range) {
      setNotice(true);
      return;
    }
    const sheetId = handle.getActiveSheetId();
    const result = buildChartData(handle.getSnapshot(), sheetId, range, 'bar');
    if (!result.ok) {
      setNotice(true);
      return;
    }
    setNotice(false);
    seqRef.current += 1;
    const offset = (chartsRef.current.length % 5) * 24;
    const { width, height } = latest.current.bounds;
    const config: ChartConfig = {
      id: `chart-${Date.now().toString(36)}-${seqRef.current}`,
      type: 'bar',
      range,
      sheetId: sheetId ?? undefined,
      x: 24 + offset,
      y: 24 + offset,
      width: Math.max(260, Math.min(420, (width || 460) - 48)),
      height: Math.max(200, Math.min(280, (height || 320) - 48)),
    };
    setList([...chartsRef.current, config]);
    setSelectedId(config.id);
    setDataMap((prev) => ({ ...prev, [config.id]: result.value }));
    latest.current.onCommit();
  }, [handleRef, setList]);

  /** 改配置；数据区域变了就立刻重算，而不是等下一次单元格编辑 */
  const update = useCallback(
    (id: string, patch: Partial<ChartConfig>) => {
      setList(chartsRef.current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
      if (patch.range) {
        const handle = handleRef.current;
        if (handle) applyData(handle.getSnapshot(), handle.getActiveSheetId());
      }
      latest.current.onCommit();
    },
    [applyData, handleRef, setList],
  );

  const remove = useCallback(
    (id: string) => {
      setList(chartsRef.current.filter((item) => item.id !== id));
      setSelectedId((prev) => (prev === id ? null : prev));
      // 派生数据跟着走，否则重新插入同名 id 时会先闪一帧旧数据
      setDataMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      latest.current.onCommit();
    },
    [setList],
  );

  const pickRange = useCallback(
    (id: string) => {
      const handle = handleRef.current;
      if (!handle) return;
      const range = handle.getActiveRange();
      if (!range) {
        setNotice(true);
        return;
      }
      setNotice(false);
      update(id, { range, sheetId: handle.getActiveSheetId() ?? undefined });
    },
    [handleRef, update],
  );

  const select = useCallback((id: string | null) => setSelectedId(id), []);

  const adopt = useCallback((configs: ChartConfig[], rawParts?: RawChartParts | null) => {
    chartsRef.current = configs;
    setCharts(configs);
    setSelectedId(configs[0]?.id ?? null);
    // 导入提示：能转成可编辑配置的 + 只能原样保留的（两者都为 0 时为 null，不显示）
    setImportReport(summarizeImport(configs, rawParts?.parts));
  }, []);

  const adoptIfEmpty = useCallback(
    (configs: ChartConfig[], rawParts?: RawChartParts | null): boolean => {
      // 已经有图表 = 来自草稿（用户的东西）：重建拿到的原始快照不能覆盖它
      if (chartsRef.current.length > 0) return false;
      adopt(configs, rawParts);
      return true;
    },
    [adopt],
  );

  const reset = useCallback(
    (configs: ChartConfig[], rawParts?: RawChartParts | null) => {
      setNotice(false);
      adopt(configs, rawParts);
    },
    [adopt],
  );

  return {
    charts,
    chartsRef,
    dataMap,
    selectedId,
    notice,
    importReport,
    select,
    insert,
    update,
    remove,
    pickRange,
    applyData,
    adoptIfEmpty,
    reset,
  };
}
