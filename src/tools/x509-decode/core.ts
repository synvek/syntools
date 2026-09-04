import type { ToolResult } from '@/core/types';

export type X509ErrorCode = 'EMPTY' | 'INVALID_PEM';

export interface X509Info {
  pemType: string;
  derLength: number;
  sha256: string;
  sha1: string;
  subject: string | null;
  issuer: string | null;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

function pemToDer(pem: string): ToolResult<{ type: string; der: Uint8Array }> {
  const trimmed = pem.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };
  const match = trimmed.match(/-----BEGIN ([^-]+)-----([\s\S]+?)-----END \1-----/);
  if (!match) return { ok: false, error: 'INVALID_PEM' };
  const type = match[1].trim();
  const b64 = match[2].replace(/\s+/g, '');
  try {
    const bin = atob(b64);
    const der = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) der[i] = bin.charCodeAt(i);
    if (der.length === 0) return { ok: false, error: 'INVALID_PEM' };
    return { ok: true, value: { type, der } };
  } catch {
    return { ok: false, error: 'INVALID_PEM' };
  }
}

/** Minimal ASN.1 DER OID and printable string helpers for subject/issuer CN */
function readLength(bytes: Uint8Array, offset: number): { length: number; next: number } | null {
  if (offset >= bytes.length) return null;
  const first = bytes[offset];
  if (first < 0x80) return { length: first, next: offset + 1 };
  const n = first & 0x7f;
  if (n === 0 || n > 4 || offset + n >= bytes.length) return null;
  let length = 0;
  for (let i = 1; i <= n; i += 1) length = (length << 8) | bytes[offset + i];
  return { length, next: offset + 1 + n };
}

function extractCn(der: Uint8Array): { subject: string | null; issuer: string | null } {
  // Best-effort: find UTF8String/PrintableString after commonName OID 55 04 03
  const cnOid = [0x55, 0x04, 0x03];
  const cns: string[] = [];
  for (let i = 0; i < der.length - 5; i += 1) {
    if (der[i] === cnOid[0] && der[i + 1] === cnOid[1] && der[i + 2] === cnOid[2]) {
      let j = i + 3;
      // skip to next string tag after OID
      while (j < der.length && der[j] !== 0x0c && der[j] !== 0x13 && der[j] !== 0x16) j += 1;
      if (j >= der.length) continue;
      const lenInfo = readLength(der, j + 1);
      if (!lenInfo) continue;
      const start = lenInfo.next;
      const end = start + lenInfo.length;
      if (end > der.length) continue;
      try {
        cns.push(new TextDecoder().decode(der.subarray(start, end)));
      } catch {
        /* ignore */
      }
    }
  }
  // In typical cert order: issuer DN appears before subject DN
  if (cns.length >= 2) return { issuer: cns[0], subject: cns[cns.length - 1] };
  if (cns.length === 1) return { issuer: null, subject: cns[0] };
  return { subject: null, issuer: null };
}

async function digestHex(algo: 'SHA-256' | 'SHA-1', data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest(algo, data);
  return bytesToHex(new Uint8Array(hash));
}

/** Parse PEM certificate: type, DER length, fingerprints, best-effort CN */
export async function decodeX509(pem: string): Promise<ToolResult<X509Info>> {
  const parsed = pemToDer(pem);
  if (!parsed.ok) return parsed;
  const { type, der } = parsed.value;
  try {
    const [sha256, sha1] = await Promise.all([digestHex('SHA-256', der), digestHex('SHA-1', der)]);
    const { subject, issuer } = extractCn(der);
    return {
      ok: true,
      value: {
        pemType: type,
        derLength: der.length,
        sha256,
        sha1,
        subject,
        issuer,
      },
    };
  } catch {
    return { ok: false, error: 'INVALID_PEM' };
  }
}
