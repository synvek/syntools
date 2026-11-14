import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportSheetIssue, resetSheetIssues, subscribeSheetIssues } from './issues';

/**
 * Failure reporting (plan P0-3).
 *
 * Two behaviours matter: the message must reach the UI at all (the old `catch {}` did not), and the
 * same failure must not stack up (dragging a selection reads styles on every pointer move).
 */

beforeEach(() => {
  resetSheetIssues();
});

describe('reportSheetIssue', () => {
  it('把失败转给订阅者', () => {
    const listener = vi.fn();
    subscribeSheetIssues(listener);
    reportSheetIssue({ code: 'clipboardWrite', level: 'notice' });
    expect(listener).toHaveBeenCalledWith({ code: 'clipboardWrite', level: 'notice' });
  });

  it('同一个 code 在同一会话里只播报一次', () => {
    const listener = vi.fn();
    subscribeSheetIssues(listener);
    reportSheetIssue({ code: 'styleRead', level: 'notice' });
    reportSheetIssue({ code: 'styleRead', level: 'notice' });
    reportSheetIssue({ code: 'styleRead', level: 'notice' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('不同 code / 不同级别分别计一次', () => {
    const listener = vi.fn();
    subscribeSheetIssues(listener);
    reportSheetIssue({ code: 'styleRead', level: 'notice' });
    reportSheetIssue({ code: 'styleRead', level: 'error' });
    reportSheetIssue({ code: 'panelUnavailable', level: 'notice' });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('取消订阅后不再收到消息', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSheetIssues(listener);
    unsubscribe();
    reportSheetIssue({ code: 'chartPartsUnreadable', level: 'notice' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('detail 只进 console，不进 UI 消息（避免把堆栈塞给用户）', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const listener = vi.fn();
    subscribeSheetIssues(listener);
    reportSheetIssue({ code: 'panelUnavailable', level: 'notice', detail: 'operation missing' });
    expect(listener).toHaveBeenCalledWith({
      code: 'panelUnavailable',
      level: 'notice',
      detail: 'operation missing',
    });
    expect(debug).toHaveBeenCalledWith('[sheet] panelUnavailable: operation missing');
    debug.mockRestore();
  });
});
