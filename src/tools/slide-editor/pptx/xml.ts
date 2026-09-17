import { XMLParser } from 'fast-xml-parser';

/**
 * DrawingML / OPC XML 读取辅助。
 *
 * 关键点：必须开启 `preserveOrder` —— spTree 下 `<p:sp>` / `<p:pic>` 等兄弟节点
 * 需要严格保持文档顺序（同一层级的对象在 JS 里会被同名标签合并，导致 z-order 丢失）。
 */

/** preserveOrder 解析结果：{ 'tagName': children | [{'#text': string}], ':@': { '@_attr': string } } */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- OPC XML 结构动态多变，此处按动态节点处理
export type XmlNode = Record<string, any>;

/**
 * 注意：必须保留命名空间前缀（removeNSPrefix: false）。
 * `<p:sldId id="256" r:id="rId2"/>` 这类节点上 `id` 与 `r:id` 会重名，
 * 去前缀后后者会把前者覆盖掉，导致关系引用丢失。
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: false,
  preserveOrder: true,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

export function parseXml(text: string): XmlNode[] {
  return parser.parse(text) as XmlNode[];
}

/** 完整标签名（含前缀） */
export function tagOf(node: XmlNode | undefined): string {
  if (!node) return '';
  for (const key of Object.keys(node)) {
    if (key !== ':@') return key;
  }
  return '';
}

/** 去掉命名空间前缀后的本地名 */
export function localNameOf(node: XmlNode | undefined): string {
  const tag = tagOf(node);
  const colon = tag.indexOf(':');
  return colon >= 0 ? tag.slice(colon + 1) : tag;
}

/** 直接子节点（按文档顺序） */
export function childrenOf(node: XmlNode | undefined): XmlNode[] {
  if (!node) return [];
  const out: XmlNode[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === ':@') continue;
    if (Array.isArray(value)) out.push(...(value as XmlNode[]));
  }
  return out;
}

/** 直接子节点中第一个匹配标签的节点（比较时忽略命名空间前缀） */
export function childOf(node: XmlNode | undefined, tag: string): XmlNode | undefined {
  return childrenOf(node).find((childItem) => localNameOf(childItem) === tag);
}

/** 直接子节点中所有匹配标签的节点 */
export function childrenNamed(node: XmlNode | undefined, tag: string): XmlNode[] {
  return childrenOf(node).filter((childItem) => localNameOf(childItem) === tag);
}

/** 递归查找首个匹配标签的节点（深度优先） */
export function findFirst(node: XmlNode | undefined, tag: string): XmlNode | undefined {
  if (!node) return undefined;
  for (const childItem of childrenOf(node)) {
    if (localNameOf(childItem) === tag) return childItem;
    const deeper = findFirst(childItem, tag);
    if (deeper) return deeper;
  }
  return undefined;
}

/** 递归收集（含自身）匹配标签的所有节点 */
export function collect(node: XmlNode | undefined, tag: string, out: XmlNode[] = []): XmlNode[] {
  if (!node) return out;
  if (localNameOf(node) === tag) out.push(node);
  for (const childItem of childrenOf(node)) collect(childItem, tag, out);
  return out;
}

export function attr(node: XmlNode | undefined, name: string): string | undefined {
  const attrs = node?.[':@'] as Record<string, unknown> | undefined;
  const value = attrs?.[`@_${name}`];
  return typeof value === 'string' ? value : undefined;
}

export function numAttr(node: XmlNode | undefined, name: string): number | undefined {
  const raw = attr(node, name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function boolAttr(node: XmlNode | undefined, name: string): boolean {
  const raw = attr(node, name);
  return raw === '1' || raw === 'true';
}

/** 连接节点内的全部文本内容 */
export function textOf(node: XmlNode | undefined): string {
  if (!node) return '';
  let text = '';
  for (const [key, value] of Object.entries(node)) {
    if (key === ':@') continue;
    if (key === '#text' && typeof value === 'string') text += value;
    else if (Array.isArray(value)) {
      for (const item of value as XmlNode[]) text += textOf(item);
    }
  }
  return text;
}
