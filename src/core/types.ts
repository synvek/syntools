import type { ComponentType } from 'react';

/** Tool runtime: client = pure frontend; server = needs the Rust backend (P2) */
export type ToolMode = 'client' | 'server';

/** Tool categories (tech design §5.1) */
export type CategoryId =
  | 'advanced' // Documents and authoring
  | 'encoding' // Encoding conversion
  | 'text' // Text processing
  | 'formatting' // Formatting
  | 'crypto' // Hashing and crypto
  | 'datetime' // Date and time
  | 'generator' // Generators
  | 'network' // Network
  | 'image' // Image processing
  | 'pdf' // PDF tools
  | 'other' // Other
  | 'file' // File tools
  | 'media' // Audio and video
  | 'cheatsheet'; // Cheat sheets

/** Tool registration contract: every tool must declare this metadata */
export interface ToolMeta {
  /** Unique id, lowercase kebab-case, also used as the /tools/:id route */
  id: string;
  name: string;
  description: string;
  category: CategoryId;
  /** Search keywords, including Chinese and English aliases */
  keywords: string[];
  /** Icon: built-in icon name (see core/components/Icon) */
  icon: string;
  /** Lazy-loaded component factory */
  component: () => Promise<{ default: ComponentType }>;
  /** Defaults to client; P2 server-side tools use server */
  mode?: ToolMode;
  /** Sort weight, ascending within a category */
  weight?: number;
  /** Related tool ids (recommended on the tool page); falls back to same-category tools */
  relatedIds?: string[];
}

/** Unified tool result contract (tech design §8.2): core.ts never throws to callers */
export type ToolResult<T> =
  { ok: true; value: T } | { ok: false; error: string; params?: Record<string, string | number> };
