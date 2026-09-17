import { pxToEmu } from '../core';
import type { SlideDoc, SlideTheme } from '../model/types';

/**
 * 自研 OOXML 写入（零新增依赖）：这里存放 pptx 包的固定骨架。
 *
 * 注意：PowerPoint 对 DrawingML 的**子元素顺序**极其严格，
 * 顺序错误会触发「演示文稿需要修复」，因此每个模板都按 schema 的 CT_ 序列书写。
 */

export const CONTENT_TYPE_DEFAULTS: Record<string, string> = {
  rels: 'application/vnd.openxmlformats-package.relationships+xml',
  xml: 'application/xml',
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
};

const APP = 'application/vnd.openxmlformats-officedocument.presentationml';

const XMLNS = {
  presentationml: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  drawingml: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  relationships: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  packageRelationships: 'http://schemas.openxmlformats.org/package/2006/relationships',
  slideMaster: 'http://schemas.openxmlformats.org/drawingml/2006/main',
};

export const SLIDE_MASTER_TYPE = `${APP}.slideMaster+xml`;
export const SLIDE_LAYOUT_TYPE = `${APP}.slideLayout+xml`;
export const SLIDE_TYPE = `${APP}.slide+xml`;
export const THEME_TYPE = `${APP}.theme+xml`;
export const PRESENTATION_TYPE = `${APP}.presentation.main+xml`;

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** packageRelationships 根节点声明 */
export function rootRels(): string {
  return [
    XML_DECLARATION,
    `<Relationships xmlns="${XMLNS.packageRelationships}">`,
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>',
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>',
    '</Relationships>',
  ].join('');
}

export function contentTypes(doc: SlideDoc): string {
  const extensions = new Set<string>(
    Object.keys(CONTENT_TYPE_DEFAULTS).filter((k) => k !== 'rels' && k !== 'xml'),
  );
  const parts = [
    XML_DECLARATION,
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`,
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
  ];
  for (const ext of extensions) {
    parts.push(`<Default Extension="${ext}" ContentType="${CONTENT_TYPE_DEFAULTS[ext]}"/>`);
  }
  parts.push(`<Override PartName="/ppt/presentation.xml" ContentType="${PRESENTATION_TYPE}"/>`);
  parts.push(`<Override PartName="/ppt/theme/theme1.xml" ContentType="${THEME_TYPE}"/>`);
  parts.push(
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${SLIDE_MASTER_TYPE}"/>`,
  );
  parts.push(
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${SLIDE_LAYOUT_TYPE}"/>`,
  );
  doc.slides.forEach((_, index) => {
    parts.push(
      `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="${SLIDE_TYPE}"/>`,
    );
  });
  parts.push('</Types>');
  return parts.join('');
}

export function presentationXml(slideCount: number, doc: SlideDoc): string {
  return [
    XML_DECLARATION,
    `<p:presentation xmlns:a="${XMLNS.drawingml}" xmlns:r="${XMLNS.relationships}" xmlns:p="${XMLNS.presentationml}" saveSubsetFonts="true">`,
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>',
    '<p:sldIdLst>',
    Array.from(
      { length: slideCount },
      (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`,
    ).join(''),
    '</p:sldIdLst>',
    `<p:sldSz cx="${pxToEmu(doc.width)}" cy="${pxToEmu(doc.height)}"/>`,
    '<p:notesSz cx="6858000" cy="9144000"/>',
    '</p:presentation>',
  ].join('');
}

export function presentationRels(slideCount: number): string {
  const lines = [
    XML_DECLARATION,
    `<Relationships xmlns="${XMLNS.packageRelationships}">`,
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
  ];
  for (let index = 0; index < slideCount; index += 1) {
    lines.push(
      `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`,
    );
  }
  lines.push('</Relationships>');
  return lines.join('');
}

export function slideMasterXml(layoutCount = 1): string {
  const relIds = Array.from({ length: layoutCount }, (_, index) => `rId${index + 1}`);
  return [
    XML_DECLARATION,
    `<p:sldMaster xmlns:a="${XMLNS.drawingml}" xmlns:r="${XMLNS.relationships}" xmlns:p="${XMLNS.presentationml}">`,
    '<p:cSld>',
    '<p:spTree>',
    '<p:nvGrpSpPr><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
    '</p:spTree>',
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>',
    '</p:cSld>',
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>',
    '<p:sldLayoutIdLst>',
    relIds
      .map((rId, index) => `<p:sldLayoutId id="${2147483649 + index}" r:id="${rId}"/>`)
      .join(''),
    '</p:sldLayoutIdLst>',
    '</p:sldMaster>',
  ].join('');
}

export function slideMasterRels(): string {
  return [
    XML_DECLARATION,
    `<Relationships xmlns="${XMLNS.packageRelationships}">`,
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>',
    '</Relationships>',
  ].join('');
}

/** 空白版式：只有一个内在 spTree，占位符由 slide 自行携带 */
export function slideLayoutXml(name: string, type: string): string {
  return [
    XML_DECLARATION,
    `<p:sldLayout xmlns:a="${XMLNS.drawingml}" xmlns:r="${XMLNS.relationships}" xmlns:p="${XMLNS.presentationml}" type="${type}" preserve="1">`,
    '<p:cSld name="' + escapeXml(name) + '">',
    '<p:spTree>',
    '<p:nvGrpSpPr><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
    '</p:spTree>',
    '</p:cSld>',
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>',
    '</p:sldLayout>',
  ].join('');
}

export function slideLayoutRels(): string {
  return [
    XML_DECLARATION,
    `<Relationships xmlns="${XMLNS.packageRelationships}">`,
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>',
    '</Relationships>',
  ].join('');
}

const SCHEME_ORDER = [
  'dk1',
  'lt1',
  'dk2',
  'lt2',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'accent5',
  'accent6',
  'hlink',
  'folHlink',
];

function themeColorEntries(theme: SlideTheme): string {
  return SCHEME_ORDER.map((key) => {
    const color = theme.colors[key] ?? '#000000';
    return `<a:${key}><a:srgbClr val="${color.replace(/^#/, '').toUpperCase()}"/></a:${key}>`;
  }).join('');
}

function fontScheme(theme: SlideTheme): string {
  const fontXml = (fonts: { latin: string; ea?: string; cs?: string }) =>
    `<a:latin typeface="${escapeXml(fonts.latin)}"/><a:ea typeface="${escapeXml(fonts.ea ?? fonts.latin)}"/><a:cs typeface="${escapeXml(fonts.cs ?? fonts.latin)}"/>`;
  return [
    `<a:fontScheme name="${escapeXml(theme.name)}">`,
    `<a:majorFont>${fontXml(theme.majorFont)}</a:majorFont>`,
    `<a:minorFont>${fontXml(theme.minorFont)}</a:minorFont>`,
    '</a:fontScheme>',
  ].join('');
}

/** 最小可用 theme：色板 + 字体方案 + 三个格式方案条目 */
export function themeXml(theme: SlideTheme): string {
  return [
    XML_DECLARATION,
    `<a:theme xmlns:a="${XMLNS.drawingml}" name="${escapeXml(theme.name)}">`,
    '<a:themeElements>',
    `<a:clrScheme name="${escapeXml(theme.name)}">${themeColorEntries(theme)}</a:clrScheme>`,
    fontScheme(theme),
    '<a:fmtScheme name="Office">',
    '<a:fillStyleLst>',
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>',
    '<a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/><a:shade val="80000"/></a:schemeClr></a:solidFill>',
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>',
    '</a:fillStyleLst>',
    '<a:lnStyleLst>',
    '<a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>',
    '<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>',
    '<a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>',
    '</a:lnStyleLst>',
    '<a:effectStyleLst>',
    '<a:effectStyle><a:effectLst/></a:effectStyle>',
    '<a:effectStyle><a:effectLst/></a:effectStyle>',
    '<a:effectStyle><a:effectLst/></a:effectStyle>',
    '</a:effectStyleLst>',
    '<a:bgFillStyleLst>',
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>',
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>',
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>',
    '</a:bgFillStyleLst>',
    '</a:fmtScheme>',
    '</a:themeElements>',
    '<a:objectDefaults/><a:extraClrSchemeLst/>',
    '</a:theme>',
  ].join('');
}

export function coreXml(title: string): string {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return [
    XML_DECLARATION,
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    `<dc:title>${escapeXml(title)}</dc:title>`,
    '<dc:creator>SynTools</dc:creator>',
    '<cp:lastModifiedBy>SynTools</cp:lastModifiedBy>',
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>`,
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>`,
    '</cp:coreProperties>',
  ].join('');
}

export function appXml(slideCount: number, title: string): string {
  return [
    XML_DECLARATION,
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">',
    '<Application>SynTools</Application>',
    '<Company>SynTools</Company>',
    `<Slides>${slideCount}</Slides>`,
    `<TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${escapeXml(title)}</vt:lpstr></vt:vector></TitlesOfParts>`,
    '</Properties>',
  ].join('');
}

export { XMLNS };
