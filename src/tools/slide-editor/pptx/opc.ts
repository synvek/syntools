import JSZip from 'jszip';
import { attr, childrenOf, localNameOf, parseXml, type XmlNode } from './xml';

/**
 * OPC 包读写（ECMA-376 Part 2）：
 * 负责 zip 解包、关系项（_rels）解析、相对路径规范化与写出时的目录摆放。
 */

export interface Relationship {
  id: string;
  type: string;
  target: string;
  /** External 关系（如外链图片） */
  external?: boolean;
}

/** part 路径 → 其 rels 文件路径 */
export function relsPathFor(partPath: string): string {
  const slash = partPath.lastIndexOf('/');
  const dir = slash >= 0 ? partPath.slice(0, slash) : '';
  const file = slash >= 0 ? partPath.slice(slash + 1) : partPath;
  return `${dir}/_rels/${file}.rels`.replace(/^\//, '');
}

/** 解析 _rels 文件内容（按 rId 索引） */
export function parseRels(xml: string): Map<string, Relationship> {
  const map = new Map<string, Relationship>();
  for (const root of parseXml(xml)) {
    if (localNameOf(root) !== 'Relationships') continue;
    for (const node of childrenOf(root)) {
      if (localNameOf(node) !== 'Relationship') continue;
      const id = attr(node, 'Id');
      if (!id) continue;
      map.set(id, {
        id,
        type: attr(node, 'Type') ?? '',
        target: attr(node, 'Target') ?? '',
        external: attr(node, 'TargetMode') === 'External',
      });
    }
  }
  return map;
}

/**
 * 规范化关系目标路径：
 * 关系的 Target 是相对「所在 part 的目录」的，需要去掉 /、. 与 .. 后得到包内绝对路径。
 */
export function normalizePartPath(partPath: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const baseDir = partPath.includes('/') ? partPath.slice(0, partPath.lastIndexOf('/')) : '';
  const stack = baseDir ? baseDir.split('/') : [];
  for (const segment of target.split('/')) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') stack.pop();
    else stack.push(segment);
  }
  return stack.join('/');
}

/**
 * 读取 File 内容：优先用现代的 `file.arrayBuffer()`，
 * 缺失时（旧 Safari / jsdom 环境）退化到 FileReader。
 */
export async function readFileBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('READ_FAILED'));
    reader.readAsArrayBuffer(file);
  });
}

export async function loadZip(file: File): Promise<JSZip> {
  const buffer = await readFileBuffer(file);
  return JSZip.loadAsync(buffer);
}

export async function readTextPart(zip: JSZip, path: string): Promise<string | undefined> {
  const entry = zip.file(path);
  if (!entry) return undefined;
  return entry.async('string');
}

export async function readBinaryPart(zip: JSZip, path: string): Promise<Uint8Array | undefined> {
  const entry = zip.file(path);
  if (!entry) return undefined;
  const buffer = await entry.async('uint8array');
  return new Uint8Array(buffer);
}

export async function readRels(zip: JSZip, partPath: string): Promise<Map<string, Relationship>> {
  const xml = await readTextPart(zip, relsPathFor(partPath));
  return xml ? parseRels(xml) : new Map();
}

/** 找出包内第 N 张幻灯片之外的全部 part 名（用于兜底扫描） */
export function listSlidePartNames(zip: JSZip): string[] {
  return Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
}

/** rels → target 绝对 part 路径 */
export function targetPath(partPath: string, rel: Relationship): string {
  return normalizePartPath(partPath, rel.target);
}

/** 取 xfrm 节点里的 off/ext/rot/flip */
export interface Xfrm {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
}

export function readXfrm(node: XmlNode | undefined): Xfrm | undefined {
  const off = node ? offParent(node) : undefined;
  const offNode = off?.off;
  const extNode = off?.ext;
  if (!offNode && !extNode) return undefined;
  return {
    x: offNode ? Number(attr(offNode, 'x') ?? 0) : 0,
    y: offNode ? Number(attr(offNode, 'y') ?? 0) : 0,
    width: extNode ? Number(attr(extNode, 'cx') ?? 0) : 0,
    height: extNode ? Number(attr(extNode, 'cy') ?? 0) : 0,
    rotation: numMaybe(attr(node, 'rot')),
    flipX: attr(node, 'flipH') === '1',
    flipY: attr(node, 'flipV') === '1',
  };
}

function offParent(node: XmlNode): { off?: XmlNode; ext?: XmlNode } {
  return {
    off: childrenOf(node).find((c) => localNameOf(c) === 'off'),
    ext: childrenOf(node).find((c) => localNameOf(c) === 'ext'),
  };
}

function numMaybe(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export type { XmlNode };
