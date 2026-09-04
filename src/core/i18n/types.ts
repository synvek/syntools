import zh from '@/core/i18n/locales/zh';

/** 已支持的语言代码（扩展新语言时在此追加） */
export type Lang = 'zh' | 'en';

/** 将翻译对象的所有字符串叶子节点宽化为 string，便于各语言文件独立维护 */
type DeepStringRecord<T> = T extends string
  ? string
  : T extends readonly string[]
    ? string[]
    : T extends object
      ? { [K in keyof T]: DeepStringRecord<T[K]> }
      : T;

/** 翻译资源结构（以 zh 的键结构为 schema 源） */
export type TranslationResources = DeepStringRecord<typeof zh>;

/** 新增语言文件时使用：const xx = { ... } satisfies TranslationResources */
export type LocaleResource = TranslationResources;
