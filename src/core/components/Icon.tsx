import type { ReactNode } from 'react';

/**
 * 内置轻量图标集：不引入图标库依赖，控制包体积（技术设计 §3.1）。
 * 工具通过 ToolMeta.icon 引用此处名称。
 */
const icons: Record<string, ReactNode> = {
  wrench: (
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5 2.5-2.5Z" />
  ),
  binary: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
      <path d="M14 7h6M7 14v6" />
    </>
  ),
  regex: <path d="M12 4v16M5 8l14 8M19 8 5 16" />,
  braces: (
    <path d="M8 4C6 4 5 5 5 7v2c0 1-1 2-2 2 1 0 2 1 2 2v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1 1 2 2 2-1 0-2 1-2 2v2c0 2-1 3-3 3" />
  ),
  link: (
    <>
      <path d="M10 14a5 5 0 0 0 7.1 0l2.8-2.8a5 5 0 0 0-7.1-7.1L11 6" />
      <path d="M14 10a5 5 0 0 0-7.1 0l-2.8 2.8a5 5 0 0 0 7.1 7.1L13 18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  hash: <path d="M5 9h14M5 15h14M9 4 7 20M17 4l-2 16" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 9.2-9.2M17 6l3 3M14 9l2 2" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  qr: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v2M14 20h2M18 18l2 2" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.9-4-6.7-9-6.7Z" />
      <circle cx="7.5" cy="11.5" r="1" fill="currentColor" />
      <circle cx="10.5" cy="7.5" r="1" fill="currentColor" />
      <circle cx="15" cy="8" r="1" fill="currentColor" />
    </>
  ),
  bits: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9v6M10 9v6M14 9h3M14 12h3M14 15h3" />
    </>
  ),
  markdown: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15V9l2.5 3L12 9v6M17 9v6m0 0 1.5-1.5M17 15l-1.5-1.5" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m4 17 5-4 3 2 4-4 4 4" />
    </>
  ),
  text: <path d="M4 6h16M4 12h10M4 18h7" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="9" r="1" fill="currentColor" />
      <circle cx="15" cy="15" r="1" fill="currentColor" />
      <circle cx="15" cy="9" r="1" fill="currentColor" />
      <circle cx="9" cy="15" r="1" fill="currentColor" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  star: <path d="m12 3 2.7 5.6 6.3.9-4.5 4.3 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.5l6.3-.9L12 3Z" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </>
  ),
  check: <path d="m5 12 5 5 9-10" />,
  download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />,
  upload: <path d="M12 15V3m0 0 4 4m-4-4L8 7M4 21h16" />,
  swap: <path d="M7 4v13m0 0-3-3m3 3 3-3M17 20V7m0 0-3 3m3-3 3-3" />,
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
    </>
  ),
  diff: (
    <>
      <rect x="3" y="4" width="8" height="16" rx="1" />
      <rect x="13" y="4" width="8" height="16" rx="1" />
      <path d="M6 9h2M6 12h2M16 9h2M16 15h2" />
    </>
  ),
  html: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="m8 10 2 2-2 2M16 10l-2 2 2 2M12 9l-1 6" />
    </>
  ),
  css: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M8 9h5a2.5 2.5 0 0 1 0 5H8V9ZM15 9h2M15 14h2" />
    </>
  ),
  xml: (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="M8 9h3M8 12h5M8 15h4M15 9l2 3-2 3" />
    </>
  ),
  unicode: (
    <>
      <path d="M4 6h16v12H4z" />
      <path d="M8 10h2.5M8 14h3M14 10h2M14 14h2" />
    </>
  ),
  eyedropper: (
    <>
      <path d="m14 6 4 4-8.5 8.5a2.1 2.1 0 0 1-3-3L14 6Z" />
      <path d="m16 8 2.5-2.5a1.5 1.5 0 0 1 2 2L18 10" />
    </>
  ),
  ruler: (
    <>
      <path d="M3 14 14 3l7 7-11 11-7-7Z" />
      <path d="m7 10 1 1M9 8l1 1M11 6l1 1M13 12l1 1M11 14l1 1" />
    </>
  ),
  pinyin: (
    <>
      <path d="M5 18V8l4 6 4-6v10" />
      <path d="M16 18V9h3a2.5 2.5 0 0 1 0 5h-3" />
    </>
  ),
  zh: (
    <>
      <path d="M6 5h12M12 5v14M8 12h8" />
      <path d="M7 19h10" />
    </>
  ),
  weight: (
    <>
      <path d="M12 3v3M8 21h8l1-10H7l1 10Z" />
      <circle cx="12" cy="8" r="2" />
    </>
  ),
  counter: (
    <>
      <path d="M4 6h16v12H4z" />
      <path d="M8 10h2M8 14h5M14 10h2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  button: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="2" />
      <path d="M8 12h8" />
    </>
  ),
  calc: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h3M13 16h3" />
    </>
  ),
  pen: (
    <>
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z" />
    </>
  ),
  codeImage: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m8 14 2-2 2 2 3-3" />
      <circle cx="9" cy="9" r="1" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 10h18M3 15h18M9 5v14M15 5v14" />
    </>
  ),
  'web-color-table': (
    <>
      <rect x="3" y="4" width="5" height="5" rx="0.5" />
      <rect x="10" y="4" width="5" height="5" rx="0.5" />
      <rect x="17" y="4" width="4" height="5" rx="0.5" />
      <rect x="3" y="11" width="5" height="5" rx="0.5" />
      <rect x="10" y="11" width="5" height="5" rx="0.5" />
      <rect x="17" y="11" width="4" height="5" rx="0.5" />
      <path d="M3 19h18" />
    </>
  ),
  watermark: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 16 16 8M10 8h4v4" />
    </>
  ),
  caseConvert: (
    <>
      <path d="M4 17V7l5 10V7" />
      <path d="M14 17h6M17 7v10" />
    </>
  ),
  bmi: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 8v6M9 22l3-8 3 8M8 12h8" />
    </>
  ),
  placeholder: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 12h8M12 9v6" />
    </>
  ),
  imageMerge: (
    <>
      <rect x="3" y="5" width="8" height="8" rx="1" />
      <rect x="13" y="11" width="8" height="8" rx="1" />
      <path d="M11 9h2M15 11V9" />
    </>
  ),
  cronGen: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3M16 4l2 2M6 4 4 6" />
    </>
  ),
  ua: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 10h10M7 14h6" />
    </>
  ),
  latex: (
    <>
      <path d="M5 18 9 6h2l4 12" />
      <path d="M7.5 13h5" />
      <path d="M16 8h3M17.5 8v10" />
    </>
  ),
  countdown: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M9 3h6" />
    </>
  ),
  stopwatch: (
    <>
      <circle cx="12" cy="14" r="7" />
      <path d="M12 11v3l2 1M10 4h4M12 4v2" />
    </>
  ),
  svgPng: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15 10 11l3 3 2-2 2 2" />
      <path d="m14 9 3-3 2 2" />
    </>
  ),
  imageFrame: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="3" />
      <path d="M8 20h8" />
    </>
  ),
  imageAdjust: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  gifFrames: (
    <>
      <rect x="3" y="5" width="10" height="8" rx="1" />
      <rect x="11" y="11" width="10" height="8" rx="1" />
      <path d="M7 9h2M15 15h2" />
    </>
  ),
  imageCrop: (
    <>
      <path d="M6 3v15h15" />
      <path d="M3 6h15v15" />
    </>
  ),
  mbti: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 4h4M18 2v4" />
    </>
  ),
  textCard: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 10h8M8 14h5" />
    </>
  ),
  imageCard: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <rect x="6" y="7" width="12" height="8" rx="1" />
      <path d="M8 18h8" />
    </>
  ),
  codeHighlight: (
    <>
      <path d="M8 8 4 12l4 4M16 8l4 4-4 4" />
      <path d="m14 7-4 10" />
    </>
  ),
  'image-base64': (
    <>
      <rect x="3" y="5" width="10" height="8" rx="1" />
      <path d="M15 9h6M15 13h4M7 9h2" />
    </>
  ),
  'image-ico': (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <path d="M13 16h7M16.5 13v7" />
    </>
  ),
  'hsv-cmyk': (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v8l5 3" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </>
  ),
  'ai-prompts': (
    <>
      <path d="M5 6h14v10H9l-4 3V6Z" />
      <path d="M9 10h6M9 13h4" />
    </>
  ),
  'md-mindmap': (
    <>
      <circle cx="6" cy="12" r="2" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="16" cy="17" r="2" />
      <path d="M8 12h6M14 12l2-4M14 12l2 4" />
    </>
  ),
  mermaid: (
    <>
      <path d="M5 8h5v4H5zM14 8h5v4h-5zM9.5 16h5v4h-5z" />
      <path d="M10 12v2M16.5 12v2M12 14v2" />
    </>
  ),
  'css-gradient': (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 12h16" />
    </>
  ),
  'image-to-paper': (
    <>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M9 14h6M9 17h4" />
    </>
  ),
  'md-to-image': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15V9l2 2.5L11 9v6M15 11h3M15 14h2" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 16v-5M12 16V8M16 16v-3" />
    </>
  ),
  css3: (
    <>
      <path d="M5 4h14l-1.5 16L12 22l-5.5-2L5 4Z" />
      <path d="M9 9h7l-.4 4H10.5l.2 2H15l-.3 2.5L12 18.5 9.5 17.7" />
    </>
  ),
  xslt: (
    <>
      <path d="M5 7h6v4H5zM13 13h6v4h-6z" />
      <path d="M11 9h4M13 9v4" />
    </>
  ),
  pdf: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  pdfMerge: (
    <>
      <path d="M8 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h6" />
      <path d="M16 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-6" />
      <path d="M10 12h4M12 10v4" />
    </>
  ),
  pdfSplit: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" />
      <path d="M14 3v5h5M17 12v8M14 16h6" />
    </>
  ),
  pdfDelete: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6" />
      <path d="m16 11 4 4M20 11l-4 4" />
    </>
  ),
  pdfExtract: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <path d="M14 3v5h5M16 13h5M18.5 10.5 21 13l-2.5 2.5" />
    </>
  ),
  pdfReorder: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h0M4 12h0M4 18h0" />
    </>
  ),
  pdfRotate: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </>
  ),
  pdfToImage: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <rect x="13" y="12" width="8" height="7" rx="1" />
      <path d="m13.5 19 2-1.5 1.5 1 2-2" />
    </>
  ),
  imagesToPdf: (
    <>
      <rect x="3" y="5" width="8" height="6" rx="1" />
      <rect x="3" y="13" width="8" height="6" rx="1" />
      <path d="M14 8h7v11a1 1 0 0 1-1 1h-5M14 8V5h4" />
    </>
  ),
  pdfViewer: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M8 12h8M8 16h5" />
    </>
  ),
  pdfPageNumbers: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 17h6" />
    </>
  ),
  pdfHeaderFooter: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M8 8h4M8 18h8" />
    </>
  ),
  pdfInsertImage: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M8 18l3-3 2 2 3-3" />
    </>
  ),
  pdfAddText: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 14h6M12 11v6" />
    </>
  ),
  pdfSign: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M8 16c2-3 4-3 6 0" />
    </>
  ),
  pdfMetadata: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 12h6M9 15h4" />
    </>
  ),
  pdfEncrypt: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <rect x="9" y="13" width="6" height="5" rx="1" />
      <path d="M11 13v-1a1 1 0 0 1 2 0v1" />
    </>
  ),
  pdfCrop: (
    <>
      <path d="M6 3v15h15M3 6h15v15M9 9h7v7" />
    </>
  ),
  pdfGrayscale: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 14h6" />
    </>
  ),
  pdfAnnotate: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M8 15h5M9 12h7" />
    </>
  ),
};

interface IconProps {
  name: string;
  className?: string;
}

export function Icon({ name, className = 'h-5 w-5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {icons[name] ?? icons.wrench}
    </svg>
  );
}
