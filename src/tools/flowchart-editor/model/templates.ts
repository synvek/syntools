/**
 * 模板库：按图种分类提供起始图。
 * 模板内容是「一页」的节点与连线；需要完整文档时用 buildTemplateDoc。
 */

import { createId, defaultData } from '../core';
import { toDocV2 } from './migrate';
import type { FlowDoc, FlowEdgeRec, FlowNodeRec, ShapeKind } from './types';

export type TemplateKind =
  // 流程图
  | 'basic'
  | 'decision'
  | 'swimlane'
  | 'swimlaneV'
  // UML
  | 'umlUseCase'
  | 'umlClass'
  | 'umlSequence'
  | 'umlActivity'
  | 'umlState'
  // BPMN
  | 'bpmn'
  | 'bpmnProcess'
  // 其它图种
  | 'netTopology'
  | 'orgChart'
  | 'mindMap'
  | 'erDiagram';

export type TemplateCategory = 'flow' | 'uml' | 'bpmn' | 'network' | 'org' | 'mind' | 'er';

export interface TemplateDef {
  kind: TemplateKind;
  category: TemplateCategory;
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
  { kind: 'basic', category: 'flow' },
  { kind: 'decision', category: 'flow' },
  { kind: 'swimlane', category: 'flow' },
  { kind: 'swimlaneV', category: 'flow' },
  { kind: 'umlUseCase', category: 'uml' },
  { kind: 'umlClass', category: 'uml' },
  { kind: 'umlSequence', category: 'uml' },
  { kind: 'umlActivity', category: 'uml' },
  { kind: 'umlState', category: 'uml' },
  { kind: 'bpmn', category: 'bpmn' },
  { kind: 'bpmnProcess', category: 'bpmn' },
  { kind: 'netTopology', category: 'network' },
  { kind: 'orgChart', category: 'org' },
  { kind: 'mindMap', category: 'mind' },
  { kind: 'erDiagram', category: 'er' },
];

/** 模板内容是「一页」的节点与连线 */
export interface TemplateContent {
  nodes: FlowNodeRec[];
  edges: FlowEdgeRec[];
}

export function buildTemplate(kind: TemplateKind): TemplateContent {
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
      const a = add('startEnd', '开始', 240, 40);
      const b = add('rect', '处理步骤', 215, 140);
      const c = add('rect', '处理步骤', 215, 240);
      const d = add('startEnd', '结束', 240, 340);
      link(a, b);
      link(b, c);
      link(c, d);
      break;
    }
    case 'decision': {
      const a = add('startEnd', '开始', 260, 40);
      const b = add('decision', '条件成立?', 235, 140);
      const c = add('rect', '分支 A', 80, 280);
      const e = add('rect', '分支 B', 410, 280);
      const f = add('startEnd', '结束', 260, 380);
      link(a, b);
      link(b, c, '是');
      link(b, e, '否');
      link(c, f);
      link(e, f);
      break;
    }
    case 'swimlane': {
      const lane = add('swimlane', '横向泳道', 60, 60);
      const a = addChild('startEnd', '开始', 50, 82, lane);
      const b = addChild('rect', '步骤 1', 220, 78, lane);
      const c = addChild('rect', '步骤 2', 410, 78, lane);
      const d = addChild('startEnd', '结束', 600, 82, lane);
      link(a, b);
      link(b, c);
      link(c, d);
      break;
    }
    case 'swimlaneV': {
      const lane = add('swimlaneV', '纵向泳道', 60, 60);
      const a = addChild('startEnd', '开始', 55, 65, lane);
      const b = addChild('rect', '步骤 1', 45, 170, lane);
      const c = addChild('rect', '步骤 2', 45, 300, lane);
      const d = addChild('startEnd', '结束', 55, 430, lane);
      link(a, b);
      link(b, c);
      link(c, d);
      break;
    }
    case 'umlUseCase': {
      const actor = add('umlActor', '用户', 80, 180);
      const u1 = add('umlUseCase', '登录系统', 300, 100);
      const u2 = add('umlUseCase', '查看报表', 300, 260);
      link(actor, u1);
      link(actor, u2);
      break;
    }
    case 'umlClass': {
      const c1 = add('umlClass', '订单', 120, 80);
      const c2 = add('umlClass', '订单明细', 460, 80);
      link(c1, c2, '1 : n');
      break;
    }
    case 'umlSequence': {
      const l1 = add('umlLifeline', '用户', 80, 60);
      const l2 = add('umlLifeline', '服务', 340, 60);
      const l3 = add('umlLifeline', '数据库', 600, 60);
      link(l1, l2, '请求');
      link(l2, l3, '查询');
      link(l3, l2, '结果');
      break;
    }
    case 'umlActivity': {
      const s = add('umlStateInitial', '', 300, 40);
      const a1 = add('umlState', '提交申请', 250, 120);
      const g = add('decision', '审核通过?', 235, 230);
      const a2 = add('umlState', '归档', 250, 360);
      const e = add('umlStateFinal', '', 300, 470);
      link(s, a1);
      link(a1, g);
      link(g, a2, '通过');
      link(a2, e);
      break;
    }
    case 'umlState': {
      const s = add('umlStateInitial', '', 120, 180);
      const st1 = add('umlState', '待支付', 260, 160);
      const st2 = add('umlState', '已支付', 480, 160);
      const e = add('umlStateFinal', '', 660, 180);
      link(s, st1);
      link(st1, st2, '支付成功');
      link(st2, e);
      break;
    }
    case 'bpmn': {
      const a = add('bpmnTask', '开始事件', 235, 40);
      const b = add('bpmnTask', '用户任务', 220, 150);
      const c = add('bpmnTask', '服务任务', 220, 250);
      const d = add('bpmnTask', '结束事件', 235, 360);
      link(a, b);
      link(b, c);
      link(c, d);
      break;
    }
    case 'bpmnProcess': {
      const start = add('bpmnEventStart', '', 60, 160);
      const t1 = add('bpmnTask', '提交申请', 170, 146);
      const gw = add('bpmnGatewayExclusive', '', 360, 150);
      const t2 = add('bpmnTask', '自动通过', 470, 60);
      const t3 = add('bpmnTask', '人工审核', 470, 240);
      const end = add('bpmnEventEnd', '', 680, 160);
      link(start, t1);
      link(t1, gw);
      link(gw, t2, '金额 < 1k');
      link(gw, t3, '金额 ≥ 1k');
      link(t2, end);
      link(t3, end);
      break;
    }
    case 'netTopology': {
      const cloud = add('netCloud', '公网', 300, 40);
      const router = add('netRouter', '边界路由', 300, 180);
      const fw = add('netFirewall', '防火墙', 300, 300);
      const sw = add('netSwitch', '核心交换', 200, 420);
      const srv = add('netServer', '应用服务器', 60, 540);
      const db = add('netDatabase', '数据库', 360, 540);
      link(cloud, router);
      link(router, fw);
      link(fw, sw);
      link(sw, srv);
      link(sw, db);
      break;
    }
    case 'orgChart': {
      const ceo = add('orgUnit', '总经理', 300, 40);
      const m1 = add('orgUnit', '技术部', 120, 180);
      const m2 = add('orgUnit', '市场部', 480, 180);
      const e1 = add('orgTeam', '开发组', 60, 320);
      const e2 = add('orgTeam', '销售组', 440, 320);
      link(ceo, m1);
      link(ceo, m2);
      link(m1, e1);
      link(m2, e2);
      break;
    }
    case 'mindMap': {
      const center = add('mindCenter', '主题', 320, 240);
      const t1 = add('mindTopic', '分支一', 60, 100);
      const t2 = add('mindTopic', '分支二', 60, 300);
      const t3 = add('mindTopic', '分支三', 620, 200);
      const s1 = add('mindSub', '要点', 620, 360);
      link(center, t1);
      link(center, t2);
      link(center, t3);
      link(t3, s1);
      break;
    }
    case 'erDiagram': {
      const e1 = add('erEntity', '用户', 100, 200);
      const e2 = add('erEntity', '订单', 460, 200);
      const rel = add('erRelationship', '下单', 300, 120);
      const a1 = add('erAttribute', '用户ID', 100, 60);
      const a2 = add('erAttribute', '下单时间', 460, 60);
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
export function buildTemplateDoc(kind: TemplateKind): FlowDoc {
  const tpl = buildTemplate(kind);
  return toDocV2(tpl.nodes, tpl.edges);
}
