import { Module } from '@nestjs/common';

import type { Config } from '../../config.js';
import { CONFIG } from '../../tokens.js';
import { GitHubClient } from '../github/infrastructure/github-client.js';
import { OperationsQueries } from './application/operations.js';
import { OperationsController } from './http/operations.controller.js';
import { GitHubPlatformSource } from './infrastructure/github-platform-source.js';

@Module({
  controllers: [OperationsController],
  providers: [
    {
      provide: OperationsQueries,
      inject: [GitHubClient, CONFIG],
      useFactory: (github: GitHubClient, config: Config) =>
        new OperationsQueries(new GitHubPlatformSource(github, config.GITHUB_ORG, config.PLATFORM_REPO)),
    },
  ],
  exports: [OperationsQueries],
})
export class OperationsModule {}
