import type { ToolMeta } from '@/core/types';

export const subtitleTool: ToolMeta = {
  id: 'subtitle-tool',
  name: '字幕转换',
  description: 'SRT / WebVTT 字幕互转，支持整体平移时间轴与逐条预览',
  category: 'media',
  keywords: ['subtitle', 'srt', 'vtt', 'webvtt', '字幕', '转换', '时间轴'],
  icon: 'text',
  component: () => import('./SubtitleTool'),
  relatedIds: ['text-lines', 'timezone-converter'],
};
