import { describe, expect, it } from 'vitest';
import {
  looksLikeXml,
  parseXmlDocument,
  transformXmlWithXslt,
} from './core';

describe('xslt-transform', () => {
  it('空输入', () => {
    expect(transformXmlWithXslt('', '<xsl:stylesheet/>')).toEqual({
      ok: false,
      error: 'EMPTY_XML',
    });
    expect(transformXmlWithXslt('<a/>', '')).toEqual({ ok: false, error: 'EMPTY_XSLT' });
  });

  it('非法 XML', () => {
    expect(parseXmlDocument('<root><unclosed>')).toEqual({ ok: false, error: 'INVALID_XML' });
    expect(transformXmlWithXslt('not xml', '<a/>').ok).toBe(false);
  });

  it('looksLikeXml 辅助', () => {
    expect(looksLikeXml('<root/>')).toBe(true);
    expect(looksLikeXml('<root></root>')).toBe(true);
    expect(looksLikeXml('plain text')).toBe(false);
  });

  it('简单 XSLT（若环境支持 XSLTProcessor）', () => {
    if (typeof XSLTProcessor === 'undefined') return;
    const xml = '<root><item>hi</item></root>';
    const xslt = `<?xml version="1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <p><xsl:value-of select="root/item"/></p>
  </xsl:template>
</xsl:stylesheet>`;
    const r = transformXmlWithXslt(xml, xslt);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain('hi');
  });
});
