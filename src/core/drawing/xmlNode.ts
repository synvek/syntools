/**
 * Read-only view over parsed OOXML nodes (fast-xml-parser `preserveOrder` output shape).
 *
 * Lives in the kernel (P3-1.0) because geometry parsing happens for three carriers that differ
 * only in the wrapper: `p:sp` (pptx), `xdr:sp` (xlsx) and `wps:wsp` (docx) all hang an `a:spPr`
 * subtree with the same `a:prstGeom` / `a:custGeom` children. The kernel stays import-free: the
 * node type is structural, so whoever parses the part (`pptx/xml.ts`, the docx reader) keeps
 * ownership of the XML parser itself.
 */

/** preserveOrder parse result: { 'tagName': children, ':@': { '@_attr': string } } */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- OPC XML shapes vary, so nodes are handled dynamically
export type XmlNode = Record<string, any>;

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
