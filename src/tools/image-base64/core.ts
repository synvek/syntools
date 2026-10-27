import type { ToolResult } from '@/core/types';

/**
 * Image ↔ Base64 conversion (pure logic; encoding happens in the UI via FileReader).
 */

export type ImageBase64Error = 'EMPTY' | 'INVALID_BASE64' | 'NOT_IMAGE';

export function isImageFile(type: string): boolean {
  return type.startsWith('image/');
}

/** Extract the bare Base64 payload and MIME type from a data URL or raw Base64 */
export function parseBase64Input(
  input: string,
): ToolResult<{ mime: string; base64: string; dataUrl: string }> {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'EMPTY' };

  const dataUrlMatch = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(raw.replace(/\s+/g, ''));
  if (dataUrlMatch) {
    const mime = dataUrlMatch[1].toLowerCase();
    const base64 = dataUrlMatch[2];
    if (!base64) return { ok: false, error: 'INVALID_BASE64' };
    return { ok: true, value: { mime, base64, dataUrl: `data:${mime};base64,${base64}` } };
  }

  const compact = raw.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact) || compact.length < 8) {
    return { ok: false, error: 'INVALID_BASE64' };
  }
  const mime = sniffMime(compact) || 'image/png';
  return {
    ok: true,
    value: { mime, base64: compact, dataUrl: `data:${mime};base64,${compact}` },
  };
}

/** Sniff common image types from the Base64 header */
export function sniffMime(base64: string): string | null {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
