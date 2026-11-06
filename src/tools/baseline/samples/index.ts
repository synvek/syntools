import { docSamples } from './doc';
import { externalDocSamples } from './external-doc';
import { sheetSamples } from './sheet';
import { slideSamples } from './slide';

/**
 * Generated samples (decision D7): 15 slide / 9 sheet / 8 document, plus real third-party
 * .docx binaries (P0-1). The counts are a contract asserted by the baseline test.
 */
export const SAMPLE_COUNTS = {
  slide: 15,
  sheet: 9,
  docx: 8,
  externalDocx: externalDocSamples.length,
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
];

export { docSamples, externalDocSamples, sheetSamples, slideSamples };
