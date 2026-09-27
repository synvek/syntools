import { describe, expect, it } from 'vitest';
import { importXlsxToSnapshot } from './xlsx-io';
import { normalizeXlsxArchive, wrapCommentTextRuns } from './xlsx-normalize';

const fakeFile = (buffer: ArrayBuffer, name: string): File =>
  ({ name, size: buffer.byteLength, arrayBuffer: async () => buffer }) as unknown as File;

/** 用 exceljs 生成「带批注」的源文件（exceljs 自身写法，exceljs 能读） */
async function buildSourceWithNote(): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Data');
  worksheet.getCell('A1').value = 'x';
  worksheet.getCell('A1').note = '批注内容';
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

/**
 * 把 exceljs 风格的批注归档改造成 openpyxl 风格：
 * 批注部件放到子目录、关系 Target 用绝对路径、正文直接写 `<t>`。
 * 这正是会让 exceljs 抛 TypeError、整份文件无法导入的写法。
 */
async function mimicOpenpyxlArchive(source: ArrayBuffer): Promise<ArrayBuffer> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(source);

  for (const name of Object.keys(zip.files)) {
    if (/^xl\/comments\d+\.xml$/.test(name)) {
      zip.file('xl/comments/comment1.xml', await zip.file(name)!.async('uint8array'));
      zip.remove(name);
    } else if (/^xl\/drawings\/vmlDrawing\d+\.vml$/.test(name)) {
      zip.file('xl/drawings/commentsDrawing1.vml', await zip.file(name)!.async('uint8array'));
      zip.remove(name);
    }
  }

  const relsName = Object.keys(zip.files).find((name) =>
    /^xl\/worksheets\/_rels\/.+\.rels$/.test(name),
  )!;
  const rels = await zip.file(relsName)!.async('string');
  zip.file(
    relsName,
    rels.replace(/<Relationship\b[^>]*?\/?>/g, (tag) => {
      if (/relationships\/comments"/.test(tag)) {
        return tag.replace(/Target="[^"]*"/, 'Target="/xl/comments/comment1.xml"');
      }
      if (/relationships\/vmlDrawing"/.test(tag)) {
        return tag.replace(/Target="[^"]*"/, 'Target="/xl/drawings/commentsDrawing1.vml"');
      }
      return tag;
    }),
  );

  // 把 <text><r><t>…</t></r></text> 摊平成 <text><t>…</t></text>
  const commentName = 'xl/comments/comment1.xml';
  const commentXml = await zip.file(commentName)!.async('string');
  zip.file(commentName, commentXml.replace(/<r>(\s*<t[^>]*>[\s\S]*?<\/t>\s*)<\/r>/g, '$1'));

  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('wrapCommentTextRuns', () => {
  it('把直写的 <t> 包一层 run；已含 run 或空文本保持原样', () => {
    expect(wrapCommentTextRuns('<text><t>hi</t></text>')).toBe('<text><r><t>hi</t></r></text>');
    const withRun = '<text><r><t>hi</t></r></text>';
    expect(wrapCommentTextRuns(withRun)).toBe(withRun);
    expect(wrapCommentTextRuns('<text></text>')).toBe('<text></text>');
  });
});

describe('normalizeXlsxArchive', () => {
  it('openpyxl 风格的批注归档：修好关系后仍能读回批注文本', async () => {
    const source = await buildSourceWithNote();
    const archive = await mimicOpenpyxlArchive(source);

    // 未归一化：exceljs 读到的批注文本为空（内容丢失）
    const ExcelJS = (await import('exceljs')).default;
    const rawWorkbook = new ExcelJS.Workbook();
    let rawNoteText = '';
    try {
      await rawWorkbook.xlsx.load(archive);
      rawNoteText = String(
        (rawWorkbook.worksheets[0].getCell('A1').note as { texts?: { text?: string }[] })
          ?.texts?.[0]?.text ?? '',
      );
    } catch {
      rawNoteText = 'THREW';
    }
    expect(rawNoteText).not.toBe('批注内容');

    // 归一化后：可正常导入且批注文本完整保留
    const result = await importXlsxToSnapshot(fakeFile(archive, 'note.xlsx'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sheet = result.value.sheets[result.value.sheetOrder[0]];
    expect(sheet.cellData['0']['0'].custom?.note).toBe('批注内容');
  });

  it('无需改动的归档原样返回（避免无谓重压缩）', async () => {
    const source = await buildSourceWithNote();
    expect(await normalizeXlsxArchive(source)).toBe(source);
  });

  it('非 zip 输入原样返回，由 exceljs 决定如何报错', async () => {
    const text = new TextEncoder().encode('not a zip').buffer as ArrayBuffer;
    expect(await normalizeXlsxArchive(text)).toBe(text);
  });
});
