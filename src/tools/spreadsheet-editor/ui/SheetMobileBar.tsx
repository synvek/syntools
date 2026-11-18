import { RIBBON_ICON_BUTTON } from '@/core/components/ribbon/ribbonTheme';
import { RibbonIcon } from '@/core/components/ribbon/ribbonIcons';
import {
  resolveCommand,
  type SheetCommandContext,
  type SheetCommandId,
  type SheetRibbonHost,
} from '../commands';

/**
 * 移动端底部工具条（P2-8）。
 *
 * 只放 6 个动作，选的是"在手机上真正会做、且必须一次点到"的：
 * 撤销 / 重做 / 格式单元格（数字格式也在里面）/ 求和 / 清除内容 / 导出 xlsx。
 *
 * 刻意不新建数据源：`resolveCommand` + `SHEET_COMMANDS` 已经是菜单、Ribbon、快捷键三处的唯一来源，
 * 这里加第 8 个按钮不该再写一份 label/icon/disabled。命令的 `disabled` 谓词也一起生效，
 * 于是"受保护的表不能改""没建好实例不能点"这些规则不会在移动端漏掉。
 *
 * 它**不替代** Ribbon：窄屏下 Ribbon 仍按自己的 640px 阈值折叠成标签条 + 飞窗，
 * 侧栏里那 60 多条命令照旧可达；工具条只是把最常用的几条从"两次点击"降到"一次"。
 */
export const SHEET_MOBILE_ACTIONS = [
  'undo',
  'redo',
  'formatCells',
  'autoSum',
  'clearContent',
  'exportXlsx',
] as const satisfies readonly SheetCommandId[];

export interface SheetMobileBarProps {
  /** 与 Ribbon 同一份上下文（不含它自己持有的 `host` / `format`） */
  ctx: Omit<SheetCommandContext, 'host' | 'format'>;
  host: SheetRibbonHost | null;
  /**
   * 打开"改值"浮层（P2-8）。可选：嵌入场景没有自己那套浮层，传空就不显示这颗按钮。
   * 它不在命令表里——命令表里的动作都作用在选区整体上，而这条要拿当前格的**原值**回填输入框。
   */
  onEditCell?: () => void;
}

export function SheetMobileBar({ ctx, host, onEditCell }: SheetMobileBarProps) {
  // 这 6 条命令都不读选区格式（`format`），所以不必把 Ribbon 里那份状态搬过来；
  // 传 `null` 而不是伪造一个默认值，任何"顺手读 format"的新命令都会在窄屏上表现为禁用，
  // 而不是按一份错误的默认样式执行。
  const fullCtx: SheetCommandContext = { ...ctx, host, format: null };

  return (
    <nav
      aria-label={ctx.t('tools.sheet.mobileBarLabel')}
      data-testid="sheet-mobile-bar"
      className="flex items-center justify-around gap-1 rounded-xl border border-gray-200 bg-white/95 px-2 py-1 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
    >
      {/* 改值是手机上最高频的一次操作，用文字按钮而不是图标：7 个图标挤在 390px 里没人分得清 */}
      {onEditCell ? (
        <button
          type="button"
          onClick={onEditCell}
          data-testid="sheet-mobile-edit-cell"
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!host || ctx.busy || ctx.protectedSheet}
        >
          {ctx.t('tools.sheet.cellEditOpen')}
        </button>
      ) : null}
      {SHEET_MOBILE_ACTIONS.map((id) => {
        const command = resolveCommand(fullCtx, id);
        return (
          <button
            key={id}
            type="button"
            aria-label={command.label}
            title={command.label}
            data-testid={`sheet-mobile-${id}`}
            onClick={command.run}
            disabled={command.disabled}
            className={`${RIBBON_ICON_BUTTON} h-9 w-9 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <RibbonIcon name={command.icon} className="h-4 w-4" />
          </button>
        );
      })}
    </nav>
  );
}
