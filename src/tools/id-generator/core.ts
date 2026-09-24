import type { ToolResult } from '@/core/types';

export type IdType = 'ulid' | 'nanoid' | 'snowflake' | 'objectid';

export const ID_TYPES: { value: IdType; label: string }[] = [
  { value: 'ulid', label: 'ULID' },
  { value: 'nanoid', label: 'NanoID' },
  { value: 'snowflake', label: 'Snowflake' },
  { value: 'objectid', label: 'ObjectId' },
];

export const MAX_ID_BATCH = 1000;

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const NANOID_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
const SNOWFLAKE_EPOCH = 1288834974657;

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

function hex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

/** ULID：48 位毫秒时间戳 + 80 位随机数，Crockford Base32，共 26 字符。 */
export function generateUlid(time: number = Date.now()): string {
  let ts = Math.floor(time);
  let timePart = '';
  for (let i = 0; i < 10; i += 1) {
    timePart = CROCKFORD[ts % 32] + timePart;
    ts = Math.floor(ts / 32);
  }
  const r = randomBytes(16);
  let rand = '';
  for (let i = 0; i < 16; i += 1) rand += CROCKFORD[r[i] & 31];
  return timePart + rand;
}

/** 解析 ULID 的时间戳（毫秒），非法返回 null。 */
export function parseUlidTime(ulid: string): number | null {
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(ulid)) return null;
  let ts = 0;
  for (let i = 0; i < 10; i += 1) {
    const idx = CROCKFORD.indexOf(ulid[i].toUpperCase());
    if (idx < 0) return null;
    ts = ts * 32 + idx;
  }
  return ts;
}

/** NanoID：默认 21 字符，64 字符字母表。 */
export function generateNanoId(size = 21, alphabet = NANOID_ALPHABET): string {
  const bytes = randomBytes(size);
  const isPow2 = (alphabet.length & (alphabet.length - 1)) === 0;
  let id = '';
  for (let i = 0; i < size; i += 1) {
    id += alphabet[isPow2 ? bytes[i] & (alphabet.length - 1) : bytes[i] % alphabet.length];
  }
  return id;
}

export interface SnowflakeOptions {
  timestamp?: number;
  machineId: number;
  sequence: number;
  epoch?: number;
}

/** Snowflake：41 位时间 + 10 位机器号 + 12 位序列号。 */
export function generateSnowflake(options: SnowflakeOptions): string {
  const epoch = options.epoch ?? SNOWFLAKE_EPOCH;
  const ts = BigInt(Math.floor((options.timestamp ?? Date.now()) - epoch));
  const machine = BigInt(options.machineId & 0x3ff);
  const seq = BigInt(options.sequence & 0xfff);
  return ((ts << 22n) | (machine << 12n) | seq).toString();
}

/** ObjectId：4 字节时间 + 5 字节随机 + 3 字节计数器，24 位十六进制。 */
export function generateObjectId(timestamp: number = Date.now(), counter?: number): string {
  const time = Math.floor(timestamp / 1000);
  const timeHex = time.toString(16).padStart(8, '0').slice(-8);
  const random = hex(randomBytes(5));
  const c =
    (counter ?? randomBytes(3).reduce((acc, b) => (acc * 256 + b) % 0x1000000, 0)) & 0xffffff;
  return timeHex + random + c.toString(16).padStart(6, '0');
}

/** 解析 ObjectId 中嵌入的时间戳（毫秒），非法返回 null。 */
export function parseObjectIdTime(id: string): number | null {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return null;
  return parseInt(id.slice(0, 8), 16) * 1000;
}

export interface GenerateIdsOptions {
  type: IdType;
  count: number;
  nanoidSize?: number;
  machineId?: number;
}

/** 批量生成指定类型的 ID。 */
export function generateIds(options: GenerateIdsOptions): ToolResult<string[]> {
  const count = Math.floor(options.count);
  if (!Number.isFinite(count) || count < 1 || count > MAX_ID_BATCH) {
    return { ok: false, error: 'INVALID_COUNT' };
  }
  const out: string[] = [];
  const machineId = options.machineId ?? 1;
  for (let i = 0; i < count; i += 1) {
    switch (options.type) {
      case 'ulid':
        out.push(generateUlid());
        break;
      case 'nanoid': {
        const size = options.nanoidSize ?? 21;
        out.push(generateNanoId(Math.min(Math.max(size, 4), 64)));
        break;
      }
      case 'snowflake':
        out.push(generateSnowflake({ machineId, sequence: i % 4096 }));
        break;
      case 'objectid':
        out.push(generateObjectId());
        break;
    }
  }
  return { ok: true, value: out };
}
