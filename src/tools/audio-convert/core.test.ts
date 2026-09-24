import { describe, expect, it } from 'vitest';
import { downmix, encodeWav, resample } from './core';

describe('audio-convert', () => {
  it('重采样改变长度', () => {
    const input = new Float32Array(1000).fill(0.5);
    const out = resample(input, 44100, 22050);
    expect(out.length).toBe(500);
  });

  it('同采样率原样返回', () => {
    const input = new Float32Array([1, 2, 3]);
    expect(resample(input, 44100, 44100)).toBe(input);
  });

  it('混音为单声道取平均', () => {
    const l = new Float32Array([1, 0, -1]);
    const r = new Float32Array([0, 0, 0]);
    const mono = downmix([l, r]);
    expect(Array.from(mono)).toEqual([0.5, 0, -0.5]);
  });

  it('WAV 头部正确（16bit 单声道）', () => {
    const samples = new Float32Array(100).fill(0);
    const wav = encodeWav([samples], { sampleRate: 44100, bitDepth: 16 });
    const view = new DataView(wav.buffer);
    const str = (o: number, n: number) =>
      Array.from({ length: n }, (_, i) => String.fromCharCode(view.getUint8(o + i))).join('');
    expect(str(0, 4)).toBe('RIFF');
    expect(str(8, 4)).toBe('WAVE');
    expect(str(36, 4)).toBe('data');
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint16(34, true)).toBe(16);
    expect(wav.length).toBe(44 + 100 * 2);
  });

  it('立体声 32bit 数据长度为帧数×2×4', () => {
    const l = new Float32Array(50);
    const r = new Float32Array(50);
    const wav = encodeWav([l, r], { sampleRate: 48000, bitDepth: 32 });
    expect(wav.length).toBe(44 + 50 * 2 * 4);
  });

  it('采样值被限幅到 [-1, 1]', () => {
    const samples = new Float32Array([2, -2]);
    const wav = encodeWav([samples], { sampleRate: 8000, bitDepth: 16 });
    const view = new DataView(wav.buffer);
    expect(view.getInt16(44, true)).toBe(0x7fff);
    expect(view.getInt16(46, true)).toBe(-0x7fff);
  });
});
