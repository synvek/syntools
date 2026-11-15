import type { ExternalProducerFamily } from './external-doc';

/**
 * Real .xlsx binaries produced outside our own exporter (implementation plan P0-4 B/C).
 *
 * 8 files = 两套独立内容（中文 / 英文）× 四个办公套件（Excel / WPS / LibreOffice / Numbers）。
 * 与 `external-doc.ts` 同一套口径：`producer` 只写文件自己声明了什么，声明不了的（WPS 沿用
 * Excel 的 Application 字符串、Numbers 的 docProps 是空元素）在 `notes` 里明说，
 * 不把"用户说这是谁导出的"包装成"字节能自证"。
 *
 * 每份样本约 30 个页签，覆盖：字体探针 / 样式与数字格式 / 合并与布局 / 三种冻结 /
 * 值类型（含 RTL 与错误值）/ 公式 / 超链接 / 批注 / 条件格式 / 数据验证 / 图片 / 形状 /
 * 图表 / 表格对象 / 数据源 / 透视结果 / 定义名称 / 隐藏与完全隐藏表 / 标签色 / 保护。
 *
 * 已知缺口（诚实记录，不当作已覆盖）：文件里没有 `xl/pivotTables/*` 与 `xl/pivotCache/*`，
 * "透视表"页签提供的是透视**结果**版式而非原生透视对象；原生透视与切片器样本仍需补 1 份。
 */

export const REQUIRED_EXTERNAL_SHEETS = 8;

/** 套件族下限：与 docx 的 4 族一致（Excel 归在 `word` 族，Numbers 归在 `pages` 族） */
export const REQUIRED_SHEET_PRODUCERS = 4;

const NO_NATIVE_PIVOT =
  '透视表页签是结果版式：文件内没有 xl/pivotTables 与 pivotCache 部件，原生透视对象尚未覆盖。';

const CN_NOTE =
  '中文内容样本，30–31 个页签；cn 版不含图表与图片（对应页签为空占位），用于对比"同内容不同套件"的样式重写差异。';
const EN_NOTE =
  '英文独立内容样本，31–32 个页签，额外带 6 张图表、1 张图表工作表、3 个媒体文件、表格对象与定义名称。';

export interface SheetExternalSample {
  id: string;
  title: string;
  /** Repo-relative path of the checked-in binary */
  path: string;
  producerFamily: ExternalProducerFamily;
  /** `docProps/app.xml` → Application, plus `docProps/core.xml` → creator when they disagree */
  producer: string;
  producerVersion?: string;
  /** OOXML parts this fixture is expected to exercise (asserted against the actual bytes) */
  expectedParts: string[];
  notes: string;
}

const CHART_PARTS = ['charts', 'drawings', 'media'];

export const sheetExternalSamples: SheetExternalSample[] = [
  {
    id: 'xlsx/external/excel-cn',
    title: 'XLSX 综合特性样本（Excel for Mac 保存，中文，脱敏）',
    path: 'samples/xlsx-feature-sample-excel-cn.xlsx',
    producerFamily: 'word',
    producer: 'Microsoft Excel for Mac (app.xml: Microsoft Macintosh Excel)',
    expectedParts: ['worksheets', 'calcChain'],
    notes: `app.xml 声明 Microsoft Macintosh Excel 但未写版本号，故 producerVersion 留空；31 个页签含一张完全隐藏表、主题色标签色与工作表保护。${CN_NOTE}${NO_NATIVE_PIVOT}`,
  },
  {
    id: 'xlsx/external/excel-en',
    title: 'XLSX feature sample (Excel for Mac, English, redacted)',
    path: 'samples/xlsx-feature-sample-excel-en.xlsx',
    producerFamily: 'word',
    producer: 'Microsoft Excel for Mac (app.xml: Microsoft Macintosh Excel)',
    expectedParts: [
      'worksheets',
      ...CHART_PARTS,
      'chartsheets',
      'tables',
      'comments',
      'definedNames',
      'sheetProtection',
      'conditionalFormattings',
      'dataValidations',
      'calcChain',
    ],
    notes: `app.xml 声明 Microsoft Macintosh Excel、未写版本号。6 张图表 + 1 张图表工作表是四套件里唯一的原生图表工作表样本；含 3 个媒体文件（png / jpg / emf）。${EN_NOTE}${NO_NATIVE_PIVOT}`,
  },
  {
    id: 'xlsx/external/wps-cn',
    title: 'XLSX 综合特性样本（WPS 另存，中文，脱敏）',
    path: 'samples/xlsx-feature-sample-wps-cn.xlsx',
    producerFamily: 'wps',
    producer: 'Microsoft Macintosh Excel (app.xml) / WPS Office per supplied provenance',
    expectedParts: ['worksheets'],
    notes: `app.xml 声明的是 Microsoft Macintosh Excel——WPS 沿用了 Excel 的 Application 字符串，文件内没有可自证的 WPS 版本号，producerFamily 仅依据样本来源说明。31 个页签、47 个包内部件（同内容 Excel 版为 41），无 calcChain。${CN_NOTE}${NO_NATIVE_PIVOT}`,
  },
  {
    id: 'xlsx/external/wps-en',
    title: 'XLSX feature sample (WPS, English, redacted)',
    path: 'samples/xlsx-feature-sample-wps-en.xlsx',
    producerFamily: 'wps',
    producer: 'Microsoft Macintosh Excel (app.xml) / WPS Office per supplied provenance',
    expectedParts: [
      'worksheets',
      ...CHART_PARTS,
      'tables',
      'comments',
      'definedNames',
      'sheetProtection',
      'conditionalFormattings',
      'dataValidations',
    ],
    notes: `同 wps-cn：app.xml 只声明 Excel，WPS 版本无从自证。32 个页签、85 个包内部件；媒体目录里有一个目录条目（xl/media/）与 3 个真实文件，统计时按文件计。${EN_NOTE}${NO_NATIVE_PIVOT}`,
  },
  {
    id: 'xlsx/external/libreoffice-cn',
    title: 'XLSX 综合特性样本（LibreOffice Calc 另存，中文，脱敏）',
    path: 'samples/xlsx-feature-sample-libraoffice-cn.xlsx',
    producerFamily: 'libreoffice',
    producer: 'LibreOffice 26.8.2.2 macOS aarch64 (app.xml) LibreOffice_project/9dea406a…',
    producerVersion: '26.8.2.2',
    expectedParts: ['worksheets'],
    notes: `app.xml 声明 LibreOffice/26.8.2.2$MacOSX_AARCH64、AppVersion 15.0000；文件名沿用用户提供的 libraoffice 拼写，未改动磁盘文件。31 个页签、41 个包内部件。${CN_NOTE}${NO_NATIVE_PIVOT}`,
  },
  {
    id: 'xlsx/external/libreoffice-en',
    title: 'XLSX feature sample (LibreOffice Calc, English, redacted)',
    path: 'samples/xlsx-feature-sample-libraoffice-en.xlsx',
    producerFamily: 'libreoffice',
    producer: 'LibreOffice 26.8.2.2 macOS aarch64 (app.xml) LibreOffice_project/9dea406a…',
    producerVersion: '26.8.2.2',
    expectedParts: [
      'worksheets',
      ...CHART_PARTS,
      'tables',
      'comments',
      'definedNames',
      'sheetProtection',
      'conditionalFormattings',
      'dataValidations',
    ],
    notes: `32 个页签、86 个包内部件，为四类套件中最多；媒体文件扩展名被重写为 .jpeg。${EN_NOTE}${NO_NATIVE_PIVOT}`,
  },
  {
    id: 'xlsx/external/numbers-cn',
    title: 'XLSX 综合特性样本（Numbers 导出，中文，脱敏）',
    path: 'samples/xlsx-feature-sample-numbers-cn.xlsx',
    producerFamily: 'pages',
    producer:
      'undeclared (docProps/app.xml and core.xml are empty elements) / Apple Numbers per supplied provenance',
    expectedParts: ['worksheets', 'conditionalFormattings'],
    notes: `docProps 的 app.xml 与 core.xml 都是空元素，文件内没有任何工具/版本/作者声明，producerFamily=pages 仅依据样本来源说明。30 个页签（少一张"完全隐藏表"）、有值单元格 2,934 为中文集最多。${CN_NOTE}${NO_NATIVE_PIVOT}`,
  },
  {
    id: 'xlsx/external/numbers-en',
    title: 'XLSX feature sample (Numbers export, English, redacted)',
    path: 'samples/xlsx-feature-sample-numbers-en.xlsx',
    producerFamily: 'pages',
    producer:
      'undeclared (docProps/app.xml and core.xml are empty elements) / Apple Numbers per supplied provenance',
    expectedParts: [
      'worksheets',
      ...CHART_PARTS,
      'comments',
      'conditionalFormattings',
      'dataValidations',
    ],
    notes: `docProps 全为空元素，无工具声明。31 个页签、有值单元格 3,566（8 份中最多）；无表格对象与定义名称，图表 5 张（比 Excel / WPS 少一张图表工作表）。${EN_NOTE}${NO_NATIVE_PIVOT}`,
  },
];
