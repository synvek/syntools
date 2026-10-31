import { docSamples } from './doc';
import { sheetSamples } from './sheet';
import { slideSamples } from './slide';

/**
 * 30 generated samples (decision D7, 2026-10-29): 15 slide / 8 sheet / 7 document.
 * Split so the ratio itself is a contract — plan §5.2 fixes it and the baseline test asserts it.
 */
export const SAMPLE_COUNTS = { slide: 15, sheet: 8, docx: 8 } as const;

export const sampleManifest = [
  ...slideSamples.map((sample) => ({
    id: sample.id,
    tool: 'slide' as const,
    title: sample.title,
    source: 'generated' as const,
    ...(sample.notes ? { notes: sample.notes } : {}),
  })),
  ...sheetSamples.map((sample) => ({
    id: sample.id,
    tool: 'sheet' as const,
    title: sample.title,
    source: 'generated' as const,
    ...(sample.notes ? { notes: sample.notes } : {}),
  })),
  ...docSamples.map((sample) => ({
    id: sample.id,
    tool: 'docx' as const,
    title: sample.title,
    source: 'generated' as const,
    ...(sample.notes ? { notes: sample.notes } : {}),
  })),
];

export { docSamples, sheetSamples, slideSamples };
