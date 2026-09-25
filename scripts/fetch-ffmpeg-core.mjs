#!/usr/bin/env node
/**
 * 自托管 ffmpeg.wasm 核心（core-mt，多线程版）。
 *
 * 为什么需要它：
 *   ffmpeg.wasm 的核心（ffmpeg-core.wasm）约 31.2 MB，远超常规 bundle 预算，绝不能进 JS chunk。
 *   因此把 core 的 ESM 构建下载到 `public/ffmpeg/`，随静态产物发布，由 `@ffmpeg/ffmpeg`
 *   在用户首次使用音视频工具时按 URL 懒加载。
 *
 * 为什么用 ESM 构建：
 *   `@ffmpeg/ffmpeg` 以 `{ type: 'module' }` 创建 Worker；模块 Worker 里 `importScripts` 不可用，
 *   会回退到 `await import(coreURL)`，因此必须提供 `dist/esm/*`。
 *
 * 为什么是 core-mt：
 *   多线程版需要 SharedArrayBuffer → 全站启用 COOP/COEP（见 vercel.json / public/_headers /
 *   vite.config.ts 的 server.headers）。体积与单线程版接近，但转码速度显著更快。
 *
 * 行为：
 *   - 已存在且 SHA-256 匹配 → 跳过（缓存）。
 *   - 失败时默认「软失败」（打印告警、退出码 0），避免离线 / CI 网络抖动直接阻断构建；
 *     设置 FFMPEG_FETCH_STRICT=1 可改为硬失败。
 *
 * 用法：pnpm ffmpeg:fetch
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const VERSION = '0.12.10';
// 按版本分目录，便于对 /ffmpeg/** 使用 immutable 长缓存
const DEST = path.resolve(process.cwd(), 'public', 'ffmpeg', VERSION);
const STRICT = process.env.FFMPEG_FETCH_STRICT === '1';

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

async function main() {
  console.log(`自托管 ffmpeg.wasm 核心 @ffmpeg/core-mt@${VERSION} → public/ffmpeg/${VERSION}/`);
  mkdirSync(DEST, { recursive: true });

  let pending = FILES.filter((spec) => !isUpToDate(path.join(DEST, spec.name), spec));
  const skipped = FILES.length - pending.length;
  if (skipped > 0) console.log(`  · 已是最新，跳过 ${skipped} 个文件`);

  const results = [];
  for (const spec of pending) {
    process.stdout.write(`  ↓ ${spec.name} (${mb(spec.size)}) ... `);
    try {
      const buffer = await download(spec);
      writeFileSync(path.join(DEST, spec.name), buffer);
      console.log('完成');
      results.push(true);
    } catch (err) {
      console.log('失败');
      console.warn(`     ${err.message}`);
      results.push(false);
    }
  }
  pending = [];

  const failed = results.some((ok) => !ok);
  if (failed) {
    const message =
      '\n⚠️  ffmpeg.wasm 核心未就绪：音视频工具的高级转换（fallback 路径）在运行时会提示不可用。\n' +
      '    请联网后重试 `pnpm ffmpeg:fetch`。';
    if (STRICT) {
      console.error(message);
      process.exit(1);
    }
    console.warn(message);
    return;
  }

  const total = FILES.reduce((sum, spec) => sum + spec.size, 0);
  console.log(`✅ ffmpeg.wasm 核心就绪（合计 ${mb(total)}），位于 public/ffmpeg/${VERSION}/`);
}

main().catch((err) => {
  console.warn(`⚠️  ffmpeg:fetch 意外失败：${err?.message ?? err}`);
  if (STRICT) process.exit(1);
});
