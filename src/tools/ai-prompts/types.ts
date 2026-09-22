import type { Lang } from '@/core/i18n/types';

/**
 * AI 提示词库基础类型。
 *
 * 设计要点：
 * - `zh` / `en` 为必填（编译期强制），其余语言可选，缺失时按回退链取值；
 * - 语言键允许任意字符串，便于后续增量补充语种而不改类型定义；
 * - 详细数据规范与增补流程见 `./data/README.md`。
 */

/** 多语言文本：zh / en 必填，其余语种按需补充 */
export type LocalizedText = {
  zh: string;
  en: string;
} & Partial<Record<Lang, string>> & {
    [lang: string]: string | undefined;
  };

/** 单条提示词 */
export interface PromptItem {
  /** 全局唯一，约定为 `<category>-<slug>`（kebab-case） */
  id: string;
  /** 所属分类 id，必须存在于 `PROMPT_CATEGORIES` */
  category: string;
  /** 多语言标题 */
  title: LocalizedText;
  /** 多语言正文，可包含 `{{变量}}` 占位符 */
  prompt: LocalizedText;
}

/** 分类元信息 */
export interface PromptCategoryMeta {
  /** 分类 id，kebab-case，同时用作提示词 id 前缀 */
  id: string;
  /** 展示顺序，在全部分类中唯一（从 1 开始） */
  order: number;
  /** 多语言分类名 */
  name: LocalizedText;
  /** i18n 兜底键，固定为 `tools.aiPrompts.cat.<id>` */
  i18nKey: string;
}
