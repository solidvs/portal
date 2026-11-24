import { parse } from 'yaml';
import { z } from 'zod';

/** A system as the catalog describes it. */
export type CatalogEntry = {
  id: string;
  name: string;
  description: string | null;
  type: 'web' | 'api' | 'integration' | 'job' | 'unknown';
  lifecycle: 'development' | 'production' | 'deprecated' | 'unknown';
  owner: string | null;
  surfaces: string[];
  stack: string | null;
  dependsOn: string[];
  manifest: 'repository' | 'central' | 'none';
  repository: { name: string; url: string; language: string | null; pushedAt: string | null; archived: boolean } | null;
};

export type RepositoryFacts = {
  name: string;
  url: string;
  description: string | null;
  language: string | null;
  pushedAt: string | null;
  archived: boolean;
};

/** Schema of `catalog-info.yaml` (solidvs/catalog/v1). Unknown fields are ignored. */
const manifestSchema = z.object({
  apiVersion: z.literal('solidvs/catalog/v1'),
  kind: z.literal('System'),
  metadata: z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    name: z.string().min(1),
    description: z.string().optional(),
  }),
  spec: z
    .object({
      type: z.enum(['web', 'api', 'integration', 'job']).optional(),
      lifecycle: z.enum(['development', 'production', 'deprecated']).optional(),
      owner: z.string().optional(),
      surfaces: z.array(z.string()).optional(),
      stack: z.string().optional(),
      dependsOn: z.array(z.string()).optional(),
      repository: z.string().optional(),
    })
    .default({}),
});

export type Manifest = z.infer<typeof manifestSchema>;

/** Parses a manifest; returns undefined when the text is not a valid catalog manifest. */
export function parseManifest(text: string): Manifest | undefined {
  try {
    const result = manifestSchema.safeParse(parse(text));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/** A catalog entry from a manifest, enriched with what GitHub knows about the repository. */
export function entryFromManifest(manifest: Manifest, source: 'repository' | 'central', repository: RepositoryFacts | null): CatalogEntry {
  const { metadata, spec } = manifest;
  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description?.trim() || repository?.description || null,
    type: spec.type ?? 'unknown',
    lifecycle: spec.lifecycle ?? 'unknown',
    owner: spec.owner ?? null,
    surfaces: spec.surfaces ?? [],
    stack: spec.stack ?? null,
    dependsOn: spec.dependsOn ?? [],
    manifest: source,
    repository: repository ? toRepository(repository) : null,
  };
}

/** A repository with no manifest anywhere still appears, so gaps are visible. */
export function entryFromRepository(repository: RepositoryFacts): CatalogEntry {
  return {
    id: repository.name,
    name: repository.name,
    description: repository.description,
    type: 'unknown',
    lifecycle: repository.archived ? 'deprecated' : 'unknown',
    owner: null,
    surfaces: [],
    stack: null,
    dependsOn: [],
    manifest: 'none',
    repository: toRepository(repository),
  };
}

function toRepository(repository: RepositoryFacts): NonNullable<CatalogEntry['repository']> {
  return {
    name: repository.name,
    url: repository.url,
    language: repository.language,
    pushedAt: repository.pushedAt,
    archived: repository.archived,
  };
}

/**
 * Builds the catalog: a manifest in the repository wins over a central entry, which wins over the
 * bare repository; central entries without a repository (servers, databases) are kept; the result
 * is sorted by name.
 */
export function buildCatalog(
  repositories: { facts: RepositoryFacts; manifest: Manifest | undefined }[],
  central: Manifest[],
): CatalogEntry[] {
  const byRepository = new Map(central.filter((m) => m.spec.repository).map((m) => [m.spec.repository!, m]));
  const entries = new Map<string, CatalogEntry>();

  for (const { facts, manifest } of repositories) {
    const entry = manifest
      ? entryFromManifest(manifest, 'repository', facts)
      : byRepository.has(facts.name)
        ? entryFromManifest(byRepository.get(facts.name)!, 'central', facts)
        : entryFromRepository(facts);
    entries.set(entry.id, entry);
  }
  for (const manifest of central) {
    if (!entries.has(manifest.metadata.id) && !manifest.spec.repository) {
      entries.set(manifest.metadata.id, entryFromManifest(manifest, 'central', null));
    }
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
