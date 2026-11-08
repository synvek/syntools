import { describe, expect, it } from 'vitest';
import { exportDocxBlob, importDocx, type ImportedIr } from './docx';
import { DEFAULT_PAGE_SETUP } from './pageSetup';

/**
 * P0-2.6 acceptance: the structured IR is a side channel.
 * With `USE_OOXML_IR` off (the default) nothing changes at all; with it on the import still returns
 * the same HTML, and additionally reports what the IR cannot put back yet.
 */

// jsdom Blob lacks arrayBuffer(), so read bytes via FileReader
const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

const toFile = (blob: Blob, name: string): File => {
  const file = new File([blob], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  if (typeof file.arrayBuffer !== 'function') {
    Object.defineProperty(file, 'arrayBuffer', { value: () => blobToArrayBuffer(blob) });
  }
  return file;
};

// 1x1 transparent PNG: exercises the image anchor that the IR reports as a structural loss
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

const HTML = [
  '<h1>标题</h1>',
  `<p>正文<img src="${PNG}"></p>`,
  '<p><a data-bookmark="Intro"></a>书签</p>',
].join('');

async function exportedFile(): Promise<File> {
  const exported = await exportDocxBlob(HTML, 'ir', DEFAULT_PAGE_SETUP);
  if (!exported.ok) throw new Error(`export failed: ${exported.error}`);
  return toFile(exported.value, 'ir.docx');
}

describe('importDocx structured IR side channel (P0-2.6)', () => {
  it('leaves the import untouched while the flag is off', async () => {
    const file = await exportedFile();
    let calls = 0;
    const result = await importDocx(file, {
      onIr: () => {
        calls += 1;
      },
    });
    expect(result.ok).toBe(true);
    // `VITE_USE_OOXML_IR` is not defined in this repo, so the default keeps the main path alone
    expect(calls).toBe(0);
  });

  it('honours an explicit false even when a callback is present', async () => {
    const file = await exportedFile();
    let calls = 0;
    await importDocx(file, {
      useOoxmlIr: false,
      onIr: () => {
        calls += 1;
      },
    });
    expect(calls).toBe(0);
  });

  it('returns the same HTML with the flag on, plus the parsed IR', async () => {
    const file = await exportedFile();
    const off = await importDocx(file);
    const captured: { info?: ImportedIr } = {};
    const on = await importDocx(file, {
      useOoxmlIr: true,
      onIr: (info) => {
        captured.info = info;
      },
    });

    expect(off.ok && on.ok).toBe(true);
    if (!off.ok || !on.ok) return;
    expect(on.value).toBe(off.value);

    const ir = captured.info?.ir;
    expect(ir?.version).toBe(1);
    expect(ir?.blocks.map((block) => block.text)).toEqual(
      expect.arrayContaining(['标题', '正文', '书签']),
    );
    expect(ir?.bookmarks).toEqual([{ name: 'Intro', blockIndex: 2 }]);
    expect(ir?.images.length).toBe(1);
  });

  it('surfaces the grouped structural warnings through fidelity', async () => {
    const file = await exportedFile();
    const captured: { info?: ImportedIr } = {};
    await importDocx(file, {
      useOoxmlIr: true,
      onIr: (info) => {
        captured.info = info;
      },
    });

    const issues = captured.info?.issues ?? [];
    expect(issues.map((issue) => issue.code)).toContain('rte.irStructure');
    const structure = issues.find((issue) => issue.code === 'rte.irStructure');
    expect(structure?.severity).toBe('warning');
    expect(structure?.messageKey).toBe('tools.richText.lossIrStructure');
    expect(structure?.detail).toContain('ir.images:1');
    expect(structure?.detail).toContain('ir.bookmarks:1');
  });
});
