import { Module } from '@nestjs/common';

import type { Config } from '../../config.js';
import { CONFIG } from '../../tokens.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { GitHubClient } from '../github/infrastructure/github-client.js';
import { KnowledgeQueries } from './application/knowledge.js';
import { KnowledgeController } from './http/knowledge.controller.js';
import { GitHubDocumentsSource } from './infrastructure/github-documents-source.js';

@Module({
  imports: [CatalogModule],
  controllers: [KnowledgeController],
  providers: [
    {
      provide: KnowledgeQueries,
      inject: [GitHubClient, CONFIG],
      useFactory: (github: GitHubClient, config: Config) =>
        new KnowledgeQueries(new GitHubDocumentsSource(github, config.GITHUB_ORG), config.STANDARDS_REPO),
    },
  ],
})
export class KnowledgeModule {}
