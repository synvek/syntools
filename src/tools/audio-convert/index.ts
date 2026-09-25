import type { ToolMeta } from '@/core/types';

export const audioConvertTool: ToolMeta = {
  id: 'audio-convert',
  name: '音频转码',
  description:
    '音频格式转换：WAV（原生精修）与 MP3 / M4A / OGG / FLAC（WebCodecs 优先，回退 ffmpeg.wasm）',
  category: 'media',
  keywords: ['audio', 'wav', 'mp3', 'm4a', 'ogg', 'flac', '音频', '转码', '格式转换', 'media'],
  icon: 'music',
  component: () => import('./AudioConvertTool'),
  relatedIds: ['video-convert', 'video-to-gif', 'subtitle-tool'],
};
