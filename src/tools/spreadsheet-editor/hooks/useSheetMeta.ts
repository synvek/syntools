import { useCallback, useRef, useState } from 'react';
import { columnIndexToName } from '../core';
import { sanitizeNamedRanges, type NamedRange } from '../namedRanges';
import { resolveUsedRange } from '../print';
import {
  createPasswordHash,
  protectionFor,
  setProtection,
  type SheetProtectionFlags,
  type SheetProtectionState,
} from '../sheetProtection';
import {
  createTableFromSelection,
  takenNames,
  tablesInRange,
  type SheetTable,
} from '../sheetTables';
import type { WorkbookSnapshot } from '../xlsx-io';

/**
 * 工作簿元数据（P2-4 第 7 片）：名称 / 保护 / 表格。
 *
 * 这三样有同一个性质：**都在快照里，但都不是 Univer 的 mutation**。所以：
 *
 * 1. 每次真实改动都要显式请求落盘（`onCommit`），否则脏标记永远看不到它们；
 * 2. 改动要同时写 ref 与 state——快照合成（`sheetObjects.ts`）读 ref，界面读 state；
 * 3. 删表时要连带清理挂在那张表上的条目（`pruneSheet`），否则导出会指向不存在的表。
 *
 * 保护的额外一条：开启 = 把整个工作簿切只读（Univer 只有工作簿级 editable 权限，没有表级），
 * 这条判断留在组件里（它依赖"当前活动表"，属于视图状态），hook 只负责数据与哈希。
 */

/** 本 hook 真正会调的引擎能力 */
export interface MetaEngine {
  getActiveSheetId(): string | null;
  getActiveRange(): {
    startRow: number;
    startColumn: number;
    endRow: number;
    endColumn: number;
  } | null;
  getSnapshot(): WorkbookSnapshot;
}

export interface UseSheetMetaOptions {
  handleRef: { current: MetaEngine | null };
  /** 元数据不是 Univer mutation：改动后显式落盘 */
  onCommit: () => void;
  /** 表格相关的两句提示（已翻译） */
  messages: { tableNeedsRows: string; tableNotFound: string };
}

export interface SheetMetaApi {
  namedRanges: NamedRange[];
  namedRangesRef: { current: NamedRange[] };
  updateNames: (next: NamedRange[]) => void;
  namesOpen: boolean;
  /** 打开名称面板时的选区（`A1:B2`），供"用选区填入"使用 */
  selectionLabel: string | null;
  openNames: () => void;
  closeNames: () => void;

  tables: SheetTable[];
  tablesRef: { current: SheetTable[] };
  tableNotice: string | null;
  insertTable: () => void;
  deleteTable: () => void;

  protection: SheetProtectionState[];
  protectionRef: { current: SheetProtectionState[] };
  protectOpen: boolean;
  protectBusy: boolean;
  openProtect: () => void;
  closeProtect: () => void;
  applyProtection: (input: {
    enabled: boolean;
    flags: SheetProtectionFlags;
    password: string;
  }) => Promise<void>;

  /** 删表后清理挂在该表上的名称 / 保护 / 表格 */
  pruneSheet: (sheetId: string) => void;
  /** 实例重建：只采纳第一次（重建拿到的原始快照里没有这些字段） */
  adoptOnce: (next: MetaAdoption) => boolean;
  /** 换文档：无条件替换 */
  reset: (next: MetaAdoption) => void;
}

export interface MetaAdoption {
  namedRanges: NamedRange[];
  protection: SheetProtectionState[];
  tables: SheetTable[];
}

export function useSheetMeta({ handleRef, onCommit, messages }: UseSheetMetaOptions): SheetMetaApi {
  const [namedRanges, setNamedRanges] = useState<NamedRange[]>([]);
  const namedRangesRef = useRef<NamedRange[]>([]);
  const [namesOpen, setNamesOpen] = useState(false);
  const [selectionLabel, setSelectionLabel] = useState<string | null>(null);

  const [tables, setTables] = useState<SheetTable[]>([]);
  const tablesRef = useRef<SheetTable[]>([]);
  const [tableNotice, setTableNotice] = useState<string | null>(null);

  const [protection, setProtectionList] = useState<SheetProtectionState[]>([]);
  const protectionRef = useRef<SheetProtectionState[]>([]);
  const [protectOpen, setProtectOpen] = useState(false);
  const [protectBusy, setProtectBusy] = useState(false);

  /** 已采纳过一次快照：之后的实例重建不再覆盖（与批注同一条规则） */
  const adoptedRef = useRef(false);
  /** 用户已经改过这些元数据：本地值才是准的，之后的"首次采纳"不能再拿旧快照盖回去 */
  const editedRef = useRef(false);

  const latest = useRef({ onCommit, messages });
  latest.current = { onCommit, messages };

  const updateNames = useCallback((next: NamedRange[]) => {
    editedRef.current = true;
    namedRangesRef.current = next;
    setNamedRanges(next);
    latest.current.onCommit();
  }, []);

  /** 关面板时把"半成品"名称清掉：空名或引用识别不了的行导出后就是坏文件 */
  const closeNames = useCallback(() => {
    const cleaned = sanitizeNamedRanges(namedRangesRef.current);
    if (cleaned.length !== namedRangesRef.current.length) updateNames(cleaned);
    setNamesOpen(false);
  }, [updateNames]);

  /**
   * 打开名称管理器：顺手把当前选区记成 `A1:B2`，供"用选区填入"按钮使用。
   * 只在打开那一刻取一次 —— 面板是模态的，背后的选区不会变。
   */
  const openNames = useCallback(() => {
    const range = handleRef.current?.getActiveRange();
    if (!range) {
      setSelectionLabel(null);
    } else {
      const from = `${columnIndexToName(range.startColumn)}${range.startRow + 1}`;
      const to = `${columnIndexToName(range.endColumn)}${range.endRow + 1}`;
      setSelectionLabel(from === to ? from : `${from}:${to}`);
    }
    setNamesOpen(true);
  }, [handleRef]);

  /**
   * 保护开关：密码只在开启那一刻算一次哈希，之后从快照原样导出（导出结果才是可复现的）。
   * "切只读"由组件按活动表决定（见头注释）。
   */
  const applyProtection = useCallback(
    async (input: { enabled: boolean; flags: SheetProtectionFlags; password: string }) => {
      const sheetId = handleRef.current?.getActiveSheetId();
      if (!sheetId) return;
      setProtectBusy(true);
      editedRef.current = true;
      try {
        if (!input.enabled) {
          const next = setProtection(protectionRef.current, sheetId, null);
          protectionRef.current = next;
          setProtectionList(next);
          latest.current.onCommit();
          setProtectOpen(false);
          return;
        }
        const hash = await createPasswordHash(input.password);
        const previous = protectionFor(protectionRef.current, sheetId);
        // 保留已有密码：只是改"允许的操作"时不该把密码丢掉
        const password = hash ?? previous?.password;
        const next = setProtection(protectionRef.current, sheetId, {
          sheetId,
          enabled: true,
          flags: input.flags,
          ...(password ? { password } : {}),
        });
        protectionRef.current = next;
        setProtectionList(next);
        latest.current.onCommit();
        setProtectOpen(false);
      } finally {
        setProtectBusy(false);
      }
    },
    [handleRef],
  );

  const openProtect = useCallback(() => setProtectOpen(true), []);
  const closeProtect = useCallback(() => setProtectOpen(false), []);

  const setTableList = useCallback((next: SheetTable[]) => {
    editedRef.current = true;
    tablesRef.current = next;
    setTables(next);
    latest.current.onCommit();
  }, []);

  /**
   * 插入表格：把当前选区（太窄时退回已用区域）变成一张原生表格。
   * 表头取区域首行的文字，列名重复/为空自动兜底；表名与名称管理器共享命名空间。
   */
  const insertTable = useCallback(() => {
    const handle = handleRef.current;
    const sheetId = handle?.getActiveSheetId();
    if (!handle || !sheetId) return;
    // 受保护的表不建表格：保护的意义就是"不能改结构"
    if (protectionFor(protectionRef.current, sheetId)) return;
    const snapshot = handle.getSnapshot();
    const active = handle.getActiveRange();
    const sheetSnapshot = snapshot.sheets[sheetId];
    const used = sheetSnapshot ? resolveUsedRange(sheetSnapshot) : null;
    const range = active && active.endRow > active.startRow ? active : used;
    if (!range) return;
    const table = createTableFromSelection(
      snapshot,
      sheetId,
      range,
      takenNames({
        ...snapshot,
        syntoolsTables: tablesRef.current,
        namedRanges: namedRangesRef.current,
      }),
    );
    if (!table) {
      setTableNotice(latest.current.messages.tableNeedsRows);
      return;
    }
    setTableNotice(null);
    setTableList([...tablesRef.current, table]);
  }, [handleRef, setTableList]);

  /** 删除与当前选区相交的表格（整块删除，不做"缩表"） */
  const deleteTable = useCallback(() => {
    const handle = handleRef.current;
    const sheetId = handle?.getActiveSheetId();
    const range = handle?.getActiveRange();
    if (!handle || !sheetId || !range) return;
    if (protectionFor(protectionRef.current, sheetId)) return;
    const hits = tablesInRange(tablesRef.current, sheetId, range);
    if (hits.length === 0) {
      setTableNotice(latest.current.messages.tableNotFound);
      return;
    }
    setTableNotice(null);
    const ids = new Set(hits.map((table) => table.id));
    setTableList(tablesRef.current.filter((table) => !ids.has(table.id)));
  }, [handleRef, setTableList]);

  /**
   * 删表清理：保护 / 名称 / 表格都带 `sheetId`，留着会让导出指向一张不存在的表。
   * 三个分支各自判断"有没有"，避免为一次删表写入三次相同的空改动。
   */
  const pruneSheet = useCallback((sheetId: string) => {
    editedRef.current = true;
    if (protectionRef.current.some((item) => item.sheetId === sheetId)) {
      const next = protectionRef.current.filter((item) => item.sheetId !== sheetId);
      protectionRef.current = next;
      setProtectionList(next);
    }
    if (namedRangesRef.current.some((item) => item.sheetId === sheetId)) {
      const next = namedRangesRef.current.filter((item) => item.sheetId !== sheetId);
      namedRangesRef.current = next;
      setNamedRanges(next);
    }
    if (tablesRef.current.some((item) => item.sheetId === sheetId)) {
      const next = tablesRef.current.filter((item) => item.sheetId !== sheetId);
      tablesRef.current = next;
      setTables(next);
    }
  }, []);

  const adopt = useCallback((next: MetaAdoption) => {
    namedRangesRef.current = next.namedRanges;
    setNamedRanges(next.namedRanges);
    protectionRef.current = next.protection;
    setProtectionList(next.protection);
    tablesRef.current = next.tables;
    setTables(next.tables);
  }, []);

  const adoptOnce = useCallback(
    (next: MetaAdoption): boolean => {
      // 已经采纳过，或用户先改了本地值：都不能再用旧快照覆盖
      if (adoptedRef.current || editedRef.current) return false;
      adoptedRef.current = true;
      adopt(next);
      return true;
    },
    [adopt],
  );

  const reset = useCallback(
    (next: MetaAdoption) => {
      adoptedRef.current = true;
      setTableNotice(null);
      adopt(next);
    },
    [adopt],
  );

  return {
    namedRanges,
    namedRangesRef,
    updateNames,
    namesOpen,
    selectionLabel,
    openNames,
    closeNames,
    tables,
    tablesRef,
    tableNotice,
    insertTable,
    deleteTable,
    protection,
    protectionRef,
    protectOpen,
    protectBusy,
    openProtect,
    closeProtect,
    applyProtection,
    pruneSheet,
    adoptOnce,
    reset,
  };
}
