import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  collectRawChartParts,
  danglingPartReferences,
  decodeXmlEntities,
  dirOf,
  isExternalTarget,
  parseRelationships,
  partOfRels,
  relevantContentTypeEntries,
  relsPathFor,
  resolveRelTarget,
} from './rawChartParts';

describe('部件路径工具', () => {
  it('取目录与对应 .rels 路径', () => {
    expect(dirOf('xl/worksheets/sheet1.xml')).toBe('xl/worksheets/');
    expect(dirOf('workbook.xml')).toBe('');
    expect(relsPathFor('xl/worksheets/sheet1.xml')).toBe('xl/worksheets/_rels/sheet1.xml.rels');
    expect(relsPathFor('xl/drawings/drawing1.xml')).toBe('xl/drawings/_rels/drawing1.xml.rels');
  });

  it('从 .rels 反推拥有者部件；包级 rels 没有拥有者', () => {
    expect(partOfRels('xl/drawings/_rels/drawing1.xml.rels')).toBe('xl/drawings/drawing1.xml');
    expect(partOfRels('xl/_rels/workbook.xml.rels')).toBe('xl/workbook.xml');
    expect(partOfRels('_rels/.rels')).toBe('');
  });

  it('解析相对 / 绝对 Target，外部链接不算部件', () => {
    expect(resolveRelTarget('xl/drawings/drawing1.xml', '../media/image1.png')).toBe(
      'xl/media/image1.png',
    );
    expect(resolveRelTarget('xl/drawings/drawing1.xml', '/xl/charts/chart1.xml')).toBe(
      'xl/charts/chart1.xml',
    );
    expect(resolveRelTarget('xl/worksheets/sheet1.xml', 'https://example.com/a')).toBeNull();
    expect(resolveRelTarget('xl/worksheets/sheet1.xml', 'mailto:a@b.c')).toBeNull();
    expect(isExternalTarget('https://example.com')).toBe(true);
    expect(isExternalTarget('../media/image1.png')).toBe(false);
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

  /**
   * 纯图片 drawing 里一定有 `<xdr:spPr>`，用 `includes('<xdr:sp')` 判断"有形状"会全部命中：
   * 图片于是既被原样保留、又被重新注入一遍（图翻倍），保留的那份还引用着没导出的 `xl/media`。
   */
  it('图片的 spPr 不算形状：纯图片 drawing 仍不保留', async () => {
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
    zip.file(
      'xl/drawings/drawing1.xml',
      '<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://x"><xdr:twoCellAnchor><xdr:pic><xdr:spPr><a:xfrm/></xdr:spPr></xdr:pic></xdr:twoCellAnchor></xdr:wsDr>',
    );
    zip.file(
      'xl/drawings/_rels/drawing1.xml.rels',
      '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://x/relationships/image" Target="../media/image1.png"/></Relationships>',
    );
    zip.file('xl/media/image1.png', new Uint8Array([1, 2, 3]));
    await expect(collectRawChartParts(zip)).resolves.toBeNull();
  });

  it('真有形状锚点时保留（`<xdr:sp>`）', async () => {
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
    zip.file(
      'xl/drawings/drawing1.xml',
      '<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://x"><xdr:twoCellAnchor><xdr:sp><xdr:spPr/></xdr:sp></xdr:twoCellAnchor></xdr:wsDr>',
    );
    const parts = await collectRawChartParts(zip);
    expect(parts?.sheetDrawings).toEqual({ S1: 'xl/drawings/drawing1.xml' });
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

/**
 * 引用闭包（技术债"混合 drawing 的引用闭包"）：
 * 保留 XML 而不保留它引用的 `xl/media`，导出后就是一条 `r:embed` 指向不存在的部件——
 * Excel 会报"发现不可读取的内容"。下面的夹具都是真实存在的形态：
 * 形状与图片同处一个 drawing、图表用图片做数据点填充、超链接关系混在里面。
 */
describe('collectRawChartParts：引用闭包', () => {
  const WORKBOOK =
    '<?xml version="1.0"?><workbook xmlns:r="http://r"><sheets><sheet name="S1" r:id="rId1"/></sheets></workbook>';
  const WORKBOOK_RELS =
    '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://x/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
  const SHEET = '<?xml version="1.0"?><worksheet><drawing r:id="rId1"/></worksheet>';
  const SHEET_RELS =
    '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://x/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>';

  function mixedDrawingZip(drawingRels: string): JSZip {
    const zip = new JSZip();
    zip.file('xl/workbook.xml', WORKBOOK);
    zip.file('xl/_rels/workbook.xml.rels', WORKBOOK_RELS);
    zip.file('xl/worksheets/sheet1.xml', SHEET);
    zip.file('xl/worksheets/_rels/sheet1.xml.rels', SHEET_RELS);
    zip.file(
      'xl/drawings/drawing1.xml',
      '<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://x"><xdr:twoCellAnchor><xdr:sp><xdr:spPr/></xdr:sp></xdr:twoCellAnchor>' +
        '<xdr:twoCellAnchor><xdr:pic><xdr:blipFill><a:blip r:embed="rId2"/></xdr:blipFill></xdr:pic></xdr:twoCellAnchor></xdr:wsDr>',
    );
    zip.file('xl/drawings/_rels/drawing1.xml.rels', drawingRels);
    return zip;
  }

  it('形状与图片同处一个 drawing：图片的 xl/media 一起保留，闭包成立', async () => {
    const zip = mixedDrawingZip(
      '<?xml version="1.0"?><Relationships><Relationship Id="rId2" Type="http://x/relationships/image" Target="../media/image5.png"/></Relationships>',
    );
    zip.file('xl/media/image5.png', new Uint8Array([1, 2, 3]));

    const parts = await collectRawChartParts(zip);
    expect(parts).not.toBeNull();
    if (!parts) return;
    expect(Object.keys(parts.parts).sort()).toEqual([
      'xl/drawings/_rels/drawing1.xml.rels',
      'xl/drawings/drawing1.xml',
      'xl/media/image5.png',
    ]);
    expect(danglingPartReferences(parts.parts)).toEqual([]);
  });

  it('图表用图片做数据点填充：chart 的 .rels 与媒体都由闭包带出', async () => {
    const zip = new JSZip();
    zip.file('xl/workbook.xml', WORKBOOK);
    zip.file('xl/_rels/workbook.xml.rels', WORKBOOK_RELS);
    zip.file('xl/worksheets/sheet1.xml', SHEET);
    zip.file('xl/worksheets/_rels/sheet1.xml.rels', SHEET_RELS);
    zip.file(
      'xl/drawings/drawing1.xml',
      '<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://x"><xdr:oneCellAnchor/></xdr:wsDr>',
    );
    zip.file(
      'xl/drawings/_rels/drawing1.xml.rels',
      '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://x/relationships/chart" Target="../charts/chart1.xml"/></Relationships>',
    );
    zip.file('xl/charts/chart1.xml', '<?xml version="1.0"?><c:chartSpace/>');
    zip.file(
      'xl/charts/_rels/chart1.xml.rels',
      '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://x/relationships/image" Target="../media/image7.png"/></Relationships>',
    );
    zip.file('xl/media/image7.png', new Uint8Array([9]));

    const parts = await collectRawChartParts(zip);
    expect(parts).not.toBeNull();
    if (!parts) return;
    expect(Object.keys(parts.parts)).toContain('xl/media/image7.png');
    expect(danglingPartReferences(parts.parts)).toEqual([]);
  });

  it('超链接（TargetMode=External）不算部件，也不会被判成断链', async () => {
    const zip = mixedDrawingZip(
      '<?xml version="1.0"?><Relationships>' +
        '<Relationship Id="rId2" Type="http://x/relationships/image" Target="../media/image5.png"/>' +
        '<Relationship Id="rId3" Type="http://x/relationships/hyperlink" Target="https://example.com/" TargetMode="External"/>' +
        '</Relationships>',
    );
    zip.file('xl/media/image5.png', new Uint8Array([1]));

    const parts = await collectRawChartParts(zip);
    expect(parts).not.toBeNull();
    if (!parts) return;
    expect(Object.keys(parts.parts)).not.toContain('https://example.com/');
    expect(danglingPartReferences(parts.parts)).toEqual([]);
  });

  it('旧草稿里缺媒体的保留集合会被报成断链（导出侧据此提示，而不是静默产出）', () => {
    const rels = btoa(
      '<?xml version="1.0"?><Relationships><Relationship Id="rId2" Type="http://x/relationships/image" Target="../media/image5.png"/></Relationships>',
    );
    expect(
      danglingPartReferences({
        'xl/drawings/drawing1.xml': btoa('<xdr:wsDr/>'),
        'xl/drawings/_rels/drawing1.xml.rels': rels,
      }),
    ).toEqual([{ rels: 'xl/drawings/_rels/drawing1.xml.rels', target: 'xl/media/image5.png' }]);
  });
});
