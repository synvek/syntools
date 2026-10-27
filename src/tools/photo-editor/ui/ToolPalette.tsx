import { Fragment, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ToolButton } from './controls';
import { ToolFlyout } from './ToolFlyout';
import { usePhotoStore } from '../store';
import { TOOL_GROUPS, displayToolOf } from '../toolset';
import type { ToolDef, ToolGroupDef } from '../toolset';
import type { ShapeKind, TextDirection } from '../model/types';
import { NARROW_QUERY, useMediaQuery } from './useMediaQuery';

/**
 * Left vertical toolbox: **one row = one tool family**, siblings hidden behind a click-again flyout.
 *
 * Why group them: 26 flat tools made the rail about 1100px, the tallest item in the flex row,
 * which pushed the whole workspace to 1100px and stretched the canvas along with it (forcing scroll).
 * Compressed into 15 family rows it is about 600px, so the canvas height comes from the remaining viewport;
 * a rail taller than the workspace scrolls internally instead of growing the page.
 *
 * Interaction matches Photoshop / Photopea:
 * - a button shows the group's most recent tool (or the primary one), with a corner triangle for siblings;
 * - the first click selects that tool (the button highlights);
 * - **clicking the highlighted button again** opens the group list, which closes after a pick;
 * - the triangle is only an icon and not clickable (there is no separate second button).
 *
 * Grouping and shortcut data live in `toolset.ts`, shared with the shortcut sheet so labels match bindings.
 */
export function ToolPalette() {
  const { t } = useTranslation();
  const tool = usePhotoStore((s) => s.tool);
  const setTool = usePhotoStore((s) => s.setTool);
  const shapeKind = usePhotoStore((s) => s.shapeKind);
  const setShapeKind = usePhotoStore((s) => s.setShapeKind);
  const textDirection = usePhotoStore((s) => s.textDirection);
  const setTextDirection = usePhotoStore((s) => s.setTextDirection);
  const isNarrow = useMediaQuery(NARROW_QUERY);
  const [flyout, setFlyout] = useState<{ groupId: string; anchor: HTMLElement } | null>(null);

  // Switching tools by keyboard leaves the flyout anchored to the old tool: just close it
  const lastTool = useRef(tool);
  useEffect(() => {
    if (lastTool.current === tool) return;
    lastTool.current = tool;
    setFlyout(null);
  }, [tool]);

  /** Not selected → select it; selected → open / close the group's other tools */
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
  /** Shape / text groups: items are kinds of one tool, so the flyout returns a kind, not a tool id */
  const openHasVariants = openGroup?.items.some((item) => item.variant) ?? false;
  /** Which piece of state a group's sub-kinds read from (shapes → shapeKind, text → textDirection) */
  const variantOf = (group: ToolGroupDef): ShapeKind | TextDirection | undefined =>
    group.variantKind === 'shape'
      ? shapeKind
      : group.variantKind === 'text'
        ? textDirection
        : undefined;

  return (
    <div
      data-testid="photo-tool-palette"
      // The workspace height comes from the viewport; a taller rail **scrolls itself** (flyouts use a portal)
      className="flex max-h-full w-12 shrink-0 flex-col items-center gap-1.5 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm dark:border-gray-800 dark:bg-gray-900 max-lg:max-h-14 max-lg:w-full max-lg:flex-row max-lg:overflow-x-auto max-lg:overflow-y-hidden"
    >
      {TOOL_GROUPS.map((group, groupIndex) => {
        const current = displayToolOf(group, tool, variantOf(group));
        const hasSiblings = group.items.length > 1;
        // Dividers only between sections: one per row would add ~50px and raise the workspace minimum
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
            tool: t(displayToolOf(openGroup, tool, variantOf(openGroup)).labelKey),
          })}
          items={openGroup.items.map((item) => ({
            // Groups with sub-kinds: the flyout offers kinds, and picking one sets both tool and kind
            id: item.variant ?? item.id,
            icon: item.icon,
            label: t(item.labelKey),
            shortcut: item.shortcut,
          }))}
          activeId={openHasVariants ? (variantOf(openGroup) ?? tool) : tool}
          prefer={isNarrow ? 'bottom' : 'right'}
          onPick={(id) => {
            const item = openGroup.items.find((entry) => (entry.variant ?? entry.id) === id);
            if (!item) return;
            if (openGroup.variantKind === 'shape') setShapeKind(item.variant as ShapeKind);
            else if (openGroup.variantKind === 'text') {
              setTextDirection(item.variant as TextDirection);
            }
            setTool(item.id);
          }}
          onClose={() => setFlyout(null)}
        />
      ) : null}
    </div>
  );
}
