import { useCallback, useRef, useState } from 'react';
import {
  computePivot,
  nextPivotId,
  pivotToMatrix,
  readPivotSource,
  removePivotConfig,
  upsertPivotConfig,
  type PivotBlock,
  type PivotConfig,
} from '../pivot';
import { uniqueSheetName } from '../pivotSheet';
import { resolveUsedRange } from '../print';
import type { SheetCellValue } from '../univer';
import type { WorkbookSnapshot } from '../xlsx-io';

/**
 * 透视表配置与写入（P2-4 第八片）。
 *
 * 透视表和其他工具自有内容一样：**配置在快照里，但它不是 Univer 的 mutation**。所以这里只做四类事：
 *
 * 1. 配置的生命周期（新建 / 切换 / 改布局 / 删除 / 清空）——每次真实改动都显式 `onCommit`；
 * 2. 面板状态（开合）与"面板看的那份源快照"——`openRef` 给外部订阅（源数据一改就重算）；
 * 3. 重建采纳 `adoptIfEmpty`（原始快照里没有透视，有内容就说明来自草稿）与换文档 `reset`；
 * 4. 「插入到文档」：首插建表并记下 `outputSheetId`，之后是**更新同一张表**。
 *
 * 视图派生（`readPivotSource` / `computePivot` 的结果、字段键表）与打印留在组件：
 * 它们由面板消费，且打印要复用文件进出那一套管线。
 */

/** 本 hook 真正会调的引擎能力 */
export interface PivotEngine {
  getSnapshot(): WorkbookSnapshot;
  getActiveSheetId(): string | null;
  getActiveRange(): {
    startRow: number;
    startColumn: number;
    endRow: number;
    endColumn: number;
  } | null;
  getSheets(): { id: string; name: string }[];
  setActiveSheet(id: string): void;
  writeSheetValues(
    sheetId: string,
    values: SheetCellValue[][],
    clear?: { rows: number; columns: number },
  ): boolean;
  insertSheetWithValues(name: string, values: SheetCellValue[][]): string | null;
}

export interface UseSheetPivotOptions {
  handleRef: { current: PivotEngine | null };
  /** 配置不是 Univer mutation：改动后显式落盘 */
  onCommit: () => void;
  /** 「插入到文档」会新建工作表：让标签栏刷新（用回调，避免 hook 依赖标签栏 hook） */
  onSheetsChanged: () => void;
  /** 目标表受保护时不许覆盖（保护的意义就是拦住写入） */
  isSheetProtected: (sheetId: string) => boolean;
  /** 值字段标签（占比 / 排名要带后缀），由组件注入翻译 */
  valueLabel: (block: PivotBlock) => string;
  /** 三句已翻译的文案 */
  messages: { title: string; blank: string; values: string };
}

export interface SheetPivotApi {
  configs: PivotConfig[];
  configsRef: { current: PivotConfig[] };
  /** 面板正在编辑的实例 */
  config: PivotConfig | null;
  /** 面板聚合用的源快照（打开时拍一张，源数据改动后由 `refresh` 重取） */
  snapshot: WorkbookSnapshot | null;
  open: boolean;
  /** 供外部订阅判断"面板开着才需要重算" */
  openRef: { current: boolean };
  openPanel: () => void;
  closePanel: () => void;
  applyConfig: (next: PivotConfig) => void;
  create: () => void;
  select: (id: string) => void;
  remove: (id: string) => void;
  /** 清除全部透视配置（面板底部的"删除透视表"） */
  removeAll: () => void;
  /** 用当前选区重置布局（字段偏移全部失效，所以布局复位但保留实例 id） */
  useSelection: () => void;
  refresh: () => void;
  insert: () => void;
  /** 实例重建：列表为空才采纳（重建快照里本来就没有透视） */
  adoptIfEmpty: (configs: PivotConfig[]) => void;
  /** 换文档：无条件替换，并清掉活动实例 / 关掉面板 */
  reset: (configs: PivotConfig[]) => void;
}

/** 一张表已经被写入的范围：更新透视表前要先按旧范围清空，否则换布局会留下上一版的尾巴 */
function usedBlock(
  sheet: WorkbookSnapshot['sheets'][string] | undefined,
): { rows: number; columns: number } | undefined {
  if (!sheet) return undefined;
  let rows = 0;
  let columns = 0;
  for (const [row, cells] of Object.entries(sheet.cellData ?? {})) {
    for (const column of Object.keys(cells ?? {})) {
      rows = Math.max(rows, Number(row) + 1);
      columns = Math.max(columns, Number(column) + 1);
    }
  }
  return rows > 0 && columns > 0 ? { rows, columns } : undefined;
}

export function useSheetPivot({
  handleRef,
  onCommit,
  onSheetsChanged,
  isSheetProtected,
  valueLabel,
  messages,
}: UseSheetPivotOptions): SheetPivotApi {
  const [configs, setConfigs] = useState<PivotConfig[]>([]);
  const configsRef = useRef<PivotConfig[]>([]);
  const [config, setConfig] = useState<PivotConfig | null>(null);
  const configRef = useRef<PivotConfig | null>(null);
  const [snapshot, setSnapshot] = useState<WorkbookSnapshot | null>(null);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  openRef.current = open;

  const latest = useRef({ onCommit, onSheetsChanged, isSheetProtected, valueLabel, messages });
  latest.current = { onCommit, onSheetsChanged, isSheetProtected, valueLabel, messages };

  /** 活动实例的读写都走 ref：回调里的 `config` 状态会有一帧滞后 */
  const setActive = useCallback((next: PivotConfig | null) => {
    configRef.current = next;
    setConfig(next);
  }, []);

  const writeConfigs = useCallback((next: PivotConfig[]) => {
    configsRef.current = next;
    setConfigs(next);
  }, []);

  /**
   * 从当前选区（单格时退回已用区域）生成初始配置。
   * 布局给一个能立刻看到结果的最小默认：第一个字段做行、最后一个字段做值。
   */
  const buildConfig = useCallback(
    (snap: WorkbookSnapshot, sheetId: string): PivotConfig => {
      const active = handleRef.current?.getActiveRange() ?? null;
      const sheet = snap.sheets[sheetId];
      const used = sheet ? resolveUsedRange(sheet) : null;
      const single =
        !!active && active.startRow === active.endRow && active.startColumn === active.endColumn;
      const range =
        active && !single
          ? active
          : (used ?? active ?? { startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 });
      const width = range.endColumn - range.startColumn + 1;
      return {
        id: 'pivot-1',
        name: latest.current.messages.title,
        sheetId,
        range: { ...range },
        // 默认给一个立刻能看懂的交叉表：第一列做行、第二列做列（够宽时）、最后一列求和
        rows: width > 1 ? [0] : [],
        cols: width > 2 ? [1] : [],
        values: width > 1 ? [{ column: width - 1, aggregation: 'sum' }] : [],
        filters: {},
        hasHeader: true,
      };
    },
    [handleRef],
  );

  /**
   * 打开面板：已有配置就沿用（用户上次摆好的行列不因为重开面板丢失），
   * 一张表多个透视时优先回到"这张表上的那个"，没有才新建一个实例。
   */
  const openPanel = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const snap = handle.getSnapshot();
    // 没有活动工作表就没有源数据：与图表一致，直接不进面板
    const sheetId = handle.getActiveSheetId() ?? snap.sheetOrder[0];
    if (!sheetId) return;
    const list = configsRef.current;
    const activeId = configRef.current?.id;
    const saved =
      list.find((item) => item.sheetId === sheetId && item.id === activeId) ??
      list.find((item) => item.sheetId === sheetId);
    const next = saved ?? { ...buildConfig(snap, sheetId), id: nextPivotId(list) };
    setActive(next);
    // 打开面板就把配置写进文档：否则"打开面板直接导出"会因为 ref 里没有配置而漏掉透视表工作表
    writeConfigs(upsertPivotConfig(list, next));
    latest.current.onCommit();
    setSnapshot(snap);
    openRef.current = true;
    setOpen(true);
  }, [buildConfig, handleRef, setActive, writeConfigs]);

  const closePanel = useCallback(() => {
    openRef.current = false;
    setOpen(false);
  }, []);

  /**
   * 配置是工具自有内容：写进 ref + 状态，并显式请求保存（与图表同一范式）。
   * 多实例下按 id 就地替换，不重置整个列表 —— 否则改第二个透视表会把第一个删掉。
   */
  const applyConfig = useCallback(
    (next: PivotConfig) => {
      setActive(next);
      writeConfigs(upsertPivotConfig(configsRef.current, next));
      latest.current.onCommit();
    },
    [setActive, writeConfigs],
  );

  /** 新建一个透视实例（同一张工作表可以有多张，各自独立的行列/筛选/值布局） */
  const create = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const snap = handle.getSnapshot();
    const sheetId = handle.getActiveSheetId() ?? snap.sheetOrder[0];
    if (!sheetId) return;
    const list = configsRef.current;
    const base = buildConfig(snap, sheetId);
    const next: PivotConfig = {
      ...base,
      id: nextPivotId(list),
      // 名字带序号，插入后生成的工作表名也就能一眼分清是哪一张
      name: list.length === 0 ? base.name : `${base.name} ${list.length + 1}`,
    };
    setActive(next);
    writeConfigs(upsertPivotConfig(list, next));
    latest.current.onCommit();
    setSnapshot(snap);
  }, [buildConfig, handleRef, setActive, writeConfigs]);

  /** 切换正在编辑的实例：源区域从当前文档重读（别的表上的数据可能刚改过） */
  const select = useCallback(
    (id: string) => {
      const target = configsRef.current.find((item) => item.id === id);
      if (!target) return;
      setActive(target);
      const handle = handleRef.current;
      if (handle) setSnapshot(handle.getSnapshot());
    },
    [handleRef, setActive],
  );

  /**
   * 删除实例。**不动**已经插入到文档里的结果表：那是文档里的一张真实工作表，
   * 删配置就等于同时删数据，用户不会预期这个行为。
   */
  const remove = useCallback(
    (id: string) => {
      const list = removePivotConfig(configsRef.current, id);
      writeConfigs(list);
      latest.current.onCommit();
      if (configRef.current?.id !== id) return;
      const next = list[0] ?? null;
      setActive(next);
      if (!next) closePanel();
    },
    [closePanel, setActive, writeConfigs],
  );

  /** 清除全部配置（面板底部的"删除透视表"）；已经插入到文档的工作表同样保留 */
  const removeAll = useCallback(() => {
    writeConfigs([]);
    setActive(null);
    closePanel();
    latest.current.onCommit();
  }, [closePanel, setActive, writeConfigs]);

  /**
   * 换源区域后旧的字段偏移不再有效：布局复位，避免把"第 3 列"当成"第 1 列"继续算；
   * 实例 id 保留，因为面板上还停在这个实例上。
   */
  const useSelection = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const snap = handle.getSnapshot();
    const sheetId = handle.getActiveSheetId() ?? snap.sheetOrder[0];
    if (!sheetId) return;
    applyConfig({ ...buildConfig(snap, sheetId), id: configRef.current?.id ?? 'pivot-1' });
    setSnapshot(snap);
  }, [applyConfig, buildConfig, handleRef]);

  const refresh = useCallback(() => {
    setSnapshot(handleRef.current?.getSnapshot() ?? null);
  }, [handleRef]);

  /**
   * 「插入到文档」：把透视结果落成一张真实工作表。
   *
   * 第一次插在末尾并记下 `outputSheetId`；之后再点就是**更新**同一张表
   * （先按旧范围清空再写）。导出会复用这张表，不再追加副本——
   * 否则用户点了插入再导出，文档里会出现两张透视表。
   *
   * 每次都从**当前**文档重算：面板可能停在旧快照上（源数据改过但没点刷新），
   * 插进去的数字必须是用户此刻看到的这份数据。
   */
  const insert = useCallback(() => {
    const handle = handleRef.current;
    const current = configRef.current;
    if (!handle || !current) return;
    const snap = handle.getSnapshot();
    const source = readPivotSource(snap, current);
    if (source.records.length === 0 || source.fields.length === 0) return;
    const result = computePivot(current, source);
    const { messages: copy, valueLabel: label } = latest.current;
    const matrix = pivotToMatrix(result, current, copy.blank, label, copy.values);
    if (matrix.length === 0 || result.rowKeys.length === 0) return;

    const sheets = handle.getSheets();
    const target = current.outputSheetId
      ? sheets.find((sheet) => sheet.id === current.outputSheetId)
      : undefined;

    if (target) {
      // 保护的意义就是拦住写入：目标表受保护时不要悄悄覆盖它
      if (latest.current.isSheetProtected(target.id)) return;
      handle.writeSheetValues(target.id, matrix, usedBlock(snap.sheets[target.id]));
      handle.setActiveSheet(target.id);
      setSnapshot(handle.getSnapshot());
    } else {
      const name = uniqueSheetName(
        sheets.map((sheet) => sheet.name),
        current.name,
        copy.title,
      );
      const id = handle.insertSheetWithValues(name, matrix);
      if (!id) return;
      // 记住这张表：下次点按钮是更新而不是再插一张
      applyConfig({ ...current, outputSheetId: id });
      handle.setActiveSheet(id);
      setSnapshot(handle.getSnapshot());
    }
    latest.current.onSheetsChanged();
    latest.current.onCommit();
  }, [applyConfig, handleRef]);

  /** 实例重建拿到的是原始快照（没有透视字段）：有内容就说明来自草稿，不能被覆盖 */
  const adoptIfEmpty = useCallback(
    (next: PivotConfig[]) => {
      if (configsRef.current.length > 0 || next.length === 0) return;
      writeConfigs(next);
    },
    [writeConfigs],
  );

  /**
   * 换文档：无条件替换配置，并清掉活动实例、关掉面板。
   * 不清活动实例的话，上一份文档的源区域会挂在新文档上，"插入到文档"会写错地方。
   */
  const reset = useCallback(
    (next: PivotConfig[]) => {
      writeConfigs(next);
      setActive(null);
      closePanel();
    },
    [closePanel, setActive, writeConfigs],
  );

  return {
    configs,
    configsRef,
    config,
    snapshot,
    open,
    openRef,
    openPanel,
    closePanel,
    applyConfig,
    create,
    select,
    remove,
    removeAll,
    useSelection,
    refresh,
    insert,
    adoptIfEmpty,
    reset,
  };
}
