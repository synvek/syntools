import { Fragment, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ToolButton } from './controls';
import { ToolFlyout } from './ToolFlyout';
import { usePhotoStore } from '../store';
import { TOOL_GROUPS, displayToolOf } from '../toolset';
import type { ToolDef, ToolGroupDef } from '../toolset';
import { NARROW_QUERY, useMediaQuery } from './useMediaQuery';

/**
 * 左侧竖排工具箱：**一行 = 一个工具家族**，同组其它工具收进再次点击弹出的浮层。
 *
 * 为什么分组：26 个工具平铺时左侧栏约 1100px 高，而它是 flex 行里最高的元素，
 * 于是整个工作区被顶到 1100px、画布也一起被拉长（页面只能滚动）。
 * 按家族压成 15 行后高度约 600px，画布高度改由「视口剩余空间」决定；
 * 工具箱比工作区高时自己内部滚动，不再撑高页面。
 *
 * 交互与 Photoshop / Photopea 一致：
 * - 按钮显示该组「最近用过的工具」（没用过则显示主工具），右下角小三角表示还有同族工具；
 * - 首次点击 = 选中该工具（此时按钮高亮）；
 * - **再次点击已高亮的按钮** = 弹出组内工具列表，选完自动收起；
 * - 小三角只是图标，不可点击（不再有单独的第二颗按钮）。
 *
 * 分组与快捷键数据在 `toolset.ts`（与快捷键一览共用同一份，避免显示与绑定脱节）。
 */
export function ToolPalette() {
  const { t } = useTranslation();
  const tool = usePhotoStore((s) => s.tool);
  const setTool = usePhotoStore((s) => s.setTool);
  const shapeKind = usePhotoStore((s) => s.shapeKind);
  const setShapeKind = usePhotoStore((s) => s.setShapeKind);
  const isNarrow = useMediaQuery(NARROW_QUERY);
  const [flyout, setFlyout] = useState<{ groupId: string; anchor: HTMLElement } | null>(null);

  // 用快捷键切到别的工具时，浮层还挂在旧工具上：直接收起
  const lastTool = useRef(tool);
  useEffect(() => {
    if (lastTool.current === tool) return;
    lastTool.current = tool;
    setFlyout(null);
  }, [tool]);

  /** 未选中 → 选中该工具；已选中 → 展开 / 收起同组工具 */
  const handleSelect = (
    group: ToolGroupDef,
    current: ToolDef,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    if (group.items.length > 1 && tool === current.id) {
      const anchor = event.currentTarget;
      setFlyout((prev) => (prev?.groupId === group.id ? null : { groupId: group.id, anchor }));
      return;
    }
    setTool(current.id);
    setFlyout(null);
  };

  const openGroup = flyout ? TOOL_GROUPS.find((group) => group.id === flyout.groupId) : undefined;
  /** 形状组：组内各项是同一个工具的不同种类，浮层里返回的是种类而不是工具 id */
  const openHasVariants = openGroup?.items.some((item) => item.variant) ?? false;

  return (
    <div
      data-testid="photo-tool-palette"
      // 工作区高度由视口决定，工具栏比它高时**自己内部滚动**（浮层走 portal，不受这里裁剪）
      className="flex max-h-full w-12 shrink-0 flex-col items-center gap-1.5 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm dark:border-gray-800 dark:bg-gray-900 max-lg:max-h-14 max-lg:w-full max-lg:flex-row max-lg:overflow-x-auto max-lg:overflow-y-hidden"
    >
      {TOOL_GROUPS.map((group, groupIndex) => {
        const current = displayToolOf(group, tool, shapeKind);
        const hasSiblings = group.items.length > 1;
        // 只有跨大区才画分隔线：逐行都画会让左侧栏多出约 50px，直接影响工作区下限
        const startsSection =
          groupIndex > 0 && group.section !== TOOL_GROUPS[groupIndex - 1].section;
        return (
          <Fragment key={group.id}>
            {startsSection ? (
              <span
                aria-hidden
                className="my-0.5 h-px w-7 bg-gray-200 dark:bg-gray-700 max-lg:mx-0.5 max-lg:my-0 max-lg:h-7 max-lg:w-px"
              />
            ) : null}
            <div className="relative" data-testid={`tool-group-${group.id}`}>
              <ToolButton
                tool={current.id}
                icon={current.icon}
                label={t(current.labelKey)}
                shortcut={current.shortcut}
                active={tool === current.id}
                grouped={hasSiblings}
                onSelect={(_id, event) => handleSelect(group, current, event)}
              />
            </div>
          </Fragment>
        );
      })}

      {flyout && openGroup ? (
        <ToolFlyout
          anchor={flyout.anchor}
          label={t('tools.photo.toolGroupMore', {
            tool: t(displayToolOf(openGroup, tool, shapeKind).labelKey),
          })}
          items={openGroup.items.map((item) => ({
            // 有子种类的组：浮层里给出「种类」，选中后同时决定工具与种类
            id: item.variant ?? item.id,
            icon: item.icon,
            label: t(item.labelKey),
            shortcut: item.shortcut,
          }))}
          activeId={openHasVariants ? shapeKind : tool}
          prefer={isNarrow ? 'bottom' : 'right'}
          onPick={(id) => {
            const item = openGroup.items.find((entry) => (entry.variant ?? entry.id) === id);
            if (!item) return;
            if (item.variant) setShapeKind(item.variant);
            setTool(item.id);
          }}
          onClose={() => setFlyout(null)}
        />
      ) : null}
    </div>
  );
}
