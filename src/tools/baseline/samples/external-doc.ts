/**
 * Real .docx binaries produced outside our own exporter (implementation plan P0-1).
 *
 * Generated samples (`doc.ts`) prove self-consistency of our export → import pair; these prove
 * what happens to a file somebody actually hands us. Their metadata is recorded from the file's
 * own docProps — a declared producer is not evidence of the tool that really wrote the bytes,
 * so `notes` keeps that distinction visible instead of overclaiming provenance.
 *
 * Coverage target met (2026-11-06): 10 files = two independent redacted documents (Chinese and
 * English) × one source + four office suites. The English set also supplies the `comments` part
 * that the Chinese set lacks. CI now runs the baseline with BASELINE_REQUIRE_COVERAGE=1, so both
 * the file count and the four producer families are enforced on every release.
 */

export const REQUIRED_EXTERNAL_SAMPLES = 10;

/** Tool families the plan requires (§4.2 / §8.2); `other` exists for the unprocessed source. */
export const EXTERNAL_PRODUCER_FAMILIES = ['word', 'wps', 'libreoffice', 'pages'] as const;
export type ExternalProducerFamily = (typeof EXTERNAL_PRODUCER_FAMILIES)[number] | 'other';
export const REQUIRED_EXTERNAL_PRODUCERS = EXTERNAL_PRODUCER_FAMILIES.length;

const SHARED_NOTE =
  '同一脱敏源文档由不同办公软件打开/另存得到，属于「多工具变体」而非独立内容样本；' +
  'core.xml creator 仍为 MiniMax Code · docx skill，app.xml 的 Application 只声明处理/另存工具，' +
  '不等同于该工具原生生成的字节。';

const EN_NOTE =
  '英文独立内容样本「Consensus Algorithms in Practice」，与中文样本集内容完全不同；' +
  'core.xml creator 为 Priya Nair（脱敏源文档作者），app.xml 的 Application 只声明处理/另存工具，' +
  '不等同于该工具原生生成的字节。本组 5 份均含 word/comments.xml，补齐中文集缺失的批注覆盖。';

export interface ExternalDocSample {
  id: string;
  title: string;
  /** Repo-relative path of the checked-in, redacted binary */
  path: string;
  /** Which office suite handled the file; `other` = source document before any suite processed it */
  producerFamily: ExternalProducerFamily;
  /** `docProps/app.xml` → Application, plus `docProps/core.xml` → creator when they disagree */
  producer: string;
  /** Version / family when the file declares one */
  producerVersion?: string;
  /** OOXML parts this fixture is expected to exercise (asserted against the actual bytes) */
  expectedParts: string[];
  /** Provenance caveat, surfaced in the manifest and the report */
  notes: string;
}

export const externalDocSamples: ExternalDocSample[] = [
  {
    id: 'docx/external/feature-sample',
    title: 'DOCX 高级特性样本（脱敏，外部产出）',
    path: 'samples/docx-feature-sample.docx',
    producerFamily: 'other',
    producer: 'Microsoft Office Word (declared) / MiniMax Code docx skill (creator)',
    producerVersion: 'unknown',
    expectedParts: [
      'sections',
      'headers',
      'footers',
      'footnotes',
      'endnotes',
      'revisions',
      'fields',
      'images',
      'styles',
      'numbering',
      'people',
      'math',
      'shapes',
    ],
    notes:
      'app.xml 声明 Microsoft Office Word，core.xml creator 为 MiniMax Code · docx skill；按方案 §4.2 作为「外部工具产出的二进制样本」接入，不等同于 Word 原生导出。此份是未经理工处理的源文档基线，不计入四类工具族覆盖。',
  },
  {
    id: 'docx/external/word',
    title: 'DOCX 高级特性样本（Word 另存，脱敏）',
    path: 'samples/docx-feature-sample-word.docx',
    producerFamily: 'word',
    producer: 'Microsoft Office Word (app.xml) / MiniMax Code · docx skill (core.xml creator)',
    expectedParts: [
      'sections',
      'headers',
      'footers',
      'footnotes',
      'endnotes',
      'revisions',
      'fields',
      'images',
      'styles',
      'numbering',
      'people',
      'math',
      'shapes',
    ],
    notes: `${SHARED_NOTE} app.xml 未声明 Word 版本号，故 producerVersion 留空。相对源文档修订标记与域计数发生变化（revisions 126、fields 482），可视为 Word 重写 OOXML 的结果。`,
  },
  {
    id: 'docx/external/wps',
    title: 'DOCX 高级特性样本（WPS 另存，脱敏）',
    path: 'samples/docx-feature-sample-wps.docx',
    producerFamily: 'wps',
    producer: 'WPS Office 12.1.0.19302 (app.xml) / MiniMax Code · docx skill (core.xml creator)',
    producerVersion: '12.1.0.19302',
    expectedParts: [
      'sections',
      'headers',
      'footers',
      'footnotes',
      'endnotes',
      'revisions',
      'fields',
      'images',
      'styles',
      'numbering',
      'people',
      'math',
      'shapes',
    ],
    notes: `${SHARED_NOTE} app.xml 声明 WPS Office_12.1.0.19302_F1E327BC-…；extra customXml / docProps/custom.xml 为 WPS 写入，people 部件从 1 增至 4，修订标记 581 为五份中最多。`,
  },
  {
    id: 'docx/external/libreoffice',
    title: 'DOCX 高级特性样本（LibreOffice 另存，脱敏）',
    path: 'samples/docx-feature-sample-libraoffice.docx',
    producerFamily: 'libreoffice',
    producer:
      'LibreOffice 26.8.2.2 macOS aarch64 (app.xml) / MiniMax Code · docx skill (core.xml creator)',
    producerVersion: '26.8.2.2',
    expectedParts: [
      'sections',
      'headers',
      'footers',
      'footnotes',
      'endnotes',
      'revisions',
      'fields',
      'images',
      'styles',
      'numbering',
      'math',
      'shapes',
    ],
    notes: `${SHARED_NOTE} app.xml 声明 LibreOffice/26.8.2.2$MacOSX_AARCH64；页眉页脚各 12 个、styles 39 为五份中最多，无 people 部件。文件名沿用用户提供的 libraoffice 拼写，未改动磁盘文件。`,
  },
  {
    id: 'docx/external/pages',
    title: 'DOCX 高级特性样本（Pages 导出，脱敏）',
    path: 'samples/docx-feature-sample-pages.docx',
    producerFamily: 'pages',
    producer: 'undeclared (docProps empty) / Apple Pages per supplied provenance',
    expectedParts: [
      'sections',
      'headers',
      'footers',
      'footnotes',
      'revisions',
      'fields',
      'images',
      'styles',
      'numbering',
      'math',
      'shapes',
    ],
    notes:
      '由用户提供的 .pages 源文件重新导出为 .docx；app.xml 与 core.xml 均为空元素，文件内没有任何工具/版本声明，' +
      'producerFamily=pages 仅依据样本来源说明，不能从字节自证。导出后 endnotes / people 为 0，shapes 4 为五份中最多。' +
      ` ${SHARED_NOTE}`,
  },
  {
    id: 'docx/external/feature-sample-en',
    title: 'English feature sample (redacted source)',
    path: 'samples/docx-feature-sample-en.docx',
    producerFamily: 'other',
    producer: 'undeclared (no docProps package parts)',
    expectedParts: [
      'sections',
      'headers',
      'footers',
      'footnotes',
      'endnotes',
      'comments',
      'revisions',
      'fields',
      'math',
      'shapes',
      'styles',
      'numbering',
      'people',
    ],
    notes: `${EN_NOTE} 此份连 docProps/app.xml 与 core.xml 部件都不存在，完全没有产出工具声明；是英文集的源文档基线，不计入四类工具族覆盖。无 word/media/ 部件，comments=5 为 10 份中最多。`,
  },
  {
    id: 'docx/external/en-word',
    title: 'English feature sample (Word, redacted)',
    path: 'samples/docx-feature-sample-en-word.docx',
    producerFamily: 'word',
    producer: 'Microsoft Office Word (app.xml) / Priya Nair (core.xml creator)',
    expectedParts: [
      'sections',
      'headers',
      'footers',
      'footnotes',
      'endnotes',
      'comments',
      'revisions',
      'fields',
      'images',
      'math',
      'shapes',
      'styles',
      'numbering',
      'people',
    ],
    notes: `${EN_NOTE} app.xml 声明 Microsoft Office Word 但未给版本号，Template=Normal.dotm；lastModifiedBy=me yangxb。revisions=141、fields=438 为英文集最多，显示 Word 重写 OOXML 的痕迹。`,
  },
  {
    id: 'docx/external/en-wps',
    title: 'English feature sample (WPS, redacted)',
    path: 'samples/docx-feature-sample-en-wps.docx',
    producerFamily: 'wps',
    producer: 'WPS Office 12.1.0.19302 (app.xml) / Priya Nair (core.xml creator)',
    producerVersion: '12.1.0.19302',
    expectedParts: [
      'sections',
      'headers',
      'footers',
      'footnotes',
      'endnotes',
      'comments',
      'revisions',
      'fields',
      'images',
      'math',
      'shapes',
      'styles',
      'numbering',
      'people',
    ],
    notes: `${EN_NOTE} app.xml 声明 WPS Office_12.1.0.19302_F1E327BC-…；lastModifiedBy=yangxb。共 48 个包内部件，media=4 为英文集最多，revisions 仅 5。`,
  },
  {
    id: 'docx/external/en-libreoffice',
    title: 'English feature sample (LibreOffice, redacted)',
    path: 'samples/docx-feature-sample-en-libraoffice.docx',
    producerFamily: 'libreoffice',
    producer: 'LibreOffice 26.8.2.2 macOS aarch64 (app.xml) / Priya Nair (core.xml creator)',
    producerVersion: '26.8.2.2',
    expectedParts: [
      'sections',
      'headers',
      'footers',
      'footnotes',
      'endnotes',
      'comments',
      'revisions',
      'fields',
      'images',
      'math',
      'shapes',
      'styles',
      'numbering',
    ],
    notes: `${EN_NOTE} app.xml 声明 LibreOffice/26.8.2.2$MacOSX_AARCH64 LibreOffice_project/…；页眉页脚各 12 个、styles=38、numbering=5 为英文集最多，无 people 部件。文件名沿用用户提供的 libraoffice 拼写。`,
  },
  {
    id: 'docx/external/en-pages',
    title: 'English feature sample (Pages export, redacted)',
    path: 'samples/docx-feature-sample-en-pages.docx',
    producerFamily: 'pages',
    producer: 'undeclared (docProps empty) / Apple Pages per supplied provenance',
    expectedParts: [
      'sections',
      'headers',
      'footers',
      'footnotes',
      'comments',
      'revisions',
      'fields',
      'images',
      'math',
      'shapes',
      'styles',
      'numbering',
    ],
    notes: `${EN_NOTE} app.xml 与 core.xml 均为空元素，文件内没有任何工具/版本/作者声明，producerFamily=pages 仅依据样本来源说明。导出后 endnotes / people 为 0，shapes=4 为英文集最多。`,
  },
];
