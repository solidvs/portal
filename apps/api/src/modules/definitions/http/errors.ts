import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { ConcurrentChange, DefinitionRuleError, InvalidDefinitionValue, UnknownDefinition } from '../application/definitions.js';

/** Use-case errors as HTTP answers; messages are for the maintainer, in Portuguese. */
export function asHttpError(error: unknown): unknown {
  if (error instanceof UnknownDefinition) return new NotFoundException('tipo de definição desconhecido');
  if (error instanceof InvalidDefinitionValue) return new UnprocessableEntityException(error.problems);
  if (error instanceof DefinitionRuleError) return new UnprocessableEntityException(error.message);
  if (error instanceof ConcurrentChange) return new ConflictException('a definição mudou enquanto você editava; recarregue e tente de novo');
  return error;
}
