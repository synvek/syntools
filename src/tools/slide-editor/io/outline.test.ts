import { describe, expect, it } from 'vitest';
import { createDoc } from '../model/factory';
import { buildDeck, parseOutline } from './outline';

describe('Markdown 大纲解析', () => {
  it('最浅标题层级作为分页依据，列表项进入要点', () => {
    const slides = parseOutline(
      ['# 第一季度', '- 收入增长', '- 成本下降', '# 第二季度', '- 新市场'].join('\n'),
    );
    expect(slides).toHaveLength(2);
    expect(slides[0]).toEqual({ title: '第一季度', bullets: ['收入增长', '成本下降'] });
    expect(slides[1]).toEqual({ title: '第二季度', bullets: ['新市场'] });
  });

  it('全篇都是二级标题时以二级标题分页', () => {
    const slides = parseOutline(['## A', '## B'].join('\n'));
    expect(slides.map((slide) => slide.title)).toEqual(['A', 'B']);
  });

  it('更深层级标题降级为当前页要点', () => {
    const slides = parseOutline(['# 主题', '## 子话题', '### 细节'].join('\n'));
    expect(slides).toHaveLength(1);
    expect(slides[0].bullets).toEqual(['子话题', '细节']);
  });

  it('代码块内容不进入大纲', () => {
    const slides = parseOutline(['# 标题', '```', '- 这是代码', '# 不是标题', '```'].join('\n'));
    expect(slides).toHaveLength(1);
    expect(slides[0].bullets).toEqual([]);
  });

  it('无标题时首行普通文本充当标题', () => {
    const slides = parseOutline(['一张没有标题的页', '要点一'].join('\n'));
    expect(slides[0]).toEqual({ title: '一张没有标题的页', bullets: ['要点一'] });
  });

  it('支持有序列表', () => {
    const slides = parseOutline(['# 步骤', '1. 准备', '2. 执行'].join('\n'));
    expect(slides[0].bullets).toEqual(['准备', '执行']);
  });

  it('空输入返回空数组', () => {
    expect(parseOutline('')).toEqual([]);
    expect(parseOutline('\n\n  \n')).toEqual([]);
  });
});

describe('大纲 → 幻灯片', () => {
  it('每页生成标题框与要点框，几何在页面范围内', () => {
    const doc = createDoc('demo');
    const deck = buildDeck(doc, parseOutline('# 标题\n- 要点'), doc.layouts[0]?.id);
    expect(deck).toHaveLength(1);
    expect(deck[0].layoutId).toBe(doc.layouts[0].id);
    expect(deck[0].elements).toHaveLength(2);
    for (const element of deck[0].elements) {
      expect(element.x).toBeGreaterThanOrEqual(0);
      expect(element.x + element.width).toBeLessThanOrEqual(doc.width);
      expect(element.y + element.height).toBeLessThanOrEqual(doc.height);
    }
  });

  it('只有要点没有标题时只生成一个元素', () => {
    const doc = createDoc('demo');
    const deck = buildDeck(doc, [{ title: '', bullets: ['只有要点'] }], undefined);
    expect(deck[0].elements).toHaveLength(1);
  });

  it('要点段落带项目符号，标题段落不带', () => {
    const doc = createDoc('demo');
    const deck = buildDeck(doc, [{ title: 'T', bullets: ['B'] }], undefined);
    const [title, bullets] = deck[0].elements;
    const titleBody = title.type === 'text' ? title.body : undefined;
    const bulletBody = bullets.type === 'text' ? bullets.body : undefined;
    expect(titleBody?.paragraphs[0].bullet).toBeUndefined();
    expect(bulletBody?.paragraphs[0].bullet).toBe(true);
  });
});
