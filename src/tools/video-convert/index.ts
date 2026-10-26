import type { ToolMeta } from '@/core/types';

export const videoConvertTool: ToolMeta = {
  id: 'video-convert',
  name: '视频转码',
  description: 'WebCodecs 视频转码（MP4 / WebM / MKV），全程在本机完成',
  category: 'media',
  keywords: ['video', 'convert', 'transcode', 'mp4', 'webm', 'mkv', '视频', '转码', '格式转换'],
  icon: 'film',
  component: () => import('./VideoConvertTool'),
  relatedIds: ['video-to-gif', 'audio-convert'],
};
