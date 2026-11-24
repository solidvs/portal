import { Module } from '@nestjs/common';

import type { Config } from '../../config.js';
import { CONFIG } from '../../tokens.js';
import { GitHubClient } from '../github/infrastructure/github-client.js';
import { CatalogQueries } from './application/catalog.js';
import { CatalogController } from './http/catalog.controller.js';
import { GitHubCatalogSource } from './infrastructure/github-catalog-source.js';

@Module({
  controllers: [CatalogController],
  providers: [
    {
      provide: CatalogQueries,
      inject: [GitHubClient, CONFIG],
      useFactory: (github: GitHubClient, config: Config) =>
        new CatalogQueries(new GitHubCatalogSource(github, config.GITHUB_ORG, config.CATALOG_REPO)),
    },
  ],
  exports: [CatalogQueries],
})
export class CatalogModule {}
