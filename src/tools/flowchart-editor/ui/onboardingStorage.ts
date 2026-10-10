/**
 * 引导已读标记（本机 localStorage）。
 * 与组件分离，避免把非组件导出混进 `Onboarding.tsx`（保持 Fast Refresh 可用）。
 */

const SEEN_KEY = 'syntools:flowchart-editor.onboarding.v1';

/** 是否已看过首启引导；localStorage 不可用时视作已读，避免反复弹出 */
export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

/** 标记为已读 */
export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // localStorage 不可用时忽略
  }
}
