import { useTranslation } from 'react-i18next';
import { ToolButton } from './controls';
import { usePhotoStore } from '../store';
import type { ToolId } from '../model/types';

/** 左侧竖排工具箱：图标 + 快捷键气泡，当前工具蓝色实心高亮。 */
export function ToolPalette() {
  const { t } = useTranslation();
  const tool = usePhotoStore((s) => s.tool);
  const setTool = usePhotoStore((s) => s.setTool);

  const items: { id: ToolId; icon: string; label: string; shortcut: string }[] = [
    { id: 'move', icon: 'cursor', label: t('tools.photo.toolMove'), shortcut: 'V' },
    { id: 'rectSelect', icon: 'imageFrame', label: t('tools.photo.toolRectSelect'), shortcut: 'M' },
    {
      id: 'ellipseSelect',
      icon: 'hsv-cmyk',
      label: t('tools.photo.toolEllipseSelect'),
      shortcut: 'O',
    },
    { id: 'lasso', icon: 'lasso', label: t('tools.photo.toolLasso'), shortcut: 'L' },
    { id: 'crop', icon: 'imageCrop', label: t('tools.photo.toolCrop'), shortcut: 'C' },
    { id: 'brush', icon: 'brush', label: t('tools.photo.toolBrush'), shortcut: 'B' },
    { id: 'eraser', icon: 'eraser', label: t('tools.photo.toolEraser'), shortcut: 'E' },
    { id: 'fill', icon: 'bucket', label: t('tools.photo.toolFill'), shortcut: 'G' },
    { id: 'eyedropper', icon: 'eyedropper', label: t('tools.photo.toolEyedropper'), shortcut: 'I' },
    { id: 'text', icon: 'text', label: t('tools.photo.toolText'), shortcut: 'T' },
    { id: 'shape', icon: 'shapes', label: t('tools.photo.toolShape'), shortcut: 'U' },
    { id: 'hand', icon: 'hand', label: t('tools.photo.toolHand'), shortcut: 'H' },
  ];

  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {items.map((item) => (
        <ToolButton
          key={item.id}
          tool={item.id}
          icon={item.icon}
          label={item.label}
          shortcut={item.shortcut}
          active={tool === item.id}
          onSelect={setTool}
        />
      ))}
    </div>
  );
}
