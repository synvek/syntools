import { describe, expect, it } from 'vitest';
import {
  PRESENTER_CHANNEL,
  PRESENTER_IDS,
  PRESENTER_WINDOW_NAME,
  createPresenterChannel,
  formatClock,
  isPresenterAlive,
  isPresenterMessage,
  presenterHtml,
  type PresenterFrame,
  type PresenterLabels,
} from './presenter';

/** P2-S10：双屏演讲者视图的协议与副屏骨架 */

const LABELS: PresenterLabels = {
  title: '演讲者视图',
  current: '当前页',
  next: '下一张',
  notes: '备注',
  notesEmpty: '（本页没有备注）',
  prev: '上一张',
  nextAction: '下一张',
  waiting: '等待放映窗口连接…',
};

describe('计时格式', () => {
  it('m:ss，跨分钟与跨小时都不补零到小时', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(61)).toBe('1:01');
    expect(formatClock(600)).toBe('10:00');
    expect(formatClock(3600)).toBe('60:00');
  });

  it('负数与小数按 0 / 向下取整处理', () => {
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock(2.9)).toBe('0:02');
  });
});

describe('消息协议', () => {
  it('认得出四种消息', () => {
    const frame: PresenterFrame = {
      type: 'frame',
      index: 0,
      total: 3,
      current: null,
      next: null,
      notes: '',
    };
    expect(isPresenterMessage(frame)).toBe(true);
    expect(isPresenterMessage({ type: 'tick', elapsed: 3 })).toBe(true);
    expect(isPresenterMessage({ type: 'closed' })).toBe(true);
    expect(isPresenterMessage({ type: 'command', action: 'next' })).toBe(true);
    expect(isPresenterMessage({ type: 'command', action: 'prev' })).toBe(true);
  });

  it('结构不对的一律拒绝（消息来自窗口间通信，不可信）', () => {
    expect(isPresenterMessage(null)).toBe(false);
    expect(isPresenterMessage('frame')).toBe(false);
    expect(isPresenterMessage({ type: 'frame' })).toBe(false);
    expect(isPresenterMessage({ type: 'tick', elapsed: '3' })).toBe(false);
    expect(isPresenterMessage({ type: 'command', action: 'close' })).toBe(false);
    expect(isPresenterMessage({ type: 'unknown' })).toBe(false);
  });
});

describe('副屏窗口存活判断', () => {
  it('null / 已关闭都算不可用', () => {
    expect(isPresenterAlive(null)).toBe(false);
    expect(isPresenterAlive(undefined)).toBe(false);
    expect(isPresenterAlive({ closed: true } as Window)).toBe(false);
    expect(isPresenterAlive({ closed: false } as Window)).toBe(true);
  });
});

describe('副屏骨架 HTML', () => {
  const html = presenterHtml(LABELS);

  it('带固定通道名与全部 DOM 挂点', () => {
    expect(html).toContain(`new BroadcastChannel(CHANNEL)`);
    expect(html).toContain(`var CHANNEL = '${PRESENTER_CHANNEL}'`);
    for (const id of Object.values(PRESENTER_IDS)) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('显示传入的文案，且自带样式（副屏没有主文档的样式表）', () => {
    expect(html).toContain('演讲者视图');
    expect(html).toContain('等待放映窗口连接…');
    expect(html).toContain('<style>');
    expect(html).toContain('grid-template-columns');
  });

  it('文案里的 HTML 与脚本都被转义，不会截断文档', () => {
    const evil = presenterHtml({
      ...LABELS,
      title: '<script>alert(1)</script>',
      notesEmpty: '</script><script>alert(2)</script>',
    });
    // HTML 部分转义
    expect(evil).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    // 脚本内的字符串字面量把 `<` 变成 \u003c
    expect(evil).not.toContain('</script><script>alert(2)');
    expect(evil).toContain('\\u003c/script>');
  });

  it('窗口名固定，连点只会复用同一个副屏', () => {
    expect(PRESENTER_WINDOW_NAME).toBe(PRESENTER_CHANNEL);
  });
});

describe('通道创建', () => {
  it.skipIf(typeof BroadcastChannel === 'undefined')('两个实例之间能收发消息', async () => {
    const sender = createPresenterChannel('syntools-test-presenter');
    const receiver = createPresenterChannel('syntools-test-presenter');
    expect(sender).not.toBeNull();
    expect(receiver).not.toBeNull();
    const received = new Promise<unknown>((resolve) => {
      receiver!.onmessage = (event) => resolve(event.data);
    });
    const frame: PresenterFrame = {
      type: 'frame',
      index: 1,
      total: 4,
      current: 'data:image/png;base64,AAA',
      next: null,
      notes: '讲这里',
    };
    sender!.postMessage(frame);
    await expect(received).resolves.toEqual(frame);
    sender!.close();
    receiver!.close();
  });
});
