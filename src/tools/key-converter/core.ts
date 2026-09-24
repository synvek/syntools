import type { ToolResult } from '@/core/types';

export type KeyTarget = 'pem' | 'der' | 'jwk' | 'openssh';

type KeyKind = 'public' | 'private';
type KeyFormat = 'spki' | 'pkcs8' | 'pkcs1';

interface ParsedPem {
  kind: KeyKind;
  format: KeyFormat;
  der: Uint8Array;
}

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64.replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function bytesToB64url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(s: string): Uint8Array | null {
  return base64ToBytes(s.replace(/-/g, '+').replace(/_/g, '/'));
}

function pemToDer(pem: string): ParsedPem | null {
  const m = pem.match(/-----BEGIN ([A-Z ]+?)-----([\s\S]*?)-----END \1-----/);
  if (!m) return null;
  const header = m[1].trim();
  const der = base64ToBytes(m[2]);
  if (!der) return null;
  if (header === 'PUBLIC KEY') return { kind: 'public', format: 'spki', der };
  if (header === 'PRIVATE KEY') return { kind: 'private', format: 'pkcs8', der };
  if (header === 'RSA PUBLIC KEY') return { kind: 'public', format: 'pkcs1', der };
  if (header === 'RSA PRIVATE KEY') return { kind: 'private', format: 'pkcs1', der };
  return null;
}

function derToPem(der: Uint8Array, kind: KeyKind): string {
  const label = kind === 'public' ? 'PUBLIC KEY' : 'PRIVATE KEY';
  const b64 = bytesToBase64(der);
  const lines = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----\n`;
}

async function importKeyFromParsed(parsed: ParsedPem): Promise<CryptoKey | null> {
  const alg = { name: 'RSA-OAEP', hash: 'SHA-256' } as const;
  const usages =
    parsed.kind === 'public' ? (['encrypt'] as KeyUsage[]) : (['decrypt'] as KeyUsage[]);
  return crypto.subtle
    .importKey(parsed.format as 'spki' | 'pkcs8', parsed.der, alg, true, usages)
    .catch(() => null);
}

async function importDerGuessing(der: Uint8Array): Promise<CryptoKey | null> {
  const attempts: { format: KeyFormat; usage: KeyUsage }[] = [
    { format: 'spki', usage: 'encrypt' },
    { format: 'pkcs1', usage: 'encrypt' },
    { format: 'pkcs8', usage: 'decrypt' },
    { format: 'pkcs1', usage: 'decrypt' },
  ];
  for (const { format, usage } of attempts) {
    const key = await crypto.subtle
      .importKey(format as 'spki' | 'pkcs8', der, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, [
        usage,
      ])
      .catch(() => null);
    if (key) return key;
  }
  return null;
}

function buildString(str: string): Uint8Array {
  const s = new TextEncoder().encode(str);
  const len = new Uint8Array(4);
  len[0] = (s.length >>> 24) & 0xff;
  len[1] = (s.length >>> 16) & 0xff;
  len[2] = (s.length >>> 8) & 0xff;
  len[3] = s.length & 0xff;
  const out = new Uint8Array(4 + s.length);
  out.set(len, 0);
  out.set(s, 4);
  return out;
}

function buildMpint(bytes: Uint8Array): Uint8Array {
  let data = bytes;
  if (bytes[0] & 0x80) {
    const withZero = new Uint8Array(bytes.length + 1);
    withZero[0] = 0;
    withZero.set(bytes, 1);
    data = withZero;
  }
  const len = new Uint8Array(4);
  len[0] = (data.length >>> 24) & 0xff;
  len[1] = (data.length >>> 16) & 0xff;
  len[2] = (data.length >>> 8) & 0xff;
  len[3] = data.length & 0xff;
  const out = new Uint8Array(4 + data.length);
  out.set(len, 0);
  out.set(data, 4);
  return out;
}

function mpintToBytes(buf: Uint8Array): { value: Uint8Array; rest: Uint8Array } {
  const len = (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3];
  let data = buf.subarray(4, 4 + len);
  if (data[0] === 0x00 && data.length > 1) data = data.subarray(1);
  return { value: new Uint8Array(data), rest: buf.subarray(4 + len) };
}

function stringToBytes(buf: Uint8Array): { value: string; rest: Uint8Array } {
  const len = (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3];
  return { value: new TextDecoder().decode(buf.subarray(4, 4 + len)), rest: buf.subarray(4 + len) };
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function buildOpenSsh(jwk: JsonWebKey): string {
  const n = b64urlToBytes(jwk.n ?? '');
  const e = b64urlToBytes(jwk.e ?? '');
  if (!n || !e) throw new Error('bad jwk');
  const body = concatBytes(buildString('ssh-rsa'), buildMpint(n), buildMpint(e));
  return `ssh-rsa ${bytesToBase64(body)}`;
}

function parseOpenSsh(text: string): JsonWebKey | null {
  const b64 = text.trim().split(/\s+/)[1];
  if (!b64) return null;
  const body = base64ToBytes(b64);
  if (!body) return null;
  const type = stringToBytes(body);
  if (type.value !== 'ssh-rsa') return null;
  const n = mpintToBytes(type.rest);
  const e = mpintToBytes(n.rest);
  return { kty: 'RSA', n: bytesToB64url(n.value), e: bytesToB64url(e.value) };
}

async function parseToJwk(input: string): Promise<ToolResult<{ kind: KeyKind; jwk: JsonWebKey }>> {
  const text = input.trim();
  if (!text) return { ok: false, error: 'EMPTY' };

  if (text.startsWith('{')) {
    try {
      const jwk = JSON.parse(text) as JsonWebKey;
      if (jwk.kty !== 'RSA') return { ok: false, error: 'UNSUPPORTED' };
      return { ok: true, value: { kind: jwk.d ? 'private' : 'public', jwk } };
    } catch {
      return { ok: false, error: 'INVALID_INPUT' };
    }
  }

  if (text.startsWith('ssh-rsa')) {
    const jwk = parseOpenSsh(text);
    if (!jwk) return { ok: false, error: 'INVALID_INPUT' };
    return { ok: true, value: { kind: 'public', jwk } };
  }
  if (/^ssh-|^ecdsa-|^sk-/.test(text)) return { ok: false, error: 'UNSUPPORTED' };

  if (text.includes('-----BEGIN')) {
    const parsed = pemToDer(text);
    if (!parsed) return { ok: false, error: 'INVALID_INPUT' };
    const key = await importKeyFromParsed(parsed);
    if (!key) return { ok: false, error: 'INVALID_KEY' };
    const jwk = await crypto.subtle.exportKey('jwk', key);
    return { ok: true, value: { kind: parsed.kind, jwk } };
  }

  const der = base64ToBytes(text);
  if (!der) return { ok: false, error: 'INVALID_INPUT' };
  const key = await importDerGuessing(der);
  if (!key) return { ok: false, error: 'INVALID_KEY' };
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return { ok: true, value: { kind: key.type === 'private' ? 'private' : 'public', jwk } };
}

/** 在 PEM / DER / JWK / OpenSSH 之间互转 RSA 密钥。 */
export async function convertKey(input: string, target: KeyTarget): Promise<ToolResult<string>> {
  const parsed = await parseToJwk(input);
  if (!parsed.ok) return parsed;
  const { kind, jwk } = parsed.value;

  if (target === 'jwk') return { ok: true, value: JSON.stringify(jwk, null, 2) };

  if (target === 'openssh') {
    if (kind !== 'public') return { ok: false, error: 'NEED_PUBLIC' };
    if (jwk.kty !== 'RSA') return { ok: false, error: 'UNSUPPORTED' };
    try {
      return { ok: true, value: buildOpenSsh(jwk) };
    } catch {
      return { ok: false, error: 'INVALID_INPUT' };
    }
  }

  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true,
      kind === 'public' ? ['encrypt'] : ['decrypt'],
    );
    const fmt = kind === 'public' ? 'spki' : 'pkcs8';
    const der = new Uint8Array(await crypto.subtle.exportKey(fmt, key));
    if (target === 'der') return { ok: true, value: bytesToBase64(der) };
    return { ok: true, value: derToPem(der, kind) };
  } catch {
    return { ok: false, error: 'INVALID_KEY' };
  }
}
