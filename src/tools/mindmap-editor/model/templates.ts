/**
 * 脑图预设模板：模板内的节点文案统一为英文（与默认新建文案保持一致），
 * 模板在侧边栏 / 弹窗中的展示名仍走 i18n（键 `tools.mindmap.template*`）。
 * 载入模板会替换当前脑图内容。
 */

import { createId } from './tree';
import type { MindDoc, MindLayoutDirection, MindNodeRec } from './types';
import { DEFAULT_THEME_ID } from './themes';

export type MindTemplateKind = 'project' | 'meeting' | 'reading' | 'product' | 'weekly';

export const MIND_TEMPLATES: MindTemplateKind[] = [
  'project',
  'meeting',
  'reading',
  'product',
  'weekly',
];

interface Spec {
  text: string;
  children?: Spec[];
}

const SPECS: Record<
  MindTemplateKind,
  { spec: Spec; direction: MindLayoutDirection; themeId: string }
> = {
  project: {
    direction: 'right',
    themeId: 'classic',
    spec: {
      text: 'Project Plan',
      children: [
        {
          text: 'Goals',
          children: [
            { text: 'Scope of delivery' },
            { text: 'Success metrics' },
            { text: 'Acceptance criteria' },
          ],
        },
        {
          text: 'Milestones',
          children: [
            { text: 'Requirements review' },
            { text: 'Development & integration' },
            { text: 'Staged rollout' },
            { text: 'Official release' },
          ],
        },
        {
          text: 'Resources',
          children: [
            { text: 'Team capacity' },
            { text: 'Budget' },
            { text: 'External dependencies' },
          ],
        },
        {
          text: 'Risks',
          children: [
            { text: 'Schedule risk' },
            { text: 'Technical risk' },
            { text: 'Compliance risk' },
          ],
        },
      ],
    },
  },
  meeting: {
    direction: 'right',
    themeId: 'sunset',
    spec: {
      text: 'Meeting Notes',
      children: [
        {
          text: 'Topic one',
          children: [{ text: 'Background' }, { text: 'Decision' }],
        },
        {
          text: 'Topic two',
          children: [{ text: 'Background' }, { text: 'Decision' }],
        },
        {
          text: 'Action items',
          children: [{ text: 'Owner / due date' }, { text: 'Owner / due date' }],
        },
        {
          text: 'Next meeting',
          children: [{ text: 'Date & time' }, { text: 'Attendees' }],
        },
      ],
    },
  },
  reading: {
    direction: 'both',
    themeId: 'forest',
    spec: {
      text: 'Reading Notes',
      children: [
        {
          text: 'Key ideas',
          children: [{ text: 'Idea one' }, { text: 'Idea two' }],
        },
        {
          text: 'Key concepts',
          children: [{ text: 'Concept A' }, { text: 'Concept B' }],
        },
        {
          text: 'Quotes',
          children: [{ text: 'Notable excerpt' }],
        },
        {
          text: 'Takeaways',
          children: [{ text: 'How to apply it' }],
        },
        {
          text: 'Questions',
          children: [{ text: 'To be verified' }],
        },
      ],
    },
  },
  product: {
    direction: 'down',
    themeId: 'grape',
    spec: {
      text: 'Product Structure',
      children: [
        {
          text: 'Client app',
          children: [{ text: 'Home' }, { text: 'Detail page' }, { text: 'Account center' }],
        },
        {
          text: 'Admin console',
          children: [{ text: 'Dashboard' }, { text: 'Access control' }],
        },
        {
          text: 'Core services',
          children: [{ text: 'Account system' }, { text: 'Notifications' }, { text: 'Payments' }],
        },
      ],
    },
  },
  weekly: {
    direction: 'right',
    themeId: 'candy',
    spec: {
      text: 'Weekly Plan',
      children: [
        {
          text: 'Focus areas',
          children: [{ text: 'Task one' }, { text: 'Task two' }],
        },
        {
          text: 'Collaboration',
          children: [{ text: 'Cross-team alignment' }],
        },
        {
          text: 'Learning',
          children: [{ text: 'Skill to practice' }],
        },
        {
          text: 'Review',
          children: [{ text: 'Went well' }, { text: 'To improve' }],
        },
      ],
    },
  },
};

function flatten(spec: Spec, parentId: string | null, out: MindNodeRec[]): void {
  const id = createId();
  out.push({ id, parentId, text: spec.text, collapsed: false });
  for (const child of spec.children ?? []) flatten(child, id, out);
}

/** 生成模板脑图（每次调用都是全新 id） */
export function buildMindTemplate(kind: MindTemplateKind): MindDoc {
  const entry = SPECS[kind] ?? SPECS.project;
  const nodes: MindNodeRec[] = [];
  flatten(entry.spec, null, nodes);
  return {
    version: 1,
    rootId: nodes[0].id,
    nodes,
    direction: entry.direction,
    themeId: entry.themeId || DEFAULT_THEME_ID,
  };
}
