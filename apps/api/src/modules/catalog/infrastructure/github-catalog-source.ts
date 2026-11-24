import type { GitHubClient } from '../../github/infrastructure/github-client.js';
import type { CatalogSource } from '../application/catalog.js';
import { parseManifest, type Manifest, type RepositoryFacts } from '../domain/catalog.js';

type RepositoryJson = {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  pushed_at: string | null;
  archived: boolean;
  is_template: boolean;
};

/** Catalog over GitHub: the organization's repositories, their manifests, the central catalog. */
export class GitHubCatalogSource implements CatalogSource {
  constructor(
    private readonly github: GitHubClient,
    private readonly org: string,
    private readonly catalogRepository: string,
  ) {}

  async repositories(): Promise<RepositoryFacts[]> {
    const repositories = await this.github.json<RepositoryJson[]>(`/orgs/${this.org}/repos?per_page=100&type=all`);
    return repositories
      .filter((r) => !r.is_template && r.name !== this.catalogRepository && r.name !== '.github')
      .map((r) => ({ name: r.name, url: r.html_url, description: r.description, language: r.language, pushedAt: r.pushed_at, archived: r.archived }));
  }

  async repositoryManifest(repository: string): Promise<Manifest | undefined> {
    const text = await this.github.file(this.org, repository, 'catalog-info.yaml');
    return text ? parseManifest(text) : undefined;
  }

  async centralManifests(): Promise<Manifest[]> {
    const files = await this.github.directory(this.org, this.catalogRepository, 'systems');
    const manifests = await Promise.all(
      files
        .filter((f) => f.type === 'file' && /\.ya?ml$/.test(f.name))
        .map(async (f) => {
          const text = await this.github.file(this.org, this.catalogRepository, f.path);
          return text ? parseManifest(text) : undefined;
        }),
    );
    return manifests.filter((m): m is Manifest => m !== undefined);
  }
}
