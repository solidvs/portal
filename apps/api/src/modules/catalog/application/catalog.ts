import { buildCatalog, type CatalogEntry, type Manifest, type RepositoryFacts } from '../domain/catalog.js';

/** What the catalog needs from the outside world (implemented over GitHub). */
export interface CatalogSource {
  repositories(): Promise<RepositoryFacts[]>;
  /** The repository's own `catalog-info.yaml`, if present and valid. */
  repositoryManifest(repository: string): Promise<Manifest | undefined>;
  /** Entries of the central catalog repository (legacy systems, infrastructure). */
  centralManifests(): Promise<Manifest[]>;
}

/** Use case: the whole catalog, and one entry. */
export class CatalogQueries {
  constructor(private readonly source: CatalogSource) {}

  async list(): Promise<CatalogEntry[]> {
    const [repositories, central] = await Promise.all([this.source.repositories(), this.source.centralManifests()]);
    const withManifests = await Promise.all(
      repositories.map(async (facts) => ({ facts, manifest: await this.source.repositoryManifest(facts.name) })),
    );
    return buildCatalog(withManifests, central);
  }

  async find(id: string): Promise<CatalogEntry | undefined> {
    return (await this.list()).find((entry) => entry.id === id);
  }
}
