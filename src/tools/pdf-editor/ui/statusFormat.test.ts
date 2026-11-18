import { describe, expect, it } from 'vitest';
import { formatFileSize, formatPageSize } from './statusFormat';

describe('formatFileSize', () => {
  it('按量级选择 B / KB / MB', () => {
    expect(formatFileSize(0)).toBe('—');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(512 * 1024)).toBe('512 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(20 * 1024 * 1024)).toBe('20 MB');
  });
});

describe('formatPageSize', () => {
  it('同时给出 pt 与 mm（A4 ≈ 595×842pt / 210×297mm）', () => {
    expect(formatPageSize(595.28, 841.89)).toBe('595 × 842 pt · 210 × 297 mm');
  });

  it('横向页面保持顺序', () => {
    expect(formatPageSize(841.89, 595.28)).toBe('842 × 595 pt · 297 × 210 mm');
  });
});
