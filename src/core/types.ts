import type { ComponentType } from 'react';

/** 工具运行方：client = 纯前端；server = 依赖 Rust 后端（P2） */
export type ToolMode = 'client' | 'server';

/** 工具分类（技术设计 §5.1） */
export type CategoryId =
  | 'encoding' // 编码转换
  | 'text' // 文本处理
  | 'formatting' // 格式化
  | 'crypto' // 加密哈希
  | 'datetime' // 时间日期
  | 'generator' // 生成器
  | 'network' // 网络
  | 'image' // 图片处理
  | 'pdf' // PDF 工具
  | 'other'; // 其他

/** 工具注册契约：所有工具必须声明此元数据 */
export interface ToolMeta {
  /** 唯一标识，小写短横线，同时作为路由 /tools/:id */
  id: string;
  name: string;
  description: string;
  category: CategoryId;
  /** 搜索关键词，含中英文别名 */
  keywords: string[];
  /** 图标：内置 icon 名称（见 core/components/Icon） */
  icon: string;
  /** 懒加载组件工厂 */
  component: () => Promise<{ default: ComponentType }>;
  /** 默认 client；P2 服务端工具为 server */
  mode?: ToolMode;
  /** 排序权重，同分类内升序 */
  weight?: number;
  /** 相关工具 id（工具页推荐）；缺省时按同分类补齐 */
  relatedIds?: string[];
}

/** 工具计算统一返回契约（技术设计 §8.2）：core.ts 永不向调用方抛异常 */
export type ToolResult<T> =
  { ok: true; value: T } | { ok: false; error: string; params?: Record<string, string | number> };
