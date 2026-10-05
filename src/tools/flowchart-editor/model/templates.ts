/**
 * 模板库：按图种分类提供起始图。
 * 模板内容是「一页」的节点与连线；需要完整文档时用 buildTemplateDoc。
 *
 * 模板内文案通过 `TemplateTranslator` 注入（token 见 `./templateLabels`），
 * 缺省回退中文，保证纯函数可单测、不依赖 i18next 实例。
 */

import { createId, defaultData } from '../core';
import { toDocV2 } from './migrate';
import { TEMPLATE_LABELS_I18N, type TemplateLabelKey } from './templateLabels';
import type { FlowDoc, FlowEdgeRec, FlowNodeRec, ShapeKind } from './types';

export type TemplateKind =
  // 流程图
  | 'basic'
  | 'decision'
  | 'swimlane'
  | 'swimlaneV'
  | 'approval'
  | 'onboarding'
  | 'swimlane2'
  // UML
  | 'umlUseCase'
  | 'umlClass'
  | 'umlSequence'
  | 'umlActivity'
  | 'umlState'
  | 'umlComponent'
  // BPMN
  | 'bpmn'
  | 'bpmnProcess'
  | 'bpmnCollab'
  // 其它图种
  | 'netTopology'
  | 'netSubnet'
  | 'orgChart'
  | 'mindMap'
  | 'erDiagram';

export type TemplateCategory = 'flow' | 'uml' | 'bpmn' | 'network' | 'org' | 'mind' | 'er';

export interface TemplateDef {
  kind: TemplateKind;
  category: TemplateCategory;
  /** 模板标题的 i18n 键后缀（`tools.flowchart.template<Key>`） */
  labelKey: string;
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'flow',
  'uml',
  'bpmn',
  'network',
  'org',
  'mind',
  'er',
];

export const TEMPLATES: TemplateDef[] = [
  { kind: 'basic', category: 'flow', labelKey: 'Basic' },
  { kind: 'decision', category: 'flow', labelKey: 'Decision' },
  { kind: 'approval', category: 'flow', labelKey: 'Approval' },
  { kind: 'onboarding', category: 'flow', labelKey: 'Onboarding' },
  { kind: 'swimlane', category: 'flow', labelKey: 'Swimlane' },
  { kind: 'swimlaneV', category: 'flow', labelKey: 'SwimlaneV' },
  { kind: 'swimlane2', category: 'flow', labelKey: 'Swimlane2' },
  { kind: 'umlUseCase', category: 'uml', labelKey: 'UmlUseCase' },
  { kind: 'umlClass', category: 'uml', labelKey: 'UmlClass' },
  { kind: 'umlSequence', category: 'uml', labelKey: 'UmlSequence' },
  { kind: 'umlActivity', category: 'uml', labelKey: 'UmlActivity' },
  { kind: 'umlState', category: 'uml', labelKey: 'UmlState' },
  { kind: 'umlComponent', category: 'uml', labelKey: 'UmlComponent' },
  { kind: 'bpmn', category: 'bpmn', labelKey: 'Bpmn' },
  { kind: 'bpmnProcess', category: 'bpmn', labelKey: 'BpmnProcess' },
  { kind: 'bpmnCollab', category: 'bpmn', labelKey: 'BpmnCollab' },
  { kind: 'netTopology', category: 'network', labelKey: 'NetTopology' },
  { kind: 'netSubnet', category: 'network', labelKey: 'NetSubnet' },
  { kind: 'orgChart', category: 'org', labelKey: 'OrgChart' },
  { kind: 'mindMap', category: 'mind', labelKey: 'MindMap' },
  { kind: 'erDiagram', category: 'er', labelKey: 'ErDiagram' },
];

/** 模板内容是「一页」的节点与连线 */
export interface TemplateContent {
  nodes: FlowNodeRec[];
  edges: FlowEdgeRec[];
}

/** 模板文案翻译器：token → 展示文案 */
export type TemplateTranslator = (key: TemplateLabelKey) => string;

/** 缺省翻译器：回退中文（单测与无 i18n 环境使用） */
export const fallbackTemplateTranslator: TemplateTranslator = (key) =>
  TEMPLATE_LABELS_I18N.zh[key] ?? TEMPLATE_LABELS_I18N.en[key] ?? key;

export function buildTemplate(
  kind: TemplateKind,
  tr: TemplateTranslator = fallbackTemplateTranslator,
): TemplateContent {
  const nodes: FlowNodeRec[] = [];
  const edges: FlowEdgeRec[] = [];
  const add = (n: ShapeKind, label: string, x: number, y: number): string => {
    const id = createId('t');
    nodes.push({ id, type: 'shape', position: { x, y }, data: defaultData(n, label) });
    return id;
  };
  const addChild = (
    n: ShapeKind,
    label: string,
    x: number,
    y: number,
    parentId: string,
  ): string => {
    const id = createId('t');
    nodes.push({ id, type: 'shape', position: { x, y }, parentId, data: defaultData(n, label) });
    return id;
  };
  const link = (source: string, target: string, label?: string) =>
    edges.push({ id: createId('te'), source, target, label });

  switch (kind) {
    case 'basic': {
      const a = add('startEnd', tr('start'), 240, 40);
      const b = add('rect', tr('step'), 215, 140);
      const c = add('rect', tr('step'), 215, 240);
      const d = add('startEnd', tr('end'), 240, 340);
      link(a, b);
      link(b, c);
      link(c, d);
      break;
    }
    case 'decision': {
      const a = add('startEnd', tr('start'), 260, 40);
      const b = add('decision', tr('condition'), 235, 140);
      const c = add('rect', tr('branchA'), 80, 280);
      const e = add('rect', tr('branchB'), 410, 280);
      const f = add('startEnd', tr('end'), 260, 380);
      link(a, b);
      link(b, c, tr('yes'));
      link(b, e, tr('no'));
      link(c, f);
      link(e, f);
      break;
    }
    case 'swimlane': {
      const lane = add('swimlane', tr('laneH'), 60, 60);
      const a = addChild('startEnd', tr('start'), 50, 82, lane);
      const b = addChild('rect', tr('step1'), 220, 78, lane);
      const c = addChild('rect', tr('step2'), 410, 78, lane);
      const d = addChild('startEnd', tr('end'), 600, 82, lane);
      link(a, b);
      link(b, c);
      link(c, d);
      break;
    }
    case 'swimlaneV': {
      const lane = add('swimlaneV', tr('laneV'), 60, 60);
      const a = addChild('startEnd', tr('start'), 55, 65, lane);
      const b = addChild('rect', tr('step1'), 45, 170, lane);
      const c = addChild('rect', tr('step2'), 45, 300, lane);
      const d = addChild('startEnd', tr('end'), 55, 430, lane);
      link(a, b);
      link(b, c);
      link(c, d);
      break;
    }
    case 'umlUseCase': {
      const actor = add('umlActor', tr('user'), 80, 180);
      const u1 = add('umlUseCase', tr('login'), 300, 100);
      const u2 = add('umlUseCase', tr('report'), 300, 260);
      link(actor, u1);
      link(actor, u2);
      break;
    }
    case 'umlClass': {
      const c1 = add('umlClass', tr('order'), 120, 80);
      const c2 = add('umlClass', tr('orderItem'), 460, 80);
      link(c1, c2, '1 : n');
      break;
    }
    case 'umlSequence': {
      const l1 = add('umlLifeline', tr('user'), 80, 60);
      const l2 = add('umlLifeline', tr('service'), 340, 60);
      const l3 = add('umlLifeline', tr('database'), 600, 60);
      link(l1, l2, tr('request'));
      link(l2, l3, tr('query'));
      link(l3, l2, tr('result'));
      break;
    }
    case 'umlActivity': {
      const s = add('umlStateInitial', '', 300, 40);
      const a1 = add('umlState', tr('submit'), 250, 120);
      const g = add('decision', tr('approved'), 235, 230);
      const a2 = add('umlState', tr('archive'), 250, 360);
      const e = add('umlStateFinal', '', 300, 470);
      link(s, a1);
      link(a1, g);
      link(g, a2, tr('pass'));
      link(a2, e);
      break;
    }
    case 'umlState': {
      const s = add('umlStateInitial', '', 120, 180);
      const st1 = add('umlState', tr('pendingPay'), 260, 160);
      const st2 = add('umlState', tr('paid'), 480, 160);
      const e = add('umlStateFinal', '', 660, 180);
      link(s, st1);
      link(st1, st2, tr('paySuccess'));
      link(st2, e);
      break;
    }
    case 'bpmn': {
      const a = add('bpmnTask', tr('startEvent'), 235, 40);
      const b = add('bpmnTask', tr('userTask'), 220, 150);
      const c = add('bpmnTask', tr('serviceTask'), 220, 250);
      const d = add('bpmnTask', tr('endEvent'), 235, 360);
      link(a, b);
      link(b, c);
      link(c, d);
      break;
    }
    case 'bpmnProcess': {
      const start = add('bpmnEventStart', '', 60, 160);
      const t1 = add('bpmnTask', tr('submit'), 170, 146);
      const gw = add('bpmnGatewayExclusive', '', 360, 150);
      const t2 = add('bpmnTask', tr('autoPass'), 470, 60);
      const t3 = add('bpmnTask', tr('manualReview'), 470, 240);
      const end = add('bpmnEventEnd', '', 680, 160);
      link(start, t1);
      link(t1, gw);
      link(gw, t2, tr('amountSmall'));
      link(gw, t3, tr('amountLarge'));
      link(t2, end);
      link(t3, end);
      break;
    }
    case 'netTopology': {
      const cloud = add('netCloud', tr('publicNet'), 300, 40);
      const router = add('netRouter', tr('edgeRouter'), 300, 180);
      const fw = add('netFirewall', tr('firewall'), 300, 300);
      const sw = add('netSwitch', tr('coreSwitch'), 200, 420);
      const srv = add('netServer', tr('appServer'), 60, 540);
      const db = add('netDatabase', tr('database'), 360, 540);
      link(cloud, router);
      link(router, fw);
      link(fw, sw);
      link(sw, srv);
      link(sw, db);
      break;
    }
    case 'orgChart': {
      const ceo = add('orgUnit', tr('gm'), 300, 40);
      const m1 = add('orgUnit', tr('techDept'), 120, 180);
      const m2 = add('orgUnit', tr('marketDept'), 480, 180);
      const e1 = add('orgTeam', tr('devTeam'), 60, 320);
      const e2 = add('orgTeam', tr('salesTeam'), 440, 320);
      link(ceo, m1);
      link(ceo, m2);
      link(m1, e1);
      link(m2, e2);
      break;
    }
    case 'mindMap': {
      const center = add('mindCenter', tr('topic'), 320, 240);
      const t1 = add('mindTopic', tr('topic1'), 60, 100);
      const t2 = add('mindTopic', tr('topic2'), 60, 300);
      const t3 = add('mindTopic', tr('topic3'), 620, 200);
      const s1 = add('mindSub', tr('point'), 620, 360);
      link(center, t1);
      link(center, t2);
      link(center, t3);
      link(t3, s1);
      break;
    }
    case 'approval': {
      const a = add('startEnd', tr('start'), 250, 40);
      const d = add('rect', tr('draft'), 225, 130);
      const r = add('rect', tr('review'), 225, 220);
      const g = add('decision', tr('approved'), 235, 310);
      const p = add('rect', tr('pass'), 90, 440);
      const j = add('rect', tr('reject'), 400, 440);
      const e = add('startEnd', tr('end'), 250, 540);
      link(a, d);
      link(d, r);
      link(r, g);
      link(g, p, tr('yes'));
      link(g, j, tr('no'));
      link(p, e);
      link(j, d, tr('reject'));
      break;
    }
    case 'onboarding': {
      const a = add('startEnd', tr('start'), 250, 40);
      const o = add('rect', tr('onboard'), 225, 130);
      const t = add('rect', tr('training'), 225, 220);
      const p = add('rect', tr('probation'), 225, 310);
      const g = add('decision', tr('approved'), 235, 400);
      const c = add('rect', tr('confirm'), 90, 520);
      const e = add('startEnd', tr('end'), 250, 620);
      link(a, o);
      link(o, t);
      link(t, p);
      link(p, g);
      link(g, c, tr('yes'));
      link(g, e, tr('no'));
      link(c, e);
      break;
    }
    case 'swimlane2': {
      const lane1 = add('swimlane', tr('laneSales'), 60, 60);
      const s1 = addChild('startEnd', tr('start'), 50, 82, lane1);
      const s2 = addChild('rect', tr('submit'), 220, 78, lane1);
      const s3 = addChild('startEnd', tr('end'), 640, 82, lane1);
      const lane2 = add('swimlane', tr('laneFinance'), 60, 320);
      const f1 = addChild('rect', tr('review'), 220, 338, lane2);
      const f2 = addChild('decision', tr('approved'), 420, 328, lane2);
      link(s1, s2);
      link(s2, f1);
      link(f1, f2);
      link(f2, s3, tr('yes'));
      break;
    }
    case 'umlComponent': {
      const c1 = add('umlPackage', tr('component'), 120, 120);
      const c2 = add('umlInterface', tr('serviceTask'), 420, 120);
      const c3 = add('umlPackage', tr('database'), 720, 120);
      link(c1, c2, tr('request'));
      link(c2, c3, tr('query'));
      break;
    }
    case 'bpmnCollab': {
      const pool = add('swimlane', tr('pool'), 60, 60);
      const start = addChild('bpmnEventStart', '', 40, 90, pool);
      const t1 = addChild('bpmnTask', tr('submit'), 170, 78, pool);
      const gw = addChild('bpmnGatewayExclusive', '', 380, 82, pool);
      const t2 = addChild('bpmnTask', tr('autoPass'), 520, 20, pool);
      const t3 = addChild('bpmnTask', tr('manualReview'), 520, 170, pool);
      const end = addChild('bpmnEventEnd', '', 760, 90, pool);
      const msg = add('bpmnTextAnnotation', tr('message'), 400, 300);
      link(start, t1);
      link(t1, gw);
      link(gw, t2, tr('amountSmall'));
      link(gw, t3, tr('amountLarge'));
      link(t2, end);
      link(t3, end);
      link(t1, msg);
      break;
    }
    case 'netSubnet': {
      const net = add('netCloud', tr('publicNet'), 320, 40);
      const gw = add('netRouter', tr('gateway'), 320, 170);
      const fw = add('netFirewall', tr('firewall'), 320, 290);
      const sub1 = add('swimlane', tr('subnet'), 40, 420);
      addChild('netServer', tr('appServer'), 40, 60, sub1);
      addChild('netDatabase', tr('database'), 300, 60, sub1);
      const sub2 = add('swimlane', tr('subnet'), 40, 660);
      addChild('netSwitch', tr('coreSwitch'), 40, 60, sub2);
      link(net, gw);
      link(gw, fw);
      link(fw, sub1);
      link(fw, sub2);
      link(sub1, sub2);
      break;
    }
    case 'erDiagram': {
      const e1 = add('erEntity', tr('user'), 100, 200);
      const e2 = add('erEntity', tr('order'), 460, 200);
      const rel = add('erRelationship', tr('placeOrder'), 300, 120);
      const a1 = add('erAttribute', tr('userId'), 100, 60);
      const a2 = add('erAttribute', tr('orderTime'), 460, 60);
      link(e1, rel);
      link(e2, rel);
      link(e1, a1);
      link(e2, a2);
      break;
    }
  }

  return { nodes, edges };
}

/** 模板内容包成完整 v2 文档（供 store.load 使用） */
export function buildTemplateDoc(
  kind: TemplateKind,
  tr: TemplateTranslator = fallbackTemplateTranslator,
): FlowDoc {
  const tpl = buildTemplate(kind, tr);
  return toDocV2(tpl.nodes, tpl.edges);
}
