import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, it } from 'vitest';
import { exportSnapshotToBytes, importXlsxToSnapshot } from '../spreadsheet-editor/xlsx-io';

function fakeFile(bytes: Uint8Array, name: string): File {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { name, size: bytes.byteLength, arrayBuffer: async () => buffer } as unknown as File;
}

describe('probe', () => {
  it('inspects external samples', async () => {
    for (const name of ['excel-en', 'wps-en', 'libraoffice-en', 'numbers-en']) {
      const bytes = new Uint8Array(
        readFileSync(join(process.cwd(), `samples/xlsx-feature-sample-${name}.xlsx`)),
      );
      const imported = await importXlsxToSnapshot(fakeFile(bytes, 'in.xlsx'));
      if (!imported.ok) {
        console.log(name, 'IMPORT FAIL', imported.error);
        continue;
      }
      // 探针只是把快照当字典随手取几个字段：两次断言分开写，别让 `tsc` 认定这是一次误转
      const snapshot = imported.value as unknown as Record<string, unknown>;
      const images = Object.keys((snapshot.syntoolsImages as object) ?? {});
      const charts = ((snapshot.syntoolsCharts as unknown[]) ?? []).length;
      const names = ((snapshot.namedRanges as unknown[]) ?? []) as { name: string }[];
      const protections = ((snapshot.syntoolsProtection as unknown[]) ?? []) as {
        enabled?: boolean;
      }[];
      const exported = await exportSnapshotToBytes(imported.value);
      const facts: Record<string, number> = {};
      if (exported.ok) {
        const zip = await JSZip.loadAsync(exported.value);
        const parts = Object.keys(zip.files).filter((path) => !zip.files[path].dir);
        facts.media = parts.filter((path) => /^xl\/media\//.test(path)).length;
        facts.charts = parts.filter((path) => /^xl\/charts\//.test(path)).length;
        facts.drawings = parts.filter((path) => /^xl\/drawings\//.test(path)).length;
        const wb = (await zip.file('xl/workbook.xml')?.async('string')) ?? '';
        const after = [...wb.matchAll(/<definedName[^>]*name="([^"]*)"/g)].map((m) => m[1]);
        console.log(
          name,
          '| images:',
          images.length,
          '| charts:',
          charts,
          '| names in:',
          names.map((item) => item.name).join(','),
          '| names out:',
          after.join(','),
          '| protections:',
          JSON.stringify(protections.map((item) => item.enabled)),
          '| export parts:',
          JSON.stringify(facts),
        );
      }
    }
  }, 120_000);
});
