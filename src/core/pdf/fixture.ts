import { PDFDocument } from '@cantoo/pdf-lib';

/** 最小多页 PDF fixture（用于单测） */
export async function makeFixturePdf(pageCount = 3): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([200 + i * 10, 280]);
  }
  return doc.save();
}

export async function loadFixture(pageCount = 3) {
  const bytes = await makeFixturePdf(pageCount);
  return PDFDocument.load(bytes);
}
