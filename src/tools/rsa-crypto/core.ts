import type { ToolResult } from '@/core/types';

export type RsaKeyBits = 2048 | 4096;

export interface RsaKeyPair {
  publicKey: string;
  privateKey: string;
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
}

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

async function importPublic(pem: string, forSigning: boolean): Promise<CryptoKey | null> {
  const parsed = pemToDer(pem);
  if (!parsed || parsed.kind !== 'public') return null;
  return crypto.subtle
    .importKey(
      parsed.format as 'spki' | 'pkcs8',
      parsed.der,
      forSigning ? { name: 'RSA-PSS', hash: 'SHA-256' } : { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      forSigning ? ['verify'] : ['encrypt'],
    )
    .catch(() => null);
}

async function importPrivate(pem: string, forSigning: boolean): Promise<CryptoKey | null> {
  const parsed = pemToDer(pem);
  if (!parsed || parsed.kind !== 'private') return null;
  return crypto.subtle
    .importKey(
      parsed.format as 'spki' | 'pkcs8',
      parsed.der,
      forSigning ? { name: 'RSA-PSS', hash: 'SHA-256' } : { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      forSigning ? ['sign'] : ['decrypt'],
    )
    .catch(() => null);
}

/** 生成 RSA 密钥对，导出 PEM（SPKI/PKCS#8）与 JWK。 */
export async function generateRsaKeyPair(bits: RsaKeyBits = 2048): Promise<ToolResult<RsaKeyPair>> {
  try {
    const kp = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: bits,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt'],
    );
    const publicDer = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey));
    const privateDer = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
    const publicJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
    const privateJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    return {
      ok: true,
      value: {
        publicKey: derToPem(publicDer, 'public'),
        privateKey: derToPem(privateDer, 'private'),
        publicJwk,
        privateJwk,
      },
    };
  } catch {
    return { ok: false, error: 'GENERATE_FAILED' };
  }
}

export async function rsaEncrypt(
  publicPem: string,
  plaintext: string,
): Promise<ToolResult<string>> {
  if (!plaintext) return { ok: false, error: 'EMPTY' };
  const key = await importPublic(publicPem, false);
  if (!key) return { ok: false, error: 'INVALID_KEY' };
  try {
    const buf = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      key,
      new TextEncoder().encode(plaintext),
    );
    return { ok: true, value: bytesToBase64(new Uint8Array(buf)) };
  } catch {
    return { ok: false, error: 'ENCRYPT_FAILED' };
  }
}

export async function rsaDecrypt(
  privatePem: string,
  ciphertextB64: string,
): Promise<ToolResult<string>> {
  if (!ciphertextB64.trim()) return { ok: false, error: 'EMPTY' };
  const der = base64ToBytes(ciphertextB64);
  if (!der) return { ok: false, error: 'INVALID_INPUT' };
  const key = await importPrivate(privatePem, false);
  if (!key) return { ok: false, error: 'INVALID_KEY' };
  try {
    const buf = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key, der);
    return { ok: true, value: new TextDecoder().decode(buf) };
  } catch {
    return { ok: false, error: 'DECRYPT_FAILED' };
  }
}

export async function rsaSign(privatePem: string, message: string): Promise<ToolResult<string>> {
  if (!message) return { ok: false, error: 'EMPTY' };
  const key = await importPrivate(privatePem, true);
  if (!key) return { ok: false, error: 'INVALID_KEY' };
  try {
    const buf = await crypto.subtle.sign(
      { name: 'RSA-PSS', saltLength: 32 },
      key,
      new TextEncoder().encode(message),
    );
    return { ok: true, value: bytesToBase64(new Uint8Array(buf)) };
  } catch {
    return { ok: false, error: 'SIGN_FAILED' };
  }
}

export async function rsaVerify(
  publicPem: string,
  message: string,
  signatureB64: string,
): Promise<ToolResult<boolean>> {
  if (!message || !signatureB64.trim()) return { ok: false, error: 'EMPTY' };
  const sig = base64ToBytes(signatureB64);
  if (!sig) return { ok: false, error: 'INVALID_INPUT' };
  const key = await importPublic(publicPem, true);
  if (!key) return { ok: false, error: 'INVALID_KEY' };
  try {
    const ok = await crypto.subtle.verify(
      { name: 'RSA-PSS', saltLength: 32 },
      key,
      sig,
      new TextEncoder().encode(message),
    );
    return { ok: true, value: ok };
  } catch {
    return { ok: false, error: 'VERIFY_FAILED' };
  }
}
