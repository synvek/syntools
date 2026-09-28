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
export const NOTES_SLIDE_TYPE = `${APP}.notesSlide+xml`;

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

/**
 * 演讲者备注部件（ppt/notesSlides/notesSlideN.xml）。
 * 结构：p:notes → p:cSld → p:spTree，其中备注正文放在 type="body" idx="1" 的占位符里。
 */
export function notesSlideXml(text: string): string {
  const paragraphs = text.split('\n');
  const body = paragraphs
    .map(
      (line) =>
        `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${escapeXml(line)}</a:t></a:r></a:p>`,
    )
    .join('');
  return [
    XML_DECLARATION,
    `<p:notes xmlns:a="${XMLNS.drawingml}" xmlns:r="${XMLNS.relationships}" xmlns:p="${XMLNS.presentationml}">`,
    '<p:cSld>',
    '<p:spTree>',
    '<p:nvGrpSpPr><p:cNvPr id="1" name="Group 1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
    '<p:sp>',
    '<p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>',
    '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>',
    '<p:spPr/>',
    `<p:txBody><a:bodyPr/><a:lstStyle/>${body}</p:txBody>`,
    '</p:sp>',
    '</p:spTree>',
    '</p:cSld>',
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>',
    '</p:notes>',
  ].join('');
}

/** 备注部件的 rels：必须反向指回所属幻灯片 */
export function notesSlideRels(slideNumber: number): string {
  return [
    XML_DECLARATION,
    `<Relationships xmlns="${XMLNS.packageRelationships}">`,
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${slideNumber}.xml"/>`,
    '</Relationships>',
  ].join('');
}

export function contentTypes(
  doc: SlideDoc,
  layoutCount = 1,
  masterCount = 1,
  notesSlideNumbers: number[] = [],
): string {
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
  for (let index = 0; index < Math.max(1, masterCount); index += 1) {
    parts.push(
      `<Override PartName="/ppt/slideMasters/slideMaster${index + 1}.xml" ContentType="${SLIDE_MASTER_TYPE}"/>`,
    );
  }
  for (let index = 0; index < Math.max(1, layoutCount); index += 1) {
    parts.push(
      `<Override PartName="/ppt/slideLayouts/slideLayout${index + 1}.xml" ContentType="${SLIDE_LAYOUT_TYPE}"/>`,
    );
  }
  doc.slides.forEach((_, index) => {
    parts.push(
      `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="${SLIDE_TYPE}"/>`,
    );
  });
  for (const number of notesSlideNumbers) {
    parts.push(
      `<Override PartName="/ppt/notesSlides/notesSlide${number}.xml" ContentType="${NOTES_SLIDE_TYPE}"/>`,
    );
  }
  parts.push('</Types>');
  return parts.join('');
}

export function presentationXml(slideCount: number, doc: SlideDoc, masterCount = 1): string {
  const masters = Math.max(1, masterCount);
  return [
    XML_DECLARATION,
    `<p:presentation xmlns:a="${XMLNS.drawingml}" xmlns:r="${XMLNS.relationships}" xmlns:p="${XMLNS.presentationml}" saveSubsetFonts="true">`,
    '<p:sldMasterIdLst>',
    Array.from(
      { length: masters },
      (_, index) => `<p:sldMasterId id="${2147483648 + index}" r:id="rId${index + 1}"/>`,
    ).join(''),
    '</p:sldMasterIdLst>',
    '<p:sldIdLst>',
    Array.from(
      { length: slideCount },
      (_, index) => `<p:sldId id="${256 + index}" r:id="rId${masters + 1 + index}"/>`,
    ).join(''),
    '</p:sldIdLst>',
    `<p:sldSz cx="${pxToEmu(doc.width)}" cy="${pxToEmu(doc.height)}"/>`,
    '<p:notesSz cx="6858000" cy="9144000"/>',
    '</p:presentation>',
  ].join('');
}

export function presentationRels(slideCount: number, masterCount = 1): string {
  const masters = Math.max(1, masterCount);
  const lines = [
    XML_DECLARATION,
    `<Relationships xmlns="${XMLNS.packageRelationships}">`,
    Array.from(
      { length: masters },
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster${index + 1}.xml"/>`,
    ).join(''),
  ];
  for (let index = 0; index < slideCount; index += 1) {
    lines.push(
      `<Relationship Id="rId${masters + 1 + index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`,
    );
  }
  lines.push('</Relationships>');
  return lines.join('');
}

/**
 * 母版。`extraShapes` 是要写进 spTree 的母版元素 DrawingML（由调用方用 elementXml 生成），
 * 放在这里而不是直接 import write.ts，避免 templates ↔ write 的循环依赖。
 */
export function slideMasterXml(layoutCount = 1, extraShapes = ''): string {
  const relIds = Array.from({ length: Math.max(1, layoutCount) }, (_, index) => `rId${index + 1}`);
  return [
    XML_DECLARATION,
    `<p:sldMaster xmlns:a="${XMLNS.drawingml}" xmlns:r="${XMLNS.relationships}" xmlns:p="${XMLNS.presentationml}">`,
    '<p:cSld>',
    '<p:spTree>',
    '<p:nvGrpSpPr><p:cNvPr id="1" name="Group 1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
    extraShapes,
    '</p:spTree>',
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>',
    '</p:cSld>',
    '<p:sldLayoutIdLst>',
    relIds
      .map((rId, index) => `<p:sldLayoutId id="${2147483649 + index}" r:id="${rId}"/>`)
      .join(''),
    '</p:sldLayoutIdLst>',
    '</p:sldMaster>',
  ].join('');
}

/** 母版 rels：先依次挂各版式，最后挂主题（主题 rId 必须排在所有版式之后） */
export function slideMasterRels(layoutCount = 1): string {
  const layouts = Array.from(
    { length: Math.max(1, layoutCount) },
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${index + 1}.xml"/>`,
  );
  return [
    XML_DECLARATION,
    `<Relationships xmlns="${XMLNS.packageRelationships}">`,
    ...layouts,
    `<Relationship Id="rId${Math.max(1, layoutCount) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>`,
    '</Relationships>',
  ].join('');
}

/** 空白版式：只有一个内在 spTree，占位符由 slide 自行携带 */
/** 版式。`extraShapes` 为写进 spTree 的版式元素 DrawingML */
export function slideLayoutXml(name: string, type: string, extraShapes = ''): string {
  return [
    XML_DECLARATION,
    `<p:sldLayout xmlns:a="${XMLNS.drawingml}" xmlns:r="${XMLNS.relationships}" xmlns:p="${XMLNS.presentationml}" type="${type}" preserve="1">`,
    '<p:cSld name="' + escapeXml(name) + '">',
    '<p:spTree>',
    '<p:nvGrpSpPr><p:cNvPr id="1" name="Group 1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
    extraShapes,
    '</p:spTree>',
    '</p:cSld>',
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>',
    '</p:sldLayout>',
  ].join('');
}

export function slideLayoutRels(masterIndex = 0): string {
  return [
    XML_DECLARATION,
    `<Relationships xmlns="${XMLNS.packageRelationships}">`,
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster${masterIndex + 1}.xml"/>`,
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
