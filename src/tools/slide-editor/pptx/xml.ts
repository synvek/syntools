import { XMLParser } from 'fast-xml-parser';
import { childrenOf, localNameOf, type XmlNode } from '../../../core/drawing/xmlNode';

/**
 * DrawingML / OPC XML reading helpers.
 *
 * Key point: `preserveOrder` must be on — sibling nodes such as `<p:sp>` / `<p:pic>` under spTree must keep
 * strict document order (same-level objects get merged under identical tag names in JS, losing z-order).
 *
 * The node accessors themselves live in the kernel (`core/drawing/xmlNode.ts`, P3-1.0) because
 * docx `wps:wsp` and xlsx `xdr:sp` read the same subtrees; they are re-exported here so the
 * slide editor keeps a single import site.
 */

export type { XmlNode };
export {
  attr,
  boolAttr,
  childOf,
  childrenNamed,
  childrenOf,
  localNameOf,
  numAttr,
  relAttr,
  tagOf,
  textOf,
} from '../../../core/drawing/xmlNode';

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
