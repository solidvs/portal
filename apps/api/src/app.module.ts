import { Global, Module, type DynamicModule } from '@nestjs/common';
import { PlatformModule, type IdentityProvider, type ServiceTokenVerifier } from '@solidvs/server';

import type { Config } from './config.js';
import { databaseModule } from './database.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { DefinitionsModule } from './modules/definitions/definitions.module.js';
import { GitHubModule } from './modules/github/github.module.js';
import { KnowledgeModule } from './modules/knowledge/knowledge.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';
import { OverviewModule } from './modules/overview/overview.module.js';
import { SYSTEM } from './system.js';
import { CONFIG } from './tokens.js';

/**
 * Root module of the IT portal. Who may enter and what roles exist are declared here (ADR-0009):
 * the IT department enters; roles that change data come from directory groups only. Definitions
 * (ADR-0014): editors write drafts, administrators publish.
 */
type AppOptions = {
  identityProvider?: IdentityProvider;
  serviceTokenVerifier?: ServiceTokenVerifier;
  /** Replaces the database: `TestDataModule.forRoot()` of @solidvs/server/testing in HTTP tests. */
  database?: DynamicModule;
};

@Global()
@Module({})
export class AppModule {
  static forRoot(config: Config, options: AppOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PlatformModule.forRoot({
          system: SYSTEM.id,
          config,
          access: { departments: ['TI'] },
          roles: { admin: { groups: ['GRP-Portal-Admins'] }, editor: { groups: ['GRP-Portal-Editors'] } },
          ...(options.identityProvider ? { identityProvider: options.identityProvider } : {}),
          ...(options.serviceTokenVerifier ? { serviceTokenVerifier: options.serviceTokenVerifier } : {}),
        }),
        options.database ?? databaseModule(config),
        GitHubModule,
        CatalogModule,
        OperationsModule,
        KnowledgeModule,
        OverviewModule,
        DefinitionsModule,
      ],
      providers: [{ provide: CONFIG, useValue: config }],
      exports: [CONFIG],
    };
  }
}
