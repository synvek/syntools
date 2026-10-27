/**
 * UML shape catalog (aggregation layer): split into 9 category files by UML 2.5 diagram type,
 * and this file only re-exports them so the imports in `shapes/index.ts` stay unchanged.
 * Shared path generators live in `./uml-paths`.
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
