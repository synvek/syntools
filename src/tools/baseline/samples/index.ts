import { docSamples } from './doc';
import { externalDocSamples } from './external-doc';
import { sheetSamples } from './sheet';
import { sheetExternalSamples } from './sheet-external';
import { slideSamples } from './slide';

/**
 * Generated samples (decision D7): 15 slide / 9 sheet / 8 document, plus real third-party
 * binaries — 10 .docx (P0-1) and 8 .xlsx (P0-4 B/C). The counts are a contract asserted by the
 * baseline test.
 */
export const SAMPLE_COUNTS = {
  slide: 15,
  sheet: 9,
  docx: 8,
  externalDocx: externalDocSamples.length,
  externalXlsx: sheetExternalSamples.length,
} as const;

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
  ...externalDocSamples.map((sample) => ({
    id: sample.id,
    tool: 'docx' as const,
    title: sample.title,
    source: 'external' as const,
    producer: sample.producer,
    producerFamily: sample.producerFamily,
    ...(sample.producerVersion ? { producerVersion: sample.producerVersion } : {}),
    path: sample.path,
    expectedParts: sample.expectedParts,
    notes: sample.notes,
  })),
  ...sheetExternalSamples.map((sample) => ({
    id: sample.id,
    tool: 'sheet' as const,
    title: sample.title,
    source: 'external' as const,
    producer: sample.producer,
    producerFamily: sample.producerFamily,
    ...(sample.producerVersion ? { producerVersion: sample.producerVersion } : {}),
    path: sample.path,
    expectedParts: sample.expectedParts,
    notes: sample.notes,
  })),
];

export { docSamples, externalDocSamples, sheetExternalSamples, sheetSamples, slideSamples };
