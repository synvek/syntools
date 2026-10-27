import type { ToolResult } from '@/core/types';

/**
 * XSLT: XML → HTML (browser XSLTProcessor; the Node tests focus on the validation helpers).
 */

export type XsltError = 'EMPTY_XML' | 'EMPTY_XSLT' | 'INVALID_XML' | 'INVALID_XSLT' | 'TRANSFORM';

export const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="1">
    <title>TypeScript Handbook</title>
    <author>Alice</author>
    <price>29.9</price>
  </book>
  <book id="2">
    <title>CSS Secrets</title>
    <author>Bob</author>
    <price>39.5</price>
  </book>
</catalog>`;

export const SAMPLE_XSLT = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <div class="catalog">
      <h2>Books</h2>
      <ul>
        <xsl:for-each select="catalog/book">
          <li>
            <strong><xsl:value-of select="title"/></strong>
            — <xsl:value-of select="author"/>
            ($<xsl:value-of select="price"/>)
          </li>
        </xsl:for-each>
      </ul>
    </div>
  </xsl:template>
</xsl:stylesheet>`;

/** Rough check: does it look like XML (has a root tag or a self-closing tag) */
export function looksLikeXml(input: string): boolean {
  const t = input.trim();
  if (!t) return false;
  return /<\s*[\w:.-]+(?:\s[^>]*)?\/?\s*>/.test(t);
}

/** Validate XML with DOMParser (browser / jsdom) */
export function parseXmlDocument(input: string): ToolResult<Document> {
  if (!input.trim()) return { ok: false, error: 'EMPTY_XML' };
  if (typeof DOMParser === 'undefined') {
    if (!looksLikeXml(input)) return { ok: false, error: 'INVALID_XML' };
    return { ok: false, error: 'TRANSFORM' };
  }
  try {
    const doc = new DOMParser().parseFromString(input, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) return { ok: false, error: 'INVALID_XML' };
    return { ok: true, value: doc };
  } catch {
    return { ok: false, error: 'INVALID_XML' };
  }
}

export function parseXsltDocument(input: string): ToolResult<Document> {
  if (!input.trim()) return { ok: false, error: 'EMPTY_XSLT' };
  if (typeof DOMParser === 'undefined') {
    if (!looksLikeXml(input)) return { ok: false, error: 'INVALID_XSLT' };
    return { ok: false, error: 'TRANSFORM' };
  }
  try {
    const doc = new DOMParser().parseFromString(input, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) return { ok: false, error: 'INVALID_XSLT' };
    return { ok: true, value: doc };
  } catch {
    return { ok: false, error: 'INVALID_XSLT' };
  }
}

/** Run the XSLT transform and return the serialized result string */
export function transformXmlWithXslt(xml: string, xslt: string): ToolResult<string> {
  if (!xml.trim()) return { ok: false, error: 'EMPTY_XML' };
  if (!xslt.trim()) return { ok: false, error: 'EMPTY_XSLT' };

  const xmlDoc = parseXmlDocument(xml);
  if (!xmlDoc.ok) return xmlDoc;
  const xsltDoc = parseXsltDocument(xslt);
  if (!xsltDoc.ok) return xsltDoc;

  if (typeof XSLTProcessor === 'undefined') {
    return { ok: false, error: 'TRANSFORM' };
  }

  try {
    const processor = new XSLTProcessor();
    processor.importStylesheet(xsltDoc.value);
    const result = processor.transformToDocument(xmlDoc.value);
    if (!result) return { ok: false, error: 'TRANSFORM' };

    const serializer = new XMLSerializer();
    // Prefer documentElement; serialize the whole document when it is empty
    const root = result.documentElement;
    const out = root ? serializer.serializeToString(root) : serializer.serializeToString(result);
    if (!out.trim()) return { ok: false, error: 'TRANSFORM' };
    return { ok: true, value: out };
  } catch {
    return { ok: false, error: 'TRANSFORM' };
  }
}
