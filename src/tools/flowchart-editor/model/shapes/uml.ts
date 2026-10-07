/**
 * UML 图形目录（聚合层）：按 UML 2.5 图种拆分为 9 个分类文件，
 * 这里只做拼接导出，`shapes/index.ts` 的 import 保持不变。
 * 共享 path 生成函数见 `./uml-paths`。
 */

import type { ShapeDef } from './index';
import { UML_COMMON_SHAPES } from './uml-common';
import { UML_USECASE_SHAPES } from './uml-usecase';
import { UML_CLASS_SHAPES } from './uml-class';
import { UML_OBJECT_SHAPES } from './uml-object';
import { UML_SEQUENCE_SHAPES } from './uml-sequence';
import { UML_ACTIVITY_SHAPES } from './uml-activity';
import { UML_STATE_SHAPES } from './uml-state';
import { UML_COMPONENT_SHAPES } from './uml-component';
import { UML_DEPLOYMENT_SHAPES } from './uml-deployment';

export const UML_SHAPES: ShapeDef[] = [
  ...UML_COMMON_SHAPES,
  ...UML_USECASE_SHAPES,
  ...UML_CLASS_SHAPES,
  ...UML_OBJECT_SHAPES,
  ...UML_SEQUENCE_SHAPES,
  ...UML_ACTIVITY_SHAPES,
  ...UML_STATE_SHAPES,
  ...UML_COMPONENT_SHAPES,
  ...UML_DEPLOYMENT_SHAPES,
];
