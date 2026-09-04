import { describe, expect, it } from 'vitest';
import { minifyXml, processXml } from './core';

describe('processXml', () => {
  it('空输入 EMPTY', () => {
    expect(processXml('  ', 'format')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('格式化', () => {
    const r = processXml('<root><item>a</item></root>', 'format', 2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toContain('<root>');
      expect(r.value).toContain('\n');
    }
  });

  it('压缩', () => {
    const r = processXml('<root>\n  <item>a</item>\n</root>', 'compress');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('<root><item>a</item></root>');
  });
});

describe('minifyXml', () => {
  it('保留 CDATA', () => {
    const input = '<a>  <![CDATA[  x  y  ]]>  </a>';
    const out = minifyXml(input);
    expect(out).toContain('<![CDATA[  x  y  ]]>');
  });
});
