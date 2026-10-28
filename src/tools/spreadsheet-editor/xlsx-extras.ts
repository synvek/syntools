import type { ConditionalFormattingOptions, DataValidation } from 'exceljs';

/**
 * .xlsx round-trip preservation layer: conditional formatting and data validation.
 *
 * Univer and exceljs model these two features quite differently, so there is no two-way semantic
 * mapping yet. Instead the raw definitions read by exceljs are stored alongside the workbook snapshot
 * and written back on export, so "import → edit → export" never silently drops existing conditional
 * formatting / data validation.
 *
 * They live in a **tool-owned field** on the snapshot (`syntoolsExtras`) so the imported definitions
 * survive loadSnapshot verbatim. Rules created inside the editor are a different source: they are
 * stored by the registered CF/DV plugins in `snapshot.resources` and converted on export by
 * `cfdv.ts`.
 */

/** Content to preserve across the round-trip for one sheet */
export interface SheetExtras {
  conditionalFormattings?: ConditionalFormattingOptions[];
  /** Cell address → data validation definition */
  dataValidations?: Record<string, DataValidation>;
}

export interface WorkbookExtras {
  version: 1;
  /** Sheet name → extra content (by name, not id: Univer snapshots and exceljs use different id schemes) */
  sheets: Record<string, SheetExtras>;
}

/** Snapshot shape that carries the extra content */
export interface SnapshotWithExtras {
  syntoolsExtras?: WorkbookExtras;
}

/** exceljs worksheet shape: only the members this module uses */
export interface WorksheetExtrasLike {
  name: string;
  conditionalFormattings?: ConditionalFormattingOptions[];
  dataValidations?: { model?: Record<string, DataValidation> };
  addConditionalFormatting?: (cf: ConditionalFormattingOptions) => void;
  getCell?: (address: string) => { dataValidation: DataValidation } | undefined;
}

/** Read the round-trip extras of a worksheet; null when there are none */
export function collectSheetExtras(worksheet: WorksheetExtrasLike): SheetExtras | null {
  const extras: SheetExtras = {};
  if (Array.isArray(worksheet.conditionalFormattings) && worksheet.conditionalFormattings.length) {
    extras.conditionalFormattings = worksheet.conditionalFormattings;
  }
  const model = worksheet.dataValidations?.model;
  if (model && Object.keys(model).length > 0) {
    extras.dataValidations = model;
  }
  return Object.keys(extras).length > 0 ? extras : null;
}

/** Write the extras back into an exceljs worksheet */
export function applySheetExtras(worksheet: WorksheetExtrasLike, extras: SheetExtras): void {
  for (const formatting of extras.conditionalFormattings ?? []) {
    worksheet.addConditionalFormatting?.(formatting);
  }
  for (const [address, validation] of Object.entries(extras.dataValidations ?? {})) {
    const cell = worksheet.getCell?.(address);
    if (cell) cell.dataValidation = validation;
  }
}

/** Read the extras back from a snapshot; null when missing or malformed */
export function readWorkbookExtras(snapshot: object | null | undefined): WorkbookExtras | null {
  const value = (snapshot as SnapshotWithExtras | null | undefined)?.syntoolsExtras;
  if (!value || value.version !== 1 || typeof value.sheets !== 'object' || !value.sheets) {
    return null;
  }
  return value;
}

/** Merge the extras into a snapshot; drop the field when there is nothing to keep */
export function withWorkbookExtras<T extends object>(
  snapshot: T,
  extras: WorkbookExtras | null,
): T {
  const existing = (snapshot as SnapshotWithExtras).syntoolsExtras;
  if (!extras || Object.keys(extras.sheets).length === 0) {
    if (!existing) return snapshot;
    const clone = { ...snapshot } as T & SnapshotWithExtras;
    delete clone.syntoolsExtras;
    return clone;
  }
  return { ...snapshot, syntoolsExtras: extras } as T;
}

/** Count the extras (to tell the user how much content only survives via round-trip, without semantic mapping) */
export function countExtras(extras: WorkbookExtras | null): {
  conditionalFormattings: number;
  dataValidations: number;
} {
  let conditionalFormattings = 0;
  let dataValidations = 0;
  for (const sheet of Object.values(extras?.sheets ?? {})) {
    conditionalFormattings += sheet.conditionalFormattings?.length ?? 0;
    dataValidations += Object.keys(sheet.dataValidations ?? {}).length;
  }
  return { conditionalFormattings, dataValidations };
}
