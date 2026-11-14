import {
  FUNCTION_NAMES_ARRAY,
  FUNCTION_NAMES_COMPATIBILITY,
  FUNCTION_NAMES_CUBE,
  FUNCTION_NAMES_DATABASE,
  FUNCTION_NAMES_DATE,
  FUNCTION_NAMES_ENGINEERING,
  FUNCTION_NAMES_FINANCIAL,
  FUNCTION_NAMES_INFORMATION,
  FUNCTION_NAMES_LOGICAL,
  FUNCTION_NAMES_LOOKUP,
  FUNCTION_NAMES_MATH,
  FUNCTION_NAMES_STATISTICAL,
  FUNCTION_NAMES_TEXT,
  FUNCTION_NAMES_UNIVER,
  FUNCTION_NAMES_WEB,
} from '@univerjs/engine-formula';

/**
 * "Which functions does this editor actually have?" (P1-10)
 *
 * The editor registers no custom functions, so its function set *is* the engine's. Rather than
 * hand-maintaining a list (which goes stale the way the old "Pictures not supported" hint did), the
 * names come from the engine's own public export map — the same constants it uses to register
 * descriptors. If a future version drops a group, `tsc` fails here instead of silently misreporting.
 *
 * The list is used for one thing only: telling the user "this formula will not compute here, but it
 * will in Excel" *before* the cell silently becomes `#NAME?`.
 */

const GROUPS: Record<string, Record<string, string>> = {
  array: FUNCTION_NAMES_ARRAY,
  compatibility: FUNCTION_NAMES_COMPATIBILITY,
  cube: FUNCTION_NAMES_CUBE,
  database: FUNCTION_NAMES_DATABASE,
  date: FUNCTION_NAMES_DATE,
  engineering: FUNCTION_NAMES_ENGINEERING,
  financial: FUNCTION_NAMES_FINANCIAL,
  information: FUNCTION_NAMES_INFORMATION,
  logical: FUNCTION_NAMES_LOGICAL,
  lookup: FUNCTION_NAMES_LOOKUP,
  math: FUNCTION_NAMES_MATH,
  statistical: FUNCTION_NAMES_STATISTICAL,
  text: FUNCTION_NAMES_TEXT,
  univer: FUNCTION_NAMES_UNIVER,
  web: FUNCTION_NAMES_WEB,
};

/** Uppercased function names, e.g. `SUM`, `XLOOKUP` */
export const SUPPORTED_FUNCTIONS: ReadonlySet<string> = new Set(
  Object.values(GROUPS).flatMap((group) => Object.values(group).map((name) => name.toUpperCase())),
);

/** Per-group counts, for the "supported functions" summary shown in the report */
export const FUNCTION_GROUPS: ReadonlyArray<{ id: string; count: number }> = Object.entries(
  GROUPS,
).map(([id, group]) => ({ id, count: new Set(Object.values(group)).size }));

export const SUPPORTED_FUNCTION_COUNT = SUPPORTED_FUNCTIONS.size;

/**
 * Function names called by a formula, in source order.
 *
 * Deliberately lexical and forgiving: this exists to warn, not to parse. Strings are stripped first
 * so `="SUM("` does not look like a call, and a name must be followed by `(` to count.
 */
export function extractFunctionNames(formula: string): string[] {
  if (!formula.startsWith('=')) return [];
  // `_xlfn.` is how OOXML spells "newer than the file format"; it is not part of the name
  const withoutStrings = formula.replace(/"(?:[^"]|"")*"/g, '""').replace(/_xlfn\./gi, '');
  const names: string[] = [];
  const pattern = /([A-Za-z][A-Za-z0-9._]*)\s*\(/g;
  let match: RegExpExecArray | null = pattern.exec(withoutStrings);
  while (match) {
    names.push(match[1].toUpperCase());
    match = pattern.exec(withoutStrings);
  }
  return names;
}

export interface FunctionAudit {
  /** Number of formulas inspected */
  formulas: number;
  /** Distinct unsupported function names, sorted */
  unsupported: string[];
}

/** Audit a batch of formulas (empty strings are skipped: a cell without a formula is not a failure) */
export function auditFormulas(formulas: readonly string[]): FunctionAudit {
  const unsupported = new Set<string>();
  let inspected = 0;
  for (const formula of formulas) {
    if (!formula || !formula.startsWith('=')) continue;
    inspected += 1;
    for (const name of extractFunctionNames(formula)) {
      if (!SUPPORTED_FUNCTIONS.has(name)) unsupported.add(name);
    }
  }
  return { formulas: inspected, unsupported: [...unsupported].sort() };
}
