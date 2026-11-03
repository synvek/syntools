import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Ribbon } from '@/core/components/ribbon/Ribbon';
import { RIBBON_ICON_BUTTON } from '@/core/components/ribbon/ribbonTheme';
import { RibbonIcon } from '@/core/components/ribbon/ribbonIcons';
import type { EditorMenu } from '@/core/components/editorChrome';
import type { SheetFormatPatch, SheetFormatState } from './sheetFormat';
import {
  buildSheetRibbonTabs,
  type SheetCommandContext,
  type SheetRibbonContext,
  type SheetRibbonHost,
} from './commands';

/** Everything the ribbon needs except the two pieces of live state it owns (`host` / `format`) */
export type RibbonBaseContext = Omit<SheetCommandContext, 'host' | 'format'>;

export interface SpreadsheetRibbonProps {
  ctx: RibbonBaseContext;
  host: SheetRibbonHost | null;

  /** 文件 / 编辑 / 插入 / 视图 menus, rendered as icon dropdowns on the strip */
  /** 工具库里没有的命令（新建 / 导入 / 导出 / 库 / 清空）收在一个 ⋯ 菜单里 */
  menu?: EditorMenu;
  /** Save state, protection badges, clear, title, new doc, present */
  headerRight?: ReactNode;
  /** Feeds the viewport height calculation: the ribbon changes the space above the canvas */
  onCollapsedChange?: (collapsed: boolean) => void;
}

/**
 * The spreadsheet ribbon: Office tabs on top, Univer's own toolbar gone.
 *
 * Responsibilities split cleanly — `commands.ts` knows *what* to do, `univer.ts` knows *how*, this file
 * glues them to React and owns the one piece of state that only a component can hold: the selection
 * format (subscribed, coalesced) plus the armed format painter.
 */
export function SpreadsheetRibbon({
  ctx,
  host,
  menu,
  headerRight,
  onCollapsedChange,
}: SpreadsheetRibbonProps) {
  const [format, setFormat] = useState<SheetFormatState | null>(null);
  const [painting, setPainting] = useState(false);
  const [painterSticky, setPainterSticky] = useState(false);
  const painterRef = useRef<SheetFormatPatch | null>(null);
  /** Mirrors `painterSticky` for the selection callback, which closes over its first render */
  const painterStickyRef = useRef(false);

  const readFormat = useCallback(() => {
    setFormat(host ? host.getFormatState() : null);
  }, [host]);

  /** Selection + mutation subscription: keeps every toggle in sync with the cells */
  useEffect(() => {
    if (!host) {
      setFormat(null);
      return;
    }
    readFormat();
    return host.onSelectionChange(() => {
      const patch = painterRef.current;
      if (patch) {
        // Format painter: the armed format lands on the next selection. The locked painter keeps
        // its snapshot and paints again; the one-shot painter disarms (like Office)
        host.applyFormat(patch);
        if (!painterStickyRef.current) {
          painterRef.current = null;
          setPainting(false);
        }
      }
      setFormat(host.getFormatState());
    });
  }, [host, readFormat]);

  const stopPainter = useCallback(() => {
    painterRef.current = null;
    painterStickyRef.current = false;
    setPainterSticky(false);
    setPainting(false);
  }, []);

  const armPainter = useCallback(() => {
    if (!format) return false;
    painterRef.current = {
      bold: format.bold === true,
      italic: format.italic === true,
      underline: format.underline === true,
      strike: format.strike === true,
      fontFamily: format.fontFamily,
      fontSize: format.fontSize,
      color: format.color,
      fill: format.fill,
      wrap: format.wrap === true,
    };
    setPainting(true);
    return true;
  }, [format]);

  /** Ribbon split button: one click paints once, a second click cancels */
  const togglePainter = useCallback(() => {
    if (painting) {
      stopPainter();
      return;
    }
    if (armPainter()) {
      painterStickyRef.current = false;
      setPainterSticky(false);
    }
  }, [armPainter, painting, stopPainter]);

  /** Locked painter (Excel's double-click behaviour): stays armed after every painted selection */
  const lockPainter = useCallback(() => {
    if (painting && painterStickyRef.current) {
      stopPainter();
      return;
    }
    if (armPainter()) {
      painterStickyRef.current = true;
      setPainterSticky(true);
    }
  }, [armPainter, painting, stopPainter]);

  const fullCtx = useMemo<SheetRibbonContext>(
    () => ({
      ...ctx,
      host,
      format,
      painterActive: painting,
      painterSticky,
      togglePainter,
      lockPainter,
    }),
    [ctx, host, format, painting, painterSticky, togglePainter, lockPainter],
  );
  const tabs = useMemo(() => buildSheetRibbonTabs(fullCtx), [fullCtx]);

  const { t } = ctx;
  // Save state lives in the title cluster on the right (next to the document name), so the quick
  // access bar only carries commands.
  const quickAccess = (
    <>
      <button
        type="button"
        aria-label={t('tools.sheet.undo')}
        title={t('tools.sheet.undo')}
        data-testid="ribbon-qat-undo"
        onClick={ctx.actions.undo}
        className={RIBBON_ICON_BUTTON}
      >
        <RibbonIcon name="undo" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={t('tools.sheet.redo')}
        title={t('tools.sheet.redo')}
        data-testid="ribbon-qat-redo"
        onClick={ctx.actions.redo}
        className={RIBBON_ICON_BUTTON}
      >
        <RibbonIcon name="redo" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={t('tools.sheet.print')}
        title={t('tools.sheet.print')}
        data-testid="ribbon-qat-print"
        onClick={ctx.actions.print}
        disabled={ctx.busy || ctx.cellCount === 0}
        className={`${RIBBON_ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <RibbonIcon name="file" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={t('tools.sheet.exportXlsx')}
        title={t('tools.sheet.exportXlsx')}
        data-testid="ribbon-qat-export"
        onClick={ctx.actions.exportXlsx}
        disabled={ctx.busy || ctx.cellCount === 0}
        className={`${RIBBON_ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <RibbonIcon name="download" className="h-3.5 w-3.5" />
      </button>
    </>
  );

  return (
    <Ribbon
      ariaLabel={t('tools.sheet.r.ribbonLabel')}
      tabs={tabs}
      accent="green"
      menu={menu}
      quickAccess={quickAccess}
      headerRight={headerRight}
      collapseLabel={t('tools.sheet.r.collapse')}
      expandLabel={t('tools.sheet.r.expand')}
      moreLabel={t('common.more')}
      onCollapsedChange={onCollapsedChange}
      testId="sheet-ribbon"
    />
  );
}
