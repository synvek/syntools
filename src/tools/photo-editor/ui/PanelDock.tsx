import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PanelId } from '../panels';
import { usePhotoStore } from '../store';
import { Panel } from './Panel';

/**
 * 面板停靠列：按 `panels.order` 渲染全部面板，支持折叠 / 上移下移 / 显隐（显隐在「窗口」菜单里切换）。
 * 与旧版「5 个互斥 Tab」相比，面板可同时可见，更贴近桌面修图软件的工作区。
 */
export function PanelDock({ content }: { content: Record<PanelId, ReactNode> }) {
  const { t } = useTranslation();
  const panels = usePhotoStore((s) => s.panels);
  const togglePanelCollapsed = usePhotoStore((s) => s.togglePanelCollapsed);
  const expandPanel = usePhotoStore((s) => s.expandPanel);
  const movePanel = usePhotoStore((s) => s.movePanel);

  const visible = panels.order.filter((id) => !panels.hidden.includes(id));
  // 标题取既有 Tab 文案，保持与「窗口」菜单、e2e 选择器一致
  const titles: Record<PanelId, string> = {
    color: t('tools.photo.tabColor'),
    layers: t('tools.photo.tabLayers'),
    style: t('tools.photo.tabStyle'),
    text: t('tools.photo.tabText'),
    channels: t('tools.photo.tabChannels'),
    property: t('tools.photo.tabProperty'),
    adjust: t('tools.photo.tabAdjust'),
    filter: t('tools.photo.tabFilter'),
    history: t('tools.photo.tabHistory'),
  };

  return (
    <div className="flex flex-col" data-testid="panel-dock">
      {visible.map((id, index) => (
        <Panel
          key={id}
          testId={`panel-${id}`}
          title={titles[id]}
          collapsed={panels.collapsed.includes(id)}
          onToggle={() => togglePanelCollapsed(id)}
          onReveal={() => expandPanel(id)}
          onMoveUp={() => movePanel(id, -1)}
          onMoveDown={() => movePanel(id, 1)}
          canMoveUp={index > 0}
          canMoveDown={index < visible.length - 1}
          moveUpLabel={t('tools.photo.panelUp')}
          moveDownLabel={t('tools.photo.panelDown')}
          collapseLabel={t('tools.photo.collapse')}
          expandLabel={t('tools.photo.expand')}
        >
          {content[id]}
        </Panel>
      ))}
    </div>
  );
}
