import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuButton } from '@/core/components/MenuButton';
import { Icon } from '@/core/components/Icon';
import { ToolButton } from './controls';
import { usePhotoStore } from '../store';
import { TOOL_GROUPS, displayToolOf } from '../toolset';

/**
 * 左侧竖排工具箱：**一行 = 一个工具家族**，同组其它工具收进角标浮层。
 *
 * 为什么分组：26 个工具平铺时左侧栏约 1100px 高，而它是 flex 行里最高的元素，
 * 于是整个工作区被顶到 1100px、画布也一起被拉长（页面只能滚动）。
 * 按家族压成 11 行后高度约 460px，画布高度改由「视口剩余空间」决定。
 *
 * 交互与 Photoshop 的工具组一致：
 * - 点击主按钮 = 选中当前显示的工具（该组用过的工具会一直显示在按钮上）；
 * - 点击右下角角标 = 展开同组其它工具（浮层走 portal，不受左侧栏滚动裁剪）；
 * - 组内选择后浮层关闭、按钮切换为该工具。
 *
 * 分组与快捷键数据在 `toolset.ts`（与快捷键一览共用同一份，避免显示与绑定脱节）。
 */
export function ToolPalette() {
  const { t } = useTranslation();
  const tool = usePhotoStore((s) => s.tool);
  const setTool = usePhotoStore((s) => s.setTool);

  return (
    <div
      data-testid="photo-tool-palette"
      // 工作区高度由视口决定，工具栏比它高时**自己内部滚动**（浮层走 portal，不受这里裁剪）
      className="flex max-h-full w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      {TOOL_GROUPS.map((group, groupIndex) => {
        const current = displayToolOf(group, tool);
        const hasSiblings = group.items.length > 1;
        // 只有跨大区才画分隔线：逐行都画会让左侧栏多出约 50px，直接影响工作区下限
        const startsSection =
          groupIndex > 0 && group.section !== TOOL_GROUPS[groupIndex - 1].section;
        return (
          <Fragment key={group.id}>
            {startsSection ? (
              <span aria-hidden className="my-0.5 h-px w-7 bg-gray-200 dark:bg-gray-700" />
            ) : null}
            <div className="relative" data-testid={`tool-group-${group.id}`}>
              <ToolButton
                tool={current.id}
                icon={current.icon}
                label={t(current.labelKey)}
                shortcut={current.shortcut}
                active={tool === current.id}
                onSelect={setTool}
              />
              {hasSiblings ? (
                <MenuButton
                  label={t('tools.photo.toolGroupMore', {
                    tool: t(current.labelKey),
                  })}
                  triggerContent={<Icon name="chevron" className="h-2.5 w-2.5 opacity-70" />}
                  // 外层容器绝对定位到工具按钮的**右上角**（右下角留给「当前工具快捷键」徽标）；
                  // 定位锚点是上层的 `relative` 容器，因此外层容器自身不能再带 relative
                  className="absolute -right-px -top-px"
                  triggerClassName="flex h-4 w-4 items-center justify-center !rounded-sm !border-0 !p-0 text-gray-400 hover:!bg-gray-200 hover:text-gray-700 dark:text-gray-500 dark:hover:!bg-gray-700 dark:hover:text-gray-200"
                  hideChevron
                  panelClassName="min-w-40 p-1"
                  panel={(close) => (
                    <div className="flex flex-col gap-0.5">
                      {group.items.map((item) => {
                        const active = tool === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            data-tool={item.id}
                            aria-label={t(item.labelKey)}
                            onClick={() => {
                              setTool(item.id);
                              close();
                            }}
                            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors ${
                              active
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
                            }`}
                          >
                            <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                            <span className="truncate">{t(item.labelKey)}</span>
                            <span className="ml-auto shrink-0 font-mono text-[10px] text-gray-400 dark:text-gray-500">
                              {item.shortcut}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
              ) : null}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
