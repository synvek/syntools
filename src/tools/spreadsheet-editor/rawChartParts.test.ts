import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  collectRawChartParts,
  decodeXmlEntities,
  dirOf,
  parseRelationships,
  relevantContentTypeEntries,
  relsPathFor,
} from './rawChartParts';

describe('部件路径工具', () => {
  it('取目录与对应 .rels 路径', () => {
    expect(dirOf('xl/worksheets/sheet1.xml')).toBe('xl/worksheets/');
    expect(dirOf('workbook.xml')).toBe('');
    expect(relsPathFor('xl/worksheets/sheet1.xml')).toBe('xl/worksheets/_rels/sheet1.xml.rels');
    expect(relsPathFor('xl/drawings/drawing1.xml')).toBe('xl/drawings/_rels/drawing1.xml.rels');
  });
});

describe('关系解析', () => {
  const xml =
    '<?xml version="1.0"?><Relationships xmlns="http://x">' +
    '<Relationship Id="rId1" Type="http://x/relationships/drawing" Target="../drawings/drawing1.xml"/>' +
    '<Relationship Id="rId2" Type="http://x/relationships/chart" Target="../charts/chart1.xml"/>' +
    '</Relationships>';

  it('提取 Id / Type / Target', () => {
    expect(parseRelationships(xml)).toEqual([
      {
        id: 'rId1',
        type: 'http://x/relationships/drawing',
        target: '../drawings/drawing1.xml',
      },
      { id: 'rId2', type: 'http://x/relationships/chart', target: '../charts/chart1.xml' },
    ]);
  });

  it('缺失或空内容返回空数组', () => {
    expect(parseRelationships(null)).toEqual([]);
    expect(parseRelationships(undefined)).toEqual([]);
    expect(parseRelationships('<Relationships/>')).toEqual([]);
  });
});

describe('XML 实体解码', () => {
  it('常见实体与数字实体', () => {
    expect(decodeXmlEntities('A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;')).toBe(
      'A & B <C> "D" \'E\'',
    );
    expect(decodeXmlEntities('&#65;&#66;')).toBe('AB');
  });
});

describe('内容类型条目筛选', () => {
  const contentTypes =
    '<?xml version="1.0"?><Types xmlns="http://x">' +
    '<Default Extension="rels" ContentType="rels"/>' +
    '<Default Extension="xml" ContentType="xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Override PartName="/xl/charts/chart1.xml" ContentType="chart"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="sheet"/>' +
    '</Types>';

  it('只挑与保留部件相关的 Override / Default', () => {
    const entries = relevantContentTypeEntries(contentTypes, [
      'xl/charts/chart1.xml',
      'xl/media/image1.png',
    ]);
    expect(entries).toEqual([
      '<Default Extension="png" ContentType="image/png"/>',
      '<Override PartName="/xl/charts/chart1.xml" ContentType="chart"/>',
    ]);
    expect(entries.join('')).not.toContain('/xl/worksheets/sheet1.xml');
  });

  it('无原始内容类型时返回空数组', () => {
    expect(relevantContentTypeEntries(undefined, ['xl/charts/chart1.xml'])).toEqual([]);
  });
});

describe('collectRawChartParts', () => {
  it('没有图表时不保留任何部件', async () => {
    const zip = new JSZip();
    zip.file(
      'xl/workbook.xml',
      '<?xml version="1.0"?><workbook xmlns:r="http://r"><sheets><sheet name="S1" r:id="rId1"/></sheets></workbook>',
    );
    zip.file(
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://x/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    );
    zip.file('xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet/>');
    await expect(collectRawChartParts(zip)).resolves.toBeNull();
  });

  it('drawing 里只有图片（无图表）时不保留', async () => {
    const zip = new JSZip();
    zip.file(
      'xl/workbook.xml',
      '<?xml version="1.0"?><workbook xmlns:r="http://r"><sheets><sheet name="S1" r:id="rId1"/></sheets></workbook>',
    );
    zip.file(
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://x/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    );
    zip.file('xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet/>');
    zip.file(
      'xl/worksheets/_rels/sheet1.xml.rels',
      '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://x/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
    );
    zip.file('xl/drawings/drawing1.xml', '<?xml version="1.0"?><xdr:wsDr/>');
    zip.file(
      'xl/drawings/_rels/drawing1.xml.rels',
      '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://x/relationships/image" Target="../media/image1.png"/></Relationships>',
    );
    zip.file('xl/media/image1.png', new Uint8Array([1, 2, 3]));
    await expect(collectRawChartParts(zip)).resolves.toBeNull();
  });

  it('含图表时保留 drawing / chart / 其 rels 与内容类型', async () => {
    const zip = new JSZip();
    zip.file(
      'xl/workbook.xml',
      '<?xml version="1.0"?><workbook xmlns:r="http://r"><sheets><sheet name="Sales Data" r:id="rId1"/></sheets></workbook>',
    );
    zip.file(
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://x/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    );
    zip.file(
      'xl/worksheets/sheet1.xml',
      '<?xml version="1.0"?><worksheet><drawing r:id="rId1"/></worksheet>',
    );
    zip.file(
      'xl/worksheets/_rels/sheet1.xml.rels',
      '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://x/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
    );
    zip.file(
      'xl/drawings/drawing1.xml',
      '<?xml version="1.0"?><xdr:wsDr><xdr:oneCellAnchor/></xdr:wsDr>',
    );
    zip.file(
      'xl/drawings/_rels/drawing1.xml.rels',
      '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://x/relationships/chart" Target="../charts/chart1.xml"/></Relationships>',
    );
    zip.file('xl/charts/chart1.xml', '<?xml version="1.0"?><c:chartSpace/>');
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types/>');

    const parts = await collectRawChartParts(zip);
    expect(parts).not.toBeNull();
    if (!parts) return;
    expect(parts.sheetDrawings).toEqual({ 'Sales Data': 'xl/drawings/drawing1.xml' });
    expect(Object.keys(parts.parts).sort()).toEqual([
      'xl/charts/chart1.xml',
      'xl/drawings/_rels/drawing1.xml.rels',
      'xl/drawings/drawing1.xml',
    ]);
    expect(parts.contentTypes).toContain('<Types/>');
  });
});
