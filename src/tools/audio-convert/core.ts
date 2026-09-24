export type BitDepth = 8 | 16 | 32;

export interface WavOptions {
  sampleRate: number;
  bitDepth: BitDepth;
}

/** 线性插值重采样。 */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) return input;
  const ratio = toRate / fromRate;
  const length = Math.max(1, Math.round(input.length * ratio));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const pos = i / ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = input[idx] ?? input[input.length - 1] ?? 0;
    const b = input[idx + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** 多声道混合为单声道（平均值）。 */
export function downmix(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];
  const length = Math.max(...channels.map((c) => c.length));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (const ch of channels) sum += ch[i] ?? 0;
    out[i] = sum / channels.length;
  }
  return out;
}

/** 将浮点声道编码为 WAV（PCM）。 */
export function encodeWav(channels: Float32Array[], options: WavOptions): Uint8Array {
  const numChannels = Math.max(1, channels.length);
  const { sampleRate, bitDepth } = options;
  const bytesPerSample = bitDepth / 8;
  const frames = channels[0]?.length ?? 0;
  const dataSize = frames * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < frames; i += 1) {
    for (let ch = 0; ch < numChannels; ch += 1) {
      const raw = channels[ch][i] ?? 0;
      const sample = Math.max(-1, Math.min(1, raw));
      if (bitDepth === 16) {
        view.setInt16(offset, Math.round(sample * 0x7fff), true);
      } else if (bitDepth === 8) {
        view.setUint8(offset, Math.round((sample + 1) * 127.5));
      } else {
        view.setFloat32(offset, sample, true);
      }
      offset += bytesPerSample;
    }
  }
  return new Uint8Array(buffer);
}
