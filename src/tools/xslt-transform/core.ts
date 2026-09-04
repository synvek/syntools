import type { ToolResult } from '@/core/types';

/**
 * XSLT：XML → HTML（浏览器 XSLTProcessor；Node 测试侧重校验辅助）。
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

/** 粗校验：是否像 XML（有根标签或自闭合） */
export function looksLikeXml(input: string): boolean {
  const t = input.trim();
  if (!t) return false;
  return /<\s*[\w:.-]+(?:\s[^>]*)?\/?\s*>/.test(t);
}

/** 用 DOMParser 校验 XML（浏览器 / jsdom） */
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

/** 执行 XSLT 转换，返回序列化结果字符串 */
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
    // 优先取 documentElement；空文档时序列化整个 document
    const root = result.documentElement;
    const out = root ? serializer.serializeToString(root) : serializer.serializeToString(result);
    if (!out.trim()) return { ok: false, error: 'TRANSFORM' };
    return { ok: true, value: out };
  } catch {
    return { ok: false, error: 'TRANSFORM' };
  }
}
