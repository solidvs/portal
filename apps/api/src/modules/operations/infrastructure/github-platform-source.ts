import type { GitHubClient } from '../../github/infrastructure/github-client.js';
import type { PlatformSource } from '../application/operations.js';
import { environmentFile, imageOf, systemOfFile, type DeployChange, type EnvironmentName } from '../domain/operations.js';

type CommitJson = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } | null };
  author: { login: string } | null;
};

/** The platform repository over GitHub: files per environment and their history. */
export class GitHubPlatformSource implements PlatformSource {
  constructor(
    private readonly github: GitHubClient,
    private readonly org: string,
    private readonly platformRepository: string,
  ) {}

  async systemsIn(environment: EnvironmentName): Promise<string[]> {
    const files = await this.github.directory(this.org, this.platformRepository, `environments/${environment}`);
    return files.map((f) => systemOfFile(f.name)).filter((s): s is string => s !== undefined);
  }

  async image(system: string, environment: EnvironmentName) {
    const path = environmentFile(system, environment);
    const text = await this.github.file(this.org, this.platformRepository, path);
    const image = text ? imageOf(text) : undefined;
    return image ? { ...image, url: `https://github.com/${this.org}/${this.platformRepository}/blob/main/${path}` } : undefined;
  }

  async changes(system: string, environment: EnvironmentName): Promise<DeployChange[]> {
    const path = environmentFile(system, environment);
    const commits = await this.github.json<CommitJson[]>(
      `/repos/${this.org}/${this.platformRepository}/commits?path=${encodeURIComponent(path)}&per_page=30`,
    );
    return commits.map((c) => ({
      system,
      environment,
      sha: c.sha,
      message: c.commit.message.split('\n')[0] ?? '',
      author: c.author?.login ?? c.commit.author?.name ?? null,
      date: c.commit.author?.date ?? '',
      url: c.html_url,
    }));
  }
}
