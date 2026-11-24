import { Module } from '@nestjs/common';
import { AuditTrail } from '@solidvs/server';

import { Definitions, type DefinitionRepository } from './application/definitions.js';
import { AdminDefinitionsController } from './http/admin-definitions.controller.js';
import { PublicDefinitionsController } from './http/public-definitions.controller.js';
import { ServiceDefinitionsController } from './http/service-definitions.controller.js';
import { PlatformDefinitionKinds } from './infrastructure/platform-definition-kinds.js';
import { PrismaDefinitionRepository } from './infrastructure/prisma-definition-repository.js';

/** Injection token of the repository; HTTP tests replace it with an in-memory one. */
export const DEFINITION_REPOSITORY = Symbol('DEFINITION_REPOSITORY');

/** Administered definitions (ADR-0014): the portal as control plane. */
@Module({
  controllers: [AdminDefinitionsController, ServiceDefinitionsController, PublicDefinitionsController],
  providers: [
    { provide: DEFINITION_REPOSITORY, useClass: PrismaDefinitionRepository },
    {
      provide: Definitions,
      inject: [DEFINITION_REPOSITORY, AuditTrail],
      useFactory: (repository: DefinitionRepository, audit: AuditTrail) => new Definitions(new PlatformDefinitionKinds(), repository, audit),
    },
  ],
})
export class DefinitionsModule {}
