import type { ToolMeta } from '@/core/types';

export const videoToGifTool: ToolMeta = {
  id: 'video-to-gif',
  name: '视频转 GIF',
  description: '截取视频片段并生成 GIF 动图（纯前端，自实现 GIF 编码，无需上传）',
  category: 'media',
  keywords: ['video', 'gif', '视频', '动图', '转换', '截取', 'media'],
  icon: 'film',
  component: () => import('./VideoToGifTool'),
  relatedIds: ['gif-frames', 'audio-convert'],
};
