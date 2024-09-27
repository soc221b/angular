/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {PartialEvaluator} from '@angular/compiler-cli/private/migrations';
import {
  getAngularDecorators,
  queryDecoratorNames,
} from '@angular/compiler-cli/src/ngtsc/annotations';
import {extractDecoratorQueryMetadata} from '@angular/compiler-cli/src/ngtsc/annotations/directive';
import {ReflectionHost} from '@angular/compiler-cli/src/ngtsc/reflection';
import ts from 'typescript';
import {R3QueryMetadata} from '../../../../compiler';
import {ProgramInfo} from '../../utils/tsurge';
import {ClassFieldUniqueKey} from '../signal-migration/src/passes/reference_resolution/known_fields';
import {getUniqueIDForClassProperty} from './field_tracking';

/** Type describing an extracted decorator query that can be migrated. */
export interface ExtractedQuery {
  id: ClassFieldUniqueKey;
  kind: 'viewChild' | 'viewChildren' | 'contentChild' | 'contentChildren';
  args: ts.Expression[];
  queryInfo: R3QueryMetadata;
  node: ts.PropertyDeclaration;
}

/**
 * Determines if the given node refers to a decorator-based query, and
 * returns its resolved metadata if possible.
 */
export function extractSourceQueryDefinition(
  node: ts.Node,
  reflector: ReflectionHost,
  evaluator: PartialEvaluator,
  info: ProgramInfo,
): ExtractedQuery | null {
  if (
    !ts.isPropertyDeclaration(node) ||
    !ts.isClassDeclaration(node.parent) ||
    node.parent.name === undefined ||
    !ts.isIdentifier(node.name)
  ) {
    return null;
  }

  const decorators = reflector.getDecoratorsOfDeclaration(node) ?? [];
  const ngDecorators = getAngularDecorators(decorators, queryDecoratorNames, /* isCore */ false);
  if (ngDecorators.length === 0) {
    return null;
  }
  const decorator = ngDecorators[0];

  const id = getUniqueIDForClassProperty(node, info);
  if (id === null) {
    return null;
  }

  let kind: ExtractedQuery['kind'];
  if (decorator.name === 'ViewChild') {
    kind = 'viewChild';
  } else if (decorator.name === 'ViewChildren') {
    kind = 'viewChildren';
  } else if (decorator.name === 'ContentChild') {
    kind = 'contentChild';
  } else if (decorator.name === 'ContentChildren') {
    kind = 'contentChildren';
  } else {
    throw new Error('Unexpected query decorator detected.');
  }

  const queryInfo = extractDecoratorQueryMetadata(
    node,
    decorator.name,
    decorator.args ?? [],
    node.name.text,
    reflector,
    evaluator,
  );

  return {
    id,
    kind,
    args: decorator.args ?? [],
    queryInfo,
    node,
  };
}