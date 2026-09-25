import type { ToolMeta } from '@/core/types';
import { base64Tool } from '@/tools/base64';
import { urlCodecTool } from '@/tools/url-codec';
import { unicodeCodecTool } from '@/tools/unicode-codec';
import { asciiTableTool } from '@/tools/ascii-table';
import { hexCodecTool } from '@/tools/hex-codec';
import { urlQueryTool } from '@/tools/url-query';
import { gzipTool } from '@/tools/gzip-tool';
import { regexTesterTool } from '@/tools/regex-tester';
import { textDiffTool } from '@/tools/text-diff';
import { textCounterTool } from '@/tools/text-counter';
import { textLinesTool } from '@/tools/text-lines';
import { caseConvertTool } from '@/tools/case-convert';
import { jsonFormatTool } from '@/tools/json-format';
import { jsonConvertTool } from '@/tools/json-convert';
import { jsonPathTool } from '@/tools/json-path';
import { timestampTool } from '@/tools/timestamp';
import { uuidTool } from '@/tools/uuid';
import { hashTool } from '@/tools/hash';
import { jwtParserTool } from '@/tools/jwt-parser';
import { aesCryptoTool } from '@/tools/aes-crypto';
import { hmacTool } from '@/tools/hmac';
import { totpTool } from '@/tools/totp';
import { x509DecodeTool } from '@/tools/x509-decode';
import { passwordGenTool } from '@/tools/password-gen';
import { fakeDataTool } from '@/tools/fake-data';
import { entityCodecTool } from '@/tools/entity-codec';
import { cronParserTool } from '@/tools/cron-parser';
import { cronGeneratorTool } from '@/tools/cron-generator';
import { convertDataTool } from '@/tools/convert-data';
import { bmiCalculatorTool } from '@/tools/bmi-calculator';
import { placeholderImageTool } from '@/tools/placeholder-image';
import { imageMergeTool } from '@/tools/image-merge';
import { sqlFormatTool } from '@/tools/sql-format';
import { qrcodeTool } from '@/tools/qrcode';
import { colorConverterTool } from '@/tools/color-converter';
import { radixConverterTool } from '@/tools/radix-converter';
import { markdownPreviewTool } from '@/tools/markdown-preview';
import { imageCompressTool } from '@/tools/image-compress';
import { htmlFormatTool } from '@/tools/html-format';
import { jsFormatTool } from '@/tools/js-format';
import { cssFormatTool } from '@/tools/css-format';
import { xmlFormatTool } from '@/tools/xml-format';
import { xmlJsonTool } from '@/tools/xml-json';
import { htmlColorPickerTool } from '@/tools/html-color-picker';
import { webColorTableTool } from '@/tools/web-color-table';
import { pinyinTool } from '@/tools/pinyin';
import { lengthConverterTool } from '@/tools/length-converter';
import { zhConvertTool } from '@/tools/zh-convert';
import { weightConverterTool } from '@/tools/weight-converter';
import { calendarTool } from '@/tools/calendar';
import { cssButtonTool } from '@/tools/css-button';
import { randomNumberTool } from '@/tools/random-number';
import { randomStringTool } from '@/tools/random-string';
import { doodleBoardTool } from '@/tools/doodle-board';
import { calculatorTool } from '@/tools/calculator';
import { codeImageTool } from '@/tools/code-image';
import { codeHighlightTool } from '@/tools/code-highlight';
import { imageColorPickerTool } from '@/tools/image-color-picker';
import { imageWatermarkTool } from '@/tools/image-watermark';
import { uaParserTool } from '@/tools/ua-parser';
import { latexEditorTool } from '@/tools/latex-editor';
import { countdownTool } from '@/tools/countdown';
import { stopwatchTool } from '@/tools/stopwatch';
import { svgToPngTool } from '@/tools/svg-to-png';
import { imageFrameTool } from '@/tools/image-frame';
import { imageAdjustTool } from '@/tools/image-adjust';
import { gifFramesTool } from '@/tools/gif-frames';
import { imageCropTool } from '@/tools/image-crop';
import { mbtiTestTool } from '@/tools/mbti-test';
import { textCardTool } from '@/tools/text-card';
import { imageCardTool } from '@/tools/image-card';
import { imageBase64Tool } from '@/tools/image-base64';
import { imageIcoTool } from '@/tools/image-ico';
import { hsvCmykTool } from '@/tools/hsv-cmyk';
import { aiPromptsTool } from '@/tools/ai-prompts';
import { mdMindmapTool } from '@/tools/md-mindmap';
import { mermaidEditorTool } from '@/tools/mermaid-editor';
import { cssGradientTool } from '@/tools/css-gradient';
import { imageToPaperTool } from '@/tools/image-to-paper';
import { mdToImageTool } from '@/tools/md-to-image';
import { chartGeneratorTool } from '@/tools/chart-generator';
import { css3GeneratorTool } from '@/tools/css3-generator';
import { xsltTransformTool } from '@/tools/xslt-transform';
import { cidrCalcTool } from '@/tools/cidr-calc';
import { exifStripTool } from '@/tools/exif-strip';
import { pdfMergeTool } from '@/tools/pdf-merge';
import { pdfSplitTool } from '@/tools/pdf-split';
import { pdfDeletePagesTool } from '@/tools/pdf-delete-pages';
import { pdfExtractPagesTool } from '@/tools/pdf-extract-pages';
import { pdfReorderTool } from '@/tools/pdf-reorder';
import { pdfRotateTool } from '@/tools/pdf-rotate';
import { pdfToImageTool } from '@/tools/pdf-to-image';
import { imagesToPdfTool } from '@/tools/images-to-pdf';
import { pdfViewerTool } from '@/tools/pdf-viewer';
import { pdfPageNumbersTool } from '@/tools/pdf-page-numbers';
import { pdfHeaderFooterTool } from '@/tools/pdf-header-footer';
import { pdfInsertImageTool } from '@/tools/pdf-insert-image';
import { pdfAddTextTool } from '@/tools/pdf-add-text';
import { pdfSignTool } from '@/tools/pdf-sign';
import { pdfMetadataTool } from '@/tools/pdf-metadata';
import { pdfEncryptTool } from '@/tools/pdf-encrypt';
import { pdfCropTool } from '@/tools/pdf-crop';
import { pdfGrayscaleTool } from '@/tools/pdf-grayscale';
import { pdfAnnotateTool } from '@/tools/pdf-annotate';
import { richTextEditorTool } from '@/tools/rich-text-editor';
import { slideEditorTool } from '@/tools/slide-editor';
import { spreadsheetEditorTool } from '@/tools/spreadsheet-editor';
import { flowchartEditorTool } from '@/tools/flowchart-editor';
import { mindmapEditorTool } from '@/tools/mindmap-editor';
import { photoEditorTool } from '@/tools/photo-editor';
import { ipCalcTool } from '@/tools/ip-calc';
import { macAddressTool } from '@/tools/mac-address';
import { urlParserTool } from '@/tools/url-parser';
import { uaGeneratorTool } from '@/tools/ua-generator';
import { httpHeadersTool } from '@/tools/http-headers';
import { httpRequestTool } from '@/tools/http-request';
import { websocketTesterTool } from '@/tools/websocket-tester';
import { randomPortTool } from '@/tools/random-port';
import { pdfExtractTextTool } from '@/tools/pdf-extract-text';
import { pdfDecryptTool } from '@/tools/pdf-decrypt';
import { pdfWatermarkTool } from '@/tools/pdf-watermark';
import { pdfCompressTool } from '@/tools/pdf-compress';
import { baseEncodingTool } from '@/tools/base-encoding';
import { morseCodeTool } from '@/tools/morse-code';
import { caesarCipherTool } from '@/tools/caesar-cipher';
import { escapeUnescapeTool } from '@/tools/escape-unescape';
import { encodingRescueTool } from '@/tools/encoding-rescue';
import { rsaCryptoTool } from '@/tools/rsa-crypto';
import { keyConverterTool } from '@/tools/key-converter';
import { passwordHashTool } from '@/tools/password-hash';
import { checksumTool } from '@/tools/checksum';
import { passwordStrengthTool } from '@/tools/password-strength';
import { csvTool } from '@/tools/csv-tool';
import { codeMinifyTool } from '@/tools/code-minify';
import { idGeneratorTool } from '@/tools/id-generator';
import { barcodeTool } from '@/tools/barcode';
import { zipManagerTool } from '@/tools/zip-manager';
import { fileSplitMergeTool } from '@/tools/file-split-merge';
import { bulkRenameTool } from '@/tools/bulk-rename';
import { imageGridCutTool } from '@/tools/image-grid-cut';
import { idPhotoTool } from '@/tools/id-photo';
import { imageAsciiTool } from '@/tools/image-ascii';
import { unitConverterTool } from '@/tools/unit-converter';
import { timezoneConverterTool } from '@/tools/timezone-converter';
import { taxLoanCalculatorTool } from '@/tools/tax-loan-calculator';
import { httpStatusTool } from '@/tools/http-status';
import { mimeTypesTool } from '@/tools/mime-types';
import { gitCheatsheetTool } from '@/tools/git-cheatsheet';
import { audioConvertTool } from '@/tools/audio-convert';
import { videoToGifTool } from '@/tools/video-to-gif';
import { videoConvertTool } from '@/tools/video-convert';
import { subtitleTool } from '@/tools/subtitle-tool';

/**
 * 全项目唯一的聚合注册入口：新增工具仅需在此追加一行。
 * 侧边栏、首页卡片、搜索索引、路由表均由本注册表派生（技术设计 §5）。
 */
export const tools: ToolMeta[] = [
  base64Tool,
  urlCodecTool,
  unicodeCodecTool,
  asciiTableTool,
  hexCodecTool,
  urlQueryTool,
  gzipTool,
  regexTesterTool,
  textDiffTool,
  textCounterTool,
  textLinesTool,
  caseConvertTool,
  jsonFormatTool,
  jsonConvertTool,
  jsonPathTool,
  timestampTool,
  calendarTool,
  countdownTool,
  stopwatchTool,
  uuidTool,
  hashTool,
  jwtParserTool,
  aesCryptoTool,
  hmacTool,
  totpTool,
  x509DecodeTool,
  passwordGenTool,
  randomNumberTool,
  randomStringTool,
  fakeDataTool,
  entityCodecTool,
  cronParserTool,
  cronGeneratorTool,
  convertDataTool,
  sqlFormatTool,
  htmlFormatTool,
  jsFormatTool,
  cssFormatTool,
  cssButtonTool,
  xmlFormatTool,
  xmlJsonTool,
  latexEditorTool,
  qrcodeTool,
  colorConverterTool,
  htmlColorPickerTool,
  webColorTableTool,
  imageColorPickerTool,
  radixConverterTool,
  markdownPreviewTool,
  imageCompressTool,
  imageWatermarkTool,
  imageMergeTool,
  imageFrameTool,
  imageAdjustTool,
  imageCropTool,
  gifFramesTool,
  placeholderImageTool,
  svgToPngTool,
  imageBase64Tool,
  imageIcoTool,
  imageToPaperTool,
  exifStripTool,
  textCardTool,
  imageCardTool,
  mdToImageTool,
  pinyinTool,
  zhConvertTool,
  lengthConverterTool,
  weightConverterTool,
  doodleBoardTool,
  calculatorTool,
  codeImageTool,
  codeHighlightTool,
  cssGradientTool,
  css3GeneratorTool,
  chartGeneratorTool,
  mermaidEditorTool,
  mdMindmapTool,
  aiPromptsTool,
  hsvCmykTool,
  xsltTransformTool,
  cidrCalcTool,
  ipCalcTool,
  macAddressTool,
  urlParserTool,
  uaGeneratorTool,
  httpHeadersTool,
  httpRequestTool,
  websocketTesterTool,
  randomPortTool,
  pdfExtractTextTool,
  pdfDecryptTool,
  pdfWatermarkTool,
  pdfCompressTool,
  baseEncodingTool,
  morseCodeTool,
  caesarCipherTool,
  escapeUnescapeTool,
  encodingRescueTool,
  rsaCryptoTool,
  keyConverterTool,
  passwordHashTool,
  checksumTool,
  passwordStrengthTool,
  csvTool,
  codeMinifyTool,
  idGeneratorTool,
  barcodeTool,
  zipManagerTool,
  fileSplitMergeTool,
  bulkRenameTool,
  imageGridCutTool,
  idPhotoTool,
  imageAsciiTool,
  unitConverterTool,
  timezoneConverterTool,
  taxLoanCalculatorTool,
  httpStatusTool,
  mimeTypesTool,
  gitCheatsheetTool,
  audioConvertTool,
  videoToGifTool,
  videoConvertTool,
  subtitleTool,
  pdfMergeTool,
  pdfSplitTool,
  pdfDeletePagesTool,
  pdfExtractPagesTool,
  pdfReorderTool,
  pdfRotateTool,
  pdfToImageTool,
  imagesToPdfTool,
  pdfViewerTool,
  pdfPageNumbersTool,
  pdfHeaderFooterTool,
  pdfInsertImageTool,
  pdfAddTextTool,
  pdfSignTool,
  pdfMetadataTool,
  pdfEncryptTool,
  pdfCropTool,
  pdfGrayscaleTool,
  pdfAnnotateTool,
  bmiCalculatorTool,
  mbtiTestTool,
  uaParserTool,
  richTextEditorTool,
  spreadsheetEditorTool,
  slideEditorTool,
  flowchartEditorTool,
  mindmapEditorTool,
  photoEditorTool,
];

export const toolMap = new Map(tools.map((t) => [t.id, t]));
