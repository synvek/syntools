/**
 * Onboarding seen flag (local localStorage).
 * Separated from the component so non-component exports do not pollute `Onboarding.tsx` (keeping Fast Refresh working).
 */

const SEEN_KEY = 'syntools:flowchart-editor.onboarding.v1';

/** Whether the first-run onboarding has been seen; treated as seen when localStorage is unavailable, so it does not pop up repeatedly */
export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

/** Mark as seen */
export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Ignore when localStorage is unavailable
  }
}
