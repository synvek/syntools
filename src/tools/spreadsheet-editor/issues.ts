/**
 * Failure reporting for the sheet editor (plan P0-3).
 *
 * Browser APIs this tool leans on can fail quietly: Univer's feature panels disappear across
 * versions, the async clipboard API is unavailable in insecure contexts, and reading cell styles
 * materialises a large range. Before this module every one of those was `catch {}` — the user
 * clicked, nothing happened, and there was no way to tell a bug from a limitation.
 *
 * Rules encoded here:
 * 1. **Every failure has a user-visible counterpart** (`code` → `tools.sheet.issue.<code>`);
 * 2. **One report per session per code** — a panel that fails five times must not shout five times;
 * 3. **The console always gets the detail** — the UI message is short, the breadcrumb is complete.
 *
 * Pure pub/sub, no React: `univer.ts` and the tool component both publish into it.
 */

export type SheetIssueCode =
  | 'clipboardRead'
  | 'clipboardWrite'
  | 'panelUnavailable'
  | 'styleRead'
  | 'chartPartsUnreadable'
  /** A whole-column selection reaching the sort: refuse instead of freezing the tab (P1-5) */
  | 'sortTooLarge'
  /** Reading formulas off the selection failed (P1-10) */
  | 'formulaRead';

/** `notice` = degraded but the document is intact; `error` = the requested action did not happen */
export type SheetIssueLevel = 'notice' | 'error';

export interface SheetIssue {
  code: SheetIssueCode;
  level: SheetIssueLevel;
  /** Untranslated technical detail (error message, panel id); never rendered as-is */
  detail?: string;
}

type Listener = (issue: SheetIssue) => void;

const listeners = new Set<Listener>();
/** Codes already shown in this session */
const announced = new Set<string>();
/** Details that already reached the console, so a repeated failure does not flood it */
const logged = new Set<string>();

function logOnce(key: string, issue: SheetIssue): void {
  if (!issue.detail || logged.has(key)) return;
  logged.add(key);
  // eslint-disable-next-line no-console -- the only breadcrumb once the inline notice is dismissed
  console.debug(`[sheet] ${issue.code}: ${issue.detail}`);
}

/** Publish a failure. Duplicate codes are dropped after the first report. */
export function reportSheetIssue(issue: SheetIssue): void {
  const key = `${issue.level}:${issue.code}`;
  logOnce(key, issue);
  if (announced.has(key)) return;
  announced.add(key);
  for (const listener of listeners) listener(issue);
}

/** Subscribe to reports; returns the unsubscribe function */
export function subscribeSheetIssues(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper: forget what has been announced (module state would otherwise leak between cases) */
export function resetSheetIssues(): void {
  announced.clear();
  logged.clear();
  listeners.clear();
}
