import { Global, Module } from '@nestjs/common';

import type { Config } from '../../config.js';
import { CONFIG } from '../../tokens.js';
import { AppAuth, TokenAuth } from './infrastructure/github-auth.js';
import { GitHubClient } from './infrastructure/github-client.js';

/** Read-only GitHub access for every module: GitHub App in staging and production, token locally. */
@Global()
@Module({
  providers: [
    {
      provide: GitHubClient,
      inject: [CONFIG],
      useFactory: (config: Config) => {
        const auth =
          config.GITHUB_APP_ID && config.GITHUB_APP_PRIVATE_KEY && config.GITHUB_APP_INSTALLATION_ID
            ? new AppAuth(config.GITHUB_APP_ID, config.GITHUB_APP_PRIVATE_KEY, config.GITHUB_APP_INSTALLATION_ID)
            : new TokenAuth(config.GITHUB_TOKEN!);
        return new GitHubClient(auth, config.GITHUB_CACHE_MINUTES * 60_000);
      },
    },
  ],
  exports: [GitHubClient],
})
export class GitHubModule {}
