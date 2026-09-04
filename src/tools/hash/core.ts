import { md5 } from 'js-md5';
import type { ToolResult } from '@/core/types';

export type HashAlgorithm = 'md5' | 'sha-1' | 'sha-256' | 'sha-512';
export type DigestEncoding = 'hex' | 'base64';

export const ALGORITHMS: { value: HashAlgorithm; label: string }[] = [
  { value: 'md5', label: 'MD5' },
  { value: 'sha-1', label: 'SHA-1' },
  { value: 'sha-256', label: 'SHA-256' },
  { value: 'sha-512', label: 'SHA-512' },
];

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

const CHUNK_SIZE = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

function encodeDigest(bytes: Uint8Array, encoding: DigestEncoding): string {
  return encoding === 'hex' ? bytesToHex(bytes) : bytesToBase64(bytes);
}

export async function hashText(
  algorithm: HashAlgorithm,
  text: string,
  encoding: DigestEncoding,
): Promise<ToolResult<string>> {
  const bytes = new TextEncoder().encode(text);
  try {
    if (algorithm === 'md5') {
      const digest = new Uint8Array(md5.create().update(bytes).arrayBuffer());
      return { ok: true, value: encodeDigest(digest, encoding) };
    }
    const digest = await crypto.subtle.digest(algorithm, bytes);
    return { ok: true, value: encodeDigest(new Uint8Array(digest), encoding) };
  } catch {
    return { ok: false, error: 'UNSUPPORTED' };
  }
}

async function readFileBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('FILE_READ'));
    reader.readAsArrayBuffer(file);
  });
}

export async function hashFile(
  algorithm: HashAlgorithm,
  file: File,
  encoding: DigestEncoding,
): Promise<ToolResult<string>> {
  try {
    if (algorithm === 'md5') {
      const hasher = md5.create();
      if (typeof file.stream === 'function') {
        const reader = file.stream().getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          hasher.update(value);
        }
      } else {
        hasher.update(new Uint8Array(await readFileBuffer(file)));
      }
      return { ok: true, value: encodeDigest(new Uint8Array(hasher.arrayBuffer()), encoding) };
    }
    const buffer = await readFileBuffer(file);
    const digest = await crypto.subtle.digest(algorithm, buffer);
    return { ok: true, value: encodeDigest(new Uint8Array(digest), encoding) };
  } catch (e) {
    const message = (e as Error).message;
    if (message === 'FILE_READ') {
      return { ok: false, error: 'FILE_READ' };
    }
    return { ok: false, error: 'FILE_HASH', params: { message } };
  }
}
