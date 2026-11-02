import type { ReactNode } from 'react';
import { Icon } from '../Icon';

/**
 * Office-flavoured glyphs used by the ribbon.
 *
 * Why a second icon table instead of extending `Icon.tsx`: that module is imported by every tool page
 * and sits in the entry bundle (180KB budget), while these glyphs are only reachable from the
 * lazily-loaded editors. `RibbonIcon` falls back to `Icon` for the names that already exist there.
 *
 * Character glyphs (B / I / U / S) are drawn as SVG `<text>` so they keep the same 24×24 box and
 * currentColor as the rest of the set.
 */

/** Bare glyph used to compose small superscript / subscript / list markers at an explicit position */
const smallText = (char: string, x: number, y: number, size: number): ReactNode => (
  <text
    x={x}
    y={y}
    textAnchor="middle"
    fontSize={size}
    fontWeight="700"
    fill="currentColor"
    stroke="none"
  >
    {char}
  </text>
);

const textGlyph = (char: string, italic = false): ReactNode => (
  <text
    x="12"
    y="18"
    textAnchor="middle"
    fontSize="16"
    fontWeight="700"
    fontStyle={italic ? 'italic' : 'normal'}
    fontFamily="Georgia, 'Times New Roman', serif"
    fill="currentColor"
    stroke="none"
  >
    {char}
  </text>
);

const officeIcons: Record<string, ReactNode> = {
  /* ------------------------------- character ------------------------------- */
  bold: textGlyph('B'),
  italic: textGlyph('I', true),
  underline: (
    <>
      {textGlyph('U')}
      <path d="M6 21h12" strokeWidth={1.5} />
    </>
  ),
  strike: (
    <>
      {textGlyph('S')}
      <path d="M4 12h16" strokeWidth={1.5} />
    </>
  ),
  fontGrow: (
    <>
      <path d="M3 19 8 6l5 13M4.8 15h6.4" />
      <path d="M17 17V7m0 0-2.5 2.5M17 7l2.5 2.5" />
    </>
  ),
  fontShrink: (
    <>
      <path d="M3 19 8 6l5 13M4.8 15h6.4" />
      <path d="M17 7v10m0 0-2.5-2.5M17 17l2.5-2.5" />
    </>
  ),
  fontColor: (
    <>
      <path d="M5 15 10 4l5 11M6.8 11.5h6.4" />
      <path d="M4 20h16" strokeWidth={3} />
    </>
  ),
  fillColor: (
    <>
      <path d="M9 3.5 4.5 8l6 6L15 9.5z" />
      <path d="M7 6 4 3" />
      <path d="M18 14c1.6 2 2.5 3.2 2.5 4.3A2.5 2.5 0 0 1 16 19c0-1.1.9-2.3 2-4z" />
    </>
  ),
  /* -------------------------------- borders -------------------------------- */
  borders: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
      <path d="M3.5 9.5h17M3.5 15h17M9.5 3.5v17M15 3.5v17" />
    </>
  ),
  borderBottom: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1" strokeDasharray="2 2" opacity="0.5" />
      <path d="M3.5 17.5h17" strokeWidth={2.5} />
    </>
  ),
  borderTop: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1" strokeDasharray="2 2" opacity="0.5" />
      <path d="M3.5 6h17" strokeWidth={2.5} />
    </>
  ),
  borderLeft: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1" strokeDasharray="2 2" opacity="0.5" />
      <path d="M6 3.5v17" strokeWidth={2.5} />
    </>
  ),
  borderRight: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1" strokeDasharray="2 2" opacity="0.5" />
      <path d="M18 3.5v17" strokeWidth={2.5} />
    </>
  ),
  borderNone: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1" strokeDasharray="2 2" opacity="0.5" />
      <path d="M4 20 20 4" />
    </>
  ),
  borderOutside: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1" strokeWidth={2.2} />
      <path d="M9.5 9.5h5v5h-5z" strokeDasharray="2 2" opacity="0.5" />
    </>
  ),
  /* ------------------------------ cell layout ------------------------------ */
  mergeCenter: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="1" />
      <path d="M8 12h8M8 12l2-2M8 12l2 2M16 12l-2-2M16 12l-2 2" />
    </>
  ),
  mergeAcross: (
    <>
      <rect x="3.5" y="6" width="17" height="5" rx="1" />
      <rect x="3.5" y="13" width="17" height="5" rx="1" />
    </>
  ),
  unmerge: (
    <>
      <rect x="3.5" y="6" width="7" height="12" rx="1" />
      <rect x="13.5" y="6" width="7" height="12" rx="1" />
    </>
  ),
  alignLeftCell: <path d="M4 6h16M4 12h9M4 18h13" />,
  alignCenterCell: <path d="M4 6h16M7.5 12h9M5.5 18h13" />,
  alignRightCell: <path d="M4 6h16M11 12h9M7 18h13" />,
  alignTopCell: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="1" strokeDasharray="2 2" opacity="0.5" />
      <path d="M4 6.5h16" strokeWidth={2.2} />
    </>
  ),
  alignMiddleCell: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="1" strokeDasharray="2 2" opacity="0.5" />
      <path d="M4 12h16" strokeWidth={2.2} />
    </>
  ),
  alignBottomCell: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="1" strokeDasharray="2 2" opacity="0.5" />
      <path d="M4 17.5h16" strokeWidth={2.2} />
    </>
  ),
  wrapText: (
    <>
      <path d="M4 5h16M4 10h11a3 3 0 0 1 0 6h-3" />
      <path d="m14 13-2 3 2 3" />
      <path d="M4 19h6" />
    </>
  ),
  /* ------------------------------- numbers -------------------------------- */
  currency: (
    <>
      <path d="M12 3v18" />
      <path d="M16.5 7.5A4 4 0 0 0 13 5.5h-2a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2a4 4 0 0 1-3.5-2" />
    </>
  ),
  percent: (
    <>
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
      <path d="M19 5 5 19" />
    </>
  ),
  thousandSeparator: (
    <>
      <path d="M6 7h5M6 12h8M6 17h3" />
      <path d="m16 12-2 6" strokeWidth={2.4} />
    </>
  ),
  decimalAdd: (
    <>
      <path d="M5 18V6M5 18h6" />
      <path d="M17 9v8M13 13h8" />
    </>
  ),
  decimalRemove: (
    <>
      <path d="M5 18V6M5 18h6" />
      <path d="M13 13h8" />
    </>
  ),
  numberFormat: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M8.5 8.5v7M5.5 15.5h6M14 8.5h4.5M14 12h4.5M14 15.5h4.5" />
    </>
  ),
  /* --------------------------------- data --------------------------------- */
  sortAsc: (
    <>
      <path d="M4 6h9M4 12h6M4 18h3" />
      <path d="M18 5v14m0 0-3.5-3.5M18 19l3.5-3.5" />
    </>
  ),
  sortDesc: (
    <>
      <path d="M4 6h3M4 12h6M4 18h9" />
      <path d="M18 19V5m0 0-3.5 3.5M18 5l3.5 3.5" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  clearFilter: (
    <>
      <path d="M3 5h13l-5 6v5l-3 1.5V11z" />
      <path d="m16 15 5 5m0-5-5 5" />
    </>
  ),
  dataValidation: (
    <>
      <path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6z" />
      <path d="m8.5 12 2.5 2.5L15.5 10" />
    </>
  ),
  conditionalFormat: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M7 15V9M12 15v-3M17 15V7" />
    </>
  ),
  autoSum: <path d="M17 5H8l5 7-5 7h9" />,
  cellStyles: (
    <>
      <path d="M4 6h12M4 12h12M4 18h8" />
      <circle cx="18" cy="16" r="3.5" />
      <path d="M18 12.5V10a2 2 0 0 1 2-2h1" />
    </>
  ),
  tableStyles: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M9.5 9.5v10M15 9.5v10" />
      <path d="M3.5 9.5h17" strokeWidth={2.4} />
    </>
  ),
  /* -------------------------------- cells --------------------------------- */
  insertCell: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" strokeDasharray="2 2" opacity="0.6" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  deleteCell: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" strokeDasharray="2 2" opacity="0.6" />
      <path d="M8 12h8" />
    </>
  ),
  rowHeight: (
    <>
      <path d="M4 5h16M4 19h16" />
      <path d="M12 8v8m0-8-2 2m2-2 2 2m-2 8-2-2m2 2 2-2" />
    </>
  ),
  columnWidth: (
    <>
      <path d="M5 4v16M19 4v16" />
      <path d="M8 12h8m-8 0 2-2m-2 2 2 2m6-2-2-2m2 2-2 2" />
    </>
  ),
  fillDown: (
    <>
      <path d="M12 3v11m0 0-3-3m3 3 3-3" />
      <rect x="4" y="17" width="16" height="4" rx="1" />
    </>
  ),
  formatPainter: (
    <>
      <path d="M5 4h9a1 1 0 0 1 1 1v4H5z" />
      <path d="M7 9h5v3H7z" />
      <path d="M8 12h3v8H8z" />
    </>
  ),
  comment: (
    <>
      <path d="M4 5h16v11H9l-4 3z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  pivot: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M3.5 9.5h17M9.5 3.5v17" />
      <path d="M13 13h5v5h-5z" />
    </>
  ),
  /* ------------------------------- page setup ------------------------------ */
  pageSetup: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <circle cx="11" cy="14" r="2" />
      <path d="M9.5 18.5h5" />
    </>
  ),
  orientation: (
    <>
      <rect x="7" y="3.5" width="10" height="17" rx="1.5" />
      <path d="M10.5 16.5h3" />
    </>
  ),
  margins: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M7 12h10m-10 0 2-2m-2 2 2 2m8-2-2-2m2 2-2 2" />
    </>
  ),
  printArea: (
    <>
      <rect x="3.5" y="4.5" width="17" height="12" rx="1.5" />
      <path d="M7 20h10M9 16v4M15 16v4" />
    </>
  ),
  /* ---------------------------------- view --------------------------------- */
  freeze: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M3.5 9.5h17M9.5 3.5v17" />
      <path d="M3.5 9.5h6v-6" strokeWidth={2.4} opacity="0.7" />
    </>
  ),
  gridlines: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M3.5 9h17M3.5 15h17M9 3.5v17M15 3.5v17" />
    </>
  ),
  functionWizard: (
    <>
      <path d="M14 5h-2a3 3 0 0 0-3 3v11" />
      <path d="M6 11h6" />
      <path d="m16 13 5 8m0-8-5 8" />
    </>
  ),
  calcOptions: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M8.5 7.5h7M8.5 12h2M13.5 12h2M8.5 16h2M13.5 16h2" />
    </>
  ),
  paintBucket: (
    <>
      <path d="M9 3.5 4.5 8l6 6L15 9.5z" />
      <path d="M7 6 4 3" />
      <path d="M18 14c1.6 2 2.5 3.2 2.5 4.3A2.5 2.5 0 0 1 16 19c0-1.1.9-2.3 2-4z" />
    </>
  ),
  /* ------------------------- character (word processor) ------------------------- */
  superscript: (
    <>
      {smallText('x', 9, 18, 13)}
      {smallText('2', 17, 9, 9)}
    </>
  ),
  subscript: (
    <>
      {smallText('x', 9, 15, 13)}
      {smallText('2', 17, 21, 9)}
    </>
  ),
  smallCaps: (
    <>
      {smallText('A', 9, 18, 15)}
      {smallText('A', 17, 18, 10)}
    </>
  ),
  textTransform: smallText('Aa', 12, 17, 14),
  codeMark: <path d="m9 8-4 4 4 4M15 8l4 4-4 4" />,
  codeBlock: (
    <>
      <path d="M9 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2" />
      <path d="M15 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" />
    </>
  ),
  letterSpacing: (
    <>
      <path d="M4 5v14M20 5v14" />
      <path d="M8 12h8m-8 0 2-2m-2 2 2 2m6-2-2-2m2 2-2 2" />
    </>
  ),
  /* --------------------------------- lists --------------------------------- */
  bulletList: (
    <>
      <circle cx="5" cy="7" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="5" cy="17" r="1.5" />
      <path d="M9 7h11M9 12h11M9 17h11" />
    </>
  ),
  orderedList: (
    <>
      {smallText('1', 5, 8, 8)}
      {smallText('2', 5, 15, 8)}
      {smallText('3', 5, 22, 8)}
      <path d="M9 7h11M9 13h11M9 19h11" />
    </>
  ),
  taskList: (
    <>
      <rect x="3" y="4" width="6" height="6" rx="1" />
      <path d="m4.5 7 1.5 1.5L8 6" />
      <path d="M12 7h9M4 14h17M4 19h13" />
    </>
  ),
  quote: (
    <>
      <path d="M9 7H5v6h4V9" />
      <path d="M19 7h-4v6h4V9" />
    </>
  ),
  /* -------------------------------- insert -------------------------------- */
  math: (
    <>
      {smallText('f', 10, 18, 13)}
      {smallText('x', 17, 18, 10)}
    </>
  ),
  horizontalRule: <path d="M4 12h16" strokeWidth={2.4} />,
  pageBreak: (
    <>
      <path d="M3 6h6M15 6h6" />
      <path d="M3 18h6M15 18h6" />
      <path d="M12 8v2m0 4v2" />
    </>
  ),
  shapeInsert: (
    <>
      <rect x="3" y="3" width="11" height="11" rx="1.5" />
      <circle cx="16" cy="16" r="5" />
    </>
  ),
  footnote: (
    <>
      {smallText('1', 16, 9, 8)}
      <path d="M5 12h7M4 19h16" />
    </>
  ),
  endnote: (
    <>
      {smallText('1', 16, 9, 8)}
      <path d="M4 15h16M4 19h16" />
    </>
  ),
  bookmark: <path d="M6 3.5h12v17l-6-4.2-6 4.2z" />,
  crossReference: (
    <>
      <path d="M4 5h9v14H4z" />
      <path d="M16 12h5m-5 0 3-3m-3 3 3 3" />
    </>
  ),
  toc: (
    <>
      <path d="M4 6h9M4 12h9M4 18h6" />
      <path d="M16 6h4M16 12h4M16 18h4" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.5 6.3" />
      <path d="M20 5v6h-6" />
    </>
  ),
  /* ------------------------------ paragraph ------------------------------- */
  alignJustify: <path d="M4 6h16M4 12h16M4 18h16" />,
  indentIncrease: (
    <>
      <path d="M4 6h16M10 12h10M4 18h16" />
      <path d="m4 12 4-3v6z" />
    </>
  ),
  indentDecrease: (
    <>
      <path d="M4 6h16M10 12h10M4 18h16" />
      <path d="m8 12-4-3v6z" />
    </>
  ),
  hangingIndent: (
    <>
      <path d="M4 6h16M8 12h12M8 18h12" />
      <path d="M4 9v6m0-6 2 2m-2-2-2 2m2 6 2-2m-2 2-2-2" />
    </>
  ),
  paragraphSpacing: (
    <>
      <path d="M4 5h10M4 19h10" />
      <path d="M18 6v12m0-12-2 2m2-2 2 2m-2 12-2-2m2 2 2-2" />
    </>
  ),
  /* -------------------------------- images -------------------------------- */
  imageWidth: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="1.5" />
      <path d="M3 20h18m-18 0 2-2m-2 2 2 2m16-2-2-2m2 2-2 2" />
    </>
  ),
  imageLayer: (
    <>
      <rect x="7" y="4" width="12" height="9" rx="1.5" />
      <path d="M4 9v8a2 2 0 0 0 2 2h9" />
    </>
  ),
  imageAlignLeft: (
    <>
      <rect x="2" y="4.5" width="11" height="6" rx="1" />
      <path d="M2 14h8M2 17.5h5" />
    </>
  ),
  imageAlignCenter: (
    <>
      <rect x="6.5" y="4.5" width="11" height="6" rx="1" />
      <path d="M5 14h14M7 17.5h10" />
    </>
  ),
  imageAlignRight: (
    <>
      <rect x="11" y="4.5" width="11" height="6" rx="1" />
      <path d="M14 14h8M17 17.5h5" />
    </>
  ),
  /* ------------------------------ arrange (slides) ------------------------------ */
  alignArrange: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M6.5 8h8M6.5 12h11M6.5 16h6" />
    </>
  ),
  distribute: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 7v10M12 5v14M17 7v10" />
    </>
  ),
  layerFront: (
    <>
      <rect x="3.5" y="3.5" width="11" height="11" rx="1.5" />
      <path d="M9 17.5h11v-11" />
    </>
  ),
  layerForward: (
    <>
      <rect x="7" y="7" width="13" height="13" rx="1.5" />
      <path d="M7 12 3.5 8.5 7 5" />
      <path d="M3.5 8.5h7" />
    </>
  ),
  layerBackward: (
    <>
      <rect x="4" y="4" width="13" height="13" rx="1.5" />
      <path d="M17 12l3.5 3.5L17 19" />
      <path d="M20.5 15.5h-7" />
    </>
  ),
  layerBack: (
    <>
      <rect x="9.5" y="9.5" width="11" height="11" rx="1.5" />
      <path d="M15 6.5H4v11" />
    </>
  ),
  group: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" strokeDasharray="2 1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1" strokeDasharray="2 1.6" />
      <path d="M10 6.5h4v11h-4" />
    </>
  ),
  ungroup: (
    <>
      <rect x="2.5" y="2.5" width="7.5" height="7.5" rx="1" />
      <rect x="14" y="14" width="7.5" height="7.5" rx="1" />
      <path d="M13 11 11 13m0-2 2 2" />
    </>
  ),
  flipH: (
    <>
      <path d="M12 3v18" strokeDasharray="2 2" />
      <path d="M9 7 4 12l5 5zM15 7l5 5-5 5z" />
    </>
  ),
  flipV: (
    <>
      <path d="M3 12h18" strokeDasharray="2 2" />
      <path d="M7 9 12 4l5 5zM7 15l5 5 5-5z" />
    </>
  ),
  boolean: (
    <>
      <circle cx="9.5" cy="12" r="5.5" />
      <circle cx="14.5" cy="12" r="5.5" />
    </>
  ),
  shadow: (
    <>
      <rect x="3.5" y="3.5" width="12" height="12" rx="1.5" />
      <path d="M8 19.5h12.5V7" strokeDasharray="2.5 2" />
    </>
  ),
  opacity: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" opacity="0.45" />
    </>
  ),
  notes: (
    <>
      <rect x="3.5" y="4.5" width="17" height="10" rx="1.5" />
      <path d="M7 18.5h10M9 21h6" />
    </>
  ),
  /** Insert menu: a plus in a rounded frame */
  insert: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  /** Overflow marker: commands of groups that no longer fit inside the panel */
  more: (
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  /* ------------------------------ shape format ----------------------------- */
  /** Change shape: a square with an arrow pointing at a rounder one */
  changeShape: (
    <>
      <rect x="3" y="4" width="9" height="9" rx="1" />
      <circle cx="17" cy="17" r="4.5" />
      <path d="M13 9.5h4.5V5" />
      <path d="m13 9.5 4.5-4.5" strokeWidth="1.2" />
    </>
  ),
  /** Line weight: three rules of growing thickness */
  lineWeight: (
    <>
      <path d="M4 7h16" strokeWidth="1" />
      <path d="M4 12h16" strokeWidth="2" />
      <path d="M4 17.5h16" strokeWidth="3.5" />
    </>
  ),
  /** Dash style: a dashed rule over a solid hint */
  lineDash: (
    <>
      <path d="M3 8h4M10 8h4M17 8h4" strokeWidth="2" />
      <path d="M3 14h18" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  /* --------------------------------- tables -------------------------------- */
  rowAbove: (
    <>
      <rect x="3.5" y="10" width="17" height="10" rx="1.5" />
      <path d="M3.5 15h17M12 10v10" />
      <path d="M12 3v4m-2-2 2-2 2 2" />
    </>
  ),
  rowBelow: (
    <>
      <rect x="3.5" y="4" width="17" height="10" rx="1.5" />
      <path d="M3.5 9h17M12 4v10" />
      <path d="M12 21v-4m-2 2 2 2 2-2" />
    </>
  ),
  columnLeft: (
    <>
      <rect x="10" y="3.5" width="10" height="17" rx="1.5" />
      <path d="M15 3.5v17M10 12h10" />
      <path d="M7 12H3m2 2-2-2 2-2" />
    </>
  ),
  columnRight: (
    <>
      <rect x="4" y="3.5" width="10" height="17" rx="1.5" />
      <path d="M9 3.5v17M4 12h10" />
      <path d="M17 12h4m-2-2 2 2-2 2" />
    </>
  ),
  rowDelete: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
      <path d="M3.5 12h17M12 6v12" />
      <path d="M4 3.5 20 20.5" strokeWidth={1.4} />
    </>
  ),
  columnDelete: (
    <>
      <rect x="6" y="3.5" width="12" height="17" rx="1.5" />
      <path d="M12 3.5v17M6 12h12" />
      <path d="M3.5 4 20.5 20" strokeWidth={1.4} />
    </>
  ),
  headerRow: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17" strokeWidth={2.4} />
      <path d="M9.5 9.5v10M15 9.5v10" />
    </>
  ),
  tableDelete: (
    <>
      <rect x="3.5" y="4.5" width="12" height="15" rx="1.5" />
      <path d="M3.5 9.5h12M9.5 4.5v15" />
      <path d="m17 12 5 5m0-5-5 5" />
    </>
  ),
  tableZebra: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <rect
        x="3.5"
        y="9.5"
        width="17"
        height="5"
        fill="currentColor"
        stroke="none"
        opacity="0.25"
      />
      <path d="M3.5 9.5h17M3.5 14.5h17" />
    </>
  ),
};

export function RibbonIcon({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  const glyph = officeIcons[name];
  if (!glyph) return <Icon name={name} className={className} />;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}
