#!/usr/bin/env node
/**
 * 自托管 ffmpeg.wasm 核心（core-mt，多线程版）。
 *
 * 为什么需要它：
 *   ffmpeg.wasm 的核心（ffmpeg-core.wasm）约 31.2 MB，远超常规 bundle 预算，绝不能进 JS chunk。
 *   因此把 core 的 ESM 构建下载到 `public/ffmpeg/`，随静态产物发布，由 `@ffmpeg/ffmpeg`
 *   在用户首次使用音视频工具时按 URL 懒加载。
 *
 * 为什么还产出 gzip 副本（ffmpeg-core.wasm.gz）：
 *   Cloudflare Pages 对单个静态资源有 25 MiB 硬限，31.2 MB 的原始 wasm 无法直接发布
 *   （官方建议把超限文件放 R2，但那会引入第三方域，破坏「零数据外发 / CSP 仅 self」原则）。
 *   改为发布 gzip 副本（实测 9.83 MB），运行时由 src/core/media/ffmpeg.ts 按需下载并用
 *   DecompressionStream（不可用时回退 pako）解压成 blob: URL —— 同源、无需放行 CSP。
 *   平时不下载也不解压，只有真正用到 ffmpeg 兜底时才发生，首屏与其它工具不受影响。
 *
 * 为什么用 ESM 构建：
 *   `@ffmpeg/ffmpeg` 以 `{ type: 'module' }` 创建 Worker；模块 Worker 里 `importScripts` 不可用，
 *   会回退到 `await import(coreURL)`，因此必须提供 `dist/esm/*`。
 *
 * 为什么是 core-mt：
 *   多线程版需要 SharedArrayBuffer → 全站启用 COOP/COEP（见 vercel.json / public/_headers /
 *   vite.config.ts 的 server.headers）。体积与单线程版接近，但转码速度显著更快。
 *
 * 构建模式：
 *   - 默认：原始 wasm + gzip 副本都产出。本地 dev、Vercel、GitHub Pages、Tauri 可直接用原始 wasm，
 *     省一次运行时解压；Cloudflare Pages 用 `FFMPEG_PAGES=1`（见 package.json 的 build:cf）
 *     只保留 gzip 副本，并删除可能残留的原始 wasm，确保产物里没有超限文件。
 *   - 已存在且 SHA-256 匹配 → 跳过（缓存）；gzip 副本的期望值记录在 ffmpeg-core.wasm.gz.json。
 *   - 失败时默认「软失败」（打印告警、退出码 0），避免离线 / CI 网络抖动直接阻断构建；
 *     设置 FFMPEG_FETCH_STRICT=1 可改为硬失败。
 *
 * 用法：pnpm ffmpeg:fetch
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const VERSION = '0.12.10';
// 按版本分目录，便于对 /ffmpeg/** 使用 immutable 长缓存
const DEST = path.resolve(process.cwd(), 'public', 'ffmpeg', VERSION);
const STRICT = process.env.FFMPEG_FETCH_STRICT === '1';
/** Cloudflare Pages 模式：只保留 gzip 副本（原始 wasm 超过单文件 25 MiB 上限）。 */
const PAGES_ONLY = process.env.FFMPEG_PAGES === '1';
/** Cloudflare Pages 单文件上限（25 MiB），gzip 副本必须落在线下。 */
const PAGES_MAX_ASSET = 25 * 1024 * 1024;

/** 镜像源，按顺序尝试 */
const MIRRORS = [
  (file) => `https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@${VERSION}/dist/esm/${file}`,
  (file) => `https://unpkg.com/@ffmpeg/core-mt@${VERSION}/dist/esm/${file}`,
];

/** 期望的文件大小与 SHA-256（@ffmpeg/core-mt@0.12.10 的 dist/esm） */
const FILES = [
  {
    name: 'ffmpeg-core.js',
    size: 128947,
    sha256: '270a2e6ff945e173238610669a3f7132df5f9c52698a9bf708cf5c2ab6bda0de',
  },
  {
    name: 'ffmpeg-core.wasm',
    size: 32718323,
    sha256: 'be2c97605366b78f3f13e21b52e81a55a79e1f29c133b03a68ec187b1a2ec41a',
  },
  {
    name: 'ffmpeg-core.worker.js',
    size: 2115,
    sha256: 'f77898d631dc010b45c29c23cb4379c611a7d7b131bf591d08a656bb729a4ca3',
  },
];

const WASM_FILE = 'ffmpeg-core.wasm';
const GZIP_FILE = `${WASM_FILE}.gz`;
/** gzip 副本的期望 size / sha256（由本次压缩结果生成，用于后续构建跳过） */
const MANIFEST_FILE = `${GZIP_FILE}.json`;

const wasmSpec = FILES.find((spec) => spec.name === WASM_FILE);
const smallFiles = FILES.filter((spec) => spec.name !== WASM_FILE);

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;

function isUpToDate(target, spec) {
  if (!existsSync(target)) return false;
  try {
    const buffer = readFileSync(target);
    return buffer.length === spec.size && sha256(buffer) === spec.sha256;
  } catch {
    return false;
  }
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(path.join(DEST, MANIFEST_FILE), 'utf8'));
  } catch {
    return null;
  }
}

/** gzip 副本是否已与当前 wasm 版本匹配（匹配则无需重新下载 / 压缩）。 */
function isGzipUpToDate() {
  const manifest = readManifest();
  if (!manifest || manifest.sourceSha256 !== wasmSpec.sha256) return false;
  const target = path.join(DEST, GZIP_FILE);
  if (!existsSync(target)) return false;
  try {
    const buffer = readFileSync(target);
    return buffer.length === manifest.size && sha256(buffer) === manifest.sha256;
  } catch {
    return false;
  }
}

async function download(spec) {
  let lastError;
  for (const mirror of MIRRORS) {
    const url = mirror(spec.name);
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length !== spec.size) {
        throw new Error(`size mismatch: got ${buffer.length}, want ${spec.size}`);
      }
      const digest = sha256(buffer);
      if (digest !== spec.sha256) {
        throw new Error(`sha256 mismatch: got ${digest}`);
      }
      return buffer;
    } catch (err) {
      lastError = err;
      console.warn(`  ⚠ ${url} 失败：${err.message}`);
    }
  }
  throw lastError ?? new Error('all mirrors failed');
}

/** 本地副本有效则复用，否则下载。 */
async function localOrDownload(spec) {
  const target = path.join(DEST, spec.name);
  if (isUpToDate(target, spec)) return readFileSync(target);
  return download(spec);
}

/** 生成 gzip 副本（level 9）：体积约 9.8 MB，满足 Cloudflare Pages 的 25 MiB 单文件上限。 */
function writeGzip(wasmBuffer) {
  const gz = gzipSync(wasmBuffer, { level: 9 });
  writeFileSync(path.join(DEST, GZIP_FILE), gz);
  writeFileSync(
    path.join(DEST, MANIFEST_FILE),
    `${JSON.stringify(
      { sourceSha256: wasmSpec.sha256, size: gz.length, sha256: sha256(gz) },
      null,
      2,
    )}\n`,
  );
  return gz;
}

async function main() {
  console.log(
    `自托管 ffmpeg.wasm 核心 @ffmpeg/core-mt@${VERSION} → public/ffmpeg/${VERSION}/` +
      (PAGES_ONLY ? '（Cloudflare Pages 模式：仅 gzip 副本）' : ''),
  );
  mkdirSync(DEST, { recursive: true });

  // 1) 小文件（core / worker）任何平台都直接发布
  for (const spec of smallFiles) {
    const target = path.join(DEST, spec.name);
    if (isUpToDate(target, spec)) {
      console.log(`  · ${spec.name} 已是最新，跳过`);
      continue;
    }
    process.stdout.write(`  ↓ ${spec.name} (${mb(spec.size)}) ... `);
    try {
      writeFileSync(target, await download(spec));
      console.log('完成');
    } catch (err) {
      console.log('失败');
      console.warn(`     ${err.message}`);
      reportFailure();
      return;
    }
  }

  // 2) 原始 wasm：Pages 模式下不保留（超限），其余平台保留以便直连（省一次运行时解压）
  if (PAGES_ONLY) {
    if (existsSync(path.join(DEST, WASM_FILE))) {
      rmSync(path.join(DEST, WASM_FILE));
      console.log(`  · 移除 ${WASM_FILE}（Pages 单文件上限 25 MiB）`);
    }
  }

  // 3) gzip 副本：所有平台都产出，Cloudflare Pages 靠它发布
  let wasmBuffer = null;
  if (isGzipUpToDate()) {
    const manifest = readManifest();
    console.log(`  · ${GZIP_FILE} 已是最新，跳过（${mb(manifest.size)}）`);
  } else {
    process.stdout.write(`  ↓ ${WASM_FILE} (${mb(wasmSpec.size)}) → gzip ... `);
    try {
      wasmBuffer = await localOrDownload(wasmSpec);
    } catch (err) {
      console.log('失败');
      console.warn(`     ${err.message}`);
      reportFailure();
      return;
    }
    const gz = writeGzip(wasmBuffer);
    console.log(`${mb(gz.length)}（原始 ${mb(wasmBuffer.length)}）`);
    if (gz.length > PAGES_MAX_ASSET) {
      const message =
        `\n⚠️  ${GZIP_FILE} 为 ${mb(gz.length)}，超过 Cloudflare Pages 单文件上限 ${mb(PAGES_MAX_ASSET)}。\n` +
        '    需要改为分片发布（或把 wasm 放到 R2）。';
      if (STRICT) {
        console.error(message);
        process.exit(1);
      }
      console.warn(message);
    }
  }

  // 4) 非 Pages 构建：补齐原始 wasm（本地 dev / Vercel / Tauri 直接加载，不做运行时解压）
  if (!PAGES_ONLY && !isUpToDate(path.join(DEST, WASM_FILE), wasmSpec)) {
    writeFileSync(path.join(DEST, WASM_FILE), wasmBuffer ?? (await localOrDownload(wasmSpec)));
    console.log(`  · ${WASM_FILE} 已就绪（${mb(wasmSpec.size)}）`);
  }

  const manifest = readManifest();
  console.log(`✅ ffmpeg.wasm 核心就绪，位于 public/ffmpeg/${VERSION}/`);
  console.log(`   ${GZIP_FILE} ${manifest ? mb(manifest.size) : '未知'}（运行时按需解压）`);
  if (!PAGES_ONLY) console.log(`   ${WASM_FILE} ${mb(wasmSpec.size)}（直连，无解压开销）`);
}

function reportFailure() {
  const message =
    '\n⚠️  ffmpeg.wasm 核心未就绪：音视频工具的高级转换（fallback 路径）在运行时会提示不可用。\n' +
    '    请联网后重试 `pnpm ffmpeg:fetch`。';
  if (STRICT) {
    console.error(message);
    process.exit(1);
  }
  console.warn(message);
}

main().catch((err) => {
  console.warn(`⚠️  ffmpeg:fetch 意外失败：${err?.message ?? err}`);
  if (STRICT) process.exit(1);
});
