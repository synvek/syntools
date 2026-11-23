/**
 * Generate the PDF fixtures the editor's tests and manual checks rely on.
 *
 *   node scripts/make-pdf-fixtures.mjs
 *
 * Deterministic on purpose: fixed creation date, no compression randomness beyond pdf-lib's own
 * (object streams), so re-running produces byte-identical files and a diff in `fixtures/pdf/`
 * always means "the generator changed", never "someone re-ran it".
 *
 * `large-8mb.pdf` from the plan is deliberately *not* generated: the 20MB threshold is covered by
 * `src/tools/pdf-editor/io/largeDoc.test.ts`, and an 8–20MB binary in git would cost every clone.
 */

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, degrees, rgb } from '@cantoo/pdf-lib';

const OUT_DIR = fileURLToPath(new URL('../fixtures/pdf/', import.meta.url));
const FIXED_DATE = new Date('2026-01-01T00:00:00Z');

/** @param {PDFDocument} doc */
function finalize(doc, title) {
  doc.setTitle(title);
  doc.setAuthor('SynTools fixtures');
  doc.setCreator('SynTools');
  doc.setProducer('SynTools');
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  return doc.save({ useObjectStreams: true });
}

/** A4 portrait with a small margin, matching what the editor defaults to */
async function a4(title) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);
  return { doc, font, bold, page, title };
}

/** AcroForm fields: one text field, one checkbox, one dropdown (P1-B / page ops regression) */
async function formAcroform() {
  const { doc, page, font, title } = await a4('Form');
  page.drawText('Employee onboarding form', { x: 56, y: 780, size: 16, font });
  page.drawText('Full name', { x: 56, y: 730, size: 11, font });
  page.drawText('Agree to the policy', { x: 56, y: 690, size: 11, font });
  page.drawText('Department', { x: 56, y: 650, size: 11, font });

  const form = doc.getForm();
  const name = form.createTextField('fullName');
  name.setText('Alice Example');
  name.addToPage(page, { x: 160, y: 722, width: 260, height: 22, font });

  const agree = form.createCheckBox('agreePolicy');
  agree.addToPage(page, { x: 180, y: 686, width: 16, height: 16 });

  const department = form.createDropdown('department');
  department.setOptions(['Engineering', 'Design', 'Operations']);
  department.select('Engineering');
  department.addToPage(page, { x: 160, y: 642, width: 200, height: 22, font });

  return finalize(doc, title);
}

/** Scanned page: ink-like rectangles, zero text operators (docx text mode has nothing to extract) */
async function scannedNoText() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  // Paper tint
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 595.28,
    height: 841.89,
    color: rgb(0.97, 0.96, 0.94),
  });
  // A faux photo / signature block, slightly rotated like a real scan
  page.drawRectangle({
    x: 120,
    y: 520,
    width: 320,
    height: 180,
    color: rgb(0.82, 0.82, 0.84),
    rotate: degrees(1.5),
  });
  for (let row = 0; row < 14; row += 1) {
    page.drawRectangle({
      x: 80,
      y: 470 - row * 22,
      width: 380 - (row % 4) * 18,
      height: 6,
      color: rgb(0.35, 0.35, 0.38),
    });
  }
  return finalize(doc, 'Scan');
}

/** Two columns of body text (M4-2 loss case: column order cannot be recovered from one text line list) */
async function twoColumn() {
  const { doc, page, font, bold, title } = await a4('Two columns');
  page.drawText('Quarterly review', { x: 56, y: 780, size: 18, font: bold });

  const paragraph =
    'The analysis covers revenue, retention and support load for the past quarter. Figures are '
      .concat('unaudited and rounded to the nearest thousand. Each column is independent text; ')
      .concat('the layout is what makes extraction hard.');

  const words = paragraph.split(' ');
  const columnWidth = 230;
  for (const [column, offset] of [
    [0, 56],
    [1, 56 + columnWidth + 24],
  ]) {
    let y = 740;
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, 10) > columnWidth) {
        page.drawText(line, { x: offset, y, size: 10, font });
        y -= 14;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) page.drawText(line, { x: offset, y, size: 10, font });
    if (column === 0) {
      page.drawText('Left column ends here.', { x: offset, y: y - 18, size: 10, font });
    }
  }
  return finalize(doc, title);
}

/** Heading + paragraph + ruled table: the sample both the text patch and `pdfStructure` use */
async function textAndTable() {
  const { doc, page, font, bold, title } = await a4('Text and table');
  page.drawText('Invoice 2026-011', { x: 56, y: 782, size: 18, font: bold });
  page.drawText('Bill to: Example Trading Co.', { x: 56, y: 752, size: 11, font });
  page.drawText('Issued: 2026-01-01', { x: 56, y: 734, size: 11, font });

  const rows = [
    ['Item', 'Qty', 'Unit price', 'Amount'],
    ['Design work', '12', '120.00', '1440.00'],
    ['Development', '40', '150.00', '6000.00'],
    ['Support', '6', '90.00', '540.00'],
    ['Total', '', '', '7980.00'],
  ];
  const left = 56;
  const width = 480;
  const rowHeight = 26;
  const top = 660;
  const columns = [0, 240, 300, 390];

  for (let row = 0; row < rows.length; row += 1) {
    const y = top - row * rowHeight;
    page.drawLine({
      start: { x: left, y: y - 6 },
      end: { x: left + width, y: y - 6 },
      thickness: row === 0 ? 1.4 : 0.6,
      color: rgb(0.4, 0.4, 0.4),
    });
    rows[row].forEach((cell, index) => {
      if (!cell) return;
      page.drawText(cell, {
        x: left + 6 + columns[index],
        y,
        size: 10,
        font: row === 0 || row === rows.length - 1 ? bold : font,
      });
    });
  }

  page.drawText('Payment due within 30 days.', { x: 56, y: 470, size: 10, font });
  return finalize(doc, title);
}

const targets = [
  ['form-acroform.pdf', formAcroform],
  ['scanned-no-text.pdf', scannedNoText],
  ['two-column.pdf', twoColumn],
  ['text-and-table.pdf', textAndTable],
];

await mkdir(OUT_DIR, { recursive: true });
for (const [name, build] of targets) {
  const bytes = await build();
  await writeFile(`${OUT_DIR}${name}`, bytes);
  const info = await stat(`${OUT_DIR}${name}`);
  console.log(`${name}: ${info.size} bytes`);
}
