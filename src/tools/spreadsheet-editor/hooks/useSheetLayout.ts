import { useCallback, useEffect, useRef, useState } from 'react';
import { buildSheetLayout, type SheetLayout } from '../shapes';

/**
 * 形状 / 图片的锚点换算表（技术债 #7）。
 *
 * 以前这块是 `useMemo` + `void shapeLayoutVersion`：读引擎快照本身是个**副作用**，却被藏在
 * memo 体里，只能靠一个"除了当依赖什么都不做"的计数器把它重新触发一次。这样写有三个后果：
 *
 * 1. **看不出谁会让布局失效**——依赖数组里那串 `void` 就是唯一的线索，而它长得像笔误；
 * 2. **没法测**——逻辑长在 1,400 行组件的渲染期里，只能靠"形状画歪了"发现；
 * 3. **渲染期读快照**——每次版本号变化都在 render 里克隆一份工作簿，成本随表格变大而涨。
 *
 * 现在改成显式状态：布局由 `refresh()` 主动重算，调用方是那些**真的可能改列宽 / 行高**的时机
 * （实例就绪、单元格变更、换工作表、换文档）。`sheetId` 变化由 hook 自己兜住——换表是最高频的
 * 一种，让每个调用点都记得写一遍只会多一个漏掉的地方。
 *
 * 参数用"读函数"而不是引擎句柄：布局来源（`getSnapshot()`）在 `univer.ts` 里，一加载就摸 canvas，
 * jsdom 进不来；注入之后这个 hook 才能直接测"读了几次 / 读到的是哪张表"。
 */
export interface SheetLayoutController {
  layout: SheetLayout;
  /** Re-read the layout source. Call it wherever column widths / row heights may have changed */
  refresh: () => void;
}

export function useSheetLayout(
  read: () => SheetLayout,
  sheetId: string | null,
): SheetLayoutController {
  // 读函数每次渲染都是新闭包（它可能闭包了最新 state），但 `refresh` 必须稳定：
  // 它会被塞进订阅回调，每次渲染换一个引用等于反复重订阅。
  const readRef = useRef(read);
  readRef.current = read;

  const [layout, setLayout] = useState<SheetLayout>(() => buildSheetLayout(undefined));
  const refresh = useCallback(() => setLayout(readRef.current()), []);

  // 换表 / 首次挂载：活动表整份换掉，列宽行高与上一张无关
  useEffect(() => {
    refresh();
  }, [refresh, sheetId]);

  return { layout, refresh };
}
