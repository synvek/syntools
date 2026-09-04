import type { ToolMeta } from '@/core/types';

export const gifFramesTool: ToolMeta = {
  id: 'gif-frames',
  name: '在线 GIF 拆帧',
  description: '将 GIF 动画拆分为逐帧 PNG，可单帧或批量下载',
  category: 'image',
  keywords: ['gif', 'frame', '拆帧', '动画', '导出', 'png'],
  icon: 'gifFrames',
  component: () => import('./GifFramesTool'),
  weight: 19,
};
