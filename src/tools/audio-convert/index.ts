import type { ToolMeta } from '@/core/types';

export const audioConvertTool: ToolMeta = {
  id: 'audio-convert',
  name: '音频转 WAV',
  description: '将任意浏览器可解码的音频转换为 WAV（可设采样率、声道与位深）',
  category: 'media',
  keywords: ['audio', 'wav', '音频', '转换', '采样率', '声道', 'media'],
  icon: 'music',
  component: () => import('./AudioConvertTool'),
  relatedIds: ['gif-frames', 'subtitle-tool'],
};
