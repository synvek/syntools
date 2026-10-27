import { XMLParser } from 'fast-xml-parser';

/**
 * DrawingML / OPC XML reading helpers.
 *
 * Key point: `preserveOrder` must be on — sibling nodes such as `<p:sp>` / `<p:pic>` under spTree must keep
 * strict document order (same-level objects get merged under identical tag names in JS, losing z-order).
 */

/** preserveOrder parse result: { 'tagName': children | [{'#text': string}], ':@': { '@_attr': string } } */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- OPC XML shapes vary, so nodes are handled dynamically
export type XmlNode = Record<string, any>;

/**
 * Note: namespace prefixes must be kept (removeNSPrefix: false).
 * On nodes like `<p:sldId id="256" r:id="rId2"/>` the attributes `id` and `r:id` collide, and stripping
 * the prefix makes the latter overwrite the former, losing the relationship reference.
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

/** Full tag name (with prefix) */
export function tagOf(node: XmlNode | undefined): string {
  if (!node) return '';
  for (const key of Object.keys(node)) {
    if (key !== ':@') return key;
  }
  return '';
}

/** Local name without the namespace prefix */
export function localNameOf(node: XmlNode | undefined): string {
  const tag = tagOf(node);
  const colon = tag.indexOf(':');
  return colon >= 0 ? tag.slice(colon + 1) : tag;
}

/** Direct children (in document order) */
export function childrenOf(node: XmlNode | undefined): XmlNode[] {
  if (!node) return [];
  const out: XmlNode[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === ':@') continue;
    if (Array.isArray(value)) out.push(...(value as XmlNode[]));
  }
  return out;
}

/** First direct child matching the tag (prefix ignored in the comparison) */
export function childOf(node: XmlNode | undefined, tag: string): XmlNode | undefined {
  return childrenOf(node).find((childItem) => localNameOf(childItem) === tag);
}

/** All direct children matching the tag */
export function childrenNamed(node: XmlNode | undefined, tag: string): XmlNode[] {
  return childrenOf(node).filter((childItem) => localNameOf(childItem) === tag);
}

/** Recursively find the first node matching the tag (depth first) */
export function findFirst(node: XmlNode | undefined, tag: string): XmlNode | undefined {
  if (!node) return undefined;
  for (const childItem of childrenOf(node)) {
    if (localNameOf(childItem) === tag) return childItem;
    const deeper = findFirst(childItem, tag);
    if (deeper) return deeper;
  }
  return undefined;
}

/** Recursively collect all nodes matching the tag (including the node itself) */
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

/** Concatenate all text content inside a node */
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
